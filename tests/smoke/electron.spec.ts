import { expect, test, _electron as electron } from "@playwright/test";

test("launches the WenForge desktop shell", async () => {
  const app = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      NODE_ENV: "test"
    }
  });

  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "WenForge Studio" })).toBeVisible();

  const version = await app.evaluate(({ app: electronApp }) => electronApp.getVersion());
  expect(version).toBe("0.1.0");

  await app.close();
});
