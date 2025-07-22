#!/bin/bash

# Extract version from package.json
VERSION=$(cat package.json | grep '"version"' | sed 's/.*"version": "\(.*\)".*/\1/')

# Check if tag already exists locally
if git tag -l "v$VERSION" | grep -q "v$VERSION"; then
    echo "Please update the version in package.json!"
    exit 1
fi

# Check if there's a changelog entry for this version in the last 3 lines
if ! tail -3 CHANGELOG.md | grep -q "$VERSION"; then
    echo "Please update the Change Log!"
    exit 1
fi

# Create and push the tag
git tag "v$VERSION"
git push origin "v$VERSION"
echo "Created and pushed tag v$VERSION" 