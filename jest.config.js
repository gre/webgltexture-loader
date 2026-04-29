module.exports = {
  testPathIgnorePatterns: ["/node_modules/", "/lib/"],
  // NodeNext requires explicit `.js` extensions in TS source. Strip them at
  // resolution time so Jest finds the actual `.ts` file.
  moduleNameMapper: {
    "^(\\.{1,2}/.+)\\.js$": "$1"
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          esModuleInterop: true,
          isolatedModules: true,
          lib: ["ES2022", "DOM"],
          types: ["jest", "node"]
        }
      }
    ]
  },
  testMatch: ["**/src/**/*.test.{ts,tsx,js,jsx}"]
};
