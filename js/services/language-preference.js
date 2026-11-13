const SETTING_KEY = "jlptVocabularyQuizSettingsV1";

export function getSavedLanguage() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTING_KEY) || "{}");
    return settings.language === "vi" ? "vi" : "ja";
  } catch {
    return "ja";
  }
}

export function saveLanguage(language) {
  const normalizedLanguage = language === "vi" ? "vi" : "ja";
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(SETTING_KEY) || "{}");
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      settings = {};
    }
  } catch {
    settings = {};
  }
  localStorage.setItem(
    SETTING_KEY,
    JSON.stringify({ ...settings, language: normalizedLanguage })
  );
  return normalizedLanguage;
}
