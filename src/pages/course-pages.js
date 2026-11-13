import { parseQuestions } from "../utils/question-parser.js";
import { courseUrl, homeUrl, levelUrl } from "../utils/routes.js";
import { speakJapanese } from "../services/japanese-speech.js";

const courseActionsPage = document.getElementById("courseActionsPage");
const studyPage = document.getElementById("studyPage");
const studySearchInput = document.getElementById("studySearchInput");
const vocabularyList = document.getElementById("vocabularyList");
const studyStatus = document.getElementById("studyStatus");
let currentLanguage = "ja";
let currentQuestions = [];
let studyRenderToken = 0;

export function showCourseActions(levelId, course) {
  document.getElementById("courseActionsHomeLink").href = homeUrl();
  const levelLink = document.getElementById("courseActionsLevelLink");
  levelLink.href = levelUrl(levelId);
  levelLink.textContent = levelId.toUpperCase();
  document.getElementById("courseActionsCourseName").textContent = course.name;
  document.getElementById("studyModeLink").href = courseUrl(
    levelId,
    course.id,
    "goi"
  );
  document.getElementById("practiceModeLink").href = courseUrl(
    levelId,
    course.id,
    "renshuu"
  );
  updateCoursePageCopy();
}

export async function showStudyPage(levelId, course) {
  const renderToken = ++studyRenderToken;
  currentQuestions = [];
  studySearchInput.value = "";
  vocabularyList.replaceChildren();
  document.getElementById("studyHomeLink").href = homeUrl();
  const levelLink = document.getElementById("studyLevelLink");
  levelLink.href = levelUrl(levelId);
  levelLink.textContent = levelId.toUpperCase();
  const courseLink = document.getElementById("studyCourseLink");
  courseLink.href = courseUrl(levelId, course.id);
  courseLink.textContent = course.name;
  studyStatus.className = "study-status";
  studyStatus.textContent = currentLanguage === "vi" ? "Đang tải từ vựng..." : "単語を読み込み中...";
  updateCoursePageCopy();

  const response = await fetch(course.datasetUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Không thể tải dữ liệu từ vựng (${response.status}).`);
  }
  const questions = parseQuestions(await response.text());
  if (renderToken !== studyRenderToken) return;
  currentQuestions = questions;
  renderVocabularyList();
}

export function cancelStudyLoad() {
  studyRenderToken++;
}

export function applyCoursePageLanguage(language) {
  currentLanguage = language === "vi" ? "vi" : "ja";
  updateCoursePageCopy();
  if (currentQuestions.length || studyStatus.textContent) {
    renderVocabularyList();
  }
}

function updateCoursePageCopy() {
  const isVietnamese = currentLanguage === "vi";
  document.getElementById("courseActionsNavigation").setAttribute(
    "aria-label",
    isVietnamese ? "Điều hướng khóa học" : "コースのナビゲーション"
  );
  document.getElementById("studyNavigation").setAttribute(
    "aria-label",
    isVietnamese ? "Điều hướng danh sách từ vựng" : "単語一覧のナビゲーション"
  );
  const homeLinks = [
    document.getElementById("courseActionsHomeLink"),
    document.getElementById("studyHomeLink"),
  ];
  homeLinks.forEach((link) => {
    link.setAttribute("aria-label", isVietnamese ? "Trang chủ" : "ホーム");
    link.title = isVietnamese ? "Trang chủ" : "ホーム";
  });
  document.getElementById("courseActionsEyebrow").textContent = isVietnamese
    ? "CHỌN CÁCH HỌC"
    : "学習方法を選択";
  document.getElementById("studyModeTitle").textContent = isVietnamese
    ? "Từ vựng"
    : "語彙";
  document.getElementById("studyModeDescription").textContent = isVietnamese
    ? "Xem danh sách từ vựng và nghe cách đọc."
    : "単語一覧を見て、発音を聞きます。";
  document.getElementById("studyModeAction").textContent = isVietnamese
    ? "Mở danh sách từ vựng"
    : "単語一覧を開く";
  document.getElementById("practiceModeTitle").textContent = isVietnamese
    ? "Luyện tập"
    : "練習";
  document.getElementById("practiceModeDescription").textContent = isVietnamese
    ? "Làm bài kiểm tra để ghi nhớ từ vựng."
    : "クイズで単語を覚えましょう。";
  document.getElementById("practiceModeAction").textContent = isVietnamese
    ? "Bắt đầu luyện tập"
    : "練習を始める";
  document.getElementById("studyTitle").textContent = isVietnamese
    ? "Danh sách từ vựng"
    : "単語一覧";
  document.getElementById("studyBreadcrumbTitle").textContent = isVietnamese
    ? "Học"
    : "学ぶ";
  studySearchInput.placeholder = isVietnamese
    ? "Tìm từ vựng..."
    : "単語を検索...";
  studySearchInput.setAttribute(
    "aria-label",
    isVietnamese ? "Tìm từ vựng trong khóa học" : "コース内の単語を検索"
  );
  if (!currentQuestions.length) {
    studyStatus.textContent =
      currentLanguage === "vi" ? "Đang tải từ vựng..." : "単語を読み込み中...";
  }
}

function renderVocabularyList() {
  const searchTerm = studySearchInput.value.trim().toLocaleLowerCase();
  const filteredQuestions = currentQuestions.filter((question) =>
    [question.stt, question.kanji, question.vocab, question.meaning]
      .join(" ")
      .toLocaleLowerCase()
      .includes(searchTerm)
  );
  vocabularyList.replaceChildren();

  if (!filteredQuestions.length) {
    studyStatus.textContent = currentQuestions.length
      ? currentLanguage === "vi"
        ? "Không tìm thấy từ vựng phù hợp."
        : "一致する単語が見つかりません。"
      : currentLanguage === "vi"
        ? "Khóa học chưa có từ vựng hợp lệ."
        : "有効な単語がありません。";
    return;
  }

  studyStatus.textContent =
    currentLanguage === "vi"
      ? `${filteredQuestions.length} từ vựng`
      : `${filteredQuestions.length}語`;
  filteredQuestions.forEach((question) => {
    vocabularyList.appendChild(createVocabularyCard(question));
  });
}

function createVocabularyCard(question) {
  const card = document.createElement("article");
  card.className = "study-vocabulary-card";

  const number = document.createElement("span");
  number.className = "study-vocabulary-number";
  number.textContent = String(question.stt);

  const kanji = document.createElement("strong");
  kanji.className = "study-vocabulary-kanji";
  kanji.lang = "ja";
  kanji.textContent = question.kanji || "—";

  const reading = document.createElement("span");
  reading.className = "study-vocabulary-reading";
  reading.lang = "ja";
  reading.textContent = question.vocab;

  const meaning = document.createElement("span");
  meaning.className = "study-vocabulary-meaning";
  meaning.textContent = question.meaning;

  const speakButton = document.createElement("button");
  speakButton.className = "study-vocabulary-speak";
  speakButton.type = "button";
  speakButton.setAttribute(
    "aria-label",
    currentLanguage === "vi"
      ? `Phát âm ${question.vocab}`
      : `${question.vocab}を再生`
  );
  speakButton.addEventListener("click", () => {
    try {
      speakJapanese(question.vocab);
      studyStatus.classList.remove("text-danger");
    } catch (error) {
      studyStatus.textContent = error.message;
      studyStatus.classList.add("text-danger");
    }
  });
  const icon = document.createElement("i");
  icon.className = "bi bi-volume-up-fill";
  icon.setAttribute("aria-hidden", "true");
  speakButton.appendChild(icon);

  card.append(number, kanji, reading, meaning, speakButton);
  return card;
}

studySearchInput.addEventListener("input", renderVocabularyList);
