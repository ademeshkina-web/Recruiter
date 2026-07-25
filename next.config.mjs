/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Компактный self-contained вывод для деплоя в Docker / любой Node-хостинг.
  output: "standalone",
};

export default nextConfig;
