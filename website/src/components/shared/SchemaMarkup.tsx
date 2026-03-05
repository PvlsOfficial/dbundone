export function SchemaMarkup() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DBundone",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Windows, macOS",
    description:
      "Music production management app that auto-discovers FL Studio and Ableton projects, provides audio version control with LUFS analysis, task management, statistics, and a VST3 plugin bridge.",
    url: "https://dbundone.com",
    downloadUrl: "https://dbundone.com/download",
    softwareVersion: "1.0.0",
    author: {
      "@type": "Organization",
      name: "DBundone",
      url: "https://dbundone.com",
    },
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        name: "Free",
        description: "Free tier with up to 25 projects",
      },
      {
        "@type": "Offer",
        price: "79",
        priceCurrency: "USD",
        name: "Pro",
        description:
          "One-time purchase. Unlimited projects, VST3 plugin, collaboration, and all future updates.",
      },
    ],
    featureList: [
      "Auto-discover FL Studio and Ableton Live projects",
      "Audio version control with LUFS, RMS, and Peak analysis",
      "Deep FLP parser (plugins, channels, mixer tracks, samples)",
      "Kanban task management with dependencies and time tracking",
      "Statistics dashboard with activity heatmaps",
      "VST3 plugin bridge for in-DAW recording capture",
      "Cloud collaboration with permission control",
      "AI-powered artwork generation",
      "7 languages supported",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
