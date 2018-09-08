
'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const actorPath = path.dirname(
  require.resolve('@comunica/actor-init-sparql-rdfjs/package.json')
);

const actorConfigPath = path.join(
  actorPath,
  'config',
  'config-default.json'
);

const actorConfig = JSON.parse(fs.readFileSync(
  actorConfigPath, 
  'utf8'
));

const actorImportArray = actorConfig.import.slice();

const additionalImportItems = [
  'files-cais:config/sets/rdf-serializers.json',
  'files-cais:config/sets/sparql-serializers.json'
];

for (const additionalImportItem of additionalImportItems) {
  if (actorImportArray.indexOf(additionalImportItem)) {
    actorImportArray.push(additionalImportItem);
  }
}

if (actorImportArray.length > actorConfig.import.length) {
  actorConfig.import = actorImportArray;
  fs.writeFileSync(actorConfigPath, JSON.stringify(actorConfig, null, 2), 'utf8');
  const execOpts = {cwd: actorPath, env: process.env};
  child_process.exec('npm run prepare', execOpts, (err) => {
    if (err) throw err;
  });
}
