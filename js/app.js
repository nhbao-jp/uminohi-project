"use strict";
let QUESTION_TIME_MS = 5000;
const SESSION_KEY = "jlptVocabularyQuizSessionV2",
  SETTING_KEY = "jlptVocabularyQuizSettingsV1";
let totalQuestion = 1403,
  correctAnswer = 0,
  wrongAnswer = 0,
  questions = [],
  activeQuestions = [],
  currentOptions = [],
  answerLookup = new Map(),
  rememberedList = new Map(),
  unrememberedList = new Map(),
  currentIndex = 0,
  reviewRound = 0,
  totalAttempts = 0,
  quizMode = "initial",
  isAnswerLocked = false,
  isDatasetReady = false,
  isPaused = false,
  randomQuestions = false,
  currentLanguage = "ja",
  scopeMode = "preset",
  scopeSize = 50,
  askedQuestionIds = new Set(),
  completedQuestionIds = new Set(),
  currentBatchIds = [],
  batchNumber = 0,
  batchStartAttempts = 0,
  batchStartCorrect = 0,
  batchStartWrong = 0,
  questionTimeoutId = null,
  timerIntervalId = null,
  questionToken = 0,
  timerRemainingMs = QUESTION_TIME_MS,
  timerStartedAt = 0;
const e = {};
let reviewModal,
  resultModal,
  homophoneModal,
  resetModal,
  toast,
  timerAnimationId = null,
  autoSaveTimeoutId = null,
  lastAutoSavedAt = 0,
  currentHomophoneQuestion = null;
const AUTO_SAVE_DELAY_MS = 350;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
    currentProgress: "現在の範囲",
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
    seconds: "秒",
    saved: "セッションを保存しました",
    languageChanged: "表示言語を日本語に変更しました",
    questionCounter: (n, t) => `第${n}問 / 全${t}問`,
    scope: "出題範囲",
    scopeDesc: "1回のテストで出題する単語数を設定します。",
    scopeUnit: "問",
    scopeStatus: (done, total) => `出題済み：${done} / ${total}問`,
    result: "テスト結果",
    nextBatch: "次の範囲へ",
    resetAll: "すべてリセット",
    footerShortcut:
      "1〜4キーで選択。問題カードのタップ、またはSpaceキーで一時停止・再開",
    footerCredit: "このWebアプリは",
    footerCreditSuffix: " によって開発されました",
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
    loadFailed: (message) => `dataset.txt を読み込めませんでした：${message}`,
  },
  vi: {
    settings: "Cài đặt",
    language: "Ngôn ngữ hiển thị",
    languageDesc: "Chọn ngôn ngữ hiển thị cho giao diện WebApp.",
    mode: "Chế độ",
    initial: "Lần đầu",
    review: (n) => `Ôn lần ${n}`,
    remembered: "Đã nhớ",
    unremembered: "Chưa nhớ",
    rounds: "Lượt ôn",
    progress: "Tiến độ",
    currentProgress: "Phạm vi hiện tại",
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
    seconds: "giây",
    saved: "Đã lưu phiên hiện tại",
    languageChanged: "Đã chuyển giao diện sang tiếng Việt",
    questionCounter: (n, t) => `Câu ${n} / ${t}`,
    scope: "Lọc phạm vi trắc nghiệm",
    scopeDesc: "Chọn số từ được lấy cho mỗi lần kiểm tra.",
    scopeUnit: "câu",
    scopeStatus: (done, total) => `Đã hỏi: ${done} / ${total} câu`,
    result: "Kết quả bài kiểm tra",
    nextBatch: "Phạm vi tiếp theo",
    resetAll: "Đặt lại tất cả",
    footerShortcut:
      "Chọn bằng phím 1–4. Chạm thẻ câu hỏi hoặc nhấn Space để tạm dừng/tiếp tục",
    footerCredit: "WebApp này được phát triển bởi",
    footerCreditSuffix: "",
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
    loadFailed: (message) => `Không thể đọc dataset.txt: ${message}`,
  },
};
function tr() {
  return I18N[currentLanguage] || I18N.ja;
}
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function orderQuestions(a) {
  return randomQuestions ? shuffle(a) : [...a].sort((x, y) => x.stt - y.stt);
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
  scheduleAutoSave();
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
        ? `Phạm vi mỗi lần: ${
            scopeMode === "full" ? "Toàn bộ" : scopeSize + " câu"
          }`
        : `1回の出題範囲：${scopeMode === "full" ? "全問題" : scopeSize + "問"}`
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
    "footerShortcut",
    "footerCreditText",
    "footerCreditSuffix",
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
function parse(t) {
  const r = [];
  t.replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((l, i) => {
      if (!l.trim()) return;
      const c = l.split("*").map((v) => v.trim());
      if (c.length !== 8) {
        console.warn(`${i + 1}行目は8列ではありません。`);
        return;
      }
      const stt = +c[0];
      if (!Number.isInteger(stt) || !c[2] || !c[4]) return;
      r.push({
        stt,
        kanji: c[1],
        vocab: c[2],
        meaning: c[3],
        answer1: c[4],
        answer2: c[5],
        answer3: c[6],
        answer4: c[7],
      });
    });
  return r.sort((a, b) => a.stt - b.stt);
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
  if (currentIndex >= activeQuestions.length) return finish();
  isAnswerLocked = false;
  isPaused = false;
  const q = activeQuestions[currentIndex];
  if (!saved || currentOptions.length !== 4)
    currentOptions = shuffle([q.answer1, q.answer2, q.answer3, q.answer4]);
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
  e.questionText.textContent = display(q);
  e.answerRow.innerHTML = "";
  e.homophoneAction.classList.add("d-none");
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
  scheduleAutoSave();
}
function info(v, q, correct) {
  const x = document.createElement("div");
  x.className = "answer-info";
  if (v === correct && q) {
    if (isKatakanaQuestion(q) && q.vocab) {
      x.textContent = q.vocab;
      x.classList.add("katakana-english-info");
    } else {
      x.textContent = `${q.kanji || q.vocab}\n${q.meaning || tr().noMeaning}`;
    }
  } else {
    const items = answerLookup.get(String(v)) || [];
    const item = items[Math.floor(Math.random() * items.length)];
    x.textContent = item
      ? `${item.kanji || item.vocab}\n${item.meaning || tr().noMeaning}`
      : tr().invalidData;
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
  }
}
async function waitForFeedback(delay) {
  await wait(delay);
  if (e.homophoneModal.classList.contains("show")) {
    await new Promise((resolve) =>
      e.homophoneModal.addEventListener("hidden.bs.modal", resolve, {
        once: true,
      })
    );
  }
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
  stats();
  // Persist the next stable state while the old question remains visible for
  // feedback. Reloading during this delay must not offer the same question a
  // second time or count it twice.
  currentIndex++;
  currentOptions = [];
  timerRemainingMs = QUESTION_TIME_MS;
  scheduleAutoSave();
  speakVocabulary(q.vocab);
  await waitForFeedback(1500);
  if (transitionToken !== questionToken) return;
  render();
  scheduleAutoSave();
}
async function timeout(t) {
  if (t !== questionToken || isPaused || isAnswerLocked) return;
  isAnswerLocked = true;
  clearTimer();
  const transitionToken = ++questionToken;
  const q = activeQuestions[currentIndex];
  totalAttempts++;
  wrongAnswer++;
  unrememberedList.set(q.stt, q);
  rememberedList.delete(q.stt);
  e.questionLabel.textContent = tr().timedOut;
  decorate(-1, q.answer1, q);
  stats();
  currentIndex++;
  currentOptions = [];
  timerRemainingMs = QUESTION_TIME_MS;
  scheduleAutoSave();
  await waitForFeedback(700);
  if (transitionToken !== questionToken) return;
  render();
  scheduleAutoSave();
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
  activeQuestions = orderQuestions([...unrememberedList.values()]);
  currentIndex = 0;
  timerRemainingMs = QUESTION_TIME_MS;
  reviewModal.hide();
  render();
  scheduleAutoSave();
}
function complete() {
  clearTimer();
  isAnswerLocked = true;
  currentBatchIds.forEach((id) => completedQuestionIds.add(id));
  updateDatasetProgress();
  e.resultTotal.textContent = currentBatchIds.length;
  e.resultRemembered.textContent = rememberedList.size;
  e.resultAttempts.textContent = totalAttempts - batchStartAttempts;
  e.resultRounds.textContent = reviewRound;
  flushAutoSave();
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
  };
}
function save(options = {}) {
  if (!isDatasetReady || !questions.length) return false;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(buildSessionSnapshot()));
    lastAutoSavedAt = Date.now();
    if (!options.silent)
      showToast(
        currentLanguage === "vi"
          ? "Đã lưu phiên hiện tại"
          : "セッションを保存しました"
      );
    return true;
  } catch (error) {
    console.warn("セッションを保存できませんでした。", error);
    if (!options.silent)
      showToast(
        currentLanguage === "vi"
          ? "Không thể lưu phiên hiện tại"
          : "セッションを保存できませんでした"
      );
    return false;
  }
}
function scheduleAutoSave() {
  if (!isDatasetReady) return;
  clearTimeout(autoSaveTimeoutId);
  autoSaveTimeoutId = setTimeout(
    () => save({ silent: true }),
    AUTO_SAVE_DELAY_MS
  );
}
function flushAutoSave() {
  clearTimeout(autoSaveTimeoutId);
  save({ silent: true });
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
    if (!isPaused) pause();
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
  selectNextBatch();
  render();
}
function reset() {
  stopSpeechPlayback();
  resetModal.hide();
  localStorage.removeItem(SESSION_KEY);
  correctAnswer =
    wrongAnswer =
    currentIndex =
    reviewRound =
    totalAttempts =
    batchNumber =
      0;
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
  e.footerShortcut.textContent = t.footerShortcut;
  e.footerCreditText.textContent = t.footerCredit;
  e.footerCreditSuffix.textContent = t.footerCreditSuffix;
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
}
function persistSettings() {
  localStorage.setItem(
    SETTING_KEY,
    JSON.stringify({
      randomQuestions,
      questionTimeSeconds: QUESTION_TIME_MS / 1000,
      language: currentLanguage,
      scopeMode,
      scopeSize,
    })
  );
  scheduleAutoSave();
}
function applySetting() {
  randomQuestions = e.randomQuestionToggle.checked;
  persistSettings();
  showToast(randomQuestions ? tr().randomOn : tr().randomOff);
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
  stopSpeechPlayback();
  const utterance = new SpeechSynthesisUtterance(String(text || ""));
  const voices = speechSynthesis.getVoices();
  utterance.lang = "ja-JP";
  utterance.rate = 0.85;
  utterance.voice =
    voices.find(
      (voice) =>
        voice.lang.toLowerCase() === "ja-jp" && voice.default
    ) ||
    voices.find((voice) => voice.lang.toLowerCase() === "ja-jp") ||
    voices.find((voice) => /^ja(?:-|$)/i.test(voice.lang)) ||
    null;
  speechSynthesis.speak(utterance);
}
async function load() {
  try {
    const r = await fetch("dataset.txt", { cache: "no-store" });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const t = await r.text();
    if (!t.trim()) throw Error("dataset.txt は空です");
    questions = parse(t);
    if (!questions.length) throw Error("有効なデータがありません");
    answerLookup.clear();
    questions.forEach((x) => {
      const key = String(x.answer1);
      if (!answerLookup.has(key)) answerLookup.set(key, []);
      answerLookup.get(key).push(x);
    });
    isDatasetReady = true;
    selectNextBatch();
    e.loadingState.classList.add("d-none");
    e.quizApp.classList.remove("d-none");
    if (!restore()) render();
  } catch (err) {
    e.loadingState.classList.add("d-none");
    alertMsg(tr().loadFailed(err.message));
  }
}
function init() {
  cache();
  reviewModal = new bootstrap.Modal(e.reviewModal);
  resultModal = new bootstrap.Modal(e.resultModal);
  homophoneModal = new bootstrap.Modal(e.homophoneModal);
  resetModal = new bootstrap.Modal(e.resetConfirmModal);
  toast = new bootstrap.Toast(e.appToast, { delay: 2000 });
  try {
    const savedSettings = JSON.parse(localStorage.getItem(SETTING_KEY) || "{}");
    randomQuestions = savedSettings.randomQuestions || false;
    currentLanguage = savedSettings.language === "vi" ? "vi" : "ja";
    scopeMode = savedSettings.scopeMode || "preset";
    scopeSize = Math.max(1, Number(savedSettings.scopeSize) || 50);
    QUESTION_TIME_MS = Math.min(
      30000,
      Math.max(3000, (Number(savedSettings.questionTimeSeconds) || 5) * 1000)
    );
  } catch {}
  e.randomQuestionToggle.checked = randomQuestions;
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
  e.languageSelect.onchange = () => applyLanguage(e.languageSelect.value);
  document
    .querySelectorAll(".language-option")
    .forEach((option) =>
      option.addEventListener("click", () =>
        applyLanguage(option.dataset.language)
      )
    );
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
    } else if (
      isDatasetReady &&
      !isPaused &&
      !isAnswerLocked &&
      /^Digit[1-4]$/.test(ev.code)
    )
      answer(+ev.code.slice(-1) - 1);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushAutoSave();
  });
  window.addEventListener("pagehide", flushAutoSave);
  window.addEventListener("beforeunload", flushAutoSave);
  load();
}
document.addEventListener("DOMContentLoaded", init);
