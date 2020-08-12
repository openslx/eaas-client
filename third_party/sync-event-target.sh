#!/bin/sh
set -eu

REPO="https://github.com/ungap/event-target"
NAME="event-target"

build() {
  rm -rf .git/
  rm -f .gitignore
  rm -rf "$DEST/""$NAME"
  cp -R . "$DEST/""$NAME"
}

add() {
  git add "$NAME"
}

. ../sync-git.lib.sh
