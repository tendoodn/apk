//! Rust Fighter TV: multiplayer pairing, controls, physics and match rules run on the Rust server.
//! TV + mobile are thin HTML5 clients; no account or external API required on the local network.
use std::{collections::{HashMap, HashSet}, net::SocketAddr, sync::{Arc, Mutex}, time::{Duration, Instant}};

use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tower_http::services::ServeDir;

const FPS: u32 = 30;
const COUNTDOWN_TICKS: u32 = FPS * 3;
const ROUND_TICKS: u32 = FPS * 75;
const ROUND_BREAK_TICKS: u32 = FPS * 3;
const ROSTER_LEN: usize = 10;
const WORLD_W: f32 = 1280.0;
const RUN_SPEED: f32 = 5.2;

type Outbox = mpsc::UnboundedSender<Message>;
type Shared = Arc<Mutex<ServerState>>;

#[derive(Clone)]
struct Client {
    connection_id: u64,
    tx: Outbox,
}

#[derive(Clone, Copy, Default, Debug, Deserialize, Serialize)]
#[serde(default)]
struct Input {
    left: bool,
    right: bool,
    up: bool,
    light: bool,
    heavy: bool,
    special: bool,
    guard: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase { Lobby, Countdown, Fight, RoundEnd, Paused, MatchEnd }
impl Phase {
    fn label(self) -> &'static str {
        match self {
            Self::Lobby => "lobby", Self::Countdown => "countdown", Self::Fight => "fight",
            Self::RoundEnd => "round_end", Self::Paused => "paused", Self::MatchEnd => "match_end",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Attack { Light, Heavy, Special }
impl Attack {
    fn label(self) -> &'static str { match self { Self::Light => "light", Self::Heavy => "heavy", Self::Special => "special" } }
    fn total_frames(self) -> u8 { match self { Self::Light => 12, Self::Heavy => 21, Self::Special => 30 } }
    fn hit_frame(self) -> u8 { match self { Self::Light => 8, Self::Heavy => 14, Self::Special => 19 } }
    fn reach(self) -> f32 { match self { Self::Light => 115.0, Self::Heavy => 145.0, Self::Special => 205.0 } }
    fn damage(self) -> i32 { match self { Self::Light => 9, Self::Heavy => 16, Self::Special => 23 } }
}

#[derive(Clone, Copy, Debug)]
struct AttackState { kind: Attack, frames: u8, connected: bool }

#[derive(Clone, Debug)]
struct Fighter {
    x: f32,
    y: f32,
    vy: f32,
    hp: i32,
    meter: f32,
    stun: u8,
    cooldown: u8,
    attack: Option<AttackState>,
    input: Input,
    previous: Input,
    facing: i32,
    grounded: bool,
    guarding: bool,
}
impl Fighter {
    fn new(x: f32, facing: i32) -> Self {
        Self { x, y: 0.0, vy: 0.0, hp: 100, meter: 0.0, stun: 0, cooldown: 0, attack: None,
            input: Input::default(), previous: Input::default(), facing, grounded: true, guarding: false }
    }
    fn snapshot(&self) -> Value {
        let (attack, attack_frames) = match self.attack {
            Some(a) => (a.kind.label(), a.frames), None => ("", 0),
        };
        json!({"x": self.x.round(), "y": self.y.round(), "hp": self.hp,
            "meter": self.meter.round(), "stun": self.stun, "facing": self.facing,
            "guarding": self.guarding, "attack": attack, "attack_frames": attack_frames,
            "moving": self.input.left || self.input.right,
            "jumping": !self.grounded })
    }
}

struct GameRoom {
    id: String,
    mode: usize,
    codes: [String; 2],
    tv: Option<Client>,
    remotes: [Option<Client>; 2],
    phase: Phase,
    picks: [usize; 2],
    ready: [bool; 2],
    rematch: [bool; 2],
    fighters: [Fighter; 2],
    round: u8,
    scores: [u8; 2],
    reversed: bool,
    phase_ticks: u32,
    round_ticks: u32,
    message: String,
    last_seen: Instant,
}
impl GameRoom {
    fn new(id: String, mode: usize, codes: [String;2], tv: Client) -> Self {
        Self { id, mode, codes, tv: Some(tv), remotes: [None, None],
            phase: Phase::Lobby, picks: [0, 5], ready: [false, mode == 1],
            rematch: [false, false], fighters: [Fighter::new(340.0, 1), Fighter::new(940.0, -1)],
            round: 1, scores: [0, 0], reversed: false, phase_ticks: 0,
            round_ticks: ROUND_TICKS, message: String::new(), last_seen: Instant::now() }
    }
    fn remote_present(&self, idx: usize) -> bool { (idx == 1 && self.mode == 1) || self.remotes[idx].is_some() }
    fn all_present(&self) -> bool { self.mode != 0 && self.remote_present(0) && self.remote_present(1) }
    fn all_ready(&self) -> bool { self.ready[0] && self.ready[1] }
    fn reset_fighters(&mut self) {
        let x = if self.reversed { [940.0, 340.0] } else { [340.0, 940.0] };
        self.fighters = [Fighter::new(x[0], if self.reversed { -1 } else { 1 }),
                         Fighter::new(x[1], if self.reversed { 1 } else { -1 })];
        self.round_ticks = ROUND_TICKS;
    }
    fn set_phase(&mut self, next: Phase, ticks: u32) { self.phase = next; self.phase_ticks = ticks; }
    fn start_match(&mut self) {
        self.round = 1; self.scores = [0, 0]; self.reversed = false; self.rematch = [false, false];
        self.reset_fighters(); self.message.clear(); self.set_phase(Phase::Countdown, COUNTDOWN_TICKS);
    }
    fn round_winner(&mut self) {
        let a = self.fighters[0].hp;
        let b = self.fighters[1].hp;
        self.message = if a > b { self.scores[0] += 1; "NGƯỜI CHƠI 1 THẮNG HIỆP".into() }
            else if b > a { self.scores[1] += 1; "NGƯỜI CHƠI 2 THẮNG HIỆP".into() }
            else { "HIỆP HÒA".into() };
        self.set_phase(Phase::RoundEnd, ROUND_BREAK_TICKS);
    }
    fn finish_match(&mut self) {
        self.message = if self.scores[0] > self.scores[1] { "NGƯỜI CHƠI 1 CHIẾN THẮNG!".into() }
            else if self.scores[1] > self.scores[0] {
                if self.mode == 1 { "MÁY CHIẾN THẮNG!".into() } else { "NGƯỜI CHƠI 2 CHIẾN THẮNG!".into() }
            } else { "TRẬN ĐẤU HÒA!".into() };
        self.set_phase(Phase::MatchEnd, 0);
    }
    fn tick(&mut self) {
        if self.tv.is_none() { return; }
        if !self.all_present() && matches!(self.phase, Phase::Countdown | Phase::Fight) {
            self.set_phase(Phase::Paused, 0);
        }
        if self.phase == Phase::Paused {
            if self.all_present() { self.set_phase(Phase::Countdown, COUNTDOWN_TICKS); }
            return;
        }
        match self.phase {
            Phase::Lobby => { if self.all_present() && self.all_ready() { self.start_match(); } }
            Phase::Countdown => {
                if self.phase_ticks > 0 { self.phase_ticks -= 1; }
                if self.phase_ticks == 0 { self.set_phase(Phase::Fight, 0); }
            }
            Phase::Fight => {
                self.step_fighters();
                if self.round_ticks > 0 { self.round_ticks -= 1; }
                if self.round_ticks == 0 || self.fighters.iter().any(|f| f.hp == 0) { self.round_winner(); }
            }
            Phase::RoundEnd => {
                if self.phase_ticks > 0 { self.phase_ticks -= 1; }
                if self.phase_ticks == 0 {
                    if self.round == 3 { self.finish_match(); }
                    else {
                        self.round += 1;
                        self.reversed = !self.reversed;
                        self.reset_fighters();
                        self.set_phase(Phase::Countdown, COUNTDOWN_TICKS);
                    }
                }
            }
            Phase::MatchEnd => {
                if self.rematch[0] && self.rematch[1] {
                    self.ready = [false, self.mode == 1]; self.rematch = [false, false];
                    self.set_phase(Phase::Lobby, 0);
                }
            }
            Phase::Paused => {}
        }
    }
    fn step_fighters(&mut self) {
        if self.mode == 1 { self.ai_tick(); }
        let char_speed = |idx: usize| -> f32 { 0.83 + (idx % 5) as f32 * 0.09 };
        for i in 0..2 {
            let opponent_x = self.fighters[1-i].x;
            let f = &mut self.fighters[i];
            f.facing = if f.x < opponent_x { 1 } else { -1 };
            if f.cooldown > 0 { f.cooldown -= 1; }
            if f.stun > 0 { f.stun -= 1; }
            f.guarding = f.input.guard && f.stun == 0 && f.grounded && f.attack.is_none();
            if f.stun == 0 && f.attack.is_none() {
                if f.input.left != f.input.right && !f.guarding {
                    f.x += if f.input.left { -1.0 } else { 1.0 } * RUN_SPEED * char_speed(self.picks[i]);
                }
                if f.input.up && f.grounded && !f.guarding {
                    f.vy = 15.5; f.grounded = false;
                }
                if f.cooldown == 0 && !f.guarding {
                    let kind = if f.input.special && !f.previous.special && f.meter >= 50.0 {
                        Some(Attack::Special)
                    } else if f.input.heavy && !f.previous.heavy { Some(Attack::Heavy) }
                    else if f.input.light && !f.previous.light { Some(Attack::Light) }
                    else { None };
                    if let Some(kind) = kind {
                        if kind == Attack::Special { f.meter -= 50.0; }
                        f.attack = Some(AttackState { kind, frames: kind.total_frames(), connected: false });
                        f.cooldown = kind.total_frames() + 3;
                    }
                }
            }
            if !f.grounded {
                f.y += f.vy;
                f.vy -= 1.0;
                if f.y <= 0.0 { f.y = 0.0; f.vy = 0.0; f.grounded = true; }
            }
            f.x = f.x.clamp(65.0, WORLD_W - 65.0);
            f.previous = f.input;
        }
        // Keep both fighters from occupying the same space, including when jumping.
        let dx = self.fighters[1].x - self.fighters[0].x;
        if dx.abs() < 78.0 {
            let push = (78.0 - dx.abs()) / 2.0;
            if dx >= 0.0 { self.fighters[0].x -= push; self.fighters[1].x += push; }
            else { self.fighters[0].x += push; self.fighters[1].x -= push; }
        }
        // Resolve hits after both players have moved; only one hit per attack.
        for i in 0..2 {
            let Some(mut atk) = self.fighters[i].attack else { continue; };
            if atk.frames == atk.kind.hit_frame() && !atk.connected {
                let j = 1 - i;
                let distance = (self.fighters[i].x - self.fighters[j].x).abs();
                let height_ok = (self.fighters[i].y - self.fighters[j].y).abs() < 125.0;
                if distance < atk.kind.reach() && height_ok {
                    let defended = self.fighters[j].guarding;
                    let base = atk.kind.damage() + (self.picks[i] % 3) as i32;
                    let dealt = if defended { (base / 4).max(1) } else { base };
                    self.fighters[j].hp = (self.fighters[j].hp - dealt).max(0);
                    self.fighters[j].stun = if defended { 3 } else { 8 };
                    let direction = self.fighters[i].facing as f32;
                    self.fighters[j].x += direction * if defended { 9.0 } else { 24.0 };
                    self.fighters[i].meter = (self.fighters[i].meter + 12.0).min(100.0);
                    self.fighters[j].meter = (self.fighters[j].meter + 7.0).min(100.0);
                    atk.connected = true;
                }
            }
            atk.frames = atk.frames.saturating_sub(1);
            self.fighters[i].attack = if atk.frames == 0 { None } else { Some(atk) };
        }
    }
    fn ai_tick(&mut self) {
        let distance = (self.fighters[0].x - self.fighters[1].x).abs();
        let ai_x = self.fighters[1].x;
        let target = self.fighters[0].x;
        let close = distance < 165.0;
        let t = ROUND_TICKS - self.round_ticks;
        let mut input = Input::default();
        if distance > 108.0 { input.left = ai_x > target; input.right = ai_x < target; }
        if distance < 85.0 && t % 70 < 10 { input.left = ai_x < target; input.right = ai_x > target; }
        input.guard = close && self.fighters[0].attack.is_some() && t % 9 < 4;
        input.light = close && t % 26 == 1;
        input.heavy = close && t % 58 == 3;
        input.special = distance < 215.0 && self.fighters[1].meter >= 50.0 && t % 100 == 7;
        input.up = t % 113 == 29 && distance < 300.0;
        self.fighters[1].input = input;
    }
    fn snapshot(&self, include_codes: bool) -> Value {
        let connected = [self.remotes[0].is_some(), self.remotes[1].is_some()];
        let codes = if include_codes { json!([
            {"slot": 1, "code": self.codes[0], "connected": connected[0]},
            {"slot": 2, "code": self.codes[1], "connected": connected[1]}
        ]) } else { Value::Null };
        json!({"type": "state", "id": self.id, "mode": self.mode, "phase": self.phase.label(),
            "codes": codes, "connected": connected, "picks": self.picks, "ready": self.ready,
            "rematch": self.rematch, "round": self.round, "scores": self.scores,
            "reversed": self.reversed, "phase_ticks": self.phase_ticks,
            "seconds": (self.round_ticks + FPS - 1) / FPS,
            "fighters": [self.fighters[0].snapshot(), self.fighters[1].snapshot()],
            "message": self.message })
    }
    fn send_updates(&self, tick: u64) {
        if let Some(tv) = &self.tv {
            let _ = tv.tx.send(Message::Text(self.snapshot(true).to_string()));
        }
        if tick % 5 == 0 {
            let mobile_state = Message::Text(self.snapshot(false).to_string());
            for remote in self.remotes.iter().flatten() { let _ = remote.tx.send(mobile_state.clone()); }
        }
    }
}

#[derive(Default)]
struct ServerState { rooms: HashMap<String, GameRoom> }
impl ServerState {
    fn make_room(&mut self, mode: usize, client: Client) -> String {
        let mut rng = rand::thread_rng();
        let mut used: HashSet<String> = self.rooms.values().flat_map(|r| r.codes.iter().cloned()).collect();
        let mut next_code = || loop {
            let candidate = rng.gen_range(100_000..=999_999).to_string();
            if used.insert(candidate.clone()) { break candidate; }
        };
        let codes = [next_code(), next_code()];
        let id = loop {
            let value = format!("{:010x}", rng.gen::<u64>());
            if !self.rooms.contains_key(&value) { break value; }
        };
        self.rooms.insert(id.clone(), GameRoom::new(id.clone(), mode, codes, client));
        id
    }
    fn find_slot(&self, code: &str) -> Option<(String, usize)> {
        self.rooms.iter().find_map(|(id, room)| {
            (0..(if room.mode == 2 {2} else {1})).find(|&s| room.codes[s] == code)
                .map(|slot| (id.clone(), slot))
        })
    }
}

#[derive(Deserialize)]
struct WsQuery { role: String, mode: Option<usize>, code: Option<String> }

async fn ws_handler(ws: WebSocketUpgrade, Query(query): Query<WsQuery>, State(state): State<Shared>) -> Response {
    if query.role != "tv" && query.role != "remote" { return (StatusCode::BAD_REQUEST, "Invalid role").into_response(); }
    if query.role == "tv" && !matches!(query.mode, None | Some(0 | 1 | 2)) {
        return (StatusCode::BAD_REQUEST, "Mode must be 0, 1 or 2").into_response();
    }
    if query.role == "remote" && query.code.as_deref().is_none_or(|c| c.len() != 6 || !c.bytes().all(|b| b.is_ascii_digit())) {
        return (StatusCode::BAD_REQUEST, "Code must have 6 digits").into_response();
    }
    ws.on_upgrade(move |socket| handle_socket(socket, state, query))
}

async fn handle_socket(socket: WebSocket, state: Shared, query: WsQuery) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let client = Client { connection_id: rand::random(), tx: tx.clone() };
    let sender = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sink.send(message).await.is_err() { break; }
        }
    });
    let joined = {
        let mut server = state.lock().expect("server lock");
        if query.role == "tv" {
            let id = server.make_room(query.mode.unwrap_or(0), client.clone());
            Some((id, None))
        } else {
            let code = query.code.unwrap_or_default();
            if let Some((id, slot)) = server.find_slot(&code) {
                let room = server.rooms.get_mut(&id).expect("room exists");
                if room.tv.is_none() || room.remotes[slot].is_some() { None }
                else {
                    room.remotes[slot] = Some(client.clone());
                    room.last_seen = Instant::now();
                    let _ = tx.send(Message::Text(json!({"type":"welcome","slot": slot + 1,
                        "mode":room.mode, "room":id}).to_string()));
                    Some((id, Some(slot)))
                }
            } else { None }
        }
    };
    let Some((room_id, slot)) = joined else {
        let _ = tx.send(Message::Text(json!({"type":"error","message":"Mã không tồn tại hoặc tay cầm đã được kết nối."}).to_string()));
        // Send the invalid-code error before tearing down the WebSocket sender.
        drop(client);
        drop(tx);
        let _ = tokio::time::timeout(Duration::from_millis(500), sender).await;
        return;
    };
    if slot.is_none() {
        let _ = tx.send(Message::Text(json!({"type":"created","room":room_id}).to_string()));
    }
    while let Some(Ok(message)) = stream.next().await {
        if let Message::Text(text) = message {
            if text.len() > 2048 { continue; }
            if let Ok(value) = serde_json::from_str::<Value>(&text) {
                let mut server = state.lock().expect("server lock");
                if let Some(room) = server.rooms.get_mut(&room_id) {
                    room.last_seen = Instant::now();
                    if let Some(slot) = slot {
                        if room.remotes[slot].as_ref().map(|c| c.connection_id) != Some(client.connection_id) { break; }
                        match value.get("type").and_then(Value::as_str).unwrap_or("") {
                            "mode" if slot == 0 && room.phase == Phase::Lobby && !room.ready[0] && room.remotes[1].is_none() => {
                                if let Some(new_mode) = value.get("mode").and_then(Value::as_u64) {
                                    if new_mode <= 2 {
                                        room.mode = new_mode as usize;
                                        room.ready = [false, new_mode == 1];
                                        if new_mode == 1 { room.picks[1] = 5; }
                                    }
                                }
                            }
                            "select" if room.mode != 0 && room.phase == Phase::Lobby && !room.ready[slot] => {
                                if let Some(index) = value.get("character").and_then(Value::as_u64) {
                                    if (index as usize) < ROSTER_LEN { room.picks[slot] = index as usize; }
                                }
                            }
                            "ready" if room.mode != 0 && room.phase == Phase::Lobby => { room.ready[slot] = true; }
                            "input" if room.phase == Phase::Fight => {
                                if let Ok(input) = serde_json::from_value::<Input>(value.clone()) {
                                    room.fighters[slot].input = input;
                                }
                            }
                            "rematch" if room.phase == Phase::MatchEnd => {
                                room.rematch[slot] = true;
                                if room.mode == 1 { room.rematch[1] = true; }
                            }
                            _ => {}
                        }
                    }
                }
            }
        } else if let Message::Close(_) = message { break; }
    }
    {
        let mut server = state.lock().expect("server lock");
        if let Some(room) = server.rooms.get_mut(&room_id) {
            if let Some(slot) = slot {
                if room.remotes[slot].as_ref().map(|c| c.connection_id) == Some(client.connection_id) {
                    room.remotes[slot] = None;
                    room.fighters[slot].input = Input::default();
                    if room.phase == Phase::Lobby { room.ready[slot] = false; }
                }
            } else if room.tv.as_ref().map(|c| c.connection_id) == Some(client.connection_id) {
                server.rooms.remove(&room_id);
            }
        }
    }
    sender.abort();
}

async fn simulation_loop(state: Shared) {
    let mut interval = tokio::time::interval(Duration::from_micros(1_000_000 / FPS as u64));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut tick = 0u64;
    loop {
        interval.tick().await;
        tick += 1;
        let mut server = state.lock().expect("server lock");
        server.rooms.retain(|_, room| room.tv.is_some() && room.last_seen.elapsed() < Duration::from_secs(60 * 60 * 4));
        for room in server.rooms.values_mut() {
            room.tick();
            room.send_updates(tick);
        }
    }
}

async fn health() -> Json<Value> { Json(json!({"ok": true, "game": "Rust Fighter TV", "fps": FPS})) }

// All assets are embedded in the Android Rust .so. TV hosts the game directly on LAN.
// Desktop builds keep ServeDir for rapid web development.
#[cfg(target_os = "android")]
async fn embedded_asset(uri: axum::http::Uri) -> Response {
    let (mime, bytes): (&'static str, &'static [u8]) = match uri.path().trim_start_matches('/') {
        "" | "index.html" => ("text/html; charset=utf-8", include_bytes!("../public/index.html")),
        "remote.html" => ("text/html; charset=utf-8", include_bytes!("../public/remote.html")),
        "styles.css" => ("text/css; charset=utf-8", include_bytes!("../public/styles.css")),
        "tv.js" => ("application/javascript; charset=utf-8", include_bytes!("../public/tv.js")),
        "remote.js" => ("application/javascript; charset=utf-8", include_bytes!("../public/remote.js")),
        "shared.js" => ("application/javascript; charset=utf-8", include_bytes!("../public/shared.js")),
        "character-art.js" => ("application/javascript; charset=utf-8", include_bytes!("../public/character-art.js")),
        "assets/characters/ryu.webp" => ("image/webp", include_bytes!("../public/assets/characters/ryu.webp")),
        "assets/characters/ken.webp" => ("image/webp", include_bytes!("../public/assets/characters/ken.webp")),
        "assets/characters/chunli.webp" => ("image/webp", include_bytes!("../public/assets/characters/chunli.webp")),
        "assets/characters/guile.webp" => ("image/webp", include_bytes!("../public/assets/characters/guile.webp")),
        "assets/characters/cammy.webp" => ("image/webp", include_bytes!("../public/assets/characters/cammy.webp")),
        "assets/characters/blanka.webp" => ("image/webp", include_bytes!("../public/assets/characters/blanka.webp")),
        "assets/characters/zangief.webp" => ("image/webp", include_bytes!("../public/assets/characters/zangief.webp")),
        "assets/characters/dhalsim.webp" => ("image/webp", include_bytes!("../public/assets/characters/dhalsim.webp")),
        "assets/characters/honda.webp" => ("image/webp", include_bytes!("../public/assets/characters/honda.webp")),
        "assets/characters/bison.webp" => ("image/webp", include_bytes!("../public/assets/characters/bison.webp")),
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    ([(axum::http::header::CONTENT_TYPE, mime), (axum::http::header::CACHE_CONTROL, "no-cache")], bytes).into_response()
}

pub async fn serve_game() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let port: u16 = std::env::var("PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(3000);
    let state: Shared = Arc::new(Mutex::new(ServerState::default()));
    tokio::spawn(simulation_loop(state.clone()));
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health));
    #[cfg(target_os = "android")]
    let app = app.fallback(embedded_asset);
    #[cfg(not(target_os = "android"))]
    let app = app.nest_service("/", ServeDir::new(concat!(env!("CARGO_MANIFEST_DIR"), "/public")).append_index_html_on_directories(true));
    let app = app.with_state(state);
    let address = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("Rust Fighter TV listening at http://0.0.0.0:{port}");
    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg(target_os = "android")]
static NATIVE_STARTED: std::sync::Once = std::sync::Once::new();

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_tendoodn_rustfighter_tv_MainActivity_startNativeServer(
    _env: *mut std::ffi::c_void, _activity: *mut std::ffi::c_void,
) {
    NATIVE_STARTED.call_once(|| {
        std::thread::spawn(|| {
            match tokio::runtime::Builder::new_multi_thread().enable_all().build() {
                Ok(runtime) => {
                    if let Err(e) = runtime.block_on(serve_game()) {
                        eprintln!("Rust TV server failed: {e}");
                    }
                }
                Err(e) => eprintln!("Rust runtime failed: {e}"),
            }
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn room(mode: usize) -> GameRoom {
        let (tx, _rx) = mpsc::unbounded_channel();
        let tv = Client { connection_id: 9, tx };
        GameRoom::new("test".into(), mode, ["111111".into(), "222222".into()], tv)
    }
    #[test]
    fn no_mode_requires_first_phone_choice() {
        let mut r = room(0);
        let (tx, _rx) = mpsc::unbounded_channel();
        r.remotes[0] = Some(Client { connection_id: 1, tx });
        r.ready = [true, true];
        r.tick();
        assert_eq!(r.phase, Phase::Lobby);
        assert!(!r.all_present());
    }
    #[test]
    fn one_player_needs_only_first_remote() {
        let mut r = room(1);
        assert!(!r.all_present());
        let (tx, _rx) = mpsc::unbounded_channel();
        r.remotes[0] = Some(Client { connection_id: 1, tx });
        r.ready[0] = true;
        r.tick();
        assert_eq!(r.phase, Phase::Countdown);
    }
    #[test]
    fn two_player_requires_two_controllers() {
        let mut r = room(2);
        let (tx, _rx) = mpsc::unbounded_channel();
        r.remotes[0] = Some(Client { connection_id: 1, tx });
        r.ready = [true, true];
        r.tick();
        assert_eq!(r.phase, Phase::Lobby);
    }
    #[test]
    fn exactly_three_rounds_and_swap_each_round() {
        let mut r = room(1);
        r.phase = Phase::RoundEnd;
        r.phase_ticks = 1;
        r.round = 1;
        r.tick();
        assert_eq!(r.round, 2);
        assert!(r.reversed);
        assert!(r.fighters[0].x > r.fighters[1].x);
        r.phase = Phase::RoundEnd;
        r.phase_ticks = 1;
        r.tick();
        assert_eq!(r.round, 3);
        assert!(!r.reversed);
        r.phase = Phase::RoundEnd;
        r.phase_ticks = 1;
        r.tick();
        assert_eq!(r.phase, Phase::MatchEnd);
    }
    #[test]
    fn blocking_reduces_damage() {
        let mut a = room(2);
        a.fighters[0].x = 530.0;
        a.fighters[1].x = 635.0;
        a.fighters[0].attack = Some(AttackState { kind: Attack::Heavy, frames: 14, connected: false });
        a.step_fighters();
        let regular_damage = 100 - a.fighters[1].hp;
        let mut b = room(2);
        b.fighters[0].x = 530.0;
        b.fighters[1].x = 635.0;
        b.fighters[1].input.guard = true;
        b.fighters[0].attack = Some(AttackState { kind: Attack::Heavy, frames: 14, connected: false });
        b.step_fighters();
        assert!(regular_damage > 100 - b.fighters[1].hp);
    }
}
