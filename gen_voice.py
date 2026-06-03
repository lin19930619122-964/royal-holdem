# 批量生成东北话 AI 语音(edge-tts 神经语音)。每动作多句，随机不重样。
import asyncio, edge_tts, os, glob
OUT = "src/assets/voice"
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(OUT + "/v*.mp3"):
    os.remove(f)

VOICES = {0: "zh-CN-liaoning-XiaobeiNeural", 1: "zh-CN-YunjianNeural"}
PHRASES = {
    "fold": ["不跟了", "这把我撤", "得 这把算了", "牌太埋汰 扔了", "不玩这把", "这牌没法整", "我趴下", "跟不起 撤了", "这把让给你", "算了 不掺和", "牌不行 弃了", "这把我认怂"],
    "check": ["过", "我瞅瞅", "先看看", "不要 过", "过吧", "看一张", "我蹲着", "暂时不动", "过 接着发", "让一让", "我先观望", "过 你随意"],
    "call": ["跟", "我跟", "跟你这把", "行 跟了", "必须跟", "这把我跟", "跟上", "接着 我跟", "跟你玩玩", "来 我跟", "这点我还跟得起", "跟 看你后边咋整"],
    "raise": ["加注", "给你加点儿", "我加", "加 咋地", "再加点", "整个加注", "加你一下", "抬一手", "加 看你跟不", "给你来点压力", "我加注 别怂", "加 这把我有底"],
    "allin": ["全下", "梭哈", "我全下了", "梭哈 来不来", "全压 怕你咋的", "一把梭了", "全下 跟不跟", "老铁 梭哈", "全压上", "这把我豁出去了", "全下 看你胆儿肥不", "梭 不带怂的"],
    "win": ["这把归我了", "瞅见没 赢了", "哈哈 钱是我的", "必须的 拿下", "这把稳了", "承让承让", "钱 我收下了", "又赢一把", "这把美滋滋", "谢谢老铁送钱", "赢了赢了", "还得是我"],
    "taunt": ["就你这牌也敢跟", "你那小牌趁早扔", "跟我斗 你还嫩点", "这把你悬了", "你能跟得起不", "别硬撑了", "我劝你弃了吧", "你这牌不行啊", "瞅你那犹豫劲儿", "跟不跟 痛快点", "你这是送钱来了", "认怂还来得及"],
    "think": ["让我寻思寻思", "这把有点意思", "瞅瞅你啥意思", "嗯 我合计合计", "稳住 别急", "这把得琢磨"],
}

async def gen(text, voice, path, sem):
    async with sem:
        for _ in range(3):
            try:
                await edge_tts.Communicate(text, voice).save(path)
                return True
            except Exception:
                await asyncio.sleep(0.6)
        print("FAIL", path)
        return False

async def main():
    sem = asyncio.Semaphore(6)
    tasks = []
    for vi, voice in VOICES.items():
        for act, lst in PHRASES.items():
            for i, t in enumerate(lst):
                tasks.append(gen(t, voice, f"{OUT}/v{vi}_{act}_{i}.mp3", sem))
    res = await asyncio.gather(*tasks)
    print(f"完成 {sum(1 for r in res if r)}/{len(res)}")

# 每个动作的句数(供前端随机)
import json
print("COUNTS=" + json.dumps({k: len(v) for k, v in PHRASES.items()}))
asyncio.run(main())
