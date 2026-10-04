#!/usr/bin/env bash
# Syncs this directory into the DesignMD/ subfolder of the prabhu-cg/Figma-plugins
# monorepo and pushes. That repo mixes several unrelated plugins on one branch, so a
# plain `git push` from here isn't possible (it would try to overwrite everything else
# on main with just this folder) — this script keeps a persistent clone of the monorepo
# and copies only this project's tracked files into its DesignMD/ subfolder each run.
#
# Builds and includes dist/ (unlike this script's original version, which excluded it):
# DesignMD gets loaded on machines that can't run npm via "Download ZIP" of the
# monorepo, so the monorepo copy needs a pre-built dist/code.js + dist/ui.html.
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_DIR="${DESIGNMD_MONOREPO_DIR:-/Users/prc/Documents/Personal/.designmd-monorepo}"
COMMIT_MESSAGE="${1:-Update DesignMD}"

if [ ! -d "$MONOREPO_DIR/.git" ]; then
  echo "Monorepo clone not found at $MONOREPO_DIR — clone it first:"
  echo "  git clone git@github.com:prabhu-cg/Figma-plugins.git $MONOREPO_DIR"
  exit 1
fi

cd "$SOURCE_DIR"
if ! git ls-files --error-unmatch dist/code.js dist/ui.html >/dev/null 2>&1; then
  echo "dist/code.js and dist/ui.html must be tracked by git (they are published as-is)."
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Note: uncommitted changes to tracked files are included in this publish."
fi
npm run build

cd "$MONOREPO_DIR"
git checkout main
git pull --ff-only origin main

# Publish exactly the files git tracks here — no coverage/, scratch files, or other untracked
# leftovers. dist/ is tracked on purpose (see header), so the fresh build above is included.
DEST="$MONOREPO_DIR/DesignMD"
rm -rf "$DEST"
mkdir -p "$DEST"
(
  cd "$SOURCE_DIR"
  git ls-files -z | while IFS= read -r -d '' file; do
    # A tracked file deleted in the working tree is simply not published.
    if [ -e "$file" ]; then printf '%s\0' "$file"; fi
  done | tar --null -T - -cf - | tar -xf - -C "$DEST"
)

git add DesignMD

if git diff --cached --quiet; then
  echo "Nothing changed — DesignMD/ in the monorepo already matches this directory."
  exit 0
fi

git -c user.name="prc" -c user.email="prabhu_cg@proton.me" commit -m "$COMMIT_MESSAGE"
git push origin main

echo "Published to https://github.com/prabhu-cg/Figma-plugins/tree/main/DesignMD"
