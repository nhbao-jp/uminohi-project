export function parseQuestions(text) {
  const questions = [];
  text.replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((line, index) => {
      if (!line.trim()) return;
      const columns = line.split("*").map((value) => value.trim());
      if (columns.length !== 8) {
        console.warn(`${index + 1}行目は8列ではありません。`);
        return;
      }
      const stt = Number(columns[0]);
      if (!Number.isInteger(stt) || !columns[2] || !columns[4]) return;
      questions.push({
        stt,
        kanji: columns[1],
        vocab: columns[2],
        meaning: columns[3],
        answer1: columns[4],
        answer2: columns[5],
        answer3: columns[6],
        answer4: columns[7],
      });
    });
  return questions.sort((a, b) => a.stt - b.stt);
}
