const STORAGE_KEYS = {
  OFFSET: "offsetSeconds",
  MEMOS: "memos" // [{id,time,note}]
};

const elOffset = document.getElementById("offset");
const elOffsetValue = document.getElementById("offsetValue");

const elList = document.getElementById("list");
const elEmpty = document.getElementById("empty");
const btnCopyAll = document.getElementById("copyAll");
const btnClearAll = document.getElementById("clearAll");

function renderOffset(v) {
  elOffsetValue.textContent = `-${v}s`;
}

async function getMemos() {
  const obj = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
  let memos = obj[STORAGE_KEYS.MEMOS];

  // 마이그레이션: 문자열 배열이면 오브젝트로 변환
  if (Array.isArray(memos) && (memos.length === 0 || typeof memos[0] === "string")) {
    memos = memos.map((t) => ({ id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, time: t, note: "" }));
    await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
  }

  if (!Array.isArray(memos)) memos = [];
  return memos;
}

async function setMemos(memos) {
  await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
}

function renderList(memos) {
  elList.innerHTML = "";

  if (!memos || memos.length === 0) {
    elEmpty.style.display = "block";
    return;
  }
  elEmpty.style.display = "none";

  memos.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "item";
    row.style.flexDirection = "column";
    row.style.alignItems = "stretch";

    // 상단 라인: 시간(클릭 가능) + 삭제 버튼
    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";
    top.style.gap = "10px";

    const timeBtn = document.createElement("button");
    timeBtn.className = "btn";
    timeBtn.style.flex = "1";
    timeBtn.style.textAlign = "left";
    timeBtn.style.fontVariantNumeric = "tabular-nums";
    timeBtn.textContent = item.time;

    const del = document.createElement("button");
    del.className = "btn btn-mini";
    del.textContent = "삭제";
    del.addEventListener("click", async () => {
      memos.splice(idx, 1);
      await setMemos(memos);
      renderList(memos);
    });

    top.appendChild(timeBtn);
    top.appendChild(del);

    // 메모 영역(기본 숨김)
    const noteWrap = document.createElement("div");
    noteWrap.style.display = "none";
    noteWrap.style.marginTop = "8px";
    noteWrap.style.display = "none";

    const noteInput = document.createElement("textarea");
    noteInput.placeholder = "메모 입력...";
    noteInput.value = item.note || "";
    noteInput.style.width = "100%";
    noteInput.style.boxSizing = "border-box";
    noteInput.style.minHeight = "60px";
    noteInput.style.resize = "vertical";
    noteInput.style.borderRadius = "8px";
    noteInput.style.border = "1px solid #2c2c2c";
    noteInput.style.background = "#141414";
    noteInput.style.color = "#eee";
    noteInput.style.padding = "8px";
    noteInput.style.fontFamily = "inherit";
    noteInput.style.fontSize = "12px";
    noteInput.style.lineHeight = "1.35";

    const noteActions = document.createElement("div");
    noteActions.style.display = "flex";
    noteActions.style.gap = "8px";
    noteActions.style.marginTop = "8px";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn";
    saveBtn.textContent = "메모 저장";

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-mini";
    closeBtn.textContent = "닫기";

    noteActions.appendChild(saveBtn);
    noteActions.appendChild(closeBtn);

    noteWrap.appendChild(noteInput);
    noteWrap.appendChild(noteActions);

    // 시간 클릭 → 메모 토글
    timeBtn.addEventListener("click", () => {
      const isOpen = noteWrap.style.display !== "none";
      noteWrap.style.display = isOpen ? "none" : "block";
      if (!isOpen) {
        // 열릴 때 포커스
        setTimeout(() => noteInput.focus(), 0);
      }
    });

    // 메모 저장
    saveBtn.addEventListener("click", async () => {
      item.note = noteInput.value;
      memos[idx] = item;
      await setMemos(memos);
      saveBtn.textContent = "저장됨!";
      setTimeout(() => (saveBtn.textContent = "메모 저장"), 700);
    });

    // 닫기
    closeBtn.addEventListener("click", () => {
      noteWrap.style.display = "none";
    });

    row.appendChild(top);
    row.appendChild(noteWrap);
    elList.appendChild(row);
  });

  elList.scrollTop = elList.scrollHeight;
}

async function load() {
  const obj = await chrome.storage.local.get([STORAGE_KEYS.OFFSET]);
  const offset = Number(obj[STORAGE_KEYS.OFFSET] ?? 0);
  elOffset.value = String(offset);
  renderOffset(offset);

  const memos = await getMemos();
  renderList(memos);
}

elOffset.addEventListener("input", async (e) => {
  const v = Number(e.target.value);
  await chrome.storage.local.set({ [STORAGE_KEYS.OFFSET]: v });
  renderOffset(v);
});

btnClearAll.addEventListener("click", async () => {
  await setMemos([]);
  renderList([]);
});

btnCopyAll.addEventListener("click", async () => {
  const memos = await getMemos();
  // 시간 + 메모 같이 복사 (메모 없으면 시간만)
  const text = memos
    .map((x) => (x.note && x.note.trim().length > 0 ? `${x.time} - ${x.note.trim()}` : x.time))
    .join("\n");

  try {
    await navigator.clipboard.writeText(text);
    btnCopyAll.textContent = "복사됨!";
    setTimeout(() => (btnCopyAll.textContent = "전체 복사"), 800);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    btnCopyAll.textContent = "복사됨!";
    setTimeout(() => (btnCopyAll.textContent = "전체 복사"), 800);
  }
});

// background에서 새 항목 추가되면 갱신
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "memo_added") {
    const memos = await getMemos();
    renderList(memos);
  }
});

load();
