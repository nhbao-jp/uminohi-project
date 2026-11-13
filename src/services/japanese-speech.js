export function speakJapanese(text) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    throw new Error("Trình duyệt không hỗ trợ phát âm.");
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text || ""));
  const voices = window.speechSynthesis.getVoices();
  utterance.lang = "ja-JP";
  utterance.rate = 0.85;
  utterance.voice =
    voices.find(
      (voice) => voice.lang.toLowerCase() === "ja-jp" && voice.default
    ) ||
    voices.find((voice) => voice.lang.toLowerCase() === "ja-jp") ||
    voices.find((voice) => /^ja(?:-|$)/i.test(voice.lang)) ||
    null;
  window.speechSynthesis.speak(utterance);
}
