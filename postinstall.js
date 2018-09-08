
'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const actorInitSparqlRdfjsPath = path.dirname(
  require.resolve('@comunica/actor-init-sparql-rdfjs/package.json')
);

const actorInitSparqlRdfjsConfigPath = path.join(
  actorInitSparqlRdfjsPath,
  'config',
  'config-default.json'
);

const actorInitSparqlRdfjsConfig = fs.readFileSync(
  actorInitSparqlRdfjsConfigPath, 
  'utf8'
);

if (!actorInitSparqlRdfjsConfig.match(/.*rdf-serializers.*/)) {

  const lines = actorInitSparqlRdfjsConfig.split(/\r?\n/g);
  lines.splice(18, 0, '    "files-cais:config/sets/sparql-serializers.json",');
  lines.splice(19, 0, '    "files-cais:config/sets/rdf-serializers.json",');
  fs.writeFileSync(actorInitSparqlRdfjsConfigPath, lines.join('\n'), 'utf8');

  const execOpts = {cwd: actorInitSparqlRdfjsPath, env: process.env};
  child_process.exec('npm run prepare', execOpts, (err) => {
    if (err) throw err;
  });

}
