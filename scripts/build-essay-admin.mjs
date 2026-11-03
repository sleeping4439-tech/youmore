import {readFileSync,writeFileSync} from 'node:fs';
const files={EDITOR_HTML:'essay-editor.html',EDITOR_JS:'essay-editor.js',ARTICLE_TEMPLATE:'essay-sample.html'};
writeFileSync('essay-admin-assets.js',Object.entries(files).map(([k,v])=>'export const '+k+'='+JSON.stringify(readFileSync(v,'utf8'))+';').join('\n'));
