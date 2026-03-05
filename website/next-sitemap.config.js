/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://dbundone.com",
  generateRobotsTxt: false, // We have a manual robots.txt
  exclude: ["/api/*", "/success"],
  changefreq: "weekly",
  priority: 0.7,
  transform: async (config, path) => {
    // Higher priority for key pages
    const priorities = {
      "/": 1.0,
      "/download": 0.9,
      "/blog": 0.8,
    };

    return {
      loc: path,
      changefreq: config.changefreq,
      priority: priorities[path] || config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};
