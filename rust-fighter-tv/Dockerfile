FROM rust:1.85-bookworm AS build
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN useradd -r -u 10001 fighter && apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/release/rust-fighter-tv /usr/local/bin/rust-fighter-tv
COPY public ./public
USER fighter
ENV PORT=3000
EXPOSE 3000
CMD ["rust-fighter-tv"]
