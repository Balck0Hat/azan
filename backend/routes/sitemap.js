const express = require('express');
const router = express.Router();
const cities = require('../data/cities.json');

const BASE_URL = 'https://azanlive.com';
const MAX_CITIES = 500;

/**
 * Generate a URL-safe slug from city ascii name and country code.
 * e.g. "New York" + "US" => "new-york-us"
 */
function toSlug(ascii, country) {
  return `${ascii}-${country}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const topCities = cities.slice(0, MAX_CITIES);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Homepage
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += '    <changefreq>daily</changefreq>\n';
  xml += '    <priority>1.0</priority>\n';
  xml += '  </url>\n';

  // City prayer time pages
  for (const city of topCities) {
    const slug = toSlug(city.ascii, city.country);
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/prayer-times/${slug}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

// Cache the sitemap for 1 hour
let cachedSitemap = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

router.get('/sitemap.xml', (req, res) => {
  const now = Date.now();
  if (!cachedSitemap || now - cacheTime > CACHE_TTL) {
    cachedSitemap = buildSitemap();
    cacheTime = now;
  }
  res.set('Content-Type', 'application/xml');
  res.send(cachedSitemap);
});

module.exports = router;
