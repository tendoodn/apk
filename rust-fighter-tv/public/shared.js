'use strict';
// The roster identifies existing Street Fighter characters; all procedural vector
// drawings in this demo are new and are NOT extracted Capcom sprites or models.
window.RF = {
  characters: [
    {name:'RYU', title:'VÕ SĨ ÁO TRẮNG', color:'#eae9df', skin:'#dba781', accent:'#e23943', energy:'#63baff', hair:'#181c27', style:'KARATE · HADOUKEN', power:4, speed:3, mark:'拳', kind:'ryu'},
    {name:'KEN', title:'HỎA QUYỀN', color:'#d63834', skin:'#ecbc90', accent:'#ffae39', energy:'#ff9a42', hair:'#e8c24d', style:'KARATE · SHORYUKEN', power:4, speed:4, mark:'炎', kind:'ken'},
    {name:'CHUN-LI', title:'NỮ VÕ SĨ', color:'#2674cb', skin:'#ecc29d', accent:'#f9e5a7', energy:'#6fd8ff', hair:'#171c2a', style:'CƯỚC PHÁP', power:3, speed:5, mark:'春', kind:'chunli'},
    {name:'GUILE', title:'QUÂN NHÂN', color:'#60734b', skin:'#dda57d', accent:'#c6e06d', energy:'#91f3da', hair:'#f2cc6b', style:'SONIC BOOM', power:4, speed:3, mark:'★', kind:'guile'},
    {name:'CAMMY', title:'ĐỘI ĐẶC NHIỆM', color:'#428763', skin:'#f0c49f', accent:'#e44647', energy:'#81ffc9', hair:'#ecc971', style:'SPIRAL ARROW', power:3, speed:5, mark:'✦', kind:'cammy'},
    {name:'BLANKA', title:'CHIẾN BINH RỪNG', color:'#458e49', skin:'#62a45e', accent:'#f29134', energy:'#f6ed70', hair:'#e26f2b', style:'ĐIỆN KÍCH', power:4, speed:4, mark:'ϟ', kind:'blanka'},
    {name:'ZANGIEF', title:'ĐÔ VẬT', color:'#b7473f', skin:'#d39773', accent:'#e8bc59', energy:'#ff8979', hair:'#522b23', style:'SIÊU SỨC MẠNH', power:5, speed:1, mark:'✹', kind:'zangief'},
    {name:'DHALSIM', title:'BẬC THẦY YOGA', color:'#e39e43', skin:'#9b6346', accent:'#ffe08b', energy:'#ff9c4a', hair:'#492e2c', style:'YOGA FIRE', power:2, speed:3, mark:'ॐ', kind:'dhalsim'},
    {name:'E. HONDA', title:'VÕ SĨ SUMO', color:'#4b75b6', skin:'#ddb08a', accent:'#dde7f6', energy:'#74afff', hair:'#15151e', style:'SUMO HEADBUTT', power:5, speed:2, mark:'力', kind:'honda'},
    {name:'M. BISON', title:'TƯ LỆNH', color:'#ba313c', skin:'#b88b71', accent:'#e6d3c1', energy:'#b787ff', hair:'#1d152a', style:'PSYCHO POWER', power:5, speed:3, mark:'Ψ', kind:'bison'}
  ],
  wsUrl(path){const protocol=location.protocol==='https:'?'wss:':'ws:';return `${protocol}//${location.host}${path}`;},
  hexAlpha(hex, alpha){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${alpha})`;},
  escapeHtml(v){return String(v).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
};
