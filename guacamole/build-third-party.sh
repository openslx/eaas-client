#!/bin/sh -xeu

cd -- "$(dirname -- "$0")"

rm guacamole.js guacamole.css || :

help() {
  echo You might want to run:
  echo
  echo git submodule update -f guacamole-client guacamole-client-css
  exit 1
}

(
cd guacamole-client
git apply ../0001-Patches-from-eaas-client.patch || help
cat guacamole-common-js/src/main/webapp/modules/*.js > ../guacamole.js
)

(
cd guacamole-client-css
git apply ../0001-keyboard.css-Patches-from-eaas-client.patch || help
cp guacamole/src/main/webapp/styles/keyboard.css ../guacamole.css
)
