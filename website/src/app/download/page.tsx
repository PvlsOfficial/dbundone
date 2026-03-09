import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DownloadPage } from "./DownloadPage";

export const metadata: Metadata = {
  title: "Download DBundone",
  description:
    "Download DBundone for Windows. Free and open source — no account required, no limits.",
  alternates: {
    canonical: "https://dbundone.com/download",
  },
};

export default function Download() {
  return (
    <>
      <Header />
      <main>
        <DownloadPage />
      </main>
      <Footer />
    </>
  );
}
