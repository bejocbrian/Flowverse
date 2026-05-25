# syntax=docker/dockerfile:1.6

# ----------------------------------------------------------------------------
# PocketBase image for Railway / any Docker host.
# - Bundles pb_migrations and pb_hooks
# - On startup, PocketBase auto-runs any migration files it has not seen yet
# - Persistent data lives at /pb_data (mount a Railway volume here)
# ----------------------------------------------------------------------------

FROM alpine:3.20 AS fetcher

ARG PB_VERSION=0.38.0
ARG TARGETARCH=amd64

RUN apk add --no-cache curl unzip ca-certificates \
	&& curl -fL -o /tmp/pb.zip \
		"https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
	&& unzip /tmp/pb.zip -d /pb \
	&& chmod +x /pb/pocketbase

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata \
	&& addgroup -S pb && adduser -S -G pb pb

WORKDIR /app

COPY --from=fetcher /pb/pocketbase /app/pocketbase
COPY pb_migrations /app/pb_migrations
COPY pb_hooks /app/pb_hooks

# Persistent data dir. On Railway, mount a volume here.
RUN mkdir -p /pb_data && chown -R pb:pb /pb_data /app

USER pb

EXPOSE 8080

# Railway provides $PORT. Default to 8080 locally.
ENV PORT=8080

# Use shell form so $PORT expands at runtime.
CMD /app/pocketbase serve \
	--http=0.0.0.0:${PORT} \
	--dir=/pb_data \
	--migrationsDir=/app/pb_migrations \
	--hooksDir=/app/pb_hooks \
	--hooksWatch=false
