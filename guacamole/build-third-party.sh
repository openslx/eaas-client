#!/bin/sh

cd -- "$(dirname -- "$0")"
cat third_party/js/*.js > guacamole.js
cat third_party/css/*.css > guacamole.css
