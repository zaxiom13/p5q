const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
const outputPath = process.argv[2] || path.join(repoRoot, 'release-notes.md');
const rawTag = process.argv[3] || process.env.TAG_NAME || '';
const tag = rawTag.replace(/^v/, '');

function extractSection(changelog, version) {
  const pattern = new RegExp(`## \\[${version.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\] - ([^\\n]+)\\n([\\s\\S]*?)(?=\\n## \\[|$)`);
  const match = changelog.match(pattern);
  if (!match) {
    return null;
  }

  return {
    date: match[1].trim(),
    body: match[2].trim()
  };
}

function renderFromChangelog(version, section) {
  if (!section) {
    return renderFallback(version);
  }

  return [
    `# Qanvas5 Studio ${version}`,
    '',
    `Released ${section.date}`,
    '',
    section.body,
    '',
    '## Downloads',
    '',
    '- Installers and archives are attached below for each platform.'
  ].join('\n');
}

function renderFallback(version) {
  return [
    `# Qanvas5 Studio ${version}`,
    '',
    '## Highlights',
    '',
    '- Desktop release published to GitHub Releases.',
    '- Includes packaged builds for supported platforms and architectures.',
    '- See `CHANGELOG.md` for fuller project history.'
  ].join('\n');
}

const changelog = fs.readFileSync(changelogPath, 'utf8');
const section = tag ? extractSection(changelog, tag) : '';
const content = renderFromChangelog(tag || 'release', section);

fs.writeFileSync(outputPath, `${content}\n`, 'utf8');
