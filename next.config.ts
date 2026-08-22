import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "adm-zip"],
  env: {
    // las subidas directas desde el navegador van al host de storage:
    // vercel.com/api/blob suele caer en las listas de los adblockers
    NEXT_PUBLIC_VERCEL_BLOB_API_URL: "https://blob.vercel-storage.com",
  },
};

export default nextConfig;
