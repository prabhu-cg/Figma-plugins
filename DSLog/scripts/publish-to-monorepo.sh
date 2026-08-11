#!/usr/bin/env bash
# Builds DSLog and syncs it into the DSLog/ subfolder of the prabhu-cg/Figma-plugins
# monorepo, then pushes. That repo mixes several unrelated plugins on one branch, so a
# plain `git push` from here isn't possible (it would try to overwrite everything else
# on main with just this folder) — this script keeps a persistent clone of the monorepo
# and copies only this project's tracked files into its DSLog/ subfolder each run.
#
# Unlike other plugins' publish scripts, this one does NOT exclude dist/ from the sync:
# DSLog gets loaded on a work machine that can't run npm, via "Download ZIP" of the
# monorepo, so the monorepo copy needs a pre-built dist/code.js + dist/ui.html.
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_DIR="/Users/prc/Documents/Personal/.designlens-monorepo"
COMMIT_MESSAGE="${1:-Update DSLog}"

if [ ! -d "$MONOREPO_DIR/.git" ]; then
  echo "Monorepo clone not found at $MONOREPO_DIR — clone it first:"
  echo "  git clone git@github.com:prabhu-cg/Figma-plugins.git $MONOREPO_DIR"
  exit 1
fi

cd "$SOURCE_DIR"
npm run build

cd "$MONOREPO_DIR"
git checkout main
git pull --ff-only origin main

rsync -a --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.claude' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  "$SOURCE_DIR/" "$MONOREPO_DIR/DSLog/"

git add DSLog

if git diff --cached --quiet; then
  echo "Nothing changed — DSLog/ in the monorepo already matches this directory."
  exit 0
fi

git -c user.name="prc" -c user.email="prabhu_cg@proton.me" commit -m "$COMMIT_MESSAGE"
git push origin main

echo "Published to https://github.com/prabhu-cg/Figma-plugins/tree/main/DSLog"
