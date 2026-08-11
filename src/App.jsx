import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─────────────────────────────────────────────
// 온의 언어 : 한글 v11
// + 의미낱말 2~5음절 확장 (스텝 5: 1음절 / 6: 2음절 / 7: 3음절 / 8: 4~5음절)
// + 이중모음(ㅘ 등)은 ㅗ·ㅏ 위치를 나눠 노랑 칸 2개로 표시
// + 의미낱말 스텝: 그림상징 선택판 — 상징을 눌러 쓸 단어를 고름
// + 스텝 9: 직접 입력한 단어로 연습 / 스텝 10: 단어+동사구 문장 / 스텝 11: 나의 정보
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

// iOS/Safari의 speechSynthesis는 pitch 조절 폭이 좁게 반영되는 경우가 많아
// 프로필 간 차이를 크게 벌려두고, 기기에 한국어 음성이 여러 개 있으면
// 성별에 따라 실제로 다른 음성을 선택한다.
const VOICE_PROFILES = {
  adultFemale: { label: "여자 성인", pitch: 1.15, rate: 0.85, gender: "female" },
  adultMale: { label: "남자 성인", pitch: 0.35, rate: 0.8, gender: "male" },
  girl: { label: "여자아이", pitch: 2, rate: 1.05, gender: "female" },
  boy: { label: "남자아이", pitch: 1.7, rate: 1.05, gender: "male" },
};
const VOICE_STORAGE_KEY = "mh-voice";

function loadVoiceProfile() {
  try {
    const v = window.localStorage.getItem(VOICE_STORAGE_KEY);
    if (v && VOICE_PROFILES[v]) return v;
  } catch (e) {}
  return "adultFemale";
}
function saveVoiceProfile(v) {
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, v);
  } catch (e) {}
}

const MALE_VOICE_HINTS = ["male", "man", "민준", "진호", "현우", "준서", "우진", "도윤"];
const FEMALE_VOICE_HINTS = ["female", "woman", "유나", "지민", "서연", "수아", "yuna"];

function pickKoVoice(gender) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const kos = synth.getVoices().filter((v) => v.lang && v.lang.startsWith("ko"));
    if (kos.length === 0) return null;
    if (kos.length === 1) return kos[0];
    const hints = gender === "male" ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS;
    const named = kos.find((v) => hints.some((h) => v.name.toLowerCase().includes(h.toLowerCase())));
    if (named) return named;
    // 이름으로 구분이 안 되면 성별별로 서로 다른 음성이라도 쓰도록 순서로 나눔
    return gender === "male" ? kos[kos.length - 1] : kos[0];
  } catch (e) {
    return null;
  }
}

function makeUtterance(text, { rate = 0.85, pitch = 1, gender = "female" } = {}) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = rate;
  u.pitch = pitch;
  const voice = pickKoVoice(gender);
  if (voice) u.voice = voice;
  return u;
}

// speechSynthesis.cancel()은 취소된 발화에도 onend를 발생시킨다.
// 세대 토큰 없이 onend에서 다음 항목을 재생하면, 이전 시퀀스의 잔여 음절이
// 새 발화 뒤에 끼어들어 실제로 놓은 자모와 다른 글자가 들린다.
let speechGen = 0;

function speak(text, opts) {
  if (!text) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    speechGen++; // 진행 중인 시퀀스 무효화
    synth.cancel();
    synth.speak(makeUtterance(text, opts));
  } catch (e) {}
}

// 새 문제로 넘어갈 때 이전 발화가 이어지지 않도록 끊는다.
function stopSpeech() {
  try {
    speechGen++;
    window.speechSynthesis?.cancel();
  } catch (e) {}
}

// 자모 음가 → 음절 → (단어) 를 짧은 간격을 두고 순서대로 읽는다.
function speakSequence(texts, opts, gapMs = 160) {
  const list = (texts || []).filter(Boolean);
  if (!list.length) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const myGen = ++speechGen;
    synth.cancel();
    let i = 0;
    const playNext = () => {
      if (myGen !== speechGen || i >= list.length) return;
      const u = makeUtterance(list[i++], opts);
      const advance = () => {
        if (myGen === speechGen) setTimeout(playNext, gapMs);
      };
      u.onend = advance;
      u.onerror = advance;
      synth.speak(u);
    };
    playNext();
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

// 무발화 학습자는 글자보다 상징으로 먼저 인식하므로 동사구에도 그림상징을 붙인다.
const VERB_PHRASES = [
  { text: "주세요", emoji: "🙏" },
  { text: "원해요", emoji: "🙋" },
  { text: "먹고 싶어요", emoji: "🍽️" },
  { text: "가고 싶어요", emoji: "🚶" },
  { text: "하고 싶어요", emoji: "💪" },
  { text: "해요", emoji: "✅" },
];

const DIGIT_SOUND = { "0": "공", "1": "일", "2": "이", "3": "삼", "4": "사", "5": "오", "6": "육", "7": "칠", "8": "팔", "9": "구" };

const MY_INFO_FIELDS = [
  { key: "name", label: "내 이름", icon: "🙋" },
  { key: "mom", label: "엄마 이름", icon: "👩" },
  { key: "dad", label: "아빠 이름", icon: "👨" },
  { key: "address", label: "우리 집 주소", icon: "🏠" },
  { key: "phone", label: "핸드폰 번호", icon: "📱" },
];
const EMPTY_INFO = { name: "", mom: "", dad: "", address: "", phone: "" };

const STEP_INFO = {
  1: { title: "색깔 맞추기", sub: "숫자 단서 있음" },
  2: { title: "색깔 맞추기", sub: "단서 없음" },
  3: { title: "글자 만들기", sub: "자음 + 모음" },
  4: { title: "글자 만들기", sub: "받침까지" },
  5: { title: "의미낱말", sub: "1음절" },
  6: { title: "의미낱말", sub: "2음절" },
  7: { title: "의미낱말", sub: "3음절" },
  8: { title: "의미낱말", sub: "4~5음절" },
  9: { title: "나만의 단어", sub: "직접 입력" },
  10: { title: "문장 만들기", sub: "단어 + 동사구" },
  11: { title: "나의 정보", sub: "이름 · 주소 · 전화" },
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

// 완성된 한글 음절 한 글자 → [초성, 중성, (종성)] 자모 배열로 분해
function decomposeSyllable(ch) {
  const code = ch.codePointAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const cho = CHO_LIST[Math.floor(code / (21 * 28))];
  const jung = JUNG_LIST[Math.floor((code % (21 * 28)) / 28)];
  const jongIdx = code % 28;
  const jong = jongIdx ? JONG_LIST[jongIdx] : null;
  return jong ? [cho, jung, jong] : [cho, jung];
}
function decomposeWord(word) {
  return Array.from(word || "").map(decomposeSyllable).filter(Boolean);
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

// 보드(엘코닌 박스) 하나의 슬롯 → 완성된 음절 글자 (음절 단위 TTS용, 이중모음 역변환 포함)
function boardSyllableText(b) {
  const cho = b.slots.find((s) => s.region === "pink")?.jamo;
  const jong = b.slots.find((s) => s.region === "blue")?.jamo || null;
  const mid = b.slots.find((s) => s.region === "yellowMid");
  const right = b.slots.find((s) => s.region === "yellowRight");
  let jung;
  if (mid && right) {
    const entry = Object.entries(DIPH).find(([, v]) => v[0] === mid.jamo && v[1] === right.jamo);
    jung = entry ? entry[0] : mid.jamo;
  } else {
    jung = b.slots.find((s) => s.region === "yellow")?.jamo;
  }
  if (!cho || !jung) return "";
  return composeSyllable(cho, jung, jong);
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

const STORAGE_KEY = "mh-data";

function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { children: [], logs: {} };
}
function saveData(d) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch (e) {}
}

const CUSTOM_WORDS_KEY = "mh-custom-words";
function loadCustomWords() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_WORDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}
function saveCustomWords(list) {
  try {
    window.localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(list));
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
  const [voiceProfile, setVoiceProfile] = useState(loadVoiceProfile);
  const [showSettings, setShowSettings] = useState(false);
  const [round, setRound] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);

  // 스텝 9: 나만의 단어
  const [customWords, setCustomWords] = useState(loadCustomWords);
  const [showWordManager, setShowWordManager] = useState(false);
  const [newWordText, setNewWordText] = useState("");
  const [newWordEmoji, setNewWordEmoji] = useState("");

  // 스텝 10: 문장 만들기
  const [verbIdx, setVerbIdx] = useState(0);
  const [verbPlaced, setVerbPlaced] = useState(false);

  // 스텝 11: 나의 정보
  const [infoCategory, setInfoCategory] = useState("name");
  const [partIdx, setPartIdx] = useState(0);
  const [showInfoManager, setShowInfoManager] = useState(false);
  const [infoForm, setInfoForm] = useState(EMPTY_INFO);

  const say = useCallback(
    (text) => speak(text, VOICE_PROFILES[voiceProfile]),
    [voiceProfile]
  );
  const saySequence = useCallback(
    (texts) => speakSequence(texts, VOICE_PROFILES[voiceProfile]),
    [voiceProfile]
  );
  const chooseVoice = (v) => {
    setVoiceProfile(v);
    saveVoiceProfile(v);
    speak("안녕하세요", VOICE_PROFILES[v]);
  };

  const showVoiceDebug = () => {
    const synth = window.speechSynthesis;
    if (!synth) {
      alert("이 브라우저는 음성 합성을 지원하지 않아요.");
      return;
    }
    const kos = synth.getVoices().filter((v) => v.lang && v.lang.startsWith("ko"));
    const maleV = pickKoVoice("male");
    const femaleV = pickKoVoice("female");
    const list = kos.length
      ? kos.map((v) => `- ${v.name} (${v.lang})${v.localService ? "" : " [온라인 음성]"}`).join("\n")
      : "(설치된 한국어 음성이 없어요)";
    const same = maleV && femaleV && maleV.name === femaleV.name;
    const msg =
      `설치된 한국어 음성: ${kos.length}개\n${list}\n\n` +
      `남자 프로필이 쓰는 음성: ${maleV?.name ?? "없음"}\n` +
      `여자 프로필이 쓰는 음성: ${femaleV?.name ?? "없음"}\n` +
      (same ? "→ 같은 음성 + 음높이만 다르게 적용 중" : "→ 서로 다른 음성을 사용 중");
    console.log(msg);
    alert(msg);
  };

  useEffect(() => {
    setData(loadData());
    // iOS는 speechSynthesis 음성 목록을 비동기로 늦게 채우는 경우가 많아 미리 깨워둔다.
    try {
      window.speechSynthesis?.getVoices();
      window.speechSynthesis?.addEventListener("voiceschanged", () => window.speechSynthesis.getVoices());
    } catch (e) {}
  }, []);

  const hasJamo = step >= 3;
  const isMeaning = step >= 5 && step <= 9;
  const isSentence = step === 10;
  const isMyInfo = step === 11;

  const SENTENCE_POOL = useMemo(
    () => [...WORDS_1, ...WORDS_2, ...WORDS_3, ...WORDS_45, ...customWords],
    [customWords]
  );
  const pool = step === 9 ? customWords : step === 10 ? SENTENCE_POOL : MEANING_POOLS[step] ?? null;

  const myInfo = data.myInfo?.[childId] ?? EMPTY_INFO;
  const myInfoKey = `${myInfo.name}|${myInfo.mom}|${myInfo.dad}|${myInfo.address}|${myInfo.phone}`;

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

    const pushSylls = (syllsArr) => {
      syllsArr.forEach((jamos) => {
        const slots = syllToSlots(jamos);
        bs.push({ slots });
        slots.forEach((s) => all.push({ id: "c" + n++, region: s.region, jamo: s.jamo, used: false, shaking: false }));
      });
    };

    if (isMyInfo) {
      if (infoCategory === "phone") {
        const raw = (myInfo.phone || "").trim();
        const groups = raw.split(/[^0-9]+/).filter(Boolean);
        if (groups.length > 0) {
          const group = groups[partIdx % groups.length];
          Array.from(group).forEach((d) => {
            bs.push({ slots: [{ region: "digit", jamo: d }] });
            all.push({ id: "c" + n++, region: "digit", jamo: d, used: false, shaking: false });
          });
          word = { text: Array.from(group).map((d) => DIGIT_SOUND[d] ?? d).join(" "), emoji: null, partsCount: groups.length };
        }
      } else if (infoCategory === "address") {
        const raw = (myInfo.address || "").trim();
        const eojeols = raw.split(/\s+/).filter((w) => decomposeWord(w).length > 0);
        if (eojeols.length > 0) {
          const chunk = eojeols[partIdx % eojeols.length];
          pushSylls(decomposeWord(chunk));
          word = { text: chunk, emoji: null, partsCount: eojeols.length };
        }
      } else {
        const raw = (myInfo[infoCategory] || "").trim();
        const sylls = decomposeWord(raw);
        if (sylls.length > 0) {
          pushSylls(sylls);
          word = { text: raw, emoji: null };
        }
      }
    } else if (isSentence) {
      if (pool && pool.length > 0) {
        word = pool[wordIdx % pool.length];
        pushSylls(word.sylls);
      }
    } else if (isMeaning) {
      if (pool && pool.length > 0) {
        word = pool[wordIdx % pool.length];
        pushSylls(word.sylls);
      }
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
    stopSpeech();
    setBoards(bs);
    setWordInfo(word);
    setCards(shuffle(all));
    setFilledCount(0);
    setDone(false);
    setVerbIdx(0);
    setVerbPlaced(false);
    errorsRef.current = 0;
  }, [boxCount, hasJamo, isMeaning, isSentence, isMyInfo, pool, round, step, withBlueSetting, wordIdx, infoCategory, partIdx, myInfoKey]); // eslint-disable-line

  useEffect(() => {
    if (screen === "play") setup();
  }, [boxCount, withBlueSetting, round, step, screen, wordIdx, customWords, infoCategory, partIdx, myInfoKey]); // eslint-disable-line

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

  // ── 스텝 9: 나만의 단어 관리 ──
  const addCustomWord = () => {
    const text = newWordText.trim().replace(/\s+/g, "");
    if (!text) return;
    const sylls = decomposeWord(text);
    if (sylls.length === 0) {
      alert("완성된 한글 단어를 입력해주세요.");
      return;
    }
    const entry = { text, sylls, emoji: newWordEmoji.trim() || "📝" };
    const next = [...customWords, entry];
    setCustomWords(next);
    saveCustomWords(next);
    setNewWordText("");
    setNewWordEmoji("");
  };
  const removeCustomWord = (i) => {
    const next = customWords.filter((_, idx) => idx !== i);
    setCustomWords(next);
    saveCustomWords(next);
    setWordIdx(0);
  };

  // ── 스텝 11: 나의 정보 관리 (기기에만 저장, 외부 전송 없음) ──
  const openInfoManager = () => {
    setInfoForm({
      name: myInfo.name || "",
      mom: myInfo.mom || "",
      dad: myInfo.dad || "",
      address: myInfo.address || "",
      phone: myInfo.phone || "",
    });
    setShowInfoManager(true);
  };
  const saveInfoForm = () => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.myInfo) next.myInfo = {};
      next.myInfo[childId] = { ...infoForm };
      saveData(next);
      return next;
    });
    setShowInfoManager(false);
    setPartIdx(0);
  };
  const clearMyInfo = () => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next.myInfo) delete next.myInfo[childId];
      saveData(next);
      return next;
    });
    setPartIdx(0);
  };

  // ── 스텝 10: 동사구 카드 놓기 ──
  const placeVerb = (idx) => {
    if (!done || verbPlaced) return;
    setVerbIdx(idx);
    setVerbPlaced(true);
    const sentence = `${wordInfo?.text ?? ""} ${VERB_PHRASES[idx].text}`;
    if (ttsOn) say(sentence);
    if (soundOn) playChord();
  };

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
    if (b.slots[0]?.region === "digit") return "digit";
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
        const board = boards[eg];
        const isDigitBoard = board.slots[0]?.region === "digit";
        const isSyllableEnd = ep + 1 === board.slots.length;

        if (hasJamo && ttsOn) {
          if (isDigitBoard) {
            const digitWord = DIGIT_SOUND[card.jamo] ?? card.jamo;
            if (willComplete) saySequence([digitWord, wordInfo?.text ?? ""]);
            else say(digitWord);
          } else {
            const sound = jamoSoundByRegion(card.jamo, expected.region);
            if (willComplete) {
              const syll = boardSyllableText(board);
              saySequence([sound, syll, wordInfo?.text ?? ""]);
            } else if (isSyllableEnd) {
              const syll = boardSyllableText(board);
              saySequence([sound, syll]);
            } else if (sound) {
              say(sound);
            } else if (soundOn) {
              playDing();
            }
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
  }, [cards, soundOn, ttsOn, filledCount, totalSlots, boards, hasJamo, wordInfo, screen, recordComplete, say, saySequence]); // eslint-disable-line

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

  const regionColor = (region) => (region.startsWith("yellow") ? "yellow" : region === "digit" ? "blue" : region);

  const renderBoard = (b, g) => {
    const baseIdx = boardOffsets[g];

    // 숫자 카드 보드 (스텝 11 · 핸드폰 번호): 단일 칸, 자모 구성 없음
    if (b.slots[0]?.region === "digit") {
      const filled = baseIdx < filledCount;
      const isNextSlot = baseIdx === filledCount && !done;
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: filled ? COLORS.blue.solid : COLORS.blue.light, transition: "background 0.25s" }} />
          <div
            style={{
              position: "relative",
              fontSize: ghostFont,
              fontWeight: 800,
              color: filled ? INK : GHOST,
              animation: isNextSlot ? "mh-pop 0.9s ease-in-out infinite" : "none",
              lineHeight: 1,
              pointerEvents: "none",
            }}
          >
            {b.slots[0].jamo}
          </div>
        </div>
      );
    }

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

  const celebrateReady = isSentence ? done && verbPlaced : done;
  // 스텝 9·11은 입력된 내용이 없으면 매트 대신 안내를 보여준다.
  const hasContentForCategory = boards.length > 0 || (!isMyInfo && step !== 9);

  // ─────────── 화면 ───────────

  if (screen === "home") {
    return (
      <Shell>
        <div style={{ textAlign: "center", paddingTop: 36 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: MAT_RED, letterSpacing: "0.16em" }}>온 의사소통 연구소</div>
          <h1 style={{ fontSize: 40, fontWeight: 900, margin: "6px 0 2px", color: INK }}>온의 언어 : 한글</h1>
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
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => (
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
                  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
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
        <button
          onClick={() => {
            setScreen("home");
            setShowSettings(false);
            setShowWordManager(false);
            setShowInfoManager(false);
          }}
          style={chip(false)}
        >
          ←
        </button>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#9A938A" }}>
          {childName} · 스텝 {step} {STEP_INFO[step].title}
        </div>
        <button onClick={() => setShowSettings((v) => !v)} style={{ ...chip(false), opacity: 0.6 }}>
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
          {hasJamo && (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#8B847A" }}>목소리</span>
              {Object.entries(VOICE_PROFILES).map(([key, p]) => (
                <button key={key} onClick={() => chooseVoice(key)} style={chip(voiceProfile === key)}>
                  {p.label}
                </button>
              ))}
              <button onClick={showVoiceDebug} style={{ ...chip(false), marginLeft: "auto" }}>
                설치된 음성 확인
              </button>
            </div>
          )}
          {isMyInfo && (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={openInfoManager} style={chip(false)}>정보 입력/수정</button>
              <button
                onClick={() => {
                  if (confirm("저장된 개인정보를 모두 삭제할까요?")) clearMyInfo();
                }}
                style={chip(false)}
              >
                정보 전체 삭제
              </button>
            </div>
          )}
          <button onClick={() => setSoundOn((v) => !v)} style={chip(soundOn)}>
            효과음 {soundOn ? "켬" : "끔"}
          </button>
          <button onClick={() => setShowSettings(false)} style={{ ...chip(true), marginLeft: "auto" }}>
            닫기
          </button>
        </div>
      )}

      {/* 그림상징 선택판 — 이 스텝에서 만들 수 있는 단어들 (스텝 5~10) */}
      {(isMeaning || isSentence) && pool && (
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
                key={w.text + i}
                onClick={() => {
                  setWordIdx(i);
                  if (ttsOn) say(w.text);
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
          {step === 9 && (
            <button
              onClick={() => setShowWordManager(true)}
              style={{
                flexShrink: 0,
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#fff",
                border: "1.5px dashed #C6C0B6",
                fontSize: 26,
                color: "#8B847A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              +
            </button>
          )}
        </div>
      )}

      {/* 스텝 11: 항목 선택판 */}
      {isMyInfo && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 14px 8px", WebkitOverflowScrolling: "touch" }}>
          {MY_INFO_FIELDS.map((f) => {
            const selected = infoCategory === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setInfoCategory(f.key);
                  setPartIdx(0);
                }}
                style={{
                  flexShrink: 0,
                  minWidth: 64,
                  height: 64,
                  borderRadius: 14,
                  background: "#fff",
                  border: selected ? `3px solid ${MAT_RED}` : "1.5px solid #E2DDD4",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  cursor: "pointer",
                  padding: "0 8px",
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{f.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{f.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {isMyInfo && wordInfo?.partsCount > 1 && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#9A938A", marginTop: -2 }}>
          {(partIdx % wordInfo.partsCount) + 1} / {wordInfo.partsCount}
        </div>
      )}

      <div style={{ textAlign: "center", minHeight: 36 }}>
        {celebrateReady && !isSentence && <div style={{ fontSize: 24, fontWeight: 800, color: "#2E7D4F" }}>{doneText}</div>}
      </div>

      {isMyInfo && !hasContentForCategory && (
        <div style={{ textAlign: "center", padding: "30px 20px" }}>
          <div style={{ fontSize: 14, color: "#9A938A", marginBottom: 12 }}>아직 입력된 내용이 없어요.</div>
          <button onClick={openInfoManager} style={{ ...chip(true), padding: "10px 20px" }}>정보 입력하기</button>
        </div>
      )}

      {step === 9 && customWords.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 20px" }}>
          <div style={{ fontSize: 14, color: "#9A938A", marginBottom: 12 }}>아직 추가된 단어가 없어요.</div>
          <button onClick={() => setShowWordManager(true)} style={{ ...chip(true), padding: "10px 20px" }}>단어 추가하기</button>
        </div>
      )}

      {/* 매트 */}
      {hasContentForCategory && (
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
            {(isMeaning || isSentence) && (
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
                onClick={() => ttsOn && say(wordInfo?.text ?? "")}
                title="그림을 누르면 낱말을 읽어줘요"
              >
                {wordInfo?.emoji ?? ""}
              </div>
            )}
            {boards.map((b, g) => renderBoard(b, g))}
          </div>
        </div>
      )}

      {/* 스텝 10: 문장 카드 자리 */}
      {isSentence && done && (
        <div style={{ textAlign: "center", margin: "10px 16px 0" }}>
          {!verbPlaced ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#8B847A", marginBottom: 8 }}>문장 카드를 골라 놓아주세요</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                {VERB_PHRASES.map((v, i) => (
                  <button
                    key={v.text}
                    onClick={() => placeVerb(i)}
                    style={{
                      border: "1.5px solid #E2DDD4",
                      background: "#fff",
                      borderRadius: 16,
                      padding: "10px 14px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                      minWidth: 88,
                      boxShadow: "0 2px 6px rgba(46,42,37,0.10)",
                    }}
                  >
                    <span style={{ fontSize: 34, lineHeight: 1 }}>{v.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{v.text}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 22, fontWeight: 800, color: "#2E7D4F", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{wordInfo?.emoji}</span>
              <span>{wordInfo?.text}</span>
              <span>{VERB_PHRASES[verbIdx].emoji}</span>
              <span>{VERB_PHRASES[verbIdx].text}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {celebrateReady && (
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <button
            onClick={() => {
              if (isMyInfo) setPartIdx((i) => i + 1);
              else if (isSentence) setWordIdx((i) => i + 1);
              else if (isMeaning) setWordIdx((i) => i + 1);
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

      {/* 스텝 9: 단어 관리 모달 */}
      {showWordManager && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(46,42,37,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowWordManager(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(92vw, 420px)", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: INK }}>단어 관리</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newWordText}
                onChange={(e) => setNewWordText(e.target.value)}
                placeholder="단어 (예: 우유)"
                style={{ flex: 1, border: "1.5px solid #E2DDD4", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: INK }}
              />
              <input
                value={newWordEmoji}
                onChange={(e) => setNewWordEmoji(e.target.value)}
                placeholder="이모지"
                style={{ width: 64, border: "1.5px solid #E2DDD4", borderRadius: 10, padding: "9px 12px", fontSize: 18, textAlign: "center", color: INK }}
              />
            </div>
            <button onClick={addCustomWord} style={{ ...chip(true), width: "100%", padding: "10px", marginBottom: 14 }}>
              단어 추가
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {customWords.length === 0 && <div style={{ fontSize: 13, color: "#9A938A" }}>아직 추가된 단어가 없어요.</div>}
              {customWords.map((w, i) => (
                <div key={w.text + i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #F1EDE6", borderRadius: 10 }}>
                  <span style={{ fontSize: 20 }}>{w.emoji || "📝"}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: INK }}>{w.text}</span>
                  <button onClick={() => removeCustomWord(i)} style={{ ...chip(false), padding: "4px 10px" }}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowWordManager(false)} style={{ ...chip(true), width: "100%", padding: "10px", marginTop: 14 }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 스텝 11: 정보 입력 모달 (기기 내 저장만, 외부 전송 없음) */}
      {showInfoManager && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(46,42,37,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowInfoManager(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(92vw, 420px)", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: INK }}>나의 정보 입력</div>
            <div style={{ fontSize: 12, color: "#9A938A", marginBottom: 14 }}>이 정보는 이 기기에만 저장되고 외부로 전송되지 않아요.</div>
            {MY_INFO_FIELDS.map((f) => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#8B847A", marginBottom: 4 }}>
                  {f.icon} {f.label}
                </div>
                <input
                  value={infoForm[f.key]}
                  onChange={(e) => setInfoForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.key === "phone" ? "예: 010-1234-5678" : f.key === "address" ? "예: 서울시 강남구" : "예: 홍길동"}
                  style={{ width: "100%", border: "1.5px solid #E2DDD4", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: INK, boxSizing: "border-box" }}
                />
              </div>
            ))}
            <button onClick={saveInfoForm} style={{ ...chip(true), width: "100%", padding: "10px", marginTop: 8 }}>
              저장
            </button>
            <button onClick={() => setShowInfoManager(false)} style={{ ...chip(false), width: "100%", padding: "10px", marginTop: 8 }}>
              취소
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F3EFE7",
        fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif",
        color: INK,
        display: "flex",
        flexDirection: "column",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
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
