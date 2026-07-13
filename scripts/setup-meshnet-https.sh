#!/usr/bin/env bash
set -euo pipefail

HOST_NAME="${1:-${MESHNET_HOST:-}}"
MESHNET_IP="${2:-${MESHNET_IP:-}}"
TLS_DIR="${MESHNET_TLS_DIR:-storage/meshnet-tls}"

if [[ -z "$HOST_NAME" ]]; then
  echo "Usage: $0 <meshnet-hostname> [meshnet-ip]"
  echo "Example: $0 yozorawolf-olympic.nord 100.64.0.10"
  exit 1
fi

if [[ ! "$HOST_NAME" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Invalid Meshnet hostname: $HOST_NAME" >&2
  exit 1
fi

if [[ -n "$MESHNET_IP" && ! "$MESHNET_IP" =~ ^[0-9A-Fa-f:.]+$ ]]; then
  echo "Invalid Meshnet IP address: $MESHNET_IP" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate the local certificates." >&2
  exit 1
fi

mkdir -p "$TLS_DIR"
chmod 700 "$TLS_DIR"

CA_KEY="$TLS_DIR/ca.key"
CA_CERT="$TLS_DIR/ca.crt"
SERVER_KEY="$TLS_DIR/server.key"
SERVER_CERT="$TLS_DIR/server.crt"
SERVER_CSR="$TLS_DIR/server.csr"
EXT_FILE="$TLS_DIR/server.ext"

if [[ ! -f "$CA_KEY" || ! -f "$CA_CERT" ]]; then
  openssl genrsa -out "$CA_KEY" 4096
  openssl req -x509 -new -sha256 -days 3650 \
    -key "$CA_KEY" \
    -out "$CA_CERT" \
    -subj "/CN=OkuuAI Meshnet Local CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
fi

cat > "$EXT_FILE" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names

[alt_names]
DNS.1=$HOST_NAME
EOF

if [[ -n "$MESHNET_IP" ]]; then
  printf 'IP.1=%s\n' "$MESHNET_IP" >> "$EXT_FILE"
fi

openssl genrsa -out "$SERVER_KEY" 2048
openssl req -new -sha256 \
  -key "$SERVER_KEY" \
  -out "$SERVER_CSR" \
  -subj "/CN=$HOST_NAME"
openssl x509 -req -sha256 -days 825 \
  -in "$SERVER_CSR" \
  -CA "$CA_CERT" \
  -CAkey "$CA_KEY" \
  -CAcreateserial \
  -out "$SERVER_CERT" \
  -extfile "$EXT_FILE"

rm -f "$SERVER_CSR" "$EXT_FILE"
chmod 600 "$CA_KEY" "$SERVER_KEY"
chmod 644 "$CA_CERT" "$SERVER_CERT"

cat <<EOF

Meshnet TLS certificate created for $HOST_NAME.

Keep private:
  $CA_KEY
  $SERVER_KEY

Install this certificate as a trusted root CA on each client device:
  $CA_CERT

Then start OkuuAI with:
  docker compose --profile app --profile meshnet-https up --build -d

Open:
  https://$HOST_NAME:${FRONTEND_HTTPS_PORT:-9443}
EOF
