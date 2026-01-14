const STORAGE_KEYS = {
  OFFSET: "offsetSeconds",  // 0~5
  MEMOS: "memos"            // [{id,time,note}]
};

function extractTime(text) {
  const m = String(text || "").match(/\b(\d{2}:\d{2}:\d{2})\b/);
  return m ? m[1] : null;
}

function toSeconds(hms) {
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function toHMS(totalSeconds) {
  const sec = Math.max(0, totalSeconds);
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function getOffset() {
  const obj = await chrome.storage.local.get([STORAGE_KEYS.OFFSET]);
  const offset = Number(obj[STORAGE_KEYS.OFFSET] ?? 0);
  return Math.min(5, Math.max(0, offset));
}

function makeId() {
  // 충돌 거의 없는 간단 ID
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function loadMemosMigratingIfNeeded() {
  const obj = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
  let memos = obj[STORAGE_KEYS.MEMOS];

  // 예전 버전: ["00:01:02", "00:03:04"] -> 새 버전으로 변환
  if (Array.isArray(memos) && (memos.length === 0 || typeof memos[0] === "string")) {
    memos = memos.map((t) => ({ id: makeId(), time: t, note: "" }));
    await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
    return memos;
  }

  if (!Array.isArray(memos)) memos = [];
  return memos;
}

async function addMemoItem(time) {
  const memos = await loadMemosMigratingIfNeeded();
  const item = { id: makeId(), time, note: "" };
  memos.push(item);
  await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
  return item;
}

// content.js -> 저장 요청 처리
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type !== "save_timestamp_request") return;

    const raw = msg.rawText ?? "";
    const hms = extractTime(raw);
    if (!hms) {
      sendResponse({ ok: false, reason: "no_time_found" });
      return;
    }

    const offset = await getOffset();
    const adjusted = toHMS(toSeconds(hms) - offset);

    const added = await addMemoItem(adjusted);

    // 팝업 실시간 갱신용
    chrome.runtime.sendMessage({ type: "memo_added", item: added });

    sendResponse({ ok: true, value: adjusted, item: added });
  })();

  return true;
});
