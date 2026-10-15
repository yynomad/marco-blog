'use strict';

const { execFileSync } = require('node:child_process');
const { createManifest } = require('../tools/deployment-manifest');

hexo.extend.generator.register('deployment-manifest', function(locals) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: this.base_dir, encoding: 'utf8',
  }).trim();
  return {
    path: 'deployment.json',
    data: JSON.stringify(createManifest(locals.posts.toArray(), commit)),
  };
});
