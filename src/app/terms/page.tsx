import { EditableSitePage, editableSitePageMetadata } from "@/components/public/editable-site-page";

export async function generateMetadata() {
  return editableSitePageMetadata("terms");
}

export default function TermsPage() {
  return <EditableSitePage slug="terms" />;
}
