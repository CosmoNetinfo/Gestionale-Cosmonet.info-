/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve per caricare un'immagine nei post Facebook (Vercel accetta al massimo ~4,5 MB per richiesta).
  experimental: { serverActions: { bodySizeLimit: "4mb" }, serverComponentsExternalPackages: ["imapflow", "mailparser", "nodemailer"] },
};

export default nextConfig;
