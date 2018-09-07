
'use strict';

const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname, 
  'node_modules', 
  '@comunica', 
  'actor-init-sparql-rdfjs', 
  'config', 
  'config-default.json'
);

const data = fs.readFileSync(target, 'utf8');

if (!data.match(/.*rdf-serializers.*/)) {
  const lines = data.split(/\r?\n/g);
  lines.splice(18, 0, '    "files-cais:config/sets/sparql-serializers.json",');
  lines.splice(19, 0, '    "files-cais:config/sets/rdf-serializers.json",');
  fs.writeFileSync(target, lines.join('\n'), 'utf8');
}
