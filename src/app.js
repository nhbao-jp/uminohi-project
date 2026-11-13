import { getCourse, LEVELS } from "./services/course-catalog.js";
import {
  getActiveCourseKey,
  initRenshuu,
  resumeRenshuu,
  suspendRenshuu,
} from "./pages/renshuu.js";
import {
  applyHomeLanguage,
  showCourseError,
  showHome,
  showLevelCourses,
} from "./pages/home.js";
import {
  getSavedLanguage,
  saveLanguage,
} from "./services/language-preference.js";

const homePage = document.getElementById("homePage");
const coursesPage = document.getElementById("coursesPage");
const quizPage = document.getElementById("quizPage");
const settingsButton = document.getElementById("settingsButton");
const loadingState = document.getElementById("loadingState");
const languageSelect = document.getElementById("languageSelect");
let routeRequest = 0;

function syncLanguageUI(language) {
  const isVietnamese = language === "vi";
  document.documentElement.lang = language;
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
    ? `Bản quyền © ${new Date().getFullYear()} Uminohi · Phát triển bởi BaoNH4 (nhbao.work@gmail.com). Bảo lưu mọi quyền.`
    : `© ${new Date().getFullYear()} Uminohi · 開発: BaoNH4 (nhbao.work@gmail.com). すべての権利を保有します。`;
  applyHomeLanguage(language);
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
  let parts;
  try {
    parts = decodeURIComponent(location.hash.slice(1))
      .split("/")
      .filter(Boolean);
  } catch {
    return { type: "invalid" };
  }
  if (!parts.length) return { type: "home" };
  if (parts.length === 2 && parts[0] === "level") {
    return { type: "level", levelId: parts[1] };
  }
  if (parts.length === 3 && parts[0] === "renshuu") {
    return { type: "renshuu", levelId: parts[1], courseId: parts[2] };
  }
  return { type: "invalid" };
}

function displayPage(page) {
  document.body.classList.toggle("renshuu-mode", page === "renshuu");
  document.body.classList.toggle("catalog-settings", page !== "renshuu");
  homePage.classList.toggle("d-none", page !== "home");
  coursesPage.classList.toggle("d-none", page !== "courses");
  quizPage.classList.toggle("d-none", page !== "renshuu");
  settingsButton.classList.remove("d-none");
}

async function route() {
  const request = ++routeRequest;
  const current = readRoute();
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
      document.getElementById("selectedCourseName").textContent = course.name;
      const levelUrl = `#/level/${current.levelId}`;
      const courseLevelLink = document.getElementById("renshuuCourseLevelLink");
      courseLevelLink.href = levelUrl;
      courseLevelLink.textContent = current.levelId.toUpperCase();
      document.getElementById("renshuuLevelLink").href = levelUrl;
      if (activeCourseKey === courseKey) {
        loadingState.classList.add("d-none");
        resumeRenshuu();
      } else {
        await initRenshuu(course.datasetUrl, courseKey);
      }
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

window.addEventListener("hashchange", route);
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
syncLanguageUI(getSavedLanguage());
if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#/`);
route();
