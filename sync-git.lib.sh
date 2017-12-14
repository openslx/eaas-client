set -eu

abspath()
{
    if [ -d "$1" ]
    then
        cd "$1" &> '/dev/null' && echo "$(pwd -P)" && exit 0
    else
        cd &> '/dev/null' "$(dirname "$1")" && echo "$(pwd -P)/$(basename "$1")" && exit 0
    fi
    exit 30
}

BASEDIR="$(dirname "$(abspath "$0")")"
BASENAME="$(basename "$(abspath "$0")")"
TEMPDIR="$(mktemp -d)"
DEST="$BASEDIR"

cd "$BASEDIR"
if test -n "$(git status --porcelain)"; then
  git status
  echo "$BASENAME: Working tree is not clean, aborting!"
  exit 1
fi
cd "$TEMPDIR"
git clone "$REPO" .
REV="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short=10 HEAD)"
build
cd "$BASEDIR"
add
git commit -F - << EOF
Update $NAME ('$SHORT')

Via \`$BASENAME\`.

Commit '$REV'
of $REPO
(<${REPO%.git}/commit/$REV>).
EOF
