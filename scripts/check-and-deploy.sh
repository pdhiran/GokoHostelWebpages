#!/bin/bash
# Auto-deploy script for GokoWeb on Raspberry Pi.
# Polls GitHub for new commits and rebuilds if needed.
#
# Add to goko's crontab (not root's, to avoid file ownership issues):
#   0 */12 * * * flock -n /tmp/goko-deploy.lock /home/goko/goko-web/scripts/check-and-deploy.sh >> /home/goko/deploy.log 2>&1
# Or trigger manually from the Server Sync UI via "Deploy Now" button.

set -euo pipefail

REPO_DIR="${GOKO_REPO_DIR:-/home/goko/goko-web}"
LAST_GOOD_FILE="${REPO_DIR}/.last-good-sha"
BRANCH="${GOKO_BRANCH:-main}"

cd "$REPO_DIR"

# Check if we can reach GitHub
if ! git ls-remote origin "$BRANCH" &>/dev/null; then
  exit 0
fi

REMOTE_SHA=$(git ls-remote origin "$BRANCH" | head -1 | cut -f1)
LOCAL_SHA=$(git rev-parse HEAD)

if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') Deploy starting: $LOCAL_SHA -> $REMOTE_SHA"

# Pull latest
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Only run npm install if lockfile changed
if git diff "$LOCAL_SHA" HEAD --name-only | grep -q "package-lock.json"; then
  echo "  package-lock.json changed, running npm install..."
  npm install
fi

# Run Pi migrations before build
echo "  Running migrations..."
npm run db:migrate:pi || echo "  WARNING: Migration failed, continuing with build"

# Write build version
echo "$REMOTE_SHA" > .build-version

# Build
echo "  Building..."
if npm run build:pi; then
  echo "  Build succeeded, restarting..."
  pm2 restart goko
  echo "$REMOTE_SHA" > "$LAST_GOOD_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Deploy complete: $REMOTE_SHA"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') BUILD FAILED at $REMOTE_SHA"
  # Revert to last good SHA for investigation
  if [ -f "$LAST_GOOD_FILE" ]; then
    GOOD_SHA=$(cat "$LAST_GOOD_FILE")
    echo "  Last good SHA: $GOOD_SHA (not auto-reverting, manual intervention needed)"
  fi
  exit 1
fi
