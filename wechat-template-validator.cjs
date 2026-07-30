#!/usr/bin/env node

const validator = require("./skills/create-windpost-wechat-template/scripts/validate_template.cjs");

if (require.main === module) {
  validator.runCli(process.argv.slice(2));
}

module.exports = validator;
