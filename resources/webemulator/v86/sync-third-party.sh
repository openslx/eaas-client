#!/bin/sh
set -eu

REPO="https://github.com/copy/v86/"
NAME="v86"

build() {
  make build/libv86.js build/v86_all.js
  rm -rf .git/
  rm -f .gitignore
  rm -rf "$DEST/third_party/""$NAME"
  cp -R . "$DEST/third_party/""$NAME"
}

add() {
  git add third_party/"$NAME"
}

. ../../../sync-git.lib.sh
