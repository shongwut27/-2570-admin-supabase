import fs from 'fs';
const code = fs.readFileSync('dist/assets/index-B1to761-.js', 'utf8');

// Simple formatting by splitting on semicolons, braces, etc.
let formatted = code
  .replace(/([;{}])/g, '$1\n')
  .replace(/(["'])([^"'\\]|\\.)*\1/g, (match) => match.replace(/\n/g, '\\n'));

fs.writeFileSync('/tmp/split.js', formatted);
console.log("Done! Total lines:", formatted.split('\n').length);
