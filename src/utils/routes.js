const appBasePath = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

export function homeUrl() {
  return `${appBasePath}/home`;
}

export function levelUrl(levelId) {
  return `${homeUrl()}/level/${encodeURIComponent(levelId)}`;
}

export function courseUrl(levelId, courseId, mode = "benkyou") {
  return `${levelUrl(levelId)}/${encodeURIComponent(courseId)}/${mode}`;
}

export function routeUrl(route) {
  if (route.type === "home") return homeUrl();
  if (route.type === "level") return levelUrl(route.levelId);
  if (route.type === "course") {
    return courseUrl(route.levelId, route.courseId);
  }
  if (route.type === "study") {
    return courseUrl(route.levelId, route.courseId, "goi");
  }
  if (route.type === "renshuu") {
    return courseUrl(route.levelId, route.courseId, "renshuu");
  }
  return `${appBasePath}/`;
}

export function appPathname() {
  return appBasePath;
}
