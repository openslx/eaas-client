#!/bin/sh -xeu

cd -- "$(dirname -- "$0")"

(
echo "export const jsFiles = ["
printf '"%s",\n' \
    ./dist/modules/*.js
echo "];"
echo
echo "export const cssFiles = ["
printf '"%s",\n' \
  ./dist/styles/keyboard.css \
  ./dist/osk/styles/osk.css
echo "];"
) > file-list.js
