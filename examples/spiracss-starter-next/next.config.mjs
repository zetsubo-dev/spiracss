import path from "path";

const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(process.cwd(), "src")]
  }
};

export default nextConfig;
