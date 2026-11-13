import { LEVELS, getCourses } from "../services/course-catalog.js";

const levelGrid = document.getElementById("levelGrid");
const homePage = document.getElementById("homePage");
const coursesPage = document.getElementById("coursesPage");
const courseBreadcrumbLevel = document.getElementById("courseBreadcrumbLevel");
const courseList = document.getElementById("courseList");
const courseStatus = document.getElementById("courseStatus");
let courseRenderToken = 0;
let currentLanguage = "ja";
let currentLevel = null;
let currentCourseState = "";

export function showHome() {
  courseRenderToken++;
  homePage.classList.remove("d-none");
  coursesPage.classList.add("d-none");
  if (!levelGrid.childElementCount) renderLevels();
}

export async function showLevelCourses(levelId) {
  const level = LEVELS.find((item) => item.id === levelId);
  if (!level) return false;
  const renderToken = ++courseRenderToken;
  currentLevel = level;
  currentCourseState = "loading";
  homePage.classList.add("d-none");
  coursesPage.classList.remove("d-none");
  courseBreadcrumbLevel.textContent = level.name;
  document
    .querySelector(".courses-heading .home-eyebrow")
    .classList.remove("d-none");
  courseList.replaceChildren();
  courseStatus.className = "course-status";
  updateCourseCopy();
  try {
    const courses = await getCourses(level.id);
    if (renderToken !== courseRenderToken) return true;
    if (!courses.length) {
      currentCourseState = "empty";
      updateCourseCopy();
      return true;
    }
    currentCourseState = "ready";
    courseStatus.textContent = "";
    courses.forEach((course) => {
      const card = document.createElement("a");
      card.className = "course-card";
      card.href = `#/renshuu/${level.id}/${course.id}`;
      const title = document.createElement("h3");
      title.textContent = course.name;
      const description = document.createElement("p");
      description.textContent = course.description || defaultCourseDescription();
      description.dataset.defaultDescription = String(!course.description);
      const action = document.createElement("span");
      action.className = "course-card-action";
      const actionLabel = document.createElement("span");
      actionLabel.textContent =
        currentLanguage === "vi" ? "Bắt đầu học" : "学習を始める";
      const arrow = document.createElement("i");
      arrow.className = "bi bi-arrow-right";
      arrow.setAttribute("aria-hidden", "true");
      action.append(actionLabel, arrow);
      card.append(title, description, action);
      courseList.appendChild(card);
    });
  } catch (error) {
    if (renderToken !== courseRenderToken) return true;
    currentCourseState = "error";
    courseStatus.dataset.error = error.message;
    courseStatus.textContent = error.message;
    courseStatus.classList.add("text-danger");
  }
  updateCourseCopy();
  return true;
}

export function showCourseError(message) {
  courseRenderToken++;
  currentLevel = null;
  homePage.classList.add("d-none");
  coursesPage.classList.remove("d-none");
  courseBreadcrumbLevel.textContent = "Không tìm thấy";
  courseList.replaceChildren();
  courseStatus.className = "course-status text-danger";
  courseStatus.textContent = message;
  document.querySelector(".courses-heading .home-eyebrow").classList.add("d-none");
  currentCourseState = "route-error";
  courseStatus.dataset.error = message;
  updateCourseCopy();
}

export function applyHomeLanguage(language) {
  currentLanguage = language === "vi" ? "vi" : "ja";
  document.documentElement.lang = currentLanguage;
  document.querySelector("#homePage .home-heading h2").textContent =
    currentLanguage === "vi" ? "HỌC TỪ VỰNG TIẾNG NHẬT" : "日本語の語彙学習";
  document.querySelector("#homePage .home-heading p").textContent =
    currentLanguage === "vi"
      ? "Kiên trì mỗi ngày, tiến bộ từng bước."
      : "毎日の積み重ねが、大きな成長につながる。";
  document.querySelector("#levelGrid").setAttribute(
    "aria-label",
    currentLanguage === "vi" ? "Danh sách trình độ JLPT" : "JLPTのレベル一覧"
  );
  document.querySelector("#coursesPage > .renshuu-navigation").setAttribute(
    "aria-label",
    currentLanguage === "vi" ? "Điều hướng trình độ" : "レベルのナビゲーション"
  );
  document.querySelector(".courses-page .home-icon-link").setAttribute(
    "aria-label",
    currentLanguage === "vi" ? "Trang chủ" : "ホーム"
  );
  document.querySelector(".courses-page .home-icon-link").title =
    currentLanguage === "vi" ? "Trang chủ" : "ホーム";
  document.querySelector(".courses-heading .home-eyebrow").textContent =
    currentLanguage === "vi" ? "CHỌN KHÓA HỌC" : "コースを選択";
  document.querySelector("#quizPage .renshuu-navigation").setAttribute(
    "aria-label",
    currentLanguage === "vi" ? "Điều hướng khóa học" : "コースのナビゲーション"
  );
  document.querySelector("#quizPage .home-icon-link").setAttribute(
    "aria-label",
    currentLanguage === "vi" ? "Trang chủ" : "ホーム"
  );
  document.querySelector("#quizPage .home-icon-link").title =
    currentLanguage === "vi" ? "Trang chủ" : "ホーム";
  document.getElementById("renshuuLevelLink").textContent =
    currentLanguage === "vi" ? "Danh sách khóa học" : "コース一覧";
  document.querySelector(".courses-page > .renshuu-navigation").setAttribute(
    "aria-label",
    currentLanguage === "vi" ? "Điều hướng trình độ" : "レベルのナビゲーション"
  );
  if (currentCourseState === "route-error") {
    courseBreadcrumbLevel.textContent =
      currentLanguage === "vi" ? "Không tìm thấy" : "見つかりません";
  }
  document.querySelectorAll(".level-card").forEach((card, index) => {
    const level = LEVELS[index];
    card.setAttribute(
      "aria-label",
      currentLanguage === "vi"
        ? `Xem khóa học ${level.name}`
        : `${level.name}のコースを見る`
    );
    card.querySelector("span:not(.level-card-icon)").textContent =
      currentLanguage === "vi" ? "Khám phá" : "コースを見る";
  });
  document.querySelectorAll(".course-card").forEach((card) => {
    const defaultDescription =
      card.querySelector("p").dataset.defaultDescription === "true";
    if (defaultDescription) {
      card.querySelector("p").textContent = defaultCourseDescription();
    }
    card.querySelector(".course-card-action span").textContent =
      currentLanguage === "vi" ? "Bắt đầu học" : "学習を始める";
  });
  updateCourseCopy();
}

function defaultCourseDescription() {
  return currentLanguage === "vi"
    ? "Mở khóa học để bắt đầu luyện tập."
    : "コースを開いて学習を始めましょう。";
}

function updateCourseCopy() {
  if (currentCourseState === "route-error") {
    const messages = {
      "Trình độ không tồn tại.": "レベルが見つかりません。",
      "Khóa học không tồn tại hoặc URL không hợp lệ.":
        "コースが見つからないか、URLが無効です。",
      "Đường dẫn không hợp lệ.": "URLが無効です。",
    };
    courseStatus.textContent =
      currentLanguage === "vi"
        ? courseStatus.dataset.error
        : messages[courseStatus.dataset.error] || courseStatus.dataset.error;
  } else if (!currentLevel) {
    return;
  } else if (currentCourseState === "loading") {
    courseStatus.textContent =
      currentLanguage === "vi"
        ? "Đang tải danh sách khóa học..."
        : "コース一覧を読み込み中...";
  } else if (currentCourseState === "empty") {
    courseStatus.textContent =
      currentLanguage === "vi"
        ? `Trình độ ${currentLevel.name} hiện chưa có khóa học.`
        : `${currentLevel.name}にはまだコースがありません。`;
  } else if (currentCourseState === "error") {
    courseStatus.textContent = courseStatus.dataset.error;
  }
}

function renderLevels() {
  LEVELS.forEach((level) => {
    const card = document.createElement("a");
    card.className = "level-card";
    card.href = `#/level/${level.id}`;
    card.setAttribute(
      "aria-label",
      currentLanguage === "vi"
        ? `Xem khóa học ${level.name}`
        : `${level.name}のコースを見る`
    );
    const badge = document.createElement("span");
    badge.className = "level-card-icon";
    badge.innerHTML = '<i class="bi bi-journal-bookmark-fill" aria-hidden="true"></i>';
    const name = document.createElement("strong");
    name.textContent = level.name;
    const caption = document.createElement("span");
    caption.textContent =
      currentLanguage === "vi" ? "Khám phá" : "コースを見る";
    const arrow = document.createElement("i");
    arrow.className = "bi bi-arrow-up-right level-card-arrow";
    arrow.setAttribute("aria-hidden", "true");
    card.append(badge, name, caption, arrow);
    levelGrid.appendChild(card);
  });
}
