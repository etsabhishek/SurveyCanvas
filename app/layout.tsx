import type { Metadata } from "next";
import "reactflow/dist/style.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "SurveyCanvas — Visual survey flow builder",
  description: "Build, connect, test and export survey flows visually."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}