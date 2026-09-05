import catalog from "./catalog.json";
import { createRoot } from "react-dom/client";
import { CourseWorkspace } from "./CourseWorkspace";
const language = new URLSearchParams(location.search).get("language");
createRoot(document.getElementById("study-root")!).render(
  <CourseWorkspace
    initialLanguage={
      catalog.some((entry) => entry.slug === language) ? language! : "italian"
    }
  />,
);
