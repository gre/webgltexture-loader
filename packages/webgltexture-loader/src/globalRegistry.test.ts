import globalRegistry from "./globalRegistry.js";
import LoadersRegistry from "./LoadersRegistry.js";

test("globalRegistry is available", () => {
  expect(globalRegistry).toBeInstanceOf(LoadersRegistry);
});
