#!/bin/sh -xeu

cd -- "$(dirname -- "$0")"

cat guacamole-client-eaas/guacamole-common-js/src/main/webapp/modules/*.js > guacamole.js
cat \
  guacamole-client-eaas/guacamole/src/main/webapp/app/client/styles/keyboard.css \
  guacamole-client-eaas/guacamole/src/main/webapp/app/osk/styles/osk.css \
  > guacamole.css
