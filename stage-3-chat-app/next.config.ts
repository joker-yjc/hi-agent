import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "path";

// 加载根目录的 .env 文件
config({ path: path.resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig
