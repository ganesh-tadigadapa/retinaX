/**
 * Share to WhatsApp: share sheet with the PDF when the device supports it, otherwise
 * download + wa.me. The message never carries the grade.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CareBridgeProvider from "@/components/carebridge/CareBridgeProvider";
import ShareToWhatsApp from "@/components/carebridge/ShareToWhatsApp";

const PDF_B64 = btoa("%PDF-1.4 test");
const R: any = {
  scan_id: "sc_test123",
  grading: { icdr_grade: 3, referable: true },
  report: { pdf_b64: PDF_B64, filename: "dr-report.pdf" },
};

const renderIt = (r = R) =>
  render(<CareBridgeProvider><ShareToWhatsApp r={r} /></CareBridgeProvider>);

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-ignore
  delete (navigator as any).share; delete (navigator as any).canShare;
});

describe("Share to WhatsApp", () => {
  it("renders nothing without a report", () => {
    const { container } = renderIt({ ...R, report: undefined });
    expect(container.textContent).toBe("");
  });

  it("opens the share sheet with the PDF attached when supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: /share to whatsapp/i }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = share.mock.calls[0][0];
    expect(arg.files[0].name).toBe("dr-report.pdf");
    expect(arg.files[0].type).toBe("application/pdf");
    expect(arg.text).toContain("sc_test123");
    expect(arg.text.toLowerCase()).not.toMatch(/grade|severe|refer/);
  });

  it("falls back to download + wa.me when files cannot be shared", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    (URL as any).createObjectURL = vi.fn(() => "blob:x");
    (URL as any).revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderIt();
    expect(screen.getByText(/attach the downloaded file/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /share to whatsapp/i }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(click).toHaveBeenCalled();
    expect(String(open.mock.calls[0][0])).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("treats closing the share sheet as no error", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }));
    Object.assign(navigator, { share, canShare: () => true });
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: /share to whatsapp/i }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
