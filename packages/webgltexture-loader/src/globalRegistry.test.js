import globalRegistry from "./globalRegistry";
import LoadersRegistry from "./LoadersRegistry";

test("globalRegistry is available", () => {
  expect(globalRegistry).toBeInstanceOf(LoadersRegistry);
});
