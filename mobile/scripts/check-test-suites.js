#!/usr/bin/env node
/**
 * Runs the whole Jest suite and fails unless every test file on disk actually
 * ran. A suite that silently stops loading (a file moved outside the test
 * pattern, a config change, a suite with no tests left) otherwise only shows
 * up as a smaller number in a passing run.
 *
 *   npm run test:all
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');

/** Every file that looks like a test, wherever it is under src (wider than Jest's own pattern). */
function testFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(full);
    return /\.(test|spec)\.[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

const onDisk = testFiles(src).sort();
const report = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jest-suites-')), 'report.json');
const run = spawnSync('npx', ['jest', '--json', `--outputFile=${report}`, ...process.argv.slice(2)], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
});
if (!fs.existsSync(report)) {
  console.error('Jest wrote no report.');
  process.exit(run.status || 1);
}
const result = JSON.parse(fs.readFileSync(report, 'utf8'));
const ran = new Map(result.testResults.map((suite) => [suite.name, suite]));

const problems = [];
for (const file of onDisk) {
  const suite = ran.get(file);
  const name = path.relative(root, file);
  if (!suite) problems.push(`not run: ${name}`);
  else if (suite.status !== 'passed') problems.push(`${suite.status}: ${name}`);
  else if (suite.assertionResults.length === 0) problems.push(`no tests: ${name}`);
}
for (const name of ran.keys()) if (!onDisk.includes(name)) problems.push(`ran but not found on disk: ${path.relative(root, name)}`);

const tests = result.numTotalTests;
console.log(
  `Test files on disk: ${onDisk.length} · suites run: ${result.numTotalTestSuites} (passed ${result.numPassedTestSuites}) · tests: ${tests} (passed ${result.numPassedTests}, failed ${result.numFailedTests})`,
);
if (problems.length > 0 || !result.success || result.numTotalTestSuites !== onDisk.length) {
  console.error(problems.length ? problems.map((problem) => `  ${problem}`).join('\n') : '  Jest reported a failure.');
  process.exit(1);
}
console.log('Every test file on disk ran and passed.');
