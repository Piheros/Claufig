/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['node-pty'] }
}
module.exports = nextConfig
