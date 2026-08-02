/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 允许跨域，方便其他 AI 助手调用
  async headers() {
    return [
      {
        source: "/api",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
        ],
      },
    ];
  },
};

export default nextConfig;
