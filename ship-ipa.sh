#!/bin/bash
# 一键：建 GitHub 仓库 → 推送 → 云端编译未签名 .ipa → 下载到本地 dist-ipa/
# 前置：先在终端跑过一次  gh auth login  （登录你自己的 GitHub）
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:$PATH"
REPO="${1:-royal-holdem}"
SERVER="${2:-m5.tail5255b4.ts.net}"

command -v gh >/dev/null || { echo "❌ 没装 gh"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ 还没登录。请先在终端运行: gh auth login"; exit 1; }
USER=$(gh api user -q .login)
echo "GitHub 用户: $USER   仓库: $REPO"

# 1) 建仓库并推送（已存在则只加远程+推）
if gh repo view "$USER/$REPO" >/dev/null 2>&1; then
  echo "仓库已存在，直接推送"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$USER/$REPO.git"
  git push -u origin main
else
  echo "创建仓库并推送…"
  gh repo create "$REPO" --public --source=. --remote=origin --push
fi

# 2) 触发编译工作流
echo "触发云端编译(联机服务器=$SERVER)…"
gh workflow run ios-ipa.yml --ref main -f server="$SERVER"
sleep 8

# 3) 找到本次运行并等待
RID=$(gh run list --workflow=ios-ipa.yml -L1 --json databaseId -q '.[0].databaseId')
echo "运行 ID: $RID  —— 监看进度(约 5-10 分钟)…"
gh run watch "$RID" --exit-status || { echo "❌ 编译失败，看日志: gh run view $RID --log-failed"; exit 1; }

# 4) 下载 .ipa
echo "下载产物…"
rm -rf dist-ipa && mkdir -p dist-ipa
gh run download "$RID" -n royal-holdem-unsigned-ipa -D dist-ipa
IPA=$(find dist-ipa -name '*.ipa' | head -1)
echo ""
echo "✅ 完成！.ipa 在：$(cd "$(dirname "$IPA")" && pwd)/$(basename "$IPA")"
echo "   传到手机 → 巨魔 TrollStore 打开 → Install → 永久安装。"
