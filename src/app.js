import { getCourse, LEVELS } from "./services/course-catalog.js";
import {
  getActiveCourseKey,
  getSavedSessionStatus,
  getQuizSetupSettings,
  pauseRenshuuForSettings,
  startRenshuu,
  suspendRenshuu,
  unlockFeedbackAudio,
} from "./pages/renshuu.js";
import {
  applyHomeLanguage,
  showCourseError,
  showHome,
  showLevelCourses,
} from "./pages/home.js";
import {
  applyCoursePageLanguage,
  cancelStudyLoad,
  showCourseActions,
  showStudyPage,
} from "./pages/course-pages.js";
import {
  getSavedLanguage,
  saveLanguage,
} from "./services/language-preference.js";
import {
  appPathname,
  courseUrl,
  homeUrl,
  levelUrl,
  routeUrl,
} from "./utils/routes.js";

const homePage = document.getElementById("homePage");
const coursesPage = document.getElementById("coursesPage");
const courseActionsPage = document.getElementById("courseActionsPage");
const studyPage = document.getElementById("studyPage");
const quizPage = document.getElementById("quizPage");
const settingsButton = document.getElementById("settingsButton");
settingsButton.addEventListener("click", pauseRenshuuForSettings);
const loadingState = document.getElementById("loadingState");
const languageSelect = document.getElementById("languageSelect");
const quizSetupModalElement = document.getElementById("quizSetupModal");
const quizSetupModal = new bootstrap.Modal(quizSetupModalElement);
const savedSessionConfigModalElement = document.getElementById(
  "savedSessionConfigModal"
);
const savedSessionConfigModal = new bootstrap.Modal(
  savedSessionConfigModalElement,
  { backdrop: "static", keyboard: false }
);
const continueSavedSessionButton = document.getElementById(
  "continueSavedSessionButton"
);
const restartSavedSessionButton = document.getElementById(
  "restartSavedSessionButton"
);
const cancelSavedSessionConfigButton = document.getElementById(
  "cancelSavedSessionConfigButton"
);
const setupRandomQuestionToggle = document.getElementById(
  "setupRandomQuestionToggle"
);
const setupTimeoutValue = document.getElementById("setupTimeoutValue");
const setupScopeSizeSelect = document.getElementById("setupScopeSizeSelect");
const setupCustomScopeValue = document.getElementById("setupCustomScopeValue");
const setupCustomScopeWrap = document.getElementById("setupCustomScopeWrap");
const setupTwoAnswerModeToggle = document.getElementById(
  "setupTwoAnswerModeToggle"
);
const setupOptimizedQuizToggle = document.getElementById(
  "setupOptimizedQuizToggle"
);
const setupShowHanVietToggle = document.getElementById(
  "setupShowHanVietToggle"
);
const setupVocabularyAudioToggle = document.getElementById(
  "setupVocabularyAudioToggle"
);
const setupAutoOpenHomophonesToggle = document.getElementById(
  "setupAutoOpenHomophonesToggle"
);
const startQuizSetupButton = document.getElementById("startQuizSetupButton");
const cancelQuizSetupButton = document.getElementById("cancelQuizSetupButton");
const startCountdownOverlay = document.getElementById("startCountdownOverlay");
const startCountdownText = document.getElementById("startCountdownText");
let routeRequest = 0;
let pendingCourseStart = null;
let startingCourseKey = null;
let countdownTimeoutId = null;
let countdownToken = 0;
let resolveCountdown = null;
let resolveSavedSessionChoice = null;

function chooseSavedSessionAction() {
  return new Promise((resolve) => {
    resolveSavedSessionChoice = resolve;
    const finish = (choice) => {
      resolveSavedSessionChoice = null;
      resolve(choice);
      savedSessionConfigModal.hide();
    };
    continueSavedSessionButton.onclick = () => finish("continue");
    restartSavedSessionButton.onclick = () => finish("restart");
    cancelSavedSessionConfigButton.onclick = () => finish(null);
    savedSessionConfigModal.show();
  });
}

function renderBrandTitle() {
  const brandTitle = document.getElementById("brandTitle");
  const createDottedI = () => {
    const letter = document.createElement("span");
    letter.className = "brand-title-i";
    letter.textContent = "ı";
    letter.setAttribute("aria-hidden", "true");
    return letter;
  };
  brandTitle.setAttribute("aria-label", "Uminohi");
  brandTitle.replaceChildren(
    document.createTextNode("Um"),
    createDottedI(),
    document.createTextNode("noh"),
    createDottedI()
  );
}

function syncQuizSetupLanguage(language) {
  const isVietnamese = language === "vi";
  const copy = isVietnamese
    ? {
        title: "Thiết lập bài kiểm tra",
        random: "Ngẫu nhiên câu hỏi",
        timeout: "Thời gian trả lời",
        scope: "Số lượng câu hỏi",
        custom: "Tùy chỉnh",
        full: "Tất cả câu hỏi",
        twoAnswer: "Chế độ 2 đáp án",
        optimized: "Tối ưu giao diện kiểm tra",
        showHanViet: "Hiện Hán-Việt",
        vocabularyAudio: "Phát âm từ vựng",
        autoOpenHomophones: "Tự động mở từ đồng âm",
        seconds: "giây",
        questions: "câu",
        decrease: "Giảm 1 giây",
        increase: "Tăng 1 giây",
        scopeAria: "Số lượng câu hỏi",
        customScopeAria: "Số câu hỏi tùy chỉnh",
        cancel: "Hủy",
        start: "Bắt đầu",
      }
    : {
        title: "テストの設定",
        random: "問題をランダムに出題",
        timeout: "回答時間",
        scope: "問題数",
        custom: "カスタム",
        full: "全問題",
        twoAnswer: "2択モード",
        optimized: "テスト画面を最適化",
        showHanViet: "漢越音を表示",
        vocabularyAudio: "単語の音声再生",
        autoOpenHomophones: "同音異義語を自動で開く",
        seconds: "秒",
        questions: "問",
        decrease: "1秒減らす",
        increase: "1秒増やす",
        scopeAria: "問題数",
        customScopeAria: "カスタム問題数",
        cancel: "キャンセル",
        start: "開始",
      };
  document.getElementById("quizSetupTitle").textContent = copy.title;
  document.querySelector('label[for="setupRandomQuestionToggle"]').textContent =
    copy.random;
  document.querySelector('label[for="setupTimeoutValue"]').textContent =
    copy.timeout;
  document.querySelector('label[for="setupScopeSizeSelect"]').textContent =
    copy.scope;
  document.querySelector(
    'label[for="setupTwoAnswerModeToggle"]'
  ).textContent = copy.twoAnswer;
  document.querySelector(
    'label[for="setupOptimizedQuizToggle"]'
  ).textContent = copy.optimized;
  document.querySelector(
    'label[for="setupShowHanVietToggle"]'
  ).textContent = copy.showHanViet;
  document.querySelector(
    'label[for="setupVocabularyAudioToggle"]'
  ).textContent = copy.vocabularyAudio;
  document.querySelector(
    'label[for="setupAutoOpenHomophonesToggle"]'
  ).textContent = copy.autoOpenHomophones;
  setupScopeSizeSelect.querySelector('[value="custom"]').textContent =
    copy.custom;
  setupScopeSizeSelect.querySelector('[value="full"]').textContent =
    copy.full;
  document.getElementById("setupTimeoutUnitText").textContent = copy.seconds;
  document.getElementById("setupScopeUnitText").textContent = copy.questions;
  document
    .getElementById("setupDecreaseTimeoutButton")
    .setAttribute("aria-label", copy.decrease);
  document
    .getElementById("setupIncreaseTimeoutButton")
    .setAttribute("aria-label", copy.increase);
  document
    .querySelector("#quizSetupModal .timeout-stepper")
    .setAttribute(
      "aria-label",
      isVietnamese ? "Điều chỉnh thời gian trả lời" : "回答時間の調整"
    );
  setupScopeSizeSelect.setAttribute("aria-label", copy.scopeAria);
  setupCustomScopeValue.setAttribute("aria-label", copy.customScopeAria);
  cancelQuizSetupButton.textContent = copy.cancel;
  startQuizSetupButton.querySelector("span").textContent = copy.start;
  document.getElementById("savedSessionConfigTitle").textContent =
    isVietnamese
      ? "Cấu hình mới sẽ áp dụng sau phiên hiện tại"
      : "新しい設定は現在のセッション終了後に適用されます";
  document.querySelector(
    "#savedSessionConfigModal .modal-body"
  ).textContent = isVietnamese
    ? "Cấu hình mới sẽ áp dụng từ phiên tiếp theo. Tiếp tục phiên hiện tại hoặc bắt đầu lại để áp dụng ngay."
    : "新しい設定は次のセッションから適用されます。現在のセッションを続けるか、最初からやり直すと新しい設定がすぐに適用されます。";
  cancelSavedSessionConfigButton.textContent = isVietnamese
    ? "Hủy"
    : "キャンセル";
  continueSavedSessionButton.textContent = isVietnamese
    ? "Tiếp tục"
    : "続ける";
  restartSavedSessionButton.textContent = isVietnamese
    ? "Bắt đầu lại"
    : "最初からやり直す";
}

function syncLanguageUI(language) {
  const isVietnamese = language === "vi";
  document.documentElement.lang = language;
  renderBrandTitle();
  settingsButton.setAttribute("aria-label", isVietnamese ? "Cài đặt" : "設定");
  settingsButton.title = isVietnamese ? "Cài đặt" : "設定";
  document.getElementById("settingsTitle").innerHTML = isVietnamese
    ? '<i class="bi bi-gear-fill me-2"></i>Cài đặt'
    : '<i class="bi bi-gear-fill me-2"></i>設定';
  document.getElementById("languageSettingLabel").textContent = isVietnamese
    ? "Ngôn ngữ hiển thị"
    : "表示言語";
  document.getElementById("languageSettingDescription").textContent =
    isVietnamese
      ? "Chọn ngôn ngữ hiển thị cho website."
      : "インターフェースの表示言語を選択します。";
  document
    .querySelector("#settingsPanel .offcanvas-header .btn-close")
    .setAttribute("aria-label", isVietnamese ? "Đóng" : "閉じる");
  languageSelect.value = language;
  document.getElementById("selectedLanguageText").textContent = isVietnamese
    ? "Tiếng Việt"
    : "日本語";
  const flag = document.getElementById("selectedLanguageFlag");
  flag.className = `flag-icon ${isVietnamese ? "flag-vietnam" : "flag-japan"}`;
  flag.innerHTML = isVietnamese ? "<span>★</span>" : "<span></span>";
  document.querySelectorAll(".language-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.language === language);
  });
  document.getElementById("footerCreditText").textContent = isVietnamese
    ? `Copyright © ${new Date().getFullYear()} Uminohi · Developed by BaoNH4. All rights reserved.`
    : `© ${new Date().getFullYear()} Uminohi · 開発: BaoNH4. すべての権利を保有します。`;
  syncQuizSetupLanguage(language);
  applyHomeLanguage(language);
  applyCoursePageLanguage(language);
}

function changeLanguage(language) {
  const savedLanguage = saveLanguage(language);
  syncLanguageUI(savedLanguage);
  window.dispatchEvent(
    new CustomEvent("app-language-change", {
      detail: { language: savedLanguage },
    })
  );
}

function readRoute() {
  if (location.hash.startsWith("#/")) {
    let legacyParts;
    try {
      legacyParts = decodeURIComponent(location.hash.slice(1))
        .split("/")
        .filter(Boolean);
    } catch {
      return { type: "invalid" };
    }
    let legacyRoute = { type: "invalid" };
    if (!legacyParts.length) {
      legacyRoute = { type: "home" };
    } else if (legacyParts.length === 2 && legacyParts[0] === "level") {
      legacyRoute = { type: "level", levelId: legacyParts[1] };
    } else if (
      legacyParts.length === 3 &&
      legacyParts[0] === "renshuu"
    ) {
      legacyRoute = {
        type: "renshuu",
        levelId: legacyParts[1],
        courseId: legacyParts[2],
      };
    }
    if (legacyRoute.type === "invalid") return legacyRoute;
    history.replaceState(null, "", routeUrl(legacyRoute));
    return legacyRoute;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(location.pathname).replace(/\/+$/, "") || "/";
  } catch {
    return { type: "invalid" };
  }
  const appRoot = appPathname() || "/";
  if (pathname === appRoot) {
    history.replaceState(null, "", homeUrl());
    return { type: "home" };
  }
  if (pathname === homeUrl()) return { type: "home" };

  const routePrefix = `${homeUrl()}/`;
  if (pathname.startsWith(routePrefix)) {
    const parts = pathname.slice(routePrefix.length).split("/");
    if (parts.length === 2 && parts[0] === "level") {
      return { type: "level", levelId: parts[1] };
    }
    if (parts.length === 4 && parts[0] === "level") {
      const [, levelId, courseId, mode] = parts;
      if (mode === "benkyou") return { type: "course", levelId, courseId };
      if (mode === "goi") return { type: "study", levelId, courseId };
      if (mode === "hoc") {
        history.replaceState(
          null,
          "",
          courseUrl(levelId, courseId, "goi")
        );
        return { type: "study", levelId, courseId };
      }
      if (mode === "renshuu") return { type: "renshuu", levelId, courseId };
    }
  }
  return { type: "invalid" };
}

function displayPage(page) {
  if (page !== "study") cancelStudyLoad();
  document.body.classList.toggle("renshuu-mode", page === "renshuu");
  document.body.classList.toggle("catalog-settings", page !== "renshuu");
  homePage.classList.toggle("d-none", page !== "home");
  coursesPage.classList.toggle("d-none", page !== "courses");
  courseActionsPage.classList.toggle("d-none", page !== "course");
  studyPage.classList.toggle("d-none", page !== "study");
  quizPage.classList.toggle("d-none", page !== "renshuu");
  settingsButton.classList.remove("d-none");
}

function updateSetupCustomScope() {
  setupCustomScopeWrap.classList.toggle(
    "d-none",
    setupScopeSizeSelect.value !== "custom"
  );
}

function cancelStartCountdown() {
  countdownToken++;
  clearTimeout(countdownTimeoutId);
  countdownTimeoutId = null;
  startCountdownOverlay.classList.add("d-none");
  if (resolveCountdown) {
    resolveCountdown(false);
    resolveCountdown = null;
  }
  if (resolveSavedSessionChoice) {
    resolveSavedSessionChoice(null);
    resolveSavedSessionChoice = null;
    savedSessionConfigModal.hide();
  }
  startingCourseKey = null;
}

function runStartCountdown(courseKey) {
  const token = ++countdownToken;
  const messages =
    document.documentElement.lang === "vi"
      ? ["3", "2", "1", "Bắt đầu"]
      : ["3", "2", "1", "スタート"];
  startingCourseKey = courseKey;
  startCountdownOverlay.classList.remove("d-none");

  return new Promise((resolve) => {
    resolveCountdown = resolve;
    let index = 0;
    const advance = () => {
      if (token !== countdownToken) return;
      if (index >= messages.length) {
        startCountdownOverlay.classList.add("d-none");
        countdownTimeoutId = null;
        resolveCountdown = null;
        resolve(true);
        return;
      }
      startCountdownText.textContent = messages[index++];
      startCountdownText.classList.toggle(
        "is-word",
        index === messages.length
      );
      startCountdownText.classList.remove("is-changing");
      void startCountdownText.offsetWidth;
      startCountdownText.classList.add("is-changing");
      countdownTimeoutId = setTimeout(advance, 900);
    };
    advance();
  });
}

function showQuizSetup(course, courseKey, levelId) {
  const settings = getQuizSetupSettings();
  setupRandomQuestionToggle.checked = settings.randomQuestions;
  setupTimeoutValue.value = settings.questionTimeSeconds;
  setupScopeSizeSelect.value =
    settings.scopeMode === "full"
      ? "full"
      : settings.scopeMode === "preset" &&
        [...setupScopeSizeSelect.options].some(
          (option) => option.value === String(settings.scopeSize)
        )
      ? String(settings.scopeSize)
      : "custom";
  setupCustomScopeValue.value = settings.scopeSize;
  setupTwoAnswerModeToggle.checked = settings.twoAnswerMode;
  setupOptimizedQuizToggle.checked = settings.optimizedQuizUI;
  setupShowHanVietToggle.checked = settings.showHanVietMeanings;
  setupVocabularyAudioToggle.checked = settings.vocabularyAudioEnabled;
  setupAutoOpenHomophonesToggle.checked = settings.autoOpenHomophones;
  updateSetupCustomScope();
  pendingCourseStart = { course, courseKey, levelId };
  quizSetupModal.show();
}

function readQuizSetupSettings() {
  const scopeMode =
    setupScopeSizeSelect.value === "full"
      ? "full"
      : setupScopeSizeSelect.value === "custom"
      ? "custom"
      : "preset";
  const scopeSize =
    scopeMode === "custom"
      ? Math.max(1, Math.round(Number(setupCustomScopeValue.value) || 50))
      : scopeMode === "full"
      ? getQuizSetupSettings().scopeSize
      : Number(setupScopeSizeSelect.value);
  return {
    randomQuestions: setupRandomQuestionToggle.checked,
    questionTimeSeconds: Math.min(
      30,
      Math.max(3, Math.round(Number(setupTimeoutValue.value) || 5))
    ),
    scopeMode,
    scopeSize,
    twoAnswerMode: setupTwoAnswerModeToggle.checked,
    optimizedQuizUI: setupOptimizedQuizToggle.checked,
    showHanVietMeanings: setupShowHanVietToggle.checked,
    vocabularyAudioEnabled: setupVocabularyAudioToggle.checked,
    autoOpenHomophones: setupAutoOpenHomophonesToggle.checked,
  };
}

async function route() {
  const request = ++routeRequest;
  const current = readRoute();
  const pendingRouteKey =
    current.type === "renshuu"
      ? `${current.levelId}/${current.courseId}`
      : null;
  if (startingCourseKey && pendingRouteKey !== startingCourseKey) {
    cancelStartCountdown();
  }
  if (pendingCourseStart && pendingRouteKey !== pendingCourseStart.courseKey) {
    pendingCourseStart = null;
    quizSetupModal.hide();
  }
  const activeCourseKey = getActiveCourseKey();
  const routeCourseKey =
    current.type === "renshuu"
      ? `${current.levelId}/${current.courseId}`
      : null;
  if (activeCourseKey && routeCourseKey !== activeCourseKey) suspendRenshuu();

  if (current.type === "home") {
    document.title = "日本語の語彙クイズ";
    displayPage("home");
    showHome();
    return;
  }
  if (current.type === "level") {
    if (!LEVELS.some((level) => level.id === current.levelId)) {
      document.title = "Trình độ không tồn tại";
      showCourseError("Trình độ không tồn tại.");
      displayPage("courses");
      return;
    }
    document.title = `${current.levelId.toUpperCase()} · Khóa học`;
    displayPage("courses");
    await showLevelCourses(current.levelId);
    if (request !== routeRequest) return;
    return;
  }
  if (current.type === "course" || current.type === "study") {
    if (!LEVELS.some((level) => level.id === current.levelId)) {
      document.title = "Trình độ không tồn tại";
      showCourseError("Trình độ không tồn tại.");
      displayPage("courses");
      return;
    }
    displayPage(current.type);
    try {
      const course = await getCourse(current.levelId, current.courseId);
      if (request !== routeRequest) return;
      if (!course) {
        document.title = "Khóa học không tồn tại";
        showCourseError("Khóa học không tồn tại hoặc URL không hợp lệ.");
        displayPage("courses");
        return;
      }
      if (current.type === "course") {
        document.title = `${course.name} · Khóa học`;
        showCourseActions(current.levelId, course);
      } else {
        document.title = `${course.name} · Học từ vựng`;
        await showStudyPage(current.levelId, course);
        if (request !== routeRequest) return;
      }
    } catch (error) {
      if (request !== routeRequest) return;
      if (current.type === "study") {
        const status = document.getElementById("studyStatus");
        status.className = "study-status text-danger";
        status.textContent = `Không thể tải từ vựng: ${error.message}`;
      } else {
        showCourseError(`Không thể tải khóa học: ${error.message}`);
        displayPage("courses");
      }
    }
    return;
  }
  if (current.type === "renshuu") {
    document.title = "Renshuu · JLPT 語彙クイズ";
    displayPage("renshuu");
    loadingState.classList.remove("d-none");
    document.getElementById("alertRegion").replaceChildren();
    if (!LEVELS.some((level) => level.id === current.levelId)) {
      document.title = "Trình độ không tồn tại";
      showCourseError("Trình độ không tồn tại.");
      displayPage("courses");
      return;
    }
    try {
      const course = await getCourse(current.levelId, current.courseId);
      if (request !== routeRequest) return;
      if (!course) {
        document.title = "Khóa học không tồn tại";
        showCourseError("Khóa học không tồn tại hoặc URL không hợp lệ.");
        displayPage("courses");
        return;
      }
      const courseKey = `${current.levelId}/${course.id}`;
      if (activeCourseKey && activeCourseKey !== courseKey) {
        location.reload();
        return;
      }
      document.title = `${course.name} · Renshuu`;
      const courseLevelLink = document.getElementById("renshuuCourseLevelLink");
      courseLevelLink.href = levelUrl(current.levelId);
      courseLevelLink.textContent = current.levelId.toUpperCase();
      const courseLink = document.getElementById("renshuuCourseLink");
      courseLink.href = courseUrl(current.levelId, course.id);
      courseLink.textContent = course.name;
      if (activeCourseKey === courseKey) {
        loadingState.classList.remove("d-none");
      }
      showQuizSetup(course, courseKey, current.levelId);
    } catch (error) {
      if (request !== routeRequest) return;
      loadingState.classList.add("d-none");
      const alert = document.createElement("div");
      alert.className = "alert alert-danger";
      alert.textContent = `Không thể tải khóa học: ${error.message}`;
      document.getElementById("alertRegion").appendChild(alert);
    }
    return;
  }
  document.title = "Đường dẫn không hợp lệ";
  showCourseError("Đường dẫn không hợp lệ.");
  displayPage("courses");
}

setupScopeSizeSelect.addEventListener("change", updateSetupCustomScope);
document
  .getElementById("setupDecreaseTimeoutButton")
  .addEventListener("click", () => {
    setupTimeoutValue.value = Math.max(
      3,
      (Number(setupTimeoutValue.value) || 5) - 1
    );
  });
document
  .getElementById("setupIncreaseTimeoutButton")
  .addEventListener("click", () => {
    setupTimeoutValue.value = Math.min(
      30,
      (Number(setupTimeoutValue.value) || 5) + 1
    );
  });
setupTimeoutValue.addEventListener("change", () => {
  setupTimeoutValue.value = Math.min(
    30,
    Math.max(3, Math.round(Number(setupTimeoutValue.value) || 5))
  );
});
cancelQuizSetupButton.addEventListener("click", () => {
  if (!pendingCourseStart) return;
  const { levelId } = pendingCourseStart;
  pendingCourseStart = null;
  quizSetupModal.hide();
  history.pushState(null, "", levelUrl(levelId));
  route();
});
startQuizSetupButton.addEventListener("click", async () => {
  if (!pendingCourseStart) return;
  unlockFeedbackAudio();
  const courseStart = pendingCourseStart;
  const settings = readQuizSetupSettings();
  pendingCourseStart = null;
  startingCourseKey = courseStart.courseKey;
  startQuizSetupButton.disabled = true;
  const modalHidden = new Promise((resolve) => {
    quizSetupModalElement.addEventListener("hidden.bs.modal", resolve, {
      once: true,
    });
  });
  quizSetupModal.hide();
  await modalHidden;
  if (startingCourseKey !== courseStart.courseKey) {
    startQuizSetupButton.disabled = false;
    return;
  }
  try {
    const savedSession = getSavedSessionStatus(courseStart.courseKey, settings);
    let resumeSavedSession = savedSession.hasUnfinishedSession;
    let applySettingsNext = false;
    let restartFromBeginning = false;
    if (resumeSavedSession && savedSession.settingsChanged) {
      const choice = await chooseSavedSessionAction();
      if (startingCourseKey !== courseStart.courseKey) return;
      if (choice === null) {
        pendingCourseStart = courseStart;
        quizSetupModal.show();
        return;
      }
      resumeSavedSession = choice === "continue";
      applySettingsNext = choice === "continue";
      restartFromBeginning = choice === "restart";
    }

    const countdownFinished = await runStartCountdown(courseStart.courseKey);
    if (!countdownFinished) return;
    startingCourseKey = null;
    await startRenshuu(
      courseStart.course.datasetUrl,
      courseStart.courseKey,
      {
        settings,
        resumeSavedSession,
        applySettingsNext,
        restartFromBeginning,
      }
    );
  } catch (error) {
    loadingState.classList.add("d-none");
    const alert = document.createElement("div");
    alert.className = "alert alert-danger";
    alert.textContent = `Không thể bắt đầu khóa học: ${error.message}`;
    document.getElementById("alertRegion").appendChild(alert);
  } finally {
    startQuizSetupButton.disabled = false;
  }
});

window.addEventListener("hashchange", route);
window.addEventListener("popstate", route);
document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const link =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!link || link.target || link.hasAttribute("download")) return;
  const targetUrl = new URL(link.href, location.href);
  const appHome = homeUrl();
  if (
    targetUrl.origin !== location.origin ||
    (targetUrl.pathname !== appHome &&
      !targetUrl.pathname.startsWith(`${appHome}/`))
  ) {
    return;
  }
  event.preventDefault();
  history.pushState(
    null,
    "",
    `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
  );
  route();
});
window.addEventListener("app-language-change", (event) => {
  syncLanguageUI(event.detail.language);
});
languageSelect.addEventListener("change", () =>
  changeLanguage(languageSelect.value)
);
document.querySelectorAll(".language-option").forEach((option) => {
  option.addEventListener("click", () =>
    changeLanguage(option.dataset.language)
  );
});
document.querySelectorAll(".home-route-link").forEach((link) => {
  link.href = homeUrl();
});
syncLanguageUI(getSavedLanguage());
const recoveredPath = new URLSearchParams(location.search).get("__route");
if (recoveredPath?.startsWith("/home")) {
  history.replaceState(null, "", `${appPathname()}${recoveredPath}`);
}
route();
