import { test, expect } from "@playwright/test";
test("Italian teaches, checks locally, saves practice and survives an offline cold start", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Playwright service-worker offline automation is Chromium-only; see docs/astra/testing.md.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses/italian");
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await expect(page.getByText("Io sono Anna.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  await page.getByLabel("Your answer", { exact: true }).fill("IO SONO ANNA!");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(
    page.getByText(/1 practice result on this device/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Course", exact: true }).click();
  await page
    .getByRole("button", { name: "Download for offline study", exact: true })
    .click();
  await expect(
    page.getByText(
      "Downloaded. You can open offline study without a connection.",
    ),
  ).toBeVisible({ timeout: 30000 });
  await context.setOffline(true);
  await page.goto("/study.html?language=italian");
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/1 practice result on this device/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  await page.getByLabel("Your answer", { exact: true }).fill("Sono Anna.");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "acceptable alternative",
  );
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(
    page.getByText(/2 practice results on this device/),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(/2 practice results on this device/),
  ).toBeVisible();
});
test("French references and mobile navigation are usable", async ({ page }) => {
  await page.goto("/courses/french");
  await page.getByRole("button", { name: "Grammar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "People and être", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vocabulary", exact: true }).click();
  await page.getByLabel("Search vocabulary").fill("frère");
  await expect(page.getByText("a brother", { exact: true })).toBeVisible();
  for (const width of [320, 390, 430, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("Foundation language").selectOption("italian");
  await expect(page).toHaveURL(/courses\/italian/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
});

test("a complete French lesson unlocks the next lesson and a dialogue can recover", async ({
  page,
}) => {
  await page.goto("/courses/french");
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  for (const answer of ["Je suis Anna.", "I am French."]) {
    await page.getByLabel("Your answer", { exact: true }).fill(answer);
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("correct");
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
  }
  for (const word of ["Je", "suis", "française."])
    await page.getByRole("button", { name: word, exact: true }).click();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  for (const answer of ["suis", "Anna"]) {
    await page.getByLabel("Your answer", { exact: true }).fill(answer);
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Practice complete", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to course", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open next lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "People and être", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Begin practice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Dialogues", exact: true }).click();
  const meeting = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Meeting someone", exact: true }),
  });
  await meeting
    .getByRole("button", { name: "Je suis française.", exact: true })
    .click();
  await expect(meeting.getByRole("status")).toContainText("nationality");
  await meeting
    .getByRole("button", { name: "Je suis Marc.", exact: true })
    .click();
  await expect(
    meeting.getByText("Conversation complete. You reached the goal."),
  ).toBeVisible();
});
