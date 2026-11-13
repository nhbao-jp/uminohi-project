"use strict";
import { parseQuestions } from "../utils/question-parser.js";
import { orderQuestions, shuffle } from "../utils/random.js";
import { speakJapanese } from "../services/japanese-speech.js";

let QUESTION_TIME_MS = 5000;
const SESSION_KEY_BASE = "jlptVocabularyQuizSessionV2";
let SESSION_KEY = SESSION_KEY_BASE;
let PROGRESS_KEY = "jlptVocabularyQuizProgressV1";
const SETTING_KEY = "jlptVocabularyQuizSettingsV1";
let correctAnswer = 0,
  wrongAnswer = 0,
  questions = [],
  activeQuestions = [],
  currentOptions = [],
  answerLookup = new Map(),
  hanVietLookup = new Map(),
  hanVietLoaded = false,
  rememberedList = new Map(),
  unrememberedList = new Map(),
  currentIndex = 0,
  reviewRound = 0,
  totalAttempts = 0,
  quizMode = "initial",
  isAnswerLocked = false,
  isDatasetReady = false,
  isPaused = false,
  isQuizScopeActive = false,
  randomQuestions = false,
  optimizedQuizUI = false,
  twoAnswerMode = false,
  showHanVietMeanings = true,
  autoOpenHomophones = false,
  vocabularyAudioEnabled = true,
  currentLanguage = "ja",
  scopeMode = "preset",
  scopeSize = 50,
  askedQuestionIds = new Set(),
  completedQuestionIds = new Set(),
  currentBatchIds = [],
  queuedQuizSettings = null,
  batchNumber = 0,
  batchStartAttempts = 0,
  batchStartCorrect = 0,
  batchStartWrong = 0,
  questionTimeoutId = null,
  timerIntervalId = null,
  questionToken = 0,
  timerRemainingMs = QUESTION_TIME_MS,
  timerStartedAt = 0,
  pauseAfterFeedback = false;
const e = {};
let reviewModal,
  resultModal,
  homophoneModal,
  resetModal,
  toast,
  timerAnimationId = null,
  currentHomophoneQuestion = null,
  activeCourseKey = null,
  isInitialized = false,
  isSuspended = false,
  isLoading = false,
  lastSessionRestored = false,
  feedbackAudioContext = null,
  feedbackAudioUnavailable = false,
  resultConfettiCanvas = null,
  resultConfettiFrameId = null,
  resultConfettiResizeHandler = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function getFeedbackAudioContext() {
  if (feedbackAudioUnavailable) return null;
  const AudioContextConstructor =
    window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    feedbackAudioUnavailable = true;
    console.warn(
      "Web Audio API is unavailable; quiz feedback sounds are disabled."
    );
    return null;
  }
  if (!feedbackAudioContext) {
    try {
      feedbackAudioContext = new AudioContextConstructor();
    } catch (error) {
      feedbackAudioUnavailable = true;
      console.warn("Could not initialize quiz feedback audio.", error);
      return null;
    }
  }
  return feedbackAudioContext;
}
function resumeFeedbackAudio(context) {
  if (context.state !== "suspended") return;
  try {
    context.resume().catch((error) => {
      console.warn("Could not activate quiz feedback audio.", error);
    });
  } catch (error) {
    console.warn("Could not activate quiz feedback audio.", error);
  }
}
export function unlockFeedbackAudio() {
  const context = getFeedbackAudioContext();
  if (context) resumeFeedbackAudio(context);
}
function playFeedbackSound(result) {
  const context = getFeedbackAudioContext();
  if (!context) return;
  const patterns = {
    correct: [
      { frequency: 660, delay: 0, duration: 0.1 },
      { frequency: 880, delay: 0.12, duration: 0.16 },
    ],
    incorrect: [
      { frequency: 330, delay: 0, duration: 0.14 },
      { frequency: 220, delay: 0.16, duration: 0.2 },
    ],
    timeout: [
      { frequency: 260, delay: 0, duration: 0.07 },
      { frequency: 260, delay: 0.12, duration: 0.07 },
      { frequency: 196, delay: 0.25, duration: 0.14 },
    ],
    celebration: [
      { frequency: 523, delay: 0, duration: 0.12 },
      { frequency: 659, delay: 0.13, duration: 0.12 },
      { frequency: 784, delay: 0.26, duration: 0.2 },
    ],
  };
  const notes = patterns[result];
  if (!notes) return;
  const peakGain =
    result === "celebration"
      ? 0.5
      : result === "incorrect" || result === "timeout"
      ? 0.5
      : 0.5;
  try {
    resumeFeedbackAudio(context);
    const now = context.currentTime;
    for (const note of notes) {
      const startAt = now + note.delay;
      const endAt = startAt + note.duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = result === "incorrect" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(note.frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.01);
    }
  } catch (error) {
    console.warn("Could not play quiz feedback sound.", error);
  }
}
function stopResultConfetti() {
  if (resultConfettiFrameId !== null) {
    cancelAnimationFrame(resultConfettiFrameId);
    resultConfettiFrameId = null;
  }
  if (resultConfettiResizeHandler) {
    window.removeEventListener("resize", resultConfettiResizeHandler);
    resultConfettiResizeHandler = null;
  }
  resultConfettiCanvas?.remove();
  resultConfettiCanvas = null;
}
function startResultCelebration() {
  stopResultConfetti();
  playFeedbackSound("celebration");
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "result-confetti-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) {
    console.warn("Could not create the result confetti canvas context.");
    return;
  }
  resultConfettiCanvas = canvas;
  document.body.appendChild(canvas);

  const resizeCanvas = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * pixelRatio);
    canvas.height = Math.round(window.innerHeight * pixelRatio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };
  resultConfettiResizeHandler = resizeCanvas;
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const colors = [
    "#f43f5e",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
    "#06b6d4",
  ];
  const launchPoints = [
    window.innerWidth * 0.12,
    window.innerWidth * 0.5,
    window.innerWidth * 0.88,
  ];
  const particles = launchPoints.flatMap((launchX, launcherIndex) =>
    Array.from({ length: 36 }, () => ({
      x: launchX + (Math.random() - 0.5) * 18,
      y: window.innerHeight + 8,
      velocityX:
        (launcherIndex - 1) * 2 + (Math.random() - 0.5) * 6,
      velocityY: -(12 + Math.random() * 8),
      width: 5 + Math.random() * 5,
      height: 7 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.24,
    }))
  );
  let startTime = null;
  let lastFrameTime = null;
  const animate = (time) => {
    if (resultConfettiCanvas !== canvas) return;
    startTime ??= time;
    const elapsed = time - startTime;
    const frameScale =
      lastFrameTime === null
        ? 1
        : Math.min(2, (time - lastFrameTime) / 16.67);
    lastFrameTime = time;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const particle of particles) {
      particle.x += particle.velocityX * frameScale;
      particle.y += particle.velocityY * frameScale;
      particle.velocityY += 0.28 * frameScale;
      particle.rotation += particle.rotationSpeed * frameScale;
      context.save();
      context.globalAlpha = Math.min(1, (2600 - elapsed) / 700);
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(
        -particle.width / 2,
        -particle.height / 2,
        particle.width,
        particle.height
      );
      context.restore();
    }

    if (elapsed >= 2600) {
      stopResultConfetti();
      return;
    }
    resultConfettiFrameId = requestAnimationFrame(animate);
  };
  resultConfettiFrameId = requestAnimationFrame(animate);
}
const I18N = {
  ja: {
    settings: "設定",
    language: "表示言語",
    languageDesc: "インターフェースの表示言語を選択します。",
    mode: "モード",
    initial: "初回",
    review: (n) => `復習 ${n}回目`,
    remembered: "覚えた単語",
    unremembered: "未習得単語",
    rounds: "復習回数",
    progress: "進捗",
    currentProgress: "現在の問題数",
    overallProgress: "全体の進捗",
    overallCounter: (done, total) => `完了 ${done} / ${total}問`,
    answerTime: "回答時間",
    question: "問題",
    reviewQuestion: "未習得単語の復習",
    paused: "一時停止中",
    resume: "問題カードをタップ、またはSpaceキーで再開",
    save: "セッションを保存",
    reset: "最初からリセット",
    random: "問題をランダムに出題",
    randomDesc: "各ラウンド開始時に問題順をシャッフルします。",
    timeout: "回答時間",
    timeoutDesc:
      "1問あたり3〜30秒で設定できます。変更は次の問題から適用されます。",
    optimizeQuiz: "テスト画面を最適化",
    optimizeQuizDesc:
      "回答時間のカウント中は統計・進捗・フッターを隠し、問題と回答に集中できます。",
    twoAnswerMode: "2択モード",
    twoAnswerModeDesc: "正解と、その問題に設定された選択肢からランダムに1つを出題します。設定は次の問題から適用されます。",
    showHanViet: "漢字の漢越音を表示",
    showHanVietDesc: "問題カードに漢越音を表示します。",
    vocabularyAudio: "単語の音声再生",
    vocabularyAudioDesc:
      "回答後または時間切れ後に単語の音声を再生します。",
    autoOpenHomophones: "同音異義語を自動で表示",
    autoOpenHomophonesDesc:
      "回答後、同じ読み方の単語がある場合に一覧を自動で開きます。閉じると次の問題へ進みます。",
    seconds: "秒",
    saved: "セッションを保存しました",
    languageChanged: "表示言語を日本語に変更しました",
    questionCounter: (n, t) => `第${n}問 / 全${t}問`,
    scope: "問題数",
    scopeDesc: "1回のテストで出題する問題数を設定します。",
    scopeUnit: "問",
    scopeStatus: (done, total) => `出題済み：${done} / ${total}問`,
    result: "テスト結果",
    nextBatch: "次の問題セットへ",
    resetAll: "すべてリセット",
    footerCredit: (year) =>
      `© ${year} Uminohi · 開発: BaoNH4. すべての権利を保有します。`,
    loading: "データセットを読み込んでいます...",
    customScope: "カスタム",
    fullScope: "全問題",
    reviewTitle: "未習得単語一覧",
    reviewRemaining: (n) => `未習得単語は残り${n}語です。`,
    startReview: "復習を開始",
    resultTotal: "総単語数",
    resultRemembered: "覚えた単語",
    resultAttempts: "総回答数",
    resultRounds: "復習回数",
    resetTitle: "リセットしますか？",
    resetBody:
      "保存済みセッションと現在の進捗を削除し、第1問からやり直します。",
    cancel: "キャンセル",
    resetConfirm: "リセット",
    timedOut: "時間切れ・未習得単語に追加しました",
    invalidData: "有効なデータがありません",
    noMeaning: "意味なし",
    showHomophones: (n) => `同音異義語を見る（${n}語）`,
    homophonesTitle: "同じ読み方の単語",
    homophonesReading: "読み方",
    homophonesCurrent: "この問題の正解",
    close: "閉じる",
    emptyAnswer: "（空欄）",
    randomOn: "ランダム出題をオンにしました",
    randomOff: "ランダム出題をオフにしました",
    timeoutSet: (n) => `回答時間を${n}秒に設定しました`,
    restored: "保存したセッションを復元しました",
    loadFailed: (message) => `データセットを読み込めませんでした：${message}`,
    hanVietLoadFailed: (message) =>
      `漢字データを読み込めませんでした：${message}`,
  },
  vi: {
    settings: "Cài đặt",
    language: "Ngôn ngữ hiển thị",
    languageDesc: "Chọn ngôn ngữ hiển thị cho website.",
    mode: "Chế độ",
    initial: "Lần đầu",
    review: (n) => `Ôn lần ${n}`,
    remembered: "Đã nhớ",
    unremembered: "Chưa nhớ",
    rounds: "Lượt ôn",
    progress: "Tiến độ",
    currentProgress: "Số lượng câu hỏi hiện tại",
    overallProgress: "Tiến độ chung",
    overallCounter: (done, total) => `Đã kiểm tra ${done} / ${total}`,
    answerTime: "Thời gian trả lời",
    question: "Câu hỏi",
    reviewQuestion: "Ôn từ chưa nhớ",
    paused: "Đang tạm dừng",
    resume: "Chạm vào câu hỏi hoặc nhấn Space để tiếp tục",
    save: "Lưu phiên hiện tại",
    reset: "Làm lại từ đầu",
    random: "Ngẫu nhiên câu hỏi",
    randomDesc: "Xáo trộn thứ tự câu hỏi khi bắt đầu mỗi vòng.",
    timeout: "Thời gian trả lời",
    timeoutDesc:
      "Có thể đặt từ 3 đến 30 giây cho mỗi câu. Áp dụng từ câu tiếp theo.",
    optimizeQuiz: "Tối ưu giao diện kiểm tra",
    optimizeQuizDesc:
      "Khi thời gian trả lời đang đếm, ẩn thống kê, tiến độ và footer để tập trung vào câu hỏi.",
    twoAnswerMode: "Chế độ 2 đáp án",
    twoAnswerModeDesc:
      "Dùng đáp án đúng và chọn ngẫu nhiên một đáp án nhiễu của câu hỏi. Áp dụng từ câu tiếp theo.",
    showHanViet: "Hiện Hán-Việt",
    showHanVietDesc: "Hiển thị nghĩa Hán-Việt dưới chữ Kanji trong thẻ câu hỏi.",
    vocabularyAudio: "Phát âm từ vựng",
    vocabularyAudioDesc:
      "Phát âm từ vựng sau khi trả lời hoặc hết giờ.",
    autoOpenHomophones: "Tự động mở từ đồng âm",
    autoOpenHomophonesDesc:
      "Tự mở danh sách từ đồng âm sau khi trả lời; đóng popup để tiếp tục.",
    seconds: "giây",
    saved: "Đã lưu phiên hiện tại",
    languageChanged: "Đã chuyển giao diện sang tiếng Việt",
    questionCounter: (n, t) => `Câu ${n} / ${t}`,
    scope: "Số lượng câu hỏi",
    scopeDesc: "Chọn số lượng câu hỏi cho mỗi lần kiểm tra.",
    scopeUnit: "câu",
    scopeStatus: (done, total) => `Đã hỏi: ${done} / ${total} câu`,
    result: "Kết quả bài kiểm tra",
    nextBatch: "Bộ câu hỏi tiếp theo",
    resetAll: "Đặt lại tất cả",
    footerCredit: (year) =>
      `Copyright © ${year} Uminohi · Developed by BaoNH4. All rights reserved.`,
    loading: "Đang tải dữ liệu...",
    customScope: "Tùy chỉnh",
    fullScope: "Tất cả câu hỏi",
    reviewTitle: "Danh sách từ chưa nhớ",
    reviewRemaining: (n) => `Còn ${n} từ chưa nhớ.`,
    startReview: "Bắt đầu ôn tập",
    resultTotal: "Tổng số từ",
    resultRemembered: "Từ đã nhớ",
    resultAttempts: "Tổng lượt trả lời",
    resultRounds: "Số lần ôn",
    resetTitle: "Xác nhận đặt lại?",
    resetBody:
      "Xóa phiên đã lưu và toàn bộ tiến độ hiện tại, sau đó làm lại từ câu đầu tiên.",
    cancel: "Hủy",
    resetConfirm: "Đặt lại",
    timedOut: "Hết giờ — đã thêm vào danh sách chưa nhớ",
    invalidData: "Không có dữ liệu hợp lệ",
    noMeaning: "Không có nghĩa",
    showHomophones: (n) => `Xem từ đồng âm (${n} từ)`,
    homophonesTitle: "Các từ đồng âm",
    homophonesReading: "Cách đọc",
    homophonesCurrent: "Đáp án của câu này",
    close: "Đóng",
    emptyAnswer: "(Trống)",
    randomOn: "Đã bật câu hỏi ngẫu nhiên",
    randomOff: "Đã tắt câu hỏi ngẫu nhiên",
    timeoutSet: (n) => `Đã đặt thời gian trả lời là ${n} giây`,
    restored: "Đã khôi phục phiên đã lưu",
    loadFailed: (message) => `Không thể tải dữ liệu khóa học: ${message}`,
    hanVietLoadFailed: (message) =>
      `Không thể tải dữ liệu Hán-Việt: ${message}`,
  },
};
function tr() {
  return I18N[currentLanguage] || I18N.ja;
}
function applyTwoAnswerModeSetting() {
  twoAnswerMode = e.twoAnswerModeToggle.checked;
  persistSettings();
}
function applyHanVietSetting() {
  showHanVietMeanings = e.showHanVietToggle.checked;
  if (isAnswerLocked && currentIndex > 0)
    renderQuestionText(activeQuestions[currentIndex - 1], true);
  persistSettings();
}
function applyAutoOpenHomophonesSetting() {
  autoOpenHomophones = e.autoOpenHomophonesToggle.checked;
  persistSettings();
}
function applyVocabularyAudioSetting() {
  vocabularyAudioEnabled = e.vocabularyAudioToggle.checked;
  if (!vocabularyAudioEnabled) stopSpeechPlayback();
  persistSettings();
}
function getEffectiveScopeSize() {
  return scopeMode === "full"
    ? questions.length
    : Math.max(1, Math.min(questions.length, Number(scopeSize) || 50));
}
function updateScopeStatus() {
  if (!e.scopeStatus || !questions.length) return;
  e.scopeStatus.textContent = tr().scopeStatus(
    askedQuestionIds.size,
    questions.length
  );
}
function updateDatasetProgress() {
  if (!e.datasetProgressCounter || !questions.length) return;
  const completed = Math.min(completedQuestionIds.size, questions.length);
  const percent = questions.length ? (completed / questions.length) * 100 : 0;
  e.datasetProgressCounter.textContent = tr().overallCounter(
    completed,
    questions.length
  );
  e.datasetProgressText.textContent = `${percent
    .toFixed(1)
    .replace(/\.0$/, "")}%`;
  e.datasetProgressBar.style.width = `${percent}%`;
}
function sessionStorageKey(courseKey) {
  return courseKey === "n3/tong-hop-tu-vung-n3"
    ? SESSION_KEY_BASE
    : `${SESSION_KEY_BASE}:${courseKey}`;
}
function progressStorageKey(courseKey) {
  return courseKey === "n3/tong-hop-tu-vung-n3"
    ? "jlptVocabularyQuizProgressV1"
    : `jlptVocabularyQuizProgressV1:${courseKey}`;
}
function getRuntimeQuizSettings() {
  return {
    randomQuestions,
    optimizedQuizUI,
    twoAnswerMode,
    questionTimeSeconds: QUESTION_TIME_MS / 1000,
    scopeMode,
    scopeSize,
  };
}
function hasSameQuizSettings(first, second) {
  return [
    "randomQuestions",
    "optimizedQuizUI",
    "twoAnswerMode",
    "questionTimeSeconds",
    "scopeMode",
    "scopeSize",
  ].every((key) => first[key] === second[key]);
}
function isQuizSettings(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.randomQuestions === "boolean" &&
      typeof value.optimizedQuizUI === "boolean" &&
      typeof value.twoAnswerMode === "boolean" &&
      Number.isFinite(Number(value.questionTimeSeconds)) &&
      ["preset", "custom", "full"].includes(value.scopeMode) &&
      Number.isFinite(Number(value.scopeSize))
  );
}
function restoreCourseProgress() {
  completedQuestionIds.clear();
  askedQuestionIds.clear();
  const questionIds = new Set(questions.map((question) => question.stt));
  const validIds = (value) =>
    Array.isArray(value)
      ? value.filter(
          (id) => Number.isInteger(id) && questionIds.has(id)
        )
      : [];
  try {
    const rawProgress = localStorage.getItem(PROGRESS_KEY);
    if (rawProgress) {
      const progress = JSON.parse(rawProgress);
      completedQuestionIds = new Set(
        validIds(progress.completedQuestionIds)
      );
      askedQuestionIds = new Set(validIds(progress.askedQuestionIds));
      return;
    }

    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) return;
    const snapshot = JSON.parse(rawSession);
    completedQuestionIds = new Set(
      validIds(snapshot.completedQuestionIds)
    );
    askedQuestionIds = new Set(validIds(snapshot.askedQuestionIds));
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        completedQuestionIds: [...completedQuestionIds],
        askedQuestionIds: [...askedQuestionIds],
      })
    );
  } catch (error) {
    console.warn("コースの進捗を復元できませんでした。", error);
    showToast(
      currentLanguage === "vi"
        ? "Không thể khôi phục tiến độ khóa học"
        : "コースの進捗を復元できませんでした"
    );
  }
}
function selectNextBatch() {
  if (askedQuestionIds.size >= questions.length) askedQuestionIds.clear();
  let available = questions.filter((q) => !askedQuestionIds.has(q.stt));
  const limit = Math.min(getEffectiveScopeSize(), available.length);
  if (randomQuestions) available = shuffle(available);
  else available.sort((a, b) => a.stt - b.stt);
  const batch = available.slice(0, limit);
  batch.forEach((q) => askedQuestionIds.add(q.stt));
  currentBatchIds = batch.map((q) => q.stt);
  batchNumber++;
  batchStartAttempts = totalAttempts;
  batchStartCorrect = correctAnswer;
  batchStartWrong = wrongAnswer;
  rememberedList.clear();
  unrememberedList.clear();
  reviewRound = 0;
  quizMode = "initial";
  currentIndex = 0;
  timerRemainingMs = QUESTION_TIME_MS;
  activeQuestions = [...batch];
  updateScopeStatus();
  updateDatasetProgress();
  return batch;
}
function applyScopeSetting(notify = true) {
  const value = e.scopeSizeSelect.value;
  if (value === "full") {
    scopeMode = "full";
    scopeSize = questions.length || 1403;
    e.customScopeWrap.classList.add("d-none");
  } else if (value === "custom") {
    scopeMode = "custom";
    scopeSize = Math.max(1, Math.round(Number(e.customScopeValue.value) || 50));
    e.customScopeValue.value = scopeSize;
    e.customScopeWrap.classList.remove("d-none");
  } else {
    scopeMode = "preset";
    scopeSize = Number(value);
    e.customScopeWrap.classList.add("d-none");
  }
  persistSettings();
  updateScopeStatus();
  if (notify)
    showToast(
      currentLanguage === "vi"
        ? `Số lượng câu hỏi mỗi lần: ${
            scopeMode === "full" ? "Toàn bộ" : scopeSize + " câu"
          }`
        : `1回の問題数：${scopeMode === "full" ? "全問題" : scopeSize + "問"}`
    );
}

function cache() {
  [
    "alertRegion",
    "loadingState",
    "loadingText",
    "quizApp",
    "modeText",
    "rememberedCount",
    "unrememberedCount",
    "reviewRoundText",
    "questionCounter",
    "progressText",
    "progressBar",
    "currentProgressLabel",
    "datasetProgressLabel",
    "datasetProgressCounter",
    "datasetProgressText",
    "datasetProgressBar",
    "wrongRateStamp",
    "wrongRateStampPercent",
    "timerText",
    "timerBar",
    "questionCard",
    "pauseOverlay",
    "questionLabel",
    "questionText",
    "answerRow",
    "homophoneAction",
    "homophoneButton",
    "homophoneButtonText",
    "homophoneModal",
    "homophoneModalTitle",
    "homophoneReading",
    "homophoneWordList",
    "homophoneModalDismiss",
    "homophoneModalClose",
    "saveButton",
    "resetButton",
    "randomQuestionToggle",
    "timeoutValue",
    "timeoutUnitText",
    "decreaseTimeoutButton",
    "increaseTimeoutButton",
    "scopeSizeSelect",
    "customScopeWrap",
    "customScopeValue",
    "scopeStatus",
    "scopeSettingLabel",
    "scopeSettingDescription",
    "scopeUnitText",
    "customScopeOption",
    "fullScopeOption",
    "languageSelect",
    "languageDropdownButton",
    "selectedLanguageFlag",
    "selectedLanguageText",
    "languageSettingLabel",
    "languageSettingDescription",
    "optimizedQuizToggle",
    "optimizedQuizSettingLabel",
    "optimizedQuizSettingDescription",
    "twoAnswerModeToggle",
    "twoAnswerModeSettingLabel",
    "twoAnswerModeSettingDescription",
    "showHanVietToggle",
    "showHanVietSettingLabel",
    "showHanVietSettingDescription",
    "autoOpenHomophonesToggle",
    "autoOpenHomophonesSettingLabel",
    "autoOpenHomophonesSettingDescription",
    "vocabularyAudioToggle",
    "vocabularyAudioSettingLabel",
    "vocabularyAudioSettingDescription",
    "settingsTitle",
    "reviewModal",
    "reviewTitleText",
    "reviewModalSubtitle",
    "reviewWordList",
    "startReviewButton",
    "startReviewButtonText",
    "resultModal",
    "restartButton",
    "nextBatchButton",
    "resultTitleText",
    "nextBatchButtonText",
    "restartButtonText",
    "resultTotal",
    "resultTotalLabel",
    "resultRemembered",
    "resultRememberedLabel",
    "resultAttempts",
    "resultAttemptsLabel",
    "resultRounds",
    "resultRoundsLabel",
    "resetConfirmModal",
    "resetTitleText",
    "resetBodyText",
    "cancelResetButton",
    "confirmResetButton",
    "footerCreditText",
    "appToast",
    "appToastBody",
  ].forEach((id) => (e[id] = document.getElementById(id)));
}
function showToast(m) {
  e.appToastBody.textContent = m;
  toast.show();
}
function alertMsg(m, t = "danger") {
  e.alertRegion.innerHTML = `<div class="alert alert-${t}">${m}</div>`;
}
function stats() {
  const t = tr();
  e.modeText.textContent =
    quizMode === "initial" ? t.initial : t.review(reviewRound);
  e.rememberedCount.textContent = rememberedList.size;
  e.unrememberedCount.textContent = unrememberedList.size;
  e.reviewRoundText.textContent = reviewRound;
}
function display(q) {
  return q.stt <= 1295 ? q.kanji || q.vocab : q.vocab;
}
function renderQuestionText(q, showReadings = false) {
  const content = document.createElement("span");
  content.className = "question-content";
  for (const character of Array.from(String(display(q) || ""))) {
    const meaning = hanVietLookup.get(character);
    if (!meaning) {
      content.appendChild(document.createTextNode(character));
      continue;
    }
    const unit = document.createElement("span");
    unit.className = "question-kanji-unit";
    const glyph = document.createElement("span");
    glyph.className = "question-kanji-glyph";
    glyph.textContent = character;
    const reading = document.createElement("span");
    reading.className = "question-han-viet";
    reading.textContent = meaning;
    const showMeaning = showReadings && showHanVietMeanings;
    reading.classList.toggle("is-visible", showMeaning);
    reading.setAttribute("aria-hidden", String(!showMeaning));
    unit.append(glyph, reading);
    content.appendChild(unit);
  }
  e.questionText.replaceChildren(content);
}
async function loadHanVietData() {
  if (hanVietLoaded) return;
  const response = await fetch(
    new URL("../data/han-viet-list.json", import.meta.url),
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const entries = await response.json();
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) =>
        !entry ||
        typeof entry.kanji !== "string" ||
        !entry.kanji ||
        typeof entry.han_viet !== "string" ||
        !entry.han_viet
    )
  )
    throw new Error("Invalid Han-Viet data");
  hanVietLookup = new Map(entries.map(({ kanji, han_viet }) => [kanji, han_viet]));
  hanVietLoaded = true;
}
function getAnswerCount() {
  return twoAnswerMode ? 2 : 4;
}
function createOptions(q) {
  if (!twoAnswerMode)
    return shuffle([q.answer1, q.answer2, q.answer3, q.answer4]);
  const distractors = [q.answer2, q.answer3, q.answer4].filter(
    (option) => option && option !== q.answer1
  );
  if (!distractors.length)
    throw new Error(`Question ${q.stt} has no valid distractor for 2-choice mode.`);
  const distractor = distractors[Math.floor(Math.random() * distractors.length)];
  return shuffle([q.answer1, distractor]);
}
function isKatakanaQuestion(q) {
  const text = String(q.kanji || "").trim();
  return Boolean(text) && /^[\u30A0-\u30FF\u31F0-\u31FFー・\s]+$/.test(text);
}
function clearTimer() {
  clearTimeout(questionTimeoutId);
  clearInterval(timerIntervalId);
  document.body.classList.remove("timer-warning-active");
  if (timerAnimationId !== null) {
    cancelAnimationFrame(timerAnimationId);
    timerAnimationId = null;
  }
  updateOptimizedQuizLayout();
}
function updateOptimizedQuizLayout() {
  document.body.classList.toggle(
    "optimized-quiz-active",
    optimizedQuizUI && isDatasetReady && isQuizScopeActive
  );
}
function timerUI(ms) {
  ms = Math.max(0, ms);
  e.timerText.textContent = `${(ms / 1000).toFixed(1)}${tr().seconds}`;
  e.timerBar.style.width = `${(ms / QUESTION_TIME_MS) * 100}%`;
  e.timerText.className = "timer-text";
  e.timerBar.className = "timer-bar";
  document.body.classList.toggle(
    "timer-warning-active",
    ms > 0 && ms <= 1500 && !isPaused && !isAnswerLocked
  );
  if (ms <= 1500) {
    e.timerText.classList.add("danger");
    e.timerBar.classList.add("danger");
  } else if (ms <= Math.min(3000, QUESTION_TIME_MS * 0.6)) {
    e.timerText.classList.add("warning");
    e.timerBar.classList.add("warning");
  }
}
function startTimer(ms = QUESTION_TIME_MS) {
  clearTimer();
  timerRemainingMs = ms;
  timerStartedAt = performance.now();
  const token = ++questionToken;
  updateOptimizedQuizLayout();
  timerUI(ms);
  const animate = (now) => {
    if (token !== questionToken || isPaused || isAnswerLocked) return;
    timerRemainingMs = Math.max(0, ms - (now - timerStartedAt));
    timerUI(timerRemainingMs);
    if (timerRemainingMs > 0) timerAnimationId = requestAnimationFrame(animate);
  };
  timerAnimationId = requestAnimationFrame(animate);
  questionTimeoutId = setTimeout(() => timeout(token), ms);
}
function render(saved = false) {
  clearTimer();
  isQuizScopeActive = true;
  updateOptimizedQuizLayout();
  if (currentIndex >= activeQuestions.length) return finish();
  isAnswerLocked = false;
  isPaused = false;
  const q = activeQuestions[currentIndex];
  if (!saved || currentOptions.length !== getAnswerCount())
    currentOptions = createOptions(q);
  const p = ((currentIndex + 1) / activeQuestions.length) * 100;
  e.questionCounter.textContent = tr().questionCounter(
    currentIndex + 1,
    activeQuestions.length
  );
  e.progressText.textContent = `${p.toFixed(2).replace(/\.00$/, "")}%`;
  e.progressBar.style.width = `${p}%`;
  updateDatasetProgress();
  e.questionLabel.textContent =
    quizMode === "initial" ? tr().question : tr().reviewQuestion;
  renderQuestionText(q);
  e.answerRow.innerHTML = "";
  e.answerRow.classList.toggle("two-answer-mode", twoAnswerMode);
  const hasHomophones = (answerLookup.get(String(q.answer1)) || []).length > 1;
  e.homophoneAction.classList.toggle("d-none", !hasHomophones);
  e.homophoneAction.classList.remove("is-visible");
  currentHomophoneQuestion = null;
  currentOptions.forEach((v, i) => {
    const b = document.createElement("button");
    b.className = "answer-card";
    b.innerHTML = `<span class="answer-shortcut">${
      i + 1
    }</span><span class="answer-value"></span>`;
    b.querySelector(".answer-value").textContent = v || tr().emptyAnswer;
    b.onclick = () => answer(i);
    e.answerRow.appendChild(b);
  });
  pauseUI();
  stats();
  startTimer(timerRemainingMs);
}
function pauseUI() {
  e.pauseOverlay.classList.toggle("d-none", !isPaused);
  [...e.answerRow.children].forEach(
    (b) => (b.disabled = isPaused || isAnswerLocked)
  );
}
function pause() {
  if (!isDatasetReady || isAnswerLocked) return;
  if (!isPaused) {
    timerRemainingMs = Math.max(
      0,
      timerRemainingMs - (performance.now() - timerStartedAt)
    );
    clearTimer();
    isPaused = true;
    speechSynthesis.pause();
  } else {
    isPaused = false;
    speechSynthesis.resume();
    startTimer(timerRemainingMs);
  }
  pauseUI();
  updateOptimizedQuizLayout();
}
function info(v, q, correct) {
  const x = document.createElement("div");
  x.className = "answer-info";
  const appendWordMeaning = (word, meaning) => {
    const meaningText = document.createElement("span");
    meaningText.className = "answer-info-meaning";
    meaningText.textContent = meaning;
    x.append(
      document.createTextNode(word),
      document.createElement("br"),
      meaningText
    );
  };
  if (v === correct && q) {
    if (isKatakanaQuestion(q) && q.vocab) {
      x.textContent = q.vocab;
      x.classList.add("katakana-english-info");
    } else {
      appendWordMeaning(
        q.kanji || q.vocab,
        q.meaning || tr().noMeaning
      );
    }
  } else {
    const items = answerLookup.get(String(v)) || [];
    const item = items[Math.floor(Math.random() * items.length)];
    if (item) {
      appendWordMeaning(
        item.kanji || item.vocab,
        item.meaning || tr().noMeaning
      );
    } else {
      x.textContent = tr().invalidData;
    }
  }
  x.style.whiteSpace = "pre-line";
  return x;
}
function openHomophoneModal(q) {
  const items = [
    ...(answerLookup.get(String(q.answer1)) || []),
    q,
  ].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.stt === item.stt) === index
  );
  items.sort((a, b) => a.stt - b.stt);
  e.homophoneReading.textContent = `${tr().homophonesReading}: ${q.answer1}`;
  e.homophoneWordList.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "homophone-item";
    if (item.stt === q.stt) card.classList.add("is-current-answer");

    const heading = document.createElement("div");
    heading.className = "homophone-item-heading";
    const word = document.createElement("strong");
    word.textContent = item.kanji || item.vocab;
    heading.appendChild(word);
    if (item.stt === q.stt) {
      const badge = document.createElement("span");
      badge.className = "homophone-current-badge";
      badge.textContent = tr().homophonesCurrent;
      heading.appendChild(badge);
    }

    const reading = document.createElement("div");
    reading.className = "homophone-item-reading";
    reading.textContent = item.vocab;
    const meaning = document.createElement("p");
    meaning.className = "mb-0";
    meaning.textContent = item.meaning || tr().noMeaning;
    card.append(heading, reading, meaning);
    e.homophoneWordList.appendChild(card);
  });
  homophoneModal.show();
}
function maybeOpenHomophones(q) {
  const homophones = answerLookup.get(String(q.answer1)) || [];
  if (!autoOpenHomophones || homophones.length <= 1) return false;
  openHomophoneModal(q);
  return true;
}
function decorate(sel, correct, q) {
  [...e.answerRow.children].forEach((c, i) => {
    c.disabled = true;
    const v = currentOptions[i],
      l = c.querySelector(".answer-value");
    if (v === correct) {
      c.classList.add("border-success", "bg-success-subtle");
      l.textContent = `✓ ${v}`;
    } else if (i === sel) {
      c.classList.add("border-danger", "bg-danger-subtle");
      l.textContent = `✗ ${v}`;
    }
    c.appendChild(info(v, q, correct));
  });
  const homophones = answerLookup.get(String(q.answer1)) || [];
  if (homophones.length > 1) {
    currentHomophoneQuestion = q;
    e.homophoneButtonText.textContent = tr().showHomophones(homophones.length);
    e.homophoneAction.classList.remove("d-none");
    e.homophoneAction.classList.add("is-visible");
  }
}
function waitForHomophoneModalClose() {
  return new Promise((resolve) => {
    const waitForHide = () =>
      e.homophoneModal.addEventListener("hidden.bs.modal", resolve, {
        once: true,
      });
    if (e.homophoneModal.classList.contains("show")) {
      waitForHide();
    } else {
      e.homophoneModal.addEventListener("shown.bs.modal", waitForHide, {
        once: true,
      });
    }
  });
}
async function waitForFeedback(delay, autoOpenedHomophones = false) {
  if (autoOpenedHomophones) {
    await waitForHomophoneModalClose();
    return;
  }
  await wait(delay);
  if (e.homophoneModal.classList.contains("show"))
    await waitForHomophoneModalClose();
}
function renderAfterFeedback(transitionToken) {
  if (transitionToken !== questionToken) return;
  const shouldPause = pauseAfterFeedback;
  pauseAfterFeedback = false;
  render();
  if (shouldPause && currentIndex < activeQuestions.length) pause();
}
async function answer(i) {
  if (
    !isDatasetReady ||
    isPaused ||
    isAnswerLocked ||
    currentIndex >= activeQuestions.length ||
    !Number.isInteger(i) ||
    i < 0 ||
    i >= currentOptions.length
  )
    return;
  isAnswerLocked = true;
  clearTimer();
  updateOptimizedQuizLayout();
  const transitionToken = ++questionToken;
  const q = activeQuestions[currentIndex],
    ok = currentOptions[i] === q.answer1;
  totalAttempts++;
  if (ok) {
    correctAnswer++;
    rememberedList.set(q.stt, q);
    unrememberedList.delete(q.stt);
  } else {
    wrongAnswer++;
    unrememberedList.set(q.stt, q);
    rememberedList.delete(q.stt);
  }
  decorate(i, q.answer1, q);
  playFeedbackSound(ok ? "correct" : "incorrect");
  renderQuestionText(q, true);
  stats();
  currentIndex++;
  currentOptions = [];
  timerRemainingMs = QUESTION_TIME_MS;
  speakVocabulary(q.vocab);
  const autoOpenedHomophones = maybeOpenHomophones(q);
  await waitForFeedback(1500, autoOpenedHomophones);
  renderAfterFeedback(transitionToken);
}
async function timeout(t) {
  if (t !== questionToken || isPaused || isAnswerLocked) return;
  isAnswerLocked = true;
  clearTimer();
  updateOptimizedQuizLayout();
  const transitionToken = ++questionToken;
  const q = activeQuestions[currentIndex];
  totalAttempts++;
  wrongAnswer++;
  unrememberedList.set(q.stt, q);
  rememberedList.delete(q.stt);
  e.questionLabel.textContent = tr().timedOut;
  decorate(-1, q.answer1, q);
  playFeedbackSound("timeout");
  stats();
  currentIndex++;
  currentOptions = [];
  timerRemainingMs = QUESTION_TIME_MS;
  speakVocabulary(q.vocab);
  const autoOpenedHomophones = maybeOpenHomophones(q);
  await waitForFeedback(700, autoOpenedHomophones);
  renderAfterFeedback(transitionToken);
}
function showWrongRateStamp(wrongRate) {
  return new Promise((resolve) => {
    if (!e.wrongRateStamp) return resolve();
    e.wrongRateStampPercent.textContent = `${Math.round(
      wrongRate * 100
    )}% WRONG`;
    e.wrongRateStamp.hidden = false;
    e.wrongRateStamp.classList.remove("is-showing");
    void e.wrongRateStamp.offsetWidth;
    e.wrongRateStamp.classList.add("is-showing");
    if (navigator.vibrate) navigator.vibrate([80, 45, 120]);
    setTimeout(() => {
      e.wrongRateStamp.classList.remove("is-showing");
      setTimeout(() => {
        e.wrongRateStamp.hidden = true;
        resolve();
      }, 260);
    }, 4740);
  });
}
async function finish() {
  clearTimer();
  isAnswerLocked = true;
  if (!unrememberedList.size) return complete();
  if (quizMode !== "review") {
    const wrongRate =
      Math.max(0, wrongAnswer - batchStartWrong) /
      Math.max(1, currentBatchIds.length);
    if (wrongRate > 0.5) await showWrongRateStamp(wrongRate);
  }
  const items = [...unrememberedList.values()].sort((a, b) => a.stt - b.stt);
  e.reviewModalSubtitle.textContent = tr().reviewRemaining(items.length);
  e.reviewWordList.innerHTML = "";
  items.forEach((x) => {
    const d = document.createElement("div");
    d.className = "review-word-item";
    d.textContent = `${x.stt}  ${x.kanji || x.vocab}（${x.vocab}）  ${
      x.meaning
    }`;
    e.reviewWordList.appendChild(d);
  });
  reviewModal.show();
}
function startReview() {
  quizMode = "review";
  reviewRound++;
  activeQuestions = orderQuestions([...unrememberedList.values()], randomQuestions);
  currentIndex = 0;
  timerRemainingMs = QUESTION_TIME_MS;
  reviewModal.hide();
  render();
}
function complete() {
  clearTimer();
  isAnswerLocked = true;
  isQuizScopeActive = false;
  updateOptimizedQuizLayout();
  currentBatchIds.forEach((id) => completedQuestionIds.add(id));
  updateDatasetProgress();
  e.resultTotal.textContent = currentBatchIds.length;
  e.resultRemembered.textContent = rememberedList.size;
  e.resultAttempts.textContent = totalAttempts - batchStartAttempts;
  e.resultRounds.textContent = reviewRound;
  saveCourseProgress();
  saveCompletedSession();
  resultModal.show();
}
function getRemainingTimeForSave() {
  if (isPaused || isAnswerLocked) return Math.max(0, timerRemainingMs);
  return Math.max(0, timerRemainingMs - (performance.now() - timerStartedAt));
}
function buildSessionSnapshot() {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    isCompleted:
      !isQuizScopeActive && currentIndex >= activeQuestions.length,
    quizMode,
    currentIndex,
    reviewRound,
    totalAttempts,
    correctAnswer,
    wrongAnswer,
    rememberedIds: [...rememberedList.keys()],
    unrememberedIds: [...unrememberedList.keys()],
    activeIds: activeQuestions.map((x) => x.stt),
    currentOptions: [...currentOptions],
    timerRemainingMs: getRemainingTimeForSave(),
    isPaused,
    askedQuestionIds: [...askedQuestionIds],
    completedQuestionIds: [...completedQuestionIds],
    currentBatchIds: [...currentBatchIds],
    batchNumber,
    batchStartAttempts,
    batchStartCorrect,
    batchStartWrong,
    scopeMode,
    scopeSize,
    settings: getRuntimeQuizSettings(),
    nextQuizSettings: queuedQuizSettings
      ? { ...queuedQuizSettings }
      : null,
  };
}
function save() {
  if (!isPaused || !isDatasetReady || !questions.length) return false;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(buildSessionSnapshot()));
    showToast(
      currentLanguage === "vi"
        ? "Đã lưu phiên hiện tại"
        : "セッションを保存しました"
    );
    return true;
  } catch (error) {
    console.warn("セッションを保存できませんでした。", error);
    showToast(
      currentLanguage === "vi"
        ? "Không thể lưu phiên hiện tại"
        : "セッションを保存できませんでした"
    );
    return false;
  }
}
function saveCompletedSession() {
  if (!isDatasetReady || !questions.length) return false;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(buildSessionSnapshot()));
    return true;
  } catch (error) {
    console.warn("セッションを保存できませんでした。", error);
    showToast(
      currentLanguage === "vi"
        ? "Không thể tự động lưu kết quả bài kiểm tra"
        : "テスト結果を自動保存できませんでした"
    );
    return false;
  }
}
function saveCourseProgress() {
  try {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        completedQuestionIds: [...completedQuestionIds],
        askedQuestionIds: [...askedQuestionIds],
      })
    );
    return true;
  } catch (error) {
    console.warn("コースの進捗を保存できませんでした。", error);
    showToast(
      currentLanguage === "vi"
        ? "Không thể tự động lưu tiến độ khóa học"
        : "コースの進捗を自動保存できませんでした"
    );
    return false;
  }
}
function restore() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    const m = new Map(questions.map((x) => [x.stt, x]));
    const ids = (value) =>
      Array.isArray(value)
        ? value.filter((id) => Number.isInteger(id) && m.has(id))
        : [];
    const activeIds = ids(d.activeIds);
    if (!activeIds.length) throw Error("Invalid active question list");
    const restoredActiveQuestions = activeIds.map((id) => m.get(id));
    const restoredIndex = Number(d.currentIndex);
    if (
      !Number.isInteger(restoredIndex) ||
      restoredIndex < 0 ||
      restoredIndex > restoredActiveQuestions.length
    )
      throw Error("Invalid current question index");

    if (isQuizSettings(d.settings)) applyRuntimeQuizSettings(d.settings);
    queuedQuizSettings = isQuizSettings(d.nextQuizSettings)
      ? { ...d.nextQuizSettings }
      : null;
    quizMode = d.quizMode === "review" ? "review" : "initial";
    currentIndex = restoredIndex;
    reviewRound = Math.max(0, Number(d.reviewRound) || 0);
    totalAttempts = Math.max(0, Number(d.totalAttempts) || 0);
    correctAnswer = Math.max(0, Number(d.correctAnswer) || 0);
    wrongAnswer = Math.max(0, Number(d.wrongAnswer) || 0);
    rememberedList = new Map(
      ids(d.rememberedIds).map((id) => [id, m.get(id)])
    );
    unrememberedList = new Map(
      ids(d.unrememberedIds).map((id) => [id, m.get(id)])
    );
    activeQuestions = restoredActiveQuestions;
    currentOptions = Array.isArray(d.currentOptions)
      ? d.currentOptions.slice(0, 4)
      : [];
    askedQuestionIds = new Set(ids(d.askedQuestionIds));
    completedQuestionIds = new Set(ids(d.completedQuestionIds));
    currentBatchIds = ids(d.currentBatchIds);
    if (!currentBatchIds.length)
      currentBatchIds = activeQuestions.map((q) => q.stt);
    batchNumber = Number(d.batchNumber) || 1;
    batchStartAttempts = Number(d.batchStartAttempts) || 0;
    batchStartCorrect = Number(d.batchStartCorrect) || 0;
    batchStartWrong = Number(d.batchStartWrong) || 0;
    scopeMode = d.scopeMode || scopeMode;
    scopeSize = Number(d.scopeSize) || scopeSize;
    const savedRemaining = Number(d.timerRemainingMs);
    timerRemainingMs = Number.isFinite(savedRemaining)
      ? Math.max(0, Math.min(savedRemaining, QUESTION_TIME_MS))
      : QUESTION_TIME_MS;
    updateScopeStatus();
    render(true);
    showToast(tr().restored);
    return true;
  } catch (error) {
    console.warn("保存したセッションを復元できませんでした。", error);
    localStorage.removeItem(SESSION_KEY);
    return false;
  }
}
function nextBatch() {
  resultModal.hide();
  localStorage.removeItem(SESSION_KEY);
  if (queuedQuizSettings) {
    applyRuntimeQuizSettings(queuedQuizSettings);
    queuedQuizSettings = null;
    timerRemainingMs = QUESTION_TIME_MS;
    persistSettings();
  }
  selectNextBatch();
  render();
}
function startNewSession(restartFromBeginning = false) {
  if (!isDatasetReady || !questions.length) return;
  pauseAfterFeedback = false;
  localStorage.removeItem(SESSION_KEY);
  stopSpeechPlayback();
  questionToken++;
  clearTimer();
  isPaused = false;
  isAnswerLocked = false;
  isSuspended = false;
  correctAnswer =
    wrongAnswer =
    currentIndex =
    reviewRound =
    totalAttempts =
    batchNumber =
      0;
  quizMode = "initial";
  if (restartFromBeginning) askedQuestionIds.clear();
  currentBatchIds = [];
  queuedQuizSettings = null;
  rememberedList.clear();
  unrememberedList.clear();
  selectNextBatch();
  reviewModal.hide();
  resultModal.hide();
  render();
}
function reset() {
  stopSpeechPlayback();
  resetModal.hide();
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  correctAnswer =
    wrongAnswer =
    currentIndex =
    reviewRound =
    totalAttempts =
    batchNumber =
      0;
  queuedQuizSettings = null;
  quizMode = "initial";
  askedQuestionIds.clear();
  completedQuestionIds.clear();
  currentBatchIds = [];
  rememberedList.clear();
  unrememberedList.clear();
  selectNextBatch();
  resultModal.hide();
  render();
  showToast(
    currentLanguage === "vi"
      ? "Đã xóa lịch sử phạm vi và bắt đầu lại"
      : "出題履歴を削除し、第1問から開始しました"
  );
}
function updateLanguageDropdown() {
  const isVietnamese = currentLanguage === "vi";
  e.selectedLanguageText.textContent = isVietnamese ? "Tiếng Việt" : "日本語";
  e.selectedLanguageFlag.className = `flag-icon ${
    isVietnamese ? "flag-vietnam" : "flag-japan"
  }`;
  e.selectedLanguageFlag.innerHTML = isVietnamese
    ? "<span>★</span>"
    : "<span></span>";
  document
    .querySelectorAll(".language-option")
    .forEach((option) =>
      option.classList.toggle(
        "active",
        option.dataset.language === currentLanguage
      )
    );
}
function applyLanguage(language, notify = true) {
  currentLanguage = language === "vi" ? "vi" : "ja";
  document.documentElement.lang = currentLanguage;
  const t = tr();
  e.languageSelect.value = currentLanguage;
  updateLanguageDropdown();
  e.settingsTitle.innerHTML = `<i class="bi bi-gear-fill me-2"></i>${t.settings}`;
  e.languageSettingLabel.textContent = t.language;
  e.languageSettingDescription.textContent = t.languageDesc;
  e.scopeSettingLabel.textContent = t.scope;
  e.scopeSettingDescription.textContent = t.scopeDesc;
  e.scopeUnitText.textContent = t.scopeUnit;
  e.customScopeOption.textContent = t.customScope;
  e.fullScopeOption.textContent = t.fullScope;
  e.resultTitleText.textContent = t.result;
  e.nextBatchButtonText.textContent = t.nextBatch;
  e.restartButtonText.textContent = t.resetAll;
  e.reviewTitleText.textContent = t.reviewTitle;
  e.startReviewButtonText.textContent = t.startReview;
  e.homophoneModalTitle.textContent = t.homophonesTitle;
  e.homophoneModalDismiss.setAttribute("aria-label", t.close);
  e.homophoneModalClose.textContent = t.close;
  if (currentHomophoneQuestion) {
    const homophones =
      answerLookup.get(String(currentHomophoneQuestion.answer1)) || [];
    e.homophoneButtonText.textContent = t.showHomophones(homophones.length);
  }
  e.resultTotalLabel.textContent = t.resultTotal;
  e.resultRememberedLabel.textContent = t.resultRemembered;
  e.resultAttemptsLabel.textContent = t.resultAttempts;
  e.resultRoundsLabel.textContent = t.resultRounds;
  e.resetTitleText.textContent = t.resetTitle;
  e.resetBodyText.textContent = t.resetBody;
  e.cancelResetButton.textContent = t.cancel;
  e.confirmResetButton.textContent = t.resetConfirm;
  e.footerCreditText.textContent = t.footerCredit(new Date().getFullYear());
  e.loadingText.textContent = t.loading;
  e.timeoutUnitText.textContent = t.seconds;
  updateScopeStatus();
  const labels = document.querySelectorAll(".mini-stat span");
  if (labels.length >= 4) {
    labels[0].textContent = t.mode;
    labels[1].textContent = t.remembered;
    labels[2].textContent = t.unremembered;
    labels[3].textContent = t.rounds;
  }
  if (e.currentProgressLabel)
    e.currentProgressLabel.textContent = t.currentProgress;
  if (e.datasetProgressLabel)
    e.datasetProgressLabel.textContent = t.overallProgress;
  updateDatasetProgress();
  const timerLabel = document.querySelector(".timer-meta span:last-child");
  if (timerLabel) timerLabel.textContent = t.answerTime;
  const settingItems = document.querySelectorAll(".setting-item");
  if (settingItems[0]) {
    settingItems[0].querySelector("label").textContent = t.random;
    settingItems[0].querySelector("p").textContent = t.randomDesc;
  }
  if (settingItems[1]) {
    settingItems[1].querySelector("label").textContent = t.timeout;
    settingItems[1].querySelector("p").textContent = t.timeoutDesc;
  }
  e.optimizedQuizSettingLabel.textContent = t.optimizeQuiz;
  e.optimizedQuizSettingDescription.textContent = t.optimizeQuizDesc;
  e.twoAnswerModeSettingLabel.textContent = t.twoAnswerMode;
  e.twoAnswerModeSettingDescription.textContent = t.twoAnswerModeDesc;
  e.showHanVietSettingLabel.textContent = t.showHanViet;
  e.showHanVietSettingDescription.textContent = t.showHanVietDesc;
  e.vocabularyAudioSettingLabel.textContent = t.vocabularyAudio;
  e.vocabularyAudioSettingDescription.textContent = t.vocabularyAudioDesc;
  e.autoOpenHomophonesSettingLabel.textContent = t.autoOpenHomophones;
  e.autoOpenHomophonesSettingDescription.textContent =
    t.autoOpenHomophonesDesc;
  if (e.pauseOverlay) {
    e.pauseOverlay.querySelector("strong").textContent = t.paused;
    e.pauseOverlay.querySelector("span").textContent = t.resume;
    e.saveButton.innerHTML = `<i class="bi bi-floppy-fill me-1"></i>${t.save}`;
    e.resetButton.innerHTML = `<i class="bi bi-arrow-counterclockwise me-1"></i>${t.reset}`;
  }
  stats();
  if (isDatasetReady && currentIndex < activeQuestions.length) {
    e.questionCounter.textContent = t.questionCounter(
      currentIndex + 1,
      activeQuestions.length
    );
    e.questionLabel.textContent =
      quizMode === "initial" ? t.question : t.reviewQuestion;
    timerUI(timerRemainingMs);
  }
  persistSettings();
  if (notify) showToast(t.languageChanged);
  window.dispatchEvent(
    new CustomEvent("app-language-change", {
      detail: { language: currentLanguage },
    })
  );
}
function persistSettings() {
  localStorage.setItem(
    SETTING_KEY,
    JSON.stringify({
      randomQuestions,
      optimizedQuizUI,
      twoAnswerMode,
      showHanVietMeanings,
      autoOpenHomophones,
      vocabularyAudioEnabled,
      questionTimeSeconds: QUESTION_TIME_MS / 1000,
      language: currentLanguage,
      scopeMode,
      scopeSize,
    })
  );
}
function persistSetupSettings(settings) {
  try {
    localStorage.setItem(
      SETTING_KEY,
      JSON.stringify({
        ...settings,
        showHanVietMeanings,
        autoOpenHomophones,
        vocabularyAudioEnabled,
        language: currentLanguage,
      })
    );
  } catch (error) {
    console.warn("設定を保存できませんでした。", error);
    showToast(
      currentLanguage === "vi"
        ? "Không thể lưu cấu hình cho phiên tiếp theo"
        : "次のセッションの設定を保存できませんでした"
    );
  }
}
function persistNextQuizSettings(settings) {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const snapshot = JSON.parse(raw);
    if (!isQuizSettings(snapshot.settings))
      snapshot.settings = getRuntimeQuizSettings();
    snapshot.nextQuizSettings = { ...settings };
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("次のセッション設定を保存できませんでした。", error);
    showToast(
      currentLanguage === "vi"
        ? "Không thể lưu cấu hình cho phiên tiếp theo"
        : "次のセッションの設定を保存できませんでした"
    );
  }
}
function applySetting() {
  randomQuestions = e.randomQuestionToggle.checked;
  persistSettings();
  showToast(randomQuestions ? tr().randomOn : tr().randomOff);
}
function applyOptimizedQuizSetting() {
  optimizedQuizUI = e.optimizedQuizToggle.checked;
  persistSettings();
  updateOptimizedQuizLayout();
}
function setQuestionTimeout(value, notify = true) {
  const seconds = Math.min(30, Math.max(3, Math.round(Number(value) || 5)));
  QUESTION_TIME_MS = seconds * 1000;
  e.timeoutValue.value = seconds;
  persistSettings();
  if (notify) showToast(tr().timeoutSet(seconds));
}
function isKeyboardShortcutBlocked(ev) {
  const target = ev.target;
  if (
    target instanceof Element &&
    target.closest(
      "input, textarea, select, button, a, [contenteditable='true'], [role='textbox']"
    )
  )
    return true;
  return Boolean(
    document.querySelector(
      ".modal.show, .modal.showing, .offcanvas.show, .offcanvas.showing"
    )
  );
}
function stopSpeechPlayback() {
  speechSynthesis.cancel();
}
function speakVocabulary(text) {
  if (!vocabularyAudioEnabled) return;
  speakJapanese(text);
}
async function load(datasetUrl, restoreSavedSession = true) {
  isLoading = true;
  lastSessionRestored = false;
  try {
    try {
      await loadHanVietData();
    } catch (err) {
      alertMsg(tr().hanVietLoadFailed(err.message));
    }
    const r = await fetch(datasetUrl, { cache: "no-store" });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const t = await r.text();
    if (!t.trim()) throw Error("データセットが空です");
    questions = parseQuestions(t);
    if (!questions.length) throw Error("有効なデータがありません");
    answerLookup.clear();
    questions.forEach((x) => {
      const key = String(x.answer1);
      if (!answerLookup.has(key)) answerLookup.set(key, []);
      answerLookup.get(key).push(x);
    });
    isDatasetReady = true;
    restoreCourseProgress();
    selectNextBatch();
    e.loadingState.classList.add("d-none");
    e.quizApp.classList.remove("d-none");
    lastSessionRestored = restoreSavedSession && restore();
    if (!lastSessionRestored) render();
    if (isSuspended) suspendRenshuu();
  } catch (err) {
    e.loadingState.classList.add("d-none");
    alertMsg(tr().loadFailed(err.message));
  } finally {
    isLoading = false;
  }
}
function initializeQuiz() {
  cache();
  reviewModal = new bootstrap.Modal(e.reviewModal);
  resultModal = new bootstrap.Modal(e.resultModal);
  homophoneModal = new bootstrap.Modal(e.homophoneModal);
  resetModal = new bootstrap.Modal(e.resetConfirmModal);
  toast = new bootstrap.Toast(e.appToast, { delay: 2000 });
  e.resultModal.addEventListener("shown.bs.modal", startResultCelebration);
  e.resultModal.addEventListener("hidden.bs.modal", stopResultConfetti);
  try {
    const savedSettings = JSON.parse(localStorage.getItem(SETTING_KEY) || "{}");
    randomQuestions = savedSettings.randomQuestions || false;
    optimizedQuizUI = savedSettings.optimizedQuizUI === true;
    twoAnswerMode = savedSettings.twoAnswerMode === true;
    showHanVietMeanings =
      typeof savedSettings.showHanVietMeanings === "boolean"
        ? savedSettings.showHanVietMeanings
        : true;
    autoOpenHomophones = savedSettings.autoOpenHomophones === true;
    vocabularyAudioEnabled =
      typeof savedSettings.vocabularyAudioEnabled === "boolean"
        ? savedSettings.vocabularyAudioEnabled
        : true;
    currentLanguage = savedSettings.language === "vi" ? "vi" : "ja";
    scopeMode = savedSettings.scopeMode || "preset";
    scopeSize = Math.max(1, Number(savedSettings.scopeSize) || 50);
    QUESTION_TIME_MS = Math.min(
      30000,
      Math.max(3000, (Number(savedSettings.questionTimeSeconds) || 5) * 1000)
    );
  } catch {}
  e.randomQuestionToggle.checked = randomQuestions;
  e.optimizedQuizToggle.checked = optimizedQuizUI;
  e.twoAnswerModeToggle.checked = twoAnswerMode;
  e.showHanVietToggle.checked = showHanVietMeanings;
  e.autoOpenHomophonesToggle.checked = autoOpenHomophones;
  e.vocabularyAudioToggle.checked = vocabularyAudioEnabled;
  e.timeoutValue.value = QUESTION_TIME_MS / 1000;
  const presetScopeValues = [...e.scopeSizeSelect.options]
    .map((option) => option.value)
    .filter((value) => /^\d+$/.test(value));
  e.scopeSizeSelect.value =
    scopeMode === "full"
      ? "full"
      : scopeMode === "preset" && presetScopeValues.includes(String(scopeSize))
      ? String(scopeSize)
      : "custom";
  e.customScopeValue.value = scopeSize;
  e.customScopeWrap.classList.toggle(
    "d-none",
    e.scopeSizeSelect.value !== "custom"
  );
  e.languageSelect.value = currentLanguage;
  applyLanguage(currentLanguage, false);
  e.randomQuestionToggle.onchange = applySetting;
  e.optimizedQuizToggle.onchange = applyOptimizedQuizSetting;
  e.twoAnswerModeToggle.onchange = applyTwoAnswerModeSetting;
  e.showHanVietToggle.onchange = applyHanVietSetting;
  e.autoOpenHomophonesToggle.onchange = applyAutoOpenHomophonesSetting;
  e.vocabularyAudioToggle.onchange = applyVocabularyAudioSetting;
  window.addEventListener("app-language-change", (event) => {
    if (event.detail.language !== currentLanguage) {
      applyLanguage(event.detail.language);
    }
  });
  e.decreaseTimeoutButton.onclick = () =>
    setQuestionTimeout(Number(e.timeoutValue.value) - 1);
  e.increaseTimeoutButton.onclick = () =>
    setQuestionTimeout(Number(e.timeoutValue.value) + 1);
  e.timeoutValue.onchange = () => setQuestionTimeout(e.timeoutValue.value);
  e.scopeSizeSelect.onchange = () => applyScopeSetting();
  e.customScopeValue.onchange = () => applyScopeSetting();
  e.questionCard.onclick = (ev) => {
    if (ev.target.closest("button")) return;
    pause();
  };
  e.saveButton.onclick = (ev) => {
    ev.stopPropagation();
    save();
  };
  e.resetButton.onclick = (ev) => {
    ev.stopPropagation();
    resetModal.show();
  };
  e.confirmResetButton.onclick = reset;
  e.startReviewButton.onclick = startReview;
  e.homophoneButton.onclick = () =>
    currentHomophoneQuestion && openHomophoneModal(currentHomophoneQuestion);
  e.nextBatchButton.onclick = nextBatch;
  e.restartButton.onclick = () => resetModal.show();
  document.onkeydown = (ev) => {
    if (isKeyboardShortcutBlocked(ev)) return;
    if (ev.code === "Space") {
      ev.preventDefault();
      pause();
    } else if (isDatasetReady && !isPaused && !isAnswerLocked) {
      const shortcut = /^Digit([1-4])$/.exec(ev.code);
      if (shortcut && Number(shortcut[1]) <= currentOptions.length)
        answer(Number(shortcut[1]) - 1);
    }
  };
}

export function getActiveCourseKey() {
  return activeCourseKey;
}

export function getSavedSessionStatus(courseKey, requestedSettings) {
  try {
    const raw = localStorage.getItem(sessionStorageKey(courseKey));
    if (!raw) return { hasUnfinishedSession: false, settingsChanged: false };
    const snapshot = JSON.parse(raw);
    const activeIds = Array.isArray(snapshot.activeIds)
      ? snapshot.activeIds
      : [];
    const currentIndex = Number(snapshot.currentIndex);
    if (
      snapshot.isCompleted === true ||
      !activeIds.length ||
      !Number.isInteger(currentIndex) ||
      currentIndex < 0 ||
      currentIndex >= activeIds.length
    )
      return { hasUnfinishedSession: false, settingsChanged: false };

    let savedSettings = snapshot.settings;
    if (!isQuizSettings(savedSettings)) {
      let storedSettings = {};
      try {
        storedSettings = JSON.parse(localStorage.getItem(SETTING_KEY) || "{}");
      } catch (error) {
        console.warn("設定を読み込めませんでした。", error);
      }
      savedSettings = {
        randomQuestions: storedSettings.randomQuestions === true,
        optimizedQuizUI: storedSettings.optimizedQuizUI === true,
        twoAnswerMode: storedSettings.twoAnswerMode === true,
        questionTimeSeconds:
          Number(storedSettings.questionTimeSeconds) || 5,
        scopeMode: ["preset", "custom", "full"].includes(snapshot.scopeMode)
          ? snapshot.scopeMode
          : ["preset", "custom", "full"].includes(storedSettings.scopeMode)
          ? storedSettings.scopeMode
          : "preset",
        scopeSize:
          Number(snapshot.scopeSize) ||
          Number(storedSettings.scopeSize) ||
          50,
      };
    }
    return {
      hasUnfinishedSession: true,
      settingsChanged: !hasSameQuizSettings(
        savedSettings,
        requestedSettings
      ),
    };
  } catch (error) {
    console.warn("保存したセッションを確認できませんでした。", error);
    return { hasUnfinishedSession: false, settingsChanged: false };
  }
}

export function getQuizSetupSettings() {
  let savedSettings = {};
  try {
    savedSettings = JSON.parse(localStorage.getItem(SETTING_KEY) || "{}");
    if (!savedSettings || typeof savedSettings !== "object") {
      savedSettings = {};
    }
  } catch (error) {
    console.warn("設定を読み込めませんでした。", error);
  }
  const savedScopeMode = ["preset", "custom", "full"].includes(
    savedSettings.scopeMode
  )
    ? savedSettings.scopeMode
    : scopeMode;
  return {
    randomQuestions:
      typeof savedSettings.randomQuestions === "boolean"
        ? savedSettings.randomQuestions
        : randomQuestions,
    questionTimeSeconds: Math.min(
      30,
      Math.max(
        3,
        Number(savedSettings.questionTimeSeconds) ||
          QUESTION_TIME_MS / 1000
      )
    ),
    scopeMode: savedScopeMode,
    scopeSize: Math.max(
      1,
      Math.round(Number(savedSettings.scopeSize) || scopeSize)
    ),
    optimizedQuizUI:
      typeof savedSettings.optimizedQuizUI === "boolean"
        ? savedSettings.optimizedQuizUI
        : optimizedQuizUI,
    twoAnswerMode:
      typeof savedSettings.twoAnswerMode === "boolean"
        ? savedSettings.twoAnswerMode
        : twoAnswerMode,
    showHanVietMeanings:
      typeof savedSettings.showHanVietMeanings === "boolean"
        ? savedSettings.showHanVietMeanings
        : showHanVietMeanings,
    autoOpenHomophones:
      typeof savedSettings.autoOpenHomophones === "boolean"
        ? savedSettings.autoOpenHomophones
        : autoOpenHomophones,
    vocabularyAudioEnabled:
      typeof savedSettings.vocabularyAudioEnabled === "boolean"
        ? savedSettings.vocabularyAudioEnabled
        : vocabularyAudioEnabled,
  };
}

function applyPresentationSettings(settings) {
  if (typeof settings.showHanVietMeanings === "boolean") {
    showHanVietMeanings = settings.showHanVietMeanings;
  }
  if (typeof settings.autoOpenHomophones === "boolean") {
    autoOpenHomophones = settings.autoOpenHomophones;
  }
  if (typeof settings.vocabularyAudioEnabled === "boolean") {
    const wasVocabularyAudioEnabled = vocabularyAudioEnabled;
    vocabularyAudioEnabled = settings.vocabularyAudioEnabled;
    if (wasVocabularyAudioEnabled && !vocabularyAudioEnabled) {
      stopSpeechPlayback();
    }
  }
  if (isInitialized) {
    e.showHanVietToggle.checked = showHanVietMeanings;
    e.autoOpenHomophonesToggle.checked = autoOpenHomophones;
    e.vocabularyAudioToggle.checked = vocabularyAudioEnabled;
  }
}

function applyRuntimeQuizSettings(settings) {
  randomQuestions = settings.randomQuestions === true;
  optimizedQuizUI = settings.optimizedQuizUI === true;
  twoAnswerMode = settings.twoAnswerMode === true;
  applyPresentationSettings(settings);
  QUESTION_TIME_MS =
    Math.min(30, Math.max(3, Number(settings.questionTimeSeconds) || 5)) *
    1000;
  scopeMode = ["preset", "custom", "full"].includes(settings.scopeMode)
    ? settings.scopeMode
    : "preset";
  scopeSize = Math.min(
    1_000_000,
    Math.max(1, Math.round(Number(settings.scopeSize) || 50))
  );
  if (isInitialized) {
    e.randomQuestionToggle.checked = randomQuestions;
    e.optimizedQuizToggle.checked = optimizedQuizUI;
    e.twoAnswerModeToggle.checked = twoAnswerMode;
    e.timeoutValue.value = QUESTION_TIME_MS / 1000;
    e.scopeSizeSelect.value =
      scopeMode === "full"
        ? "full"
        : scopeMode === "preset" &&
          [...e.scopeSizeSelect.options].some(
            (option) => option.value === String(scopeSize)
          )
        ? String(scopeSize)
        : "custom";
    e.customScopeValue.value = scopeSize;
    e.customScopeWrap.classList.toggle(
      "d-none",
      e.scopeSizeSelect.value !== "custom"
    );
    updateScopeStatus();
    updateOptimizedQuizLayout();
  }
}

export function configureQuizSettings(settings) {
  applyRuntimeQuizSettings(settings);
  timerRemainingMs = QUESTION_TIME_MS;
  persistSettings();
}

export async function initRenshuu(
  datasetUrl,
  courseKey,
  restoreSavedSession = true
) {
  if (isInitialized) {
    if (
      activeCourseKey === courseKey &&
      !isDatasetReady &&
      !isLoading
    ) {
      e.loadingState.classList.remove("d-none");
      e.alertRegion.replaceChildren();
      await load(datasetUrl, restoreSavedSession);
    }
    return;
  }
  isInitialized = true;
  activeCourseKey = courseKey;
  SESSION_KEY = sessionStorageKey(courseKey);
  PROGRESS_KEY = progressStorageKey(courseKey);
  initializeQuiz();
  await load(datasetUrl, restoreSavedSession);
}

export function suspendRenshuu() {
  pauseAfterFeedback = false;
  if (!activeCourseKey) return;
  isSuspended = true;
  if (!isDatasetReady) return;
  if (isAnswerLocked) {
    questionToken++;
    clearTimer();
    isAnswerLocked = false;
    isPaused = true;
    pauseUI();
  } else if (!isPaused && currentIndex < activeQuestions.length) {
    pause();
  }
}

export function pauseRenshuuForSettings() {
  if (
    !isDatasetReady ||
    isPaused ||
    currentIndex >= activeQuestions.length
  ) {
    return;
  }
  if (isAnswerLocked) {
    stopSpeechPlayback();
    pauseAfterFeedback = true;
    return;
  }
  pause();
}

export async function startRenshuu(
  datasetUrl,
  courseKey,
  {
    settings,
    resumeSavedSession,
    applySettingsNext,
    restartFromBeginning,
  }
) {
  const isCurrentCourseReady =
    activeCourseKey === courseKey && isDatasetReady;
  isSuspended = false;

  if (resumeSavedSession) {
    let restored = false;
    if (isCurrentCourseReady) {
      restored = restore();
    } else {
      await initRenshuu(datasetUrl, courseKey, true);
      restored = lastSessionRestored;
    }

    if (!restored) {
      configureQuizSettings(settings);
      startNewSession(true);
      return;
    }

    isSuspended = false;
    applyPresentationSettings(settings);
    persistSettings();
    if (applySettingsNext) {
      queuedQuizSettings = { ...settings };
      persistSetupSettings(settings);
      persistNextQuizSettings(settings);
    }
    return;
  }

  configureQuizSettings(settings);
  if (isCurrentCourseReady) {
    localStorage.removeItem(sessionStorageKey(courseKey));
    e.loadingState.classList.add("d-none");
    startNewSession(restartFromBeginning);
  } else {
    await initRenshuu(datasetUrl, courseKey, false);
    localStorage.removeItem(sessionStorageKey(courseKey));
    if (restartFromBeginning && isDatasetReady) startNewSession(true);
  }
}
