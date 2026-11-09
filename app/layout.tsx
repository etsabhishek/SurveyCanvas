import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SurveyCanvas — Visual questionnaire builder",
  description: "Design, preview and export questionnaires without writing code."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}