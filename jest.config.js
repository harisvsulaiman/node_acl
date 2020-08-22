const { defaults: tsjPreset } = require("ts-jest/presets");

module.exports = {
  preset: "@shelf/jest-mongodb",
  // ...some other non related config values...
  transform: tsjPreset.transform,
};
