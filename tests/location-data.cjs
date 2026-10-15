/* Pure local reference-data checks; no upstream code, external service or user data. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'public/data/vietnam-locations-v5.2.0.json');
const raw = fs.readFileSync(target);
const data = JSON.parse(raw);
const checks = [];
function check(name, fn) { fn(); checks.push(name); console.log(`PASS ${name}`); }
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const provinces = data.provinces;
const wards = provinces.flatMap(p => p.wards);
check('Pinned local data is schema1/v5.2.0 with the reviewed immutable source commit', () => {
  assert.equal(data.schema, 1); assert.equal(data.datasetVersion, 'v5.2.0');
  assert.equal(data.metadata.sourceCommit, '62b1abdfe39625289c37a58ef6678e9db3d37f84');
  assert.ok(data.metadata.sourceUrl.includes(data.metadata.sourceCommit));
});
check('Whole-file and canonical JSON payload hashes match their declared values', () => {
  assert.equal(hash(raw), fs.readFileSync(target.replace(/\.json$/, '.sha256'), 'utf8').split(/\s/)[0]);
  assert.equal(hash(JSON.stringify(provinces)), data.metadata.payloadSha256);
});
check('34 provinces and3321 wards have globally unique string codes', () => {
  assert.equal(provinces.length, 34); assert.equal(wards.length, 3321);
  assert.equal(new Set(provinces.map(p => p.code)).size, 34);
  assert.equal(new Set(wards.map(w => w.code)).size, 3321);
  assert.ok(provinces.every(p => /^\d{2}$/.test(p.code) && typeof p.code === 'string'));
  assert.ok(wards.every(w => /^\d{5}$/.test(w.code) && typeof w.code === 'string'));
});
check('Every ward belongs to its nested province and leading-zero codes remain intact', () => {
  assert.ok(provinces.every(p => p.wards.every(w => w.provinceCode === p.code)));
  assert.equal(provinces.find(p => p.code === '01').name, 'Thành phố Hà Nội');
  assert.ok(wards.some(w => w.code === '00004' && w.provinceCode === '01'));
});
check('Reviewed2026 administrative display changes are present in the pinned reference', () => {
  for (const [code, name] of [['24','Thành phố Bắc Ninh'],['22','Thành phố Quảng Ninh'],['75','Thành phố Đồng Nai']]) {
    assert.equal(provinces.find(p => p.code === code).name, name);
  }
  assert.equal(wards.find(w => w.code === '07294').name, 'Phường Bố Hạ');
});
check('Reference records contain only code, display name and parent data', () => {
  assert.ok(provinces.every(p => Object.keys(p).sort().join(',') === 'code,name,wards'));
  assert.ok(wards.every(w => Object.keys(w).sort().join(',') === 'code,name,provinceCode'));
  assert.ok([...provinces,...wards].every(x => typeof x.name === 'string' && x.name.trim()));
});
const countryText = fs.readFileSync(path.join(root, 'lib/teachers/country-options.ts'), 'utf8');
const countryMatch = countryText.match(/export const countryOptions: readonly CountryOption\[\] = ([\s\S]*);\s*$/);
assert.ok(countryMatch, 'Country source is a data-only declaration');
const countries = JSON.parse(countryMatch[1]);
check('249 country/territory options have unique uppercase alpha2 codes and vi/en labels', () => {
  assert.equal(countries.length, 249); assert.equal(new Set(countries.map(c => c.code)).size, 249);
  assert.ok(countries.every(c => /^[A-Z]{2}$/.test(c.code) && c.vi && c.en));
  assert.equal(countries.find(c => c.code === 'VN').vi, 'Việt Nam');
  assert.equal(countries.some(c => c.code === 'XK'), false);
});
check('Country labels are static data and provenance pins the reviewed archive integrity', () => {
  assert.equal(/Intl\.|fetch\(|require\(|import\(/.test(countryText), false);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'public/data/country-options-v7.14.0.metadata.json')));
  assert.equal(meta.version, 'i18n-iso-countries@7.14.0');
  assert.equal(meta.count, 249); assert.ok(meta.archiveIntegrity.startsWith('sha512-'));
});
check('Both source MIT licenses are redistributed and no verification claim is attached', () => {
  for (const name of ['vietnamese-provinces-database-MIT.txt','i18n-iso-countries-MIT.txt']) {
    assert.ok(fs.readFileSync(path.join(root, 'public/data/licenses', name), 'utf8').includes('MIT'));
  }
  assert.ok(data.metadata.notice.includes('not government affiliation'));
  assert.ok(data.metadata.notice.includes('teacher identity verification'));
});
const report = {status:'PASS', checkedAt:new Date().toISOString(), checks:checks.length, cases:checks, scope:'Local versioned community reference data only; not legal, teacher identity or employment verification. No network or provider calls.'};
fs.writeFileSync(path.join(root, 'docs/v3/qa-location-data-report.json'), `${JSON.stringify(report,null,2)}\n`);
console.log(`Location reference data: ${checks.length} checks passed. No upstream code or user data executed.`);
