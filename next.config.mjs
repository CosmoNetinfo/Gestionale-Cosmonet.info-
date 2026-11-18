/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve per caricare un'immagine nei post Facebook (Vercel accetta al massimo ~4,5 MB per richiesta).
  experimental: { serverActions: { bodySizeLimit: "4mb" }, serverComponentsExternalPackages: ["imapflow", "mailparser", "nodemailer"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
