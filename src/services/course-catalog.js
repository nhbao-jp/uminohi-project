export const LEVELS = ["n5", "n4", "n3", "n2", "n1"].map((id) => ({
  id,
  name: id.toUpperCase(),
}));

const datasetRoot = new URL("../../dataset/", import.meta.url);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function getCourses(levelId) {
  if (!LEVELS.some((level) => level.id === levelId)) {
    throw new Error("Trình độ không hợp lệ.");
  }
  const metadataUrl = new URL(`${levelId}/courses.json`, datasetRoot);
  const response = await fetch(metadataUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Không thể tải danh sách khóa học (${response.status}).`);
  }
  const courses = await response.json();
  if (!Array.isArray(courses)) {
    throw new Error(`Metadata khóa học của ${levelId.toUpperCase()} không hợp lệ.`);
  }
  const validatedCourses = courses.map((course) =>
    validateCourse(course, levelId)
  );
  if (
    new Set(validatedCourses.map((course) => course.id)).size !== courses.length
  ) {
    throw new Error(
      `Metadata khóa học của ${levelId.toUpperCase()} có ID trùng lặp.`
    );
  }
  return validatedCourses;
}

export async function getCourse(levelId, courseId) {
  const courses = await getCourses(levelId);
  return courses.find((course) => course.id === courseId) || null;
}

function validateCourse(course, levelId) {
  if (
    !course ||
    typeof course.id !== "string" ||
    !slugPattern.test(course.id) ||
    typeof course.name !== "string" ||
    !course.name.trim() ||
    typeof course.dataset !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.txt$/.test(course.dataset)
  ) {
    throw new Error(`Metadata khóa học của ${levelId.toUpperCase()} không hợp lệ.`);
  }
  return {
    id: course.id,
    name: course.name.trim(),
    description:
      typeof course.description === "string" ? course.description.trim() : "",
    datasetUrl: new URL(`${levelId}/${course.dataset}`, datasetRoot).href,
  };
}
