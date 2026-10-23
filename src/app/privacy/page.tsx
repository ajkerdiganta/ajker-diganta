import { EditableSitePage, editableSitePageMetadata } from "@/components/public/editable-site-page";

export async function generateMetadata() {
  return editableSitePageMetadata("privacy");
}

export default function PrivacyPage() {
  return <EditableSitePage slug="privacy" />;
}
