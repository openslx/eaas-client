#!/bin/sh -xeu

cd -- "$(dirname -- "$0")"

(
cd guacamole-client
git apply ../0001-Patches-from-eaas-client.patch
)

(
cd guacamole-client-css
git apply ../0001-keyboard.css-Patches-from-eaas-client.patch
)

cat third_party/js/*.js > guacamole.js
cat third_party/css/*.css > guacamole.css
