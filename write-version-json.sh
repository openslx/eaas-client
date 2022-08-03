#!/bin/sh -xeu

cd -- "$(dirname -- "$0")"

commit="$(git describe --abbrev=64 --all --always --dirty --long)"

cat > version.json << EOF
{"commit": "$commit"}
EOF
