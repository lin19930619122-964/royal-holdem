#!/bin/bash
# 双击启动「皇室德州」手机版本地服务器，然后用手机访问。
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:$PATH"
exec node server.js 8099
