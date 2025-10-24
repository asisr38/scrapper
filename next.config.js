/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Disable React compiler for now as it's experimental
    reactCompiler: false,
  },
  // Ensure proper handling of static files
  trailingSlash: false,
};

module.exports = nextConfig;


