import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// 모두의 한글 v11
// + 의미낱말 2~5음절 확장 (스텝 5: 1음절 / 6: 2음절 / 7: 3음절 / 8: 4~5음절)
// + 이중모음(ㅘ 등)은 ㅗ·ㅏ 위치를 나눠 노랑 칸 2개로 표시
// + 의미낱말 스텝: 그림상징 선택판 — 상징을 눌러 쓸 단어를 고름
// ─────────────────────────────────────────────

const COLORS = {
  pink: { light: "#F5CFDF", solid: "#E993B6" },
  yellow: { light: "#F7F2B5", solid: "#EFE33B" },
  blue: { light: "#CFE0EF", solid: "#8FB8DC" },
};
const INK = "#2E2A25";
const GHOST = "#C6C0B6";
const MAT_RED = "#D93A35";

const F = { pinkW: 0.58, pinkH: 0.44, pinkH2: 0.5, blueH: 0.24 };

const CHO_SET = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅈ"];
const JUNG_SET = ["ㅏ", "ㅓ", "ㅗ", "ㅜ", "ㅣ"];
const JONG_SET = ["ㄱ", "ㄴ", "ㄹ", "ㅁ", "ㅂ"];
const VERT_VOWELS = ["ㅗ", "ㅛ", "ㅜ", "ㅠ", "ㅡ"];
const DIPH = { ㅘ: ["ㅗ", "ㅏ"], ㅙ: ["ㅗ", "ㅐ"], ㅚ: ["ㅗ", "ㅣ"], ㅝ: ["ㅜ", "ㅓ"], ㅞ: ["ㅜ", "ㅔ"], ㅟ: ["ㅜ", "ㅣ"], ㅢ: ["ㅡ", "ㅣ"] };

const CHO_SOUND = { ㄱ: "그", ㄲ: "끄", ㄴ: "느", ㄷ: "드", ㄸ: "뜨", ㄹ: "르", ㅁ: "므", ㅂ: "브", ㅃ: "쁘", ㅅ: "스", ㅆ: "쓰", ㅇ: "", ㅈ: "즈", ㅉ: "쯔", ㅊ: "츠", ㅋ: "크", ㅌ: "트", ㅍ: "프", ㅎ: "흐" };
const JUNG_SOUND = { ㅏ: "아", ㅐ: "애", ㅑ: "야", ㅓ: "어", ㅔ: "에", ㅕ: "여", ㅗ: "오", ㅘ: "와", ㅛ: "요", ㅜ: "우", ㅠ: "유", ㅡ: "으", ㅣ: "이" };
const JONG_SOUND = { ㄱ: "윽", ㄴ: "은", ㄷ: "읃", ㄹ: "을", ㅁ: "음", ㅂ: "읍", ㅅ: "읏", ㅇ: "응" };

function jamoSoundByRegion(jamo, region) {
  if (region === "pink") return CHO_SOUND[jamo] ?? "";
  if (region === "blue") return JONG_SOUND[jamo] ?? "";
  return JUNG_SOUND[jamo] ?? "";
}

function speak(text, rate = 0.8) {
  if (!text) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = rate;
    const voices = synth.getVoices();
    const ko = voices.find((v) => v.lang && v.lang.startsWith("ko"));
    if (ko) u.voice = ko;
    synth.speak(u);
  } catch (e) {}
}

// ── 의미낱말 (그림상징은 이모지 대체, 추후 img로 교체) ──
const WORDS_1 = [
  { text: "물", sylls: [["ㅁ", "ㅜ", "ㄹ"]], emoji: "💧" },
  { text: "밥", sylls: [["ㅂ", "ㅏ", "ㅂ"]], emoji: "🍚" },
  { text: "빵", sylls: [["ㅃ", "ㅏ", "ㅇ"]], emoji: "🍞" },
  { text: "차", sylls: [["ㅊ", "ㅏ"]], emoji: "🚗" },
  { text: "공", sylls: [["ㄱ", "ㅗ", "ㅇ"]], emoji: "⚽" },
  { text: "손", sylls: [["ㅅ", "ㅗ", "ㄴ"]], emoji: "✋" },
  { text: "발", sylls: [["ㅂ", "ㅏ", "ㄹ"]], emoji: "🦶" },
  { text: "눈", sylls: [["ㄴ", "ㅜ", "ㄴ"]], emoji: "👀" },
  { text: "코", sylls: [["ㅋ", "ㅗ"]], emoji: "👃" },
  { text: "입", sylls: [["ㅇ", "ㅣ", "ㅂ"]], emoji: "👄" },
  { text: "옷", sylls: [["ㅇ", "ㅗ", "ㅅ"]], emoji: "👕" },
  { text: "문", sylls: [["ㅁ", "ㅜ", "ㄴ"]], emoji: "🚪" },
  { text: "집", sylls: [["ㅈ", "ㅣ", "ㅂ"]], emoji: "🏠" },
  { text: "약", sylls: [["ㅇ", "ㅑ", "ㄱ"]], emoji: "💊" },
];
const WORDS_2 = [
  { text: "엄마", sylls: [["ㅇ", "ㅓ", "ㅁ"], ["ㅁ", "ㅏ"]], emoji: "👩" },
  { text: "아빠", sylls: [["ㅇ", "ㅏ"], ["ㅃ", "ㅏ"]], emoji: "👨" },
  { text: "우유", sylls: [["ㅇ", "ㅜ"], ["ㅇ", "ㅠ"]], emoji: "🥛" },
  { text: "과자", sylls: [["ㄱ", "ㅘ"], ["ㅈ", "ㅏ"]], emoji: "🍪" },
  { text: "사과", sylls: [["ㅅ", "ㅏ"], ["ㄱ", "ㅘ"]], emoji: "🍎" },
  { text: "주스", sylls: [["ㅈ", "ㅜ"], ["ㅅ", "ㅡ"]], emoji: "🧃" },
  { text: "버스", sylls: [["ㅂ", "ㅓ"], ["ㅅ", "ㅡ"]], emoji: "🚌" },
  { text: "가방", sylls: [["ㄱ", "ㅏ"], ["ㅂ", "ㅏ", "ㅇ"]], emoji: "🎒" },
  { text: "신발", sylls: [["ㅅ", "ㅣ", "ㄴ"], ["ㅂ", "ㅏ", "ㄹ"]], emoji: "👟" },
  { text: "양말", sylls: [["ㅇ", "ㅑ", "ㅇ"], ["ㅁ", "ㅏ", "ㄹ"]], emoji: "🧦" },
];
const WORDS_3 = [
  { text: "바나나", sylls: [["ㅂ", "ㅏ"], ["ㄴ", "ㅏ"], ["ㄴ", "ㅏ"]], emoji: "🍌" },
  { text: "자동차", sylls: [["ㅈ", "ㅏ"], ["ㄷ", "ㅗ", "ㅇ"], ["ㅊ", "ㅏ"]], emoji: "🚗" },
  { text: "화장실", sylls: [["ㅎ", "ㅘ"], ["ㅈ", "ㅏ", "ㅇ"], ["ㅅ", "ㅣ", "ㄹ"]], emoji: "🚽" },
  { text: "할머니", sylls: [["ㅎ", "ㅏ", "ㄹ"], ["ㅁ", "ㅓ"], ["ㄴ", "ㅣ"]], emoji: "👵" },
  { text: "유치원", sylls: [["ㅇ", "ㅠ"], ["ㅊ", "ㅣ"], ["ㅇ", "ㅝ", "ㄴ"]], emoji: "🏫" },
  { text: "초콜릿", sylls: [["ㅊ", "ㅗ"], ["ㅋ", "ㅗ", "ㄹ"], ["ㄹ", "ㅣ", "ㅅ"]], emoji: "🍫" },
];
const WORDS_45 = [
  { text: "텔레비전", sylls: [["ㅌ", "ㅔ", "ㄹ"], ["ㄹ", "ㅔ"], ["ㅂ", "ㅣ"], ["ㅈ", "ㅓ", "ㄴ"]], emoji: "📺" },
  { text: "할아버지", sylls: [["ㅎ", "ㅏ", "ㄹ"], ["ㅇ", "ㅏ"], ["ㅂ", "ㅓ"], ["ㅈ", "ㅣ"]], emoji: "👴" },
  { text: "미끄럼틀", sylls: [["ㅁ", "ㅣ"], ["ㄲ", "ㅡ"], ["ㄹ", "ㅓ", "ㅁ"], ["ㅌ", "ㅡ", "ㄹ"]], emoji: "🛝" },
  { text: "아이스크림", sylls: [["ㅇ", "ㅏ"], ["ㅇ", "ㅣ"], ["ㅅ", "ㅡ"], ["ㅋ", "ㅡ"], ["ㄹ", "ㅣ", "ㅁ"]], emoji: "🍦" },
  { text: "엘리베이터", sylls: [["ㅇ", "ㅔ", "ㄹ"], ["ㄹ", "ㅣ"], ["ㅂ", "ㅔ"], ["ㅇ", "ㅣ"], ["ㅌ", "ㅓ"]], emoji: "🛗" },
];
const MEANING_POOLS = { 5: WORDS_1, 6: WORDS_2, 7: WORDS_3, 8: WORDS_45 };

const STEP_INFO = {
  1: { title: "색깔 맞추기", sub: "숫자 단서 있음" },
  2: { title: "색깔 맞추기", sub: "단서 없음" },
  3: { title: "글자 만들기", sub: "자음 + 모음" },
  4: { title: "글자 만들기", sub: "받침까지" },
  5: { title: "의미낱말", sub: "1음절" },
  6: { title: "의미낱말", sub: "2음절" },
  7: { title: "의미낱말", sub: "3음절" },
  8: { title: "의미낱말", sub: "4~5음절" },
};

const CHO_LIST = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG_LIST = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG_LIST = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

function composeSyllable(cho, jung, jong) {
  const c = CHO_LIST.indexOf(cho);
  const j = JUNG_LIST.indexOf(jung);
  const t = jong ? JONG_LIST.indexOf(jong) : 0;
  return String.fromCharCode(0xac00 + (c * 21 + j) * 28 + t);
}

// 음절 자모 → 슬롯 목록 (이중모음은 노랑 2칸으로 분리)
function syllToSlots(jamos) {
  const [cho, jung, jong] = jamos;
  const slots = [{ region: "pink", jamo: cho }];
  if (DIPH[jung]) {
    const [v1, v2] = DIPH[jung];
    slots.push({ region: "yellowMid", jamo: v1 });
    slots.push({ region: "yellowRight", jamo: v2 });
  } else {
    slots.push({ region: "yellow", jamo: jung });
  }
  if (jong) slots.push({ region: "blue", jamo: jong });
  return slots;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let audioCtx = null;
function ensureCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playDing() {
  try {
    const ctx = ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}
function playChord() {
  try {
    const ctx = ensureCtx();
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.start(t);
      o.stop(t + 0.6);
    });
  } catch (e) {}
}

async function loadData() {
  try {
    const r = await window.storage.get("mh-data");
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) {}
  return { children: [], logs: {} };
}
async function saveData(d) {
  try {
    await window.storage.set("mh-data", JSON.stringify(d));
  } catch (e) {}
}

export default function ModuHangul() {
  const [screen, setScreen] = useState("home");
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ children: [], logs: {} });
  const [childId, setChildId] = useState("guest");
  const [newName, setNewName] = useState("");

  const [boxCount, setBoxCount] = useState(1);
  const [withBlueSetting, setWithBlueSetting] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [ttsOn, setTtsOn] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [round, setRound] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    (async () => setData(await loadData()))();
  }, []);

  const hasJamo = step >= 3;
  const isMeaning = step >= 5;
  const pool = MEANING_POOLS[step] ?? null;

  const [boards, setBoards] = useState([]); // [{slots:[{region,jamo|null}]}]
  const [wordInfo, setWordInfo] = useState(null);
  const [filledCount, setFilledCount] = useState(0);
  const [cards, setCards] = useState([]);
  const [done, setDone] = useState(false);
  const [drag, setDrag] = useState(null);

  const boardRefs = useRef([]);
  const cardRefs = useRef({});
  const dragRef = useRef(null);
  const errorsRef = useRef(0);
  const pressTimer = useRef(null);

  const totalSlots = boards.reduce((s, b) => s + b.slots.length, 0);
  const boardOffsets = boards.reduce((acc, b) => {
    acc.list.push(acc.sum);
    acc.sum += b.slots.length;
    return acc;
  }, { list: [], sum: 0 }).list;

  const setup = useCallback(() => {
    const bs = [];
    const all = [];
    let n = 0;
    let word = null;

    if (isMeaning && pool) {
      word = pool[wordIdx % pool.length];
      word.sylls.forEach((jamos) => {
        const slots = syllToSlots(jamos);
        bs.push({ slots });
        slots.forEach((s) => all.push({ id: "c" + n++, region: s.region, jamo: s.jamo, used: false, shaking: false }));
      });
    } else {
      const wb = step === 3 ? false : step === 4 ? true : withBlueSetting;
      for (let g = 0; g < boxCount; g++) {
        let slots;
        if (hasJamo) {
          const cho = pick(CHO_SET);
          const jung = pick(JUNG_SET);
          const jong = wb ? pick(JONG_SET) : null;
          slots = syllToSlots(wb ? [cho, jung, jong] : [cho, jung]);
        } else {
          slots = [
            { region: "pink", jamo: null },
            { region: "yellow", jamo: null },
            ...(wb ? [{ region: "blue", jamo: null }] : []),
          ];
        }
        bs.push({ slots });
        slots.forEach((s) => all.push({ id: "c" + n++, region: s.region, jamo: s.jamo, used: false, shaking: false }));
      }
      if (hasJamo) {
        word = {
          text: bs
            .map((b) => {
              const cho = b.slots[0].jamo;
              const jung = b.slots[1].jamo;
              const jong = b.slots.find((s) => s.region === "blue")?.jamo;
              return composeSyllable(cho, jung, jong);
            })
            .join(" "),
          emoji: null,
        };
      }
    }
    setBoards(bs);
    setWordInfo(word);
    setCards(shuffle(all));
    setFilledCount(0);
    setDone(false);
    errorsRef.current = 0;
  }, [boxCount, hasJamo, isMeaning, pool, round, step, withBlueSetting, wordIdx]);

  useEffect(() => {
    if (screen === "play") setup();
  }, [boxCount, withBlueSetting, round, step, screen, wordIdx]); // eslint-disable-line

  const recordComplete = useCallback(() => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.logs[childId]) next.logs[childId] = {};
      if (!next.logs[childId][step]) next.logs[childId][step] = { done: 0, errors: 0 };
      next.logs[childId][step].done += 1;
      next.logs[childId][step].errors += errorsRef.current;
      errorsRef.current = 0;
      saveData(next);
      return next;
    });
  }, [childId, step]);

  const addChild = () => {
    const name = newName.trim();
    if (!name) return;
    setData((prev) => {
      const id = "c" + Date.now();
      const next = { ...prev, children: [...prev.children, { id, name }] };
      saveData(next);
      setChildId(id);
      return next;
    });
    setNewName("");
  };

  const childName = childId === "guest" ? "게스트" : data.children.find((c) => c.id === childId)?.name ?? "게스트";

  const onPointerDown = (e, card) => {
    if (card.used || done) return;
    const el = cardRefs.current[card.id];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = { id: card.id, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    dragRef.current = d;
    setDrag(d);
    e.preventDefault();
  };

  // 보드별 레이아웃 정보
  const boardMeta = (b) => {
    const hasBlue = b.slots.some((s) => s.region === "blue");
    const hasSplit = b.slots.some((s) => s.region === "yellowMid");
    const pinkH = hasBlue ? F.pinkH : F.pinkH2;
    const bottom = hasBlue ? 1 - F.blueH : 1;
    return { hasBlue, hasSplit, pinkH, bottom };
  };

  const regionAtBoard = (b, relX, relY) => {
    const { hasBlue, hasSplit, pinkH } = boardMeta(b);
    if (hasBlue && relY >= 1 - F.blueH) return "blue";
    if (hasSplit) {
      if (relX < F.pinkW) return relY < pinkH ? "pink" : "yellowMid";
      return "yellowRight";
    }
    if (relY < pinkH && relX < F.pinkW) return "pink";
    return "yellow";
  };

  useEffect(() => {
    if (screen !== "play") return;
    const move = (e) => {
      if (!dragRef.current) return;
      const d = { ...dragRef.current, x: e.clientX, y: e.clientY };
      dragRef.current = d;
      setDrag(d);
    };
    const up = (e) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setDrag(null);
      const card = cards.find((c) => c.id === d.id);
      if (!card) return;

      let hitBoard = -1;
      let hitRegionKey = null;
      boardRefs.current.forEach((el, i) => {
        if (!el || i >= boards.length) return;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          hitBoard = i;
          hitRegionKey = regionAtBoard(boards[i], (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }
      });
      if (hitBoard === -1) return;

      const hitSlotIdx = boards[hitBoard].slots.findIndex((s) => s.region === hitRegionKey);
      if (hitSlotIdx === -1) return;
      const globalIdx = boardOffsets[hitBoard] + hitSlotIdx;

      // 다음에 채울 슬롯
      let eg = 0;
      let acc = 0;
      while (eg < boards.length && acc + boards[eg].slots.length <= filledCount) {
        acc += boards[eg].slots.length;
        eg++;
      }
      const ep = filledCount - acc;
      const expected = boards[eg]?.slots[ep];
      const isNext = globalIdx === filledCount;
      const isRightRegion = expected && card.region === expected.region;
      const isRightJamo = !hasJamo || card.jamo === expected?.jamo;

      if (isNext && isRightRegion && isRightJamo) {
        const willComplete = filledCount + 1 === totalSlots;
        if (hasJamo && ttsOn) {
          const sound = jamoSoundByRegion(card.jamo, expected.region);
          if (willComplete) {
            const wordText = wordInfo?.text ?? "";
            if (sound) speak(sound + ", " + wordText);
            else speak(wordText);
          } else if (sound) {
            speak(sound);
          } else if (soundOn) {
            playDing();
          }
        } else if (soundOn) {
          playDing();
        }

        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, used: true } : c)));
        setFilledCount((prev) => {
          const next = prev + 1;
          if (next === totalSlots) {
            setTimeout(() => {
              setDone(true);
              recordComplete();
              if (soundOn && !(hasJamo && ttsOn)) playChord();
            }, 250);
          }
          return next;
        });
      } else {
        errorsRef.current += 1;
        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, shaking: true } : c)));
        setTimeout(() => setCards((prev) => prev.map((c) => ({ ...c, shaking: false }))), 400);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [cards, soundOn, ttsOn, filledCount, totalSlots, boards, hasJamo, wordInfo, screen, recordComplete]); // eslint-disable-line

  const startPress = () => {
    pressTimer.current = setTimeout(() => setShowSettings(true), 1200);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const nBoards = boards.length;
  const boardSize =
    nBoards <= 1 ? "min(56vw, 240px)"
    : nBoards === 2 ? "min(38vw, 185px)"
    : nBoards === 3 ? "min(27vw, 150px)"
    : nBoards === 4 ? "min(21.5vw, 112px)"
    : "min(17.5vw, 92px)";
  const cardSize = nBoards <= 1 ? "min(20vw, 90px)" : nBoards <= 3 ? "min(15vw, 74px)" : "min(12vw, 56px)";
  const ghostFont =
    nBoards <= 1 ? "min(10vw, 46px)"
    : nBoards === 2 ? "min(7.5vw, 38px)"
    : nBoards === 3 ? "min(6vw, 30px)"
    : nBoards === 4 ? "min(4.6vw, 23px)"
    : "min(3.8vw, 19px)";
  const cardFont = nBoards <= 1 ? "min(10vw, 44px)" : nBoards <= 3 ? "min(7.5vw, 36px)" : "min(6vw, 27px)";

  // 슬롯의 자모 단서 위치
  const slotPos = (b, slot) => {
    const { hasBlue, pinkH, bottom } = boardMeta(b);
    if (slot.region === "pink") return { left: `${(F.pinkW / 2) * 100}%`, top: `${(pinkH / 2) * 100}%` };
    if (slot.region === "yellowMid") return { left: `${(F.pinkW / 2) * 100}%`, top: `${((pinkH + bottom) / 2) * 100}%` };
    if (slot.region === "yellowRight") return { left: `${((F.pinkW + 1) / 2) * 100}%`, top: `${(bottom / 2) * 100}%` };
    if (slot.region === "yellow") {
      if (slot.jamo && VERT_VOWELS.includes(slot.jamo)) {
        return { left: "50%", top: `${((pinkH + bottom) / 2) * 100}%` };
      }
      return { left: `${((F.pinkW + 1) / 2) * 100}%`, top: `${(pinkH / 2) * 100}%` };
    }
    return { left: "50%", top: `${(1 - F.blueH / 2) * 100}%` };
  };

  const regionColor = (region) => (region.startsWith("yellow") ? "yellow" : region);

  const renderBoard = (b, g) => {
    const baseIdx = boardOffsets[g];
    const { hasBlue, hasSplit, pinkH, bottom } = boardMeta(b);
    const slotFilled = (region) => {
      const idx = b.slots.findIndex((s) => s.region === region);
      return idx !== -1 && baseIdx + idx < filledCount;
    };
    const slotIsNext = (i) => baseIdx + i === filledCount && !done;

    const rs = (key, filled) => ({
      position: "absolute",
      background: filled ? COLORS[key].solid : COLORS[key].light,
      transition: "background 0.25s",
    });
    const numStyle = (i) => ({
      position: "absolute",
      fontSize: "min(6vw, 28px)",
      fontWeight: 700,
      color: INK,
      transform: "translate(-50%, -50%)",
      animation: slotIsNext(i) ? "mh-pop 0.9s ease-in-out infinite" : "none",
      lineHeight: 1,
      pointerEvents: "none",
    });

    return (
      <div
        key={g}
        ref={(el) => (boardRefs.current[g] = el)}
        style={{
          position: "relative",
          width: boardSize,
          height: boardSize,
          background: "#fff",
          boxShadow: "0 2px 8px rgba(46,42,37,0.10)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {!hasSplit && <div style={{ ...rs("yellow", slotFilled("yellow")), inset: 0 }} />}
        {hasSplit && (
          <>
            {/* 노랑 오른쪽 (두 번째 모음) */}
            <div
              style={{
                ...rs("yellow", slotFilled("yellowRight")),
                left: `${F.pinkW * 100}%`,
                top: 0,
                right: 0,
                height: `${bottom * 100}%`,
                borderLeft: "2px solid #fff",
              }}
            />
            {/* 노랑 가운데 (첫 번째 모음, 초성 아래) */}
            <div
              style={{
                ...rs("yellow", slotFilled("yellowMid")),
                left: 0,
                top: `${pinkH * 100}%`,
                width: `${F.pinkW * 100}%`,
                height: `${(bottom - pinkH) * 100}%`,
                borderTop: "2px solid #fff",
              }}
            />
          </>
        )}
        <div
          style={{
            ...rs("pink", slotFilled("pink")),
            left: 0,
            top: 0,
            width: `${F.pinkW * 100}%`,
            height: `${pinkH * 100}%`,
          }}
        />
        {hasBlue && (
          <div
            style={{
              ...rs("blue", slotFilled("blue")),
              left: 0,
              bottom: 0,
              width: "100%",
              height: `${F.blueH * 100}%`,
            }}
          />
        )}

        {/* 스텝 1: 숫자 단서 */}
        {step === 1 &&
          b.slots.map((s, i) => {
            const pos = slotPos(b, s);
            return (
              <div key={i} style={{ ...numStyle(i), ...pos }}>
                {i + 1}
              </div>
            );
          })}

        {/* 자모 단서 */}
        {hasJamo &&
          b.slots.map((s, i) => {
            const pos = slotPos(b, s);
            const filled = baseIdx + i < filledCount;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  ...pos,
                  transform: "translate(-50%, -50%)",
                  fontSize: ghostFont,
                  fontWeight: 800,
                  color: filled ? INK : GHOST,
                  animation: slotIsNext(i) ? "mh-pop 0.9s ease-in-out infinite" : "none",
                  transition: "color 0.25s",
                  lineHeight: 1,
                  pointerEvents: "none",
                }}
              >
                {s.jamo}
              </div>
            );
          })}
      </div>
    );
  };

  const doneText = isMeaning
    ? `${wordInfo?.emoji ?? ""} ${wordInfo?.text ?? ""} 완성!`
    : hasJamo
    ? (wordInfo?.text ?? "") + " 완성!"
    : "참 잘했어요!";

  // ─────────── 화면 ───────────

  if (screen === "home") {
    return (
      <Shell>
        <div style={{ textAlign: "center", paddingTop: 36 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: MAT_RED, letterSpacing: "0.16em" }}>온 의사소통 연구소</div>
          <h1 style={{ fontSize: 40, fontWeight: 900, margin: "6px 0 2px", color: INK }}>모두의 한글</h1>
          <div style={{ fontSize: 14, color: "#8B847A" }}>엘코닌 박스로 배우는 한글 첫걸음</div>
        </div>

        <div style={{ margin: "26px 16px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8B847A", marginBottom: 8 }}>학습자 선택</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={() => setChildId("guest")} style={chip(childId === "guest")}>게스트</button>
            {data.children.map((c) => (
              <button key={c.id} onClick={() => setChildId(c.id)} style={chip(childId === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="이름 추가"
              style={{
                flex: 1,
                border: "1.5px solid #E2DDD4",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 14,
                background: "#fff",
                color: INK,
                outline: "none",
              }}
            />
            <button onClick={addChild} style={{ ...chip(true), padding: "9px 16px" }}>추가</button>
          </div>
        </div>

        <div style={{ margin: "24px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStep(s);
                setRound(0);
                setWordIdx(0);
                setScreen("play");
              }}
              style={{
                border: "none",
                borderRadius: 16,
                padding: "14px 12px",
                background: "#fff",
                boxShadow: "0 2px 6px rgba(46,42,37,0.10)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: [COLORS.pink.solid, COLORS.yellow.solid, COLORS.blue.solid][(s - 1) % 3],
                    color: INK,
                    fontWeight: 800,
                    fontSize: 17,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {s}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{STEP_INFO[s].title}</div>
                  <div style={{ fontSize: 12, color: "#8B847A" }}>{STEP_INFO[s].sub}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ textAlign: "center", margin: "22px 0 30px" }}>
          <button onClick={() => setScreen("records")} style={{ ...chip(false), padding: "10px 22px", fontSize: 14 }}>
            학습 기록 보기
          </button>
        </div>
      </Shell>
    );
  }

  if (screen === "records") {
    const allKids = [{ id: "guest", name: "게스트" }, ...data.children];
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
          <button onClick={() => setScreen("home")} style={chip(false)}>← 처음으로</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: INK }}>학습 기록</div>
        </div>
        <div style={{ padding: "0 16px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
          {allKids.map((k) => {
            const log = data.logs[k.id] ?? {};
            const hasAny = Object.keys(log).length > 0;
            return (
              <div key={k.id} style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 6px rgba(46,42,37,0.08)" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 8 }}>{k.name}</div>
                {!hasAny && <div style={{ fontSize: 13, color: "#9A938A" }}>아직 기록이 없어요.</div>}
                {hasAny &&
                  [1, 2, 3, 4, 5, 6, 7, 8]
                    .filter((s) => log[s])
                    .map((s) => (
                      <div key={s} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0", borderTop: "1px solid #F1EDE6", color: INK }}>
                        <span style={{ fontWeight: 700 }}>스텝 {s} · {STEP_INFO[s].title}({STEP_INFO[s].sub})</span>
                        <span>완성 {log[s].done}회 · 오답 {log[s].errors}회</span>
                      </div>
                    ))}
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  // ── play ──
  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
        <button onClick={() => { setScreen("home"); setShowSettings(false); }} style={chip(false)}>←</button>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#9A938A" }}>
          {childName} · 스텝 {step} {STEP_INFO[step].title}
        </div>
        <button
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          style={{ ...chip(false), opacity: 0.6 }}
          title="길게 누르면 설정이 열려요"
        >
          ⚙
        </button>
      </div>

      {showSettings && (
        <div
          style={{
            margin: "0 16px 8px",
            background: "#fff",
            border: "1.5px solid #E2DDD4",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          {step <= 4 &&
            [1, 2, 3].map((n) => (
              <button key={n} onClick={() => setBoxCount(n)} style={chip(boxCount === n)}>
                박스 {n}개
              </button>
            ))}
          {step <= 2 && (
            <button onClick={() => setWithBlueSetting((v) => !v)} style={chip(withBlueSetting)}>
              파랑(3) 칸 {withBlueSetting ? "포함" : "없음"}
            </button>
          )}
          {hasJamo && (
            <button onClick={() => setTtsOn((v) => !v)} style={chip(ttsOn)}>
              음가 읽기 {ttsOn ? "켬" : "끔"}
            </button>
          )}
          <button onClick={() => setSoundOn((v) => !v)} style={chip(soundOn)}>
            효과음 {soundOn ? "켬" : "끔"}
          </button>
          <button onClick={() => setShowSettings(false)} style={{ ...chip(true), marginLeft: "auto" }}>
            닫기
          </button>
        </div>
      )}

      {/* 그림상징 선택판 — 이 스텝에서 만들 수 있는 단어들 */}
      {isMeaning && pool && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "4px 14px 8px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {pool.map((w, i) => {
            const selected = i === wordIdx % pool.length;
            return (
              <button
                key={w.text}
                onClick={() => {
                  setWordIdx(i);
                  if (ttsOn) speak(w.text);
                }}
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "#fff",
                  border: selected ? `3px solid ${MAT_RED}` : "1.5px solid #E2DDD4",
                  fontSize: 30,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: selected ? "0 2px 8px rgba(217,58,53,0.25)" : "none",
                }}
              >
                {w.emoji}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: "center", minHeight: 36 }}>
        {done && <div style={{ fontSize: 24, fontWeight: 800, color: "#2E7D4F" }}>{doneText}</div>}
      </div>

      {/* 매트 */}
      <div style={{ padding: "4px 12px 0" }}>
        <div
          style={{
            border: `5px solid ${MAT_RED}`,
            borderRadius: 26,
            background: "#FDFBF6",
            padding: "min(5vw, 26px) min(3vw, 18px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "min(3.5vw, 20px)",
            flexWrap: "wrap",
          }}
        >
          {isMeaning && (
            <div
              style={{
                width: "min(24vw, 110px)",
                height: "min(24vw, 110px)",
                background: "#fff",
                borderRadius: 16,
                border: "2px solid #E2DDD4",
                boxShadow: "0 2px 8px rgba(46,42,37,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "min(16vw, 72px)",
                lineHeight: 1,
                cursor: "pointer",
              }}
              onClick={() => ttsOn && speak(wordInfo?.text ?? "")}
              title="그림을 누르면 낱말을 읽어줘요"
            >
              {wordInfo?.emoji ?? ""}
            </div>
          )}
          {boards.map((b, g) => renderBoard(b, g))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {done && (
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <button
            onClick={() => {
              if (isMeaning) setWordIdx((i) => i + 1);
              else setRound((r) => r + 1);
            }}
            style={{
              background: INK,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "14px 44px",
              fontSize: 20,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            다음 →
          </button>
        </div>
      )}

      {/* 카드 트레이 */}
      <div
        style={{
          background: "#FDFBF6",
          borderTop: "1.5px solid #E2DDD4",
          padding: "12px 10px calc(12px + env(safe-area-inset-bottom))",
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 10,
          minHeight: 108,
        }}
      >
        {cards.map((c) => {
          const isDragging = drag && drag.id === c.id;
          const key = regionColor(c.region);
          return (
            <div
              key={c.id}
              ref={(el) => (cardRefs.current[c.id] = el)}
              onPointerDown={(e) => onPointerDown(e, c)}
              style={{
                width: cardSize,
                height: cardSize,
                borderRadius: 8,
                background: COLORS[key].solid,
                boxShadow: "0 3px 6px rgba(46,42,37,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: cardFont,
                fontWeight: 800,
                color: INK,
                cursor: c.used ? "default" : "grab",
                opacity: c.used ? 0 : isDragging ? 0.25 : 1,
                pointerEvents: c.used ? "none" : "auto",
                animation: c.shaking ? "mh-shake 0.4s" : "none",
                touchAction: "none",
              }}
            >
              {c.jamo || ""}
            </div>
          );
        })}
      </div>

      {drag &&
        (() => {
          const c = cards.find((x) => x.id === drag.id);
          return (
            <div
              style={{
                position: "fixed",
                left: drag.x - drag.w / 2,
                top: drag.y - drag.h / 2,
                width: drag.w,
                height: drag.h,
                borderRadius: 8,
                background: COLORS[regionColor(c?.region ?? "pink")].solid,
                boxShadow: "0 10px 24px rgba(46,42,37,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: cardFont,
                fontWeight: 800,
                color: INK,
                pointerEvents: "none",
                zIndex: 50,
              }}
            >
              {c?.jamo || ""}
            </div>
          );
        })()}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F3EFE7",
        fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif",
        color: INK,
        display: "flex",
        flexDirection: "column",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {children}
      <style>{`
        @keyframes mh-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-5px); }
        }
        @keyframes mh-pop {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50% { transform: translate(-50%,-50%) scale(1.35); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function chip(active) {
  return {
    border: `1.5px solid ${active ? "#2E2A25" : "#E2DDD4"}`,
    background: active ? "#2E2A25" : "#fff",
    color: active ? "#fff" : "#6B6459",
    borderRadius: 999,
    padding: "7px 14px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };
}
