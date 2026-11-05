import { describe, expect, it } from "vitest";
import { countdownLabel, remainingLabel } from "./index";

describe("localized timer labels", () => {
  it("uses Arabic singular, dual and counted forms across plural-rule boundaries", () => {
    const cases = [
      [1, "ثانية واحدة"],
      [2, "ثانيتين"],
      [3, "٣ ثوانٍ"],
      [10, "١٠ ثوانٍ"],
      [11, "١١ ثانية"],
      [20, "٢٠ ثانية"],
      [100, "١٠٠ ثانية"],
      [101, "١٠١ ثانية"],
      [102, "١٠٢ ثانية"],
      [103, "١٠٣ ثوانٍ"],
    ] as const;
    for (const [seconds, duration] of cases)
      expect(countdownLabel(seconds * 1000, "ar"), `${seconds} seconds`).toBe(
        `تُستأنف المواد بعد ${duration}`,
      );
  });

  it("uses second only for one second in English", () => {
    expect(countdownLabel(1000, "en")).toBe("Media resumes in 1 second");
    expect(countdownLabel(2000, "en")).toBe("Media resumes in 2 seconds");
    expect(countdownLabel(21_000, "en")).toBe("Media resumes in 21 seconds");
  });

  it("rounds up before choosing the plural form and announces zero as now", () => {
    expect(countdownLabel(1, "ar")).toBe("تُستأنف المواد بعد ثانية واحدة");
    expect(countdownLabel(1001, "ar")).toBe("تُستأنف المواد بعد ثانيتين");
    expect(countdownLabel(1, "en")).toBe("Media resumes in 1 second");
    expect(countdownLabel(1001, "en")).toBe("Media resumes in 2 seconds");
    expect(countdownLabel(0, "ar")).toBe("تُستأنف المواد الآن");
    expect(countdownLabel(0, "en")).toBe("Media resumes now");
  });

  it("inflects remaining session minutes in the appropriate Arabic case and English number", () => {
    expect(remainingLabel(60_000, "ar")).toBe("بقيت دقيقة واحدة");
    expect(remainingLabel(120_000, "ar")).toBe("بقيت دقيقتان");
    expect(remainingLabel(180_000, "ar")).toBe("بقيت ٣ دقائق");
    expect(remainingLabel(1_200_000, "ar")).toBe("بقيت ٢٠ دقيقة");
    expect(remainingLabel(0, "ar")).toBe("لم يتبقّ وقت");
    expect(remainingLabel(60_000, "en")).toBe("1 minute left");
    expect(remainingLabel(120_000, "en")).toBe("2 minutes left");
    expect(remainingLabel(0, "en")).toBe("0 minutes left");
  });
});
