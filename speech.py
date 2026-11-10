#!/usr/bin/env python3
"""
Edge TTS bridge for the Journal Reader plugin.

Protocol (stdin -> stdout, one JSON request per line):

  request : {"op": "synthesize", "text": "...", "voice": "en-US-AvaNeural",
             "rate": 1.0, "volume": 0, "pitch": 0}
  request : {"op": "voices"}

  response: {"type": "meta", "duration": 4.28}
  response: {"type": "boundary", "offset": 0.1, "duration": 1.9, "text": "..."}
  response: {"type": "audio", "data": "<base64 chunk>"}
  response: {"type": "done"}
  response: {"type": "error", "message": "..."}

Every response line is a single JSON object. Binary audio is base64-encoded so
the stream stays line-delimited and never needs a framing negotiation.

The process stays alive between requests so the plugin does not pay Python
startup cost on every sentence; it reads a line, serves it, and loops.
"""

import sys

# Windows 中文环境的默认编码是 GBK，它无法编码 emoji 与其它非 BMP 字符。
# 这个进程只和宿主通过 UTF-8 的 JSON 行通信，所以强制切到 UTF-8，
# 否则一次合成就可能因为 stdout 编码失败而中断。
for _stream in (sys.stdin, sys.stdout):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import asyncio
import base64
import json


def emit(obj):
    # ensure_ascii=True：所有非 ASCII 字符都转成 \uXXXX 转义，输出永远是纯 ASCII。
    # 这样无论 stdout 是什么编码都不会失败——宿主那边 JSON.parse 能正常还原。
    sys.stdout.write(json.dumps(obj, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def fix_surrogates(text):
    """Merge UTF-16 surrogate pairs into real code points.

    Node's JSON.stringify emits emoji as their two UTF-16 surrogate code
    units, but Python's json.loads keeps them as two separate characters
    instead of recombining them. The result contains lone surrogates, and any
    .encode("utf-8") on that string raises UnicodeEncodeError.

    Round-tripping through UTF-16 with surrogatepass recombines the pairs.
    """
    try:
        return text.encode("utf-16-le", "surrogatepass").decode("utf-16-le")
    except Exception:
        return text


def pct(value):
    """Map a multiplier around 1.0 onto edge-tts' percentage syntax."""
    delta = int(round((float(value) - 1.0) * 100))
    return f"{delta:+d}%"


async def op_voices(request_id):
    try:
        import edge_tts
    except Exception as error:  # noqa: BLE001 - surfaced to the caller as JSON
        emit({"type": "error", "id": request_id,
              "message": f"edge_tts is not installed: {error}"})
        return

    try:
        voices = await edge_tts.list_voices()
    except Exception as error:  # noqa: BLE001
        emit({"type": "error", "id": request_id,
              "message": f"voice list failed: {error}"})
        return

    # The plugin only ever reads English text, so the English catalogue is the
    # useful one; other locales are still returned for completeness.
    result = []
    for voice in voices:
        locale = voice.get("Locale") or ""
        if not locale.lower().startswith("en"):
            continue
        tags = voice.get("VoiceTag") or {}
        result.append({
            "id": voice.get("ShortName") or voice.get("Name") or "",
            "name": voice.get("ShortName") or voice.get("Name") or "",
            "locale": locale,
            "gender": voice.get("Gender") or "",
            "personality": tags.get("VoicePersonalities") or [],
            "description": tags.get("Description") or "",
        })
    emit({"type": "voices", "id": request_id, "voices": result})


async def op_synthesize(request):
    request_id = request.get("id")
    try:
        import edge_tts
    except Exception as error:  # noqa: BLE001
        emit({"type": "error", "id": request_id,
              "message": f"edge_tts is not installed: {error}"})
        return

    text = str(request.get("text") or "").strip()
    if not text:
        emit({"type": "error", "id": request_id, "message": "empty text"})
        return
    # Node 送来的 emoji 会带着 UTF-16 代理对；先合并成正常码点，否则无法编码。
    text = fix_surrogates(text)

    voice = request.get("voice") or "en-US-AvaNeural"
    rate = pct(request.get("rate", 1.0))
    volume = pct(request.get("volume", 0))
    pitch = f"{int(round(float(request.get('pitch', 0)))):+d}Hz"

    try:
        communicate = edge_tts.Communicate(
            text,
            voice,
            rate=rate,
            volume=volume,
            pitch=pitch,
            boundary="SentenceBoundary",
        )
        async for chunk in communicate.stream():
            kind = chunk.get("type")
            if kind == "audio":
                data = chunk.get("data")
                if data:
                    emit({
                        "type": "audio",
                        "id": request_id,
                        "data": base64.b64encode(data).decode("ascii"),
                    })
            elif kind == "SentenceBoundary":
                # edge-tts reports 100-nanosecond ticks.
                emit({
                    "type": "boundary",
                    "id": request_id,
                    "offset": round(chunk.get("offset", 0) / 1e7, 4),
                    "duration": round(chunk.get("duration", 0) / 1e7, 4),
                    "text": chunk.get("text") or "",
                })
    except Exception as error:  # noqa: BLE001
        emit({"type": "error", "id": request_id,
              "message": f"synthesis failed: {error}"})
        return

    emit({"type": "done", "id": request_id})


async def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except Exception as error:  # noqa: BLE001
            emit({"type": "error", "message": f"invalid JSON: {error}"})
            continue
        op = request.get("op")
        if op == "voices":
            await op_voices(request.get("id"))
        elif op == "synthesize":
            await op_synthesize(request)
        elif op == "quit":
            break
        else:
            emit({"type": "error", "id": request.get("id"),
                  "message": f"unknown op: {op}"})
    sys.stdout.flush()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as error:  # noqa: BLE001
        emit({"type": "error", "message": str(error)})
