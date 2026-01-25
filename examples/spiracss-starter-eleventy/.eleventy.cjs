const pluginWebc = require("@11ty/eleventy-plugin-webc");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginWebc, {
    components: [
      "src/_includes/partials/**/*.webc",
      "src/_includes/blocks/**/*.webc"
    ]
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist"
    },
    templateFormats: ["webc"]
  };
};
