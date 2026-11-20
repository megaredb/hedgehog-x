#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p certs
CA_KEY=certs/hedgehog-local-ca.key
CA_CRT=certs/hedgehog-local-ca.crt
KEY=certs/hedgehog-inc.localhost+1-key.pem
CRT=certs/hedgehog-inc.localhost+1.pem

if [ ! -f "$CA_CRT" ]; then
  cat > /tmp/hedgehog-ca.cnf <<'EOF'
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no
[dn]
CN = Hedgehog Local CA
[v3_ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
EOF
  openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
    -keyout "$CA_KEY" -out "$CA_CRT" -config /tmp/hedgehog-ca.cnf
fi

cat > /tmp/hedgehog-server.cnf <<'EOF'
[req]
distinguished_name = dn
req_extensions = v3_req
prompt = no
[dn]
CN = *.hedgehog-inc.localhost
[v3_req]
subjectAltName = @alt
[alt]
DNS.1 = hedgehog-inc.localhost
DNS.2 = *.hedgehog-inc.localhost
DNS.3 = localhost
DNS.4 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
openssl req -newkey rsa:2048 -nodes -keyout "$KEY" -out /tmp/hedgehog-server.csr -config /tmp/hedgehog-server.cnf
openssl x509 -req -in /tmp/hedgehog-server.csr -CA "$CA_CRT" -CAkey "$CA_KEY" \
  -CAcreateserial -out "$CRT" -days 825 -sha256 \
  -extfile /tmp/hedgehog-server.cnf -extensions v3_req
chmod 600 "$KEY" "$CA_KEY"

if [ "${1:-}" = "--trust" ] && command -v security >/dev/null; then
  security add-trusted-cert -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" "$CA_CRT"
  echo "CA trusted in login keychain; restart Chrome."
fi

echo "Generated: $CRT"
echo "CA:        $CA_CRT"
echo "Restart Traefik: docker restart traefik"
