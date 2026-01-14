// ====== 치지직 라이브 타이머를 DOM 전체에서 찾아내는 강인한 버전 ======

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable === true;
}

function looksLikeLiveTimerText(text) {
  if (!text) return false;
  // HH:MM:SS 포함
  if (!/\b\d{2}:\d{2}:\d{2}\b/.test(text)) return false;

  // "스트리밍" 문구가 같이 있거나, 라이브 시작 tooltip이 있는 경우를 우선
  if (text.includes("스트리밍")) return true;
  return true; // 문구가 안 붙는 케이스도 있어서 일단 통과(아래에서 더 좁힘)
}

function pickBestTimerText() {
  // 1) tooltip 속성 기반 우선 탐색 (knife / kite 둘 다 대응)
  const tooltipCandidates = [
    'span[data-knife-tooltip*="라이브 시작"]',
    'span[data-kite-tooltip*="라이브 시작"]',
    'span[data-knife-tooltip^="라이브 시작"]',
    'span[data-kite-tooltip^="라이브 시작"]'
  ];

  for (const sel of tooltipCandidates) {
    const el = document.querySelector(sel);
    if (el?.textContent && looksLikeLiveTimerText(el.textContent)) return el.textContent;
  }

  // 2) 클래스 기반(있으면 잡고, 없어도 다음 단계로)
  const byClass = document.querySelector(".video_information_count__Y05sI");
  if (byClass?.textContent && looksLikeLiveTimerText(byClass.textContent)) return byClass.textContent;

  // 3) DOM 전체에서 HH:MM:SS 텍스트를 가진 요소를 훑어서 찾기
  // 너무 무거워지지 않게 span/div 위주로 먼저
  const els = document.querySelectorAll("span, div, p");
  let fallback = null;

  for (const el of els) {
    const t = (el.textContent || "").trim();
    if (!looksLikeLiveTimerText(t)) continue;

    // "스트리밍" 포함이면 최우선
    if (t.includes("스트리밍")) return t;

    // 그 외엔 후보로만 저장
    if (!fallback) fallback = t;
  }

  // 4) 마지막 fallback: 후보가 있으면 반환
  return fallback;
}

function waitForTimerText(timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const tick = () => {
      const t = pickBestTimerText();
      if (t) return resolve(t);
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };

    tick();
  });
}

async function handleKeydown(e) {
  // p 단독키만 허용
  if ((e.key || "").toLowerCase() !== "p") return;

  // 타이핑 중(채팅 입력창 등)이면 저장 안 함
  if (isTypingTarget(e.target)) return;

  // 치지직 자체 단축키랑 충돌 방지
  e.preventDefault();
  e.stopPropagation();

  // 타이머 텍스트 찾기 (즉시 + 대기)
  let rawText = pickBestTimerText();
  if (!rawText) rawText = await waitForTimerText(8000);

  if (!rawText) {
    console.warn("[Chzzk Memo] time element not found (maybe iframe or different DOM)");
    return;
  }

  chrome.runtime.sendMessage(
    { type: "save_timestamp_request", rawText },
    (resp) => {
      if (!resp?.ok) console.warn("[Chzzk Memo] save failed:", resp);
    }
  );
}

document.addEventListener("keydown", handleKeydown, true);


