import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname as getDirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = getDirname(__filename);

const UNSAFE_PATTERNS = [
	/eval\s*\(/,
	/new Function\(/,
	/script\.src\s*=/,
	/innerHTML\s*=/
];

const scanDirectory = (dirPath) => {
	const files = fs.readdirSync(dirPath, { withFileTypes: true });

	for (const file of files) {
		const fullPath = path.join(dirPath, file.name);

		if (file.isDirectory()) {
			scanDirectory(fullPath);
		} else if (file.isFile() && /\.(js|ts)$/.test(file.name)) {
			const content = fs.readFileSync(fullPath, 'utf-8');

			UNSAFE_PATTERNS.forEach((pattern, index) => {
				if (pattern.test(content)) {
					console.warn(`⚠️ Found pattern #${index + 1} in: ${fullPath}`);
				}
			});
		}
	}
};

scanDirectory(path.join(__dirname, 'src'));
