import type { NextConfig } from "next";

const config: NextConfig = {
	serverExternalPackages: ["@grpc/grpc-js"],
	transpilePackages: ["@errata/core", "@errata/agents", "@errata/llm"],
	poweredByHeader: false,
};
export default config;
