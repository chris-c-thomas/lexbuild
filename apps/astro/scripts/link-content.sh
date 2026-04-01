#!/bin/bash
# Link CLI output into the app's content directory for local development.
# Run from apps/astro/ after running lexbuild convert commands at all granularities.
set -euo pipefail

REPO_ROOT="$(cd ../.. && pwd)"
CONTENT_DIR="./content"

# Create content directory structure (source-first, then granularity)
mkdir -p "$CONTENT_DIR"/usc/{sections,chapters,titles}
mkdir -p "$CONTENT_DIR"/ecfr/{sections,chapters,parts,titles}
mkdir -p "$CONTENT_DIR"/fr/documents

# Section-level output (default granularity, -o ./output)
if [ -d "$REPO_ROOT/output/usc" ]; then
  rm -rf "$CONTENT_DIR/usc/sections"
  ln -s "$REPO_ROOT/output/usc" "$CONTENT_DIR/usc/sections"
  echo "Linked USC sections"
fi
if [ -d "$REPO_ROOT/output/ecfr" ]; then
  rm -rf "$CONTENT_DIR/ecfr/sections"
  ln -s "$REPO_ROOT/output/ecfr" "$CONTENT_DIR/ecfr/sections"
  echo "Linked eCFR sections"
fi

# Chapter-level output (-g chapter -o ./output-chapter)
if [ -d "$REPO_ROOT/output-chapter/usc" ]; then
  rm -rf "$CONTENT_DIR/usc/chapters"
  ln -s "$REPO_ROOT/output-chapter/usc" "$CONTENT_DIR/usc/chapters"
  echo "Linked USC chapters"
fi
if [ -d "$REPO_ROOT/output-chapter/ecfr" ]; then
  rm -rf "$CONTENT_DIR/ecfr/chapters"
  ln -s "$REPO_ROOT/output-chapter/ecfr" "$CONTENT_DIR/ecfr/chapters"
  echo "Linked eCFR chapters"
fi

# Part-level output (-g part -o ./output-part, eCFR only)
if [ -d "$REPO_ROOT/output-part/ecfr" ]; then
  rm -rf "$CONTENT_DIR/ecfr/parts"
  ln -s "$REPO_ROOT/output-part/ecfr" "$CONTENT_DIR/ecfr/parts"
  echo "Linked eCFR parts"
fi

# Title-level output (-g title -o ./output-title)
if [ -d "$REPO_ROOT/output-title/usc" ]; then
  rm -rf "$CONTENT_DIR/usc/titles"
  ln -s "$REPO_ROOT/output-title/usc" "$CONTENT_DIR/usc/titles"
  echo "Linked USC titles"
fi
if [ -d "$REPO_ROOT/output-title/ecfr" ]; then
  rm -rf "$CONTENT_DIR/ecfr/titles"
  ln -s "$REPO_ROOT/output-title/ecfr" "$CONTENT_DIR/ecfr/titles"
  echo "Linked eCFR titles"
fi

# FR documents (flat output, no granularity variants)
if [ -d "$REPO_ROOT/output/fr" ]; then
  rm -rf "$CONTENT_DIR/fr/documents"
  ln -s "$REPO_ROOT/output/fr" "$CONTENT_DIR/fr/documents"
  echo "Linked FR documents"
fi

echo "All content linked."
