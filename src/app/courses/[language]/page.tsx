import catalog from "@/features/course-pack/catalog.json";
import { notFound } from "next/navigation";
import { CourseWorkspace } from "@/features/course-pack/CourseWorkspace";
import "@/features/course-pack/study.css";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  if (!catalog.some((entry) => entry.slug === language)) notFound();
  return <CourseWorkspace initialLanguage={language} />;
}
