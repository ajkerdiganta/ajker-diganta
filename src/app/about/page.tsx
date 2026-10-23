import { EditableSitePage, editableSitePageMetadata } from "@/components/public/editable-site-page";

export async function generateMetadata() {
  return editableSitePageMetadata("about");
}

export default function AboutPage() {
  return <EditableSitePage slug="about" />;
}
