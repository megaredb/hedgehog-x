#!/bin/bash

# Create certs directory if it doesn't exist
mkdir -p .certs

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "mkcert is not installed. Please install mkcert first: https://github.com/FiloSottile/mkcert"
    exit 1
fi

echo "Installing local CA..."
mkcert -install

echo "Generating certificates for hedgehog-inc.localhost..."
cd .certs
mkcert hedgehog-inc.localhost

echo "Certificates generated successfully in .certs/ directory."
