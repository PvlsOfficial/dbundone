import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DownloadPage } from "./DownloadPage";

export const metadata: Metadata = {
  title: "Download DBundone",
  description:
    "Download DBundone for Windows or macOS. Free tier available with no account required.",
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
