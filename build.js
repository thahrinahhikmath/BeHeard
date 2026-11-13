const esbuild = require('esbuild');
const fs = require('fs');

const common = fs.readFileSync('public/common.jsx', 'utf8');
for (const name of ['audience', 'admin']) {
  const src = common + '\n' + fs.readFileSync(`public/${name}.jsx`, 'utf8');
  const out = esbuild.transformSync(src, { loader: 'jsx' }).code;
  fs.writeFileSync(`public/${name}.js`, out);
}
console.log('Built public/audience.js and public/admin.js');