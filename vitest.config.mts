import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["source/Test/**/*Test.ts"],
    watch: false,
    // Disabling isolation enables to reuse a temporary database for grouped tests. With isolation, a temporary
    // database will be created for each file which will significantly increase the overhead and test time
    // in larger test suites (where the number of test files > the number of CPU cores).
    pool: "threads",
    isolate: false,
  },
});

