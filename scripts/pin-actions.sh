#!/usr/bin/env bash
# pin-actions.sh
# Run once locally to pin all GitHub Actions in .github/workflows/ to full commit SHAs.
# Requires: curl, jq, a GITHUB_TOKEN with public repo read access
#
# Usage:
#   export GITHUB_TOKEN=ghp_your_token_here
#   bash scripts/pin-actions.sh

set -euo pipefail

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: Set GITHUB_TOKEN before running this script."
  echo "  export GITHUB_TOKEN=ghp_yourtoken"
  exit 1
fi

WORKFLOWS_DIR=".github/workflows"

resolve_sha() {
  local repo="$1"
  local ref="$2"
  local sha
  # Get the ref object
  sha=$(curl -fsSL \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/git/refs/tags/${ref}" \
    | jq -r '(if type == "array" then .[-1] else . end).object.sha')

  # If the SHA is a tag object, dereference it
  local obj_type
  obj_type=$(curl -fsSL \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/git/tags/${sha}" \
    | jq -r '.object.type // "commit"')

  if [ "$obj_type" = "commit" ]; then
    sha=$(curl -fsSL \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${repo}/git/tags/${sha}" \
      | jq -r '.object.sha')
  fi

  echo "$sha"
}

pin_workflow() {
  local file="$1"
  echo "Pinning: $file"
  # Match lines like: uses: owner/repo@vX or uses: owner/repo/sub@vX
  while IFS= read -r line; do
    if [[ "$line" =~ uses:[[:space:]]+(([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)(/[a-zA-Z0-9_.-]+)?@([a-zA-Z0-9._/-]+)) ]]; then
      full_ref="${BASH_REMATCH[1]}"
      repo="${BASH_REMATCH[2]}"
      sub="${BASH_REMATCH[3]}"
      tag="${BASH_REMATCH[4]}"

      # Skip if already pinned to a SHA (40-char hex)
      if [[ "$tag" =~ ^[0-9a-f]{40}$ ]]; then
        continue
      fi

      echo "  Resolving ${repo}@${tag}..."
      sha=$(resolve_sha "$repo" "$tag" 2>/dev/null || echo "")

      if [ -z "$sha" ] || [ ${#sha} -ne 40 ]; then
        echo "  WARN: Could not resolve SHA for ${repo}@${tag} — skipping"
        continue
      fi

      # Replace in file: uses: owner/repo@tag → uses: owner/repo@sha # tag
      escaped_ref=$(echo "$full_ref" | sed 's/[\/&]/\\&/g')
      new_ref="${repo}${sub}@${sha} # ${tag}"
      escaped_new=$(echo "$new_ref" | sed 's/[\/&]/\\&/g')
      sed -i "s|uses: ${escaped_ref}|uses: ${escaped_new}|g" "$file"
      echo "  Pinned: ${repo}${sub}@${tag} → ${sha:0:12}..."
    fi
  done < "$file"
}

for wf in "${WORKFLOWS_DIR}"/*.yml; do
  [ -f "$wf" ] || continue
  pin_workflow "$wf"
done

echo ""
echo "Done. Review changes with: git diff .github/workflows/"
echo "Commit with: git add .github/workflows/ && git commit -m 'ci: pin GitHub Actions to full SHAs'"
