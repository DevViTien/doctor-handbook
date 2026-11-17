/**
 * Runs on staged files before each commit (via husky).
 *
 * Windows limits a command line to ~8 KB, so a large commit (dependency upgrade, mass
 * rename) cannot pass every file path to one command. Past a threshold, run the tool on the
 * whole project instead, which yields the same result.
 */
const MAX_FILES_PER_COMMAND = 40;

const quote = (file) => `"${file}"`;

/** @param {string} command @param {string} wholeProjectCommand */
const perFiles = (command, wholeProjectCommand) => (files) =>
  files.length > MAX_FILES_PER_COMMAND
    ? wholeProjectCommand
    : `${command} ${files.map(quote).join(" ")}`;

const config = {
  "*.{ts,tsx,mts,mjs,js}": [
    perFiles("eslint --fix --max-warnings=0", "eslint --fix --max-warnings=0 ."),
    perFiles("prettier --write", "prettier --write ."),
  ],
  "*.{json,css,yml,yaml}": [perFiles("prettier --write", "prettier --write .")],
};

export default config;
