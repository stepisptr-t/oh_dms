#!/usr/bin/env bash
SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd $SCRIPT_DIR

npm pack
cd ../js
npm install ../jslib/jslib-*.tgz