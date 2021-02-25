#!/bin/sh -xeu

cd -- "$(dirname -- "$0")"

(
echo "export const jsFiles = ["
printf '"%s",\n' \
    ./guacamole-client-eaas/guacamole-common-js/src/main/webapp/modules/*.js
echo "];"
echo
echo "export const cssFiles = ["
printf '"%s",\n' \
  guacamole-client-eaas/guacamole/src/main/webapp/app/client/styles/keyboard.css \
  guacamole-client-eaas/guacamole/src/main/webapp/app/osk/styles/osk.css
echo "];"
) > file-list.js
