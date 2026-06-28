import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsTab } from "./SettingsTab";
import { type AnimeItem } from "../../services/animeScanner";

describe("SettingsTab", () => {
  const defaultSettings = {
    targetScore: 4.8,
    rescanThreshold: 95,
    cacheExpireDays: 14,
    requestDelayMs: 800,
  };

  const sampleSearchList: AnimeItem[] = [
    {
      link: "https://example.com/anime/1",
      title: "Anime 1",
      watchCount: 100,
      episodeCount: 12,
      uploadDate: "2024-01-01T00:00:00.000Z",
      score: 4.5,
      ratingCount: 10,
      description: "Desc",
      scannedAt: "2024-01-02T00:00:00.000Z",
    },
    {
      link: "https://example.com/anime/2",
      title: "Anime 2",
      watchCount: 200,
      episodeCount: 24,
      uploadDate: "2024-02-01T00:00:00.000Z",
      score: 4.6,
      ratingCount: 20,
      description: "Desc 2",
      scannedAt: undefined,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderComponent = (props = {}) => {
    return render(
      <SettingsTab
        settings={defaultSettings}
        onSave={vi.fn()}
        scannedList={[]}
        favoriteList={[]}
        trashList={[]}
        onImportData={vi.fn()}
        onError={vi.fn()}
        {...props}
      />,
    );
  };

  it("renders correctly with provided settings", () => {
    renderComponent();

    expect(screen.getByDisplayValue("4.8")).toBeDefined();
    expect(screen.getByDisplayValue("95")).toBeDefined();
    expect(screen.getByDisplayValue("14")).toBeDefined();
  });

  it("calls onSave when targetScore changes", () => {
    const handleSave = vi.fn();
    renderComponent({ onSave: handleSave });

    const input = screen.getByDisplayValue("4.8");
    fireEvent.change(input, { target: { value: "4.9" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      targetScore: 4.9,
    });
  });

  it("calls onSave when rescanThreshold changes", () => {
    const handleSave = vi.fn();
    renderComponent({ onSave: handleSave });

    const input = screen.getByDisplayValue("95");
    fireEvent.change(input, { target: { value: "90" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      rescanThreshold: 90,
    });
  });

  it("calls onSave when cacheExpireDays changes", () => {
    const handleSave = vi.fn();
    renderComponent({ onSave: handleSave });

    const input = screen.getByDisplayValue("14");
    fireEvent.change(input, { target: { value: "7" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      cacheExpireDays: 7,
    });
  });

  it("calls onSave when requestDelayMs changes", () => {
    const handleSave = vi.fn();
    renderComponent({ onSave: handleSave });

    const input = screen.getByDisplayValue("800");
    fireEvent.change(input, { target: { value: "1000" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      requestDelayMs: 1000,
    });
  });

  it("does not call onSave when input is invalid, empty or NaN", () => {
    const handleSave = vi.fn();
    renderComponent({ onSave: handleSave });

    const input = screen.getByDisplayValue("4.8");

    // Test empty value
    fireEvent.change(input, { target: { value: "" } });
    expect(handleSave).not.toHaveBeenCalled();

    // Test NaN value using defineProperty to bypass HTML5 number input coercion in JSdom
    Object.defineProperty(input, "value", {
      get: () => "NaN",
      configurable: true,
    });
    fireEvent.change(input);
    expect(handleSave).not.toHaveBeenCalled();
  });

  it("clamps targetScore between 0.0 and 5.0", () => {
    const handleSave = vi.fn();
    renderComponent({ onSave: handleSave });

    const input = screen.getByDisplayValue("4.8");

    // Test upper limit clamping
    fireEvent.change(input, { target: { value: "6.0" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      targetScore: 5.0,
    });

    // Test lower limit clamping
    fireEvent.change(input, { target: { value: "-1.0" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      targetScore: 0.0,
    });
  });

  it("clamps rescanThreshold between 0 and 100", () => {
    const handleSave = vi.fn();
    renderComponent({ onSave: handleSave });

    const input = screen.getByDisplayValue("95");

    // Test upper limit clamping
    fireEvent.change(input, { target: { value: "120" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      rescanThreshold: 100,
    });

    // Test lower limit clamping
    fireEvent.change(input, { target: { value: "-10" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      rescanThreshold: 0,
    });
  });

  // --- Import / Export Tests ---

  it("exports backup successfully", () => {
    const mockCreateUrl = vi.fn().mockReturnValue("blob:url");
    const mockRevokeUrl = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: mockCreateUrl,
      revokeObjectURL: mockRevokeUrl,
    });

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") {
        return {
          href: "",
          download: "",
          click: mockClick,
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    renderComponent({
      scannedList: sampleSearchList,
    });

    const exportBtn = screen.getByTestId("btn-export-backup");
    fireEvent.click(exportBtn);

    expect(mockCreateUrl).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeUrl).toHaveBeenCalled();
  });

  it("imports backup successfully", async () => {
    const handleImportData = vi.fn();
    renderComponent({
      onImportData: handleImportData,
    });

    // Mock FileReader behavior with scannedAt string field included
    const mockFileContent = JSON.stringify({
      scannedList: [
        {
          link: "https://example.com/anime/import",
          title: "Imported Anime",
          watchCount: 500,
          episodeCount: 12,
          uploadDate: "2024-05-01T00:00:00.000Z",
          scannedAt: "2024-05-02T00:00:00.000Z",
          score: 4.8,
          ratingCount: 100,
          description: "Successfully imported description",
        },
      ],
    });

    const file = new File([mockFileContent], "backup.json", {
      type: "application/json",
    });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              result: mockFileContent,
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleImportData).toHaveBeenCalled();
    });
  });

  it("renders validation error on invalid backup file schema", async () => {
    const handleError = vi.fn();
    renderComponent({ onError: handleError });

    // Invalid JSON schema
    const mockFileContent = JSON.stringify({
      scannedList: [
        {
          link: "invalid-url",
          title: 12345, // Title must be a string in schema
        },
      ],
    });

    const file = new File([mockFileContent], "backup.json", {
      type: "application/json",
    });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              result: mockFileContent,
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
      expect(handleError.mock.calls[0][0].message).toContain(
        "Data schema validation failed",
      );
    });
  });

  it("renders error on invalid JSON syntax during import", async () => {
    const handleError = vi.fn();
    renderComponent({ onError: handleError });
    const file = new File(["{invalid-json"], "backup.json", {
      type: "application/json",
    });

    // Mock JSON.parse to throw a string error
    vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw "syntax error string";
    });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              result: "{invalid-json",
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
      expect(handleError.mock.calls[0][0].message).toContain(
        "Failed to parse or validate backup file",
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("handles string throws during schema validation during import", async () => {
    const handleError = vi.fn();
    renderComponent({ onError: handleError });
    const file = new File(
      [JSON.stringify({ scannedList: [] })],
      "backup.json",
      {
        type: "application/json",
      },
    );

    // Mock JSON.parse to return a custom object with a throwing getter
    vi.spyOn(JSON, "parse").mockReturnValueOnce({
      get scannedList() {
        throw "custom schema error thrown";
      },
    });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              result: JSON.stringify({ scannedList: [] }),
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
      expect(handleError.mock.calls[0][0].message).toContain(
        "custom schema error thrown",
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("renders error when export backup throws an error", () => {
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        throw new Error("createObjectURL error");
      },
      revokeObjectURL: vi.fn(),
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const handleError = vi.fn();
    renderComponent({
      scannedList: sampleSearchList,
      onError: handleError,
    });

    const exportBtn = screen.getByTestId("btn-export-backup");
    fireEvent.click(exportBtn);

    expect(handleError).toHaveBeenCalled();
    expect(handleError.mock.calls[0][0].message).toContain(
      "Failed to export backup data",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("renders error when reader result is not a string", async () => {
    const handleError = vi.fn();
    renderComponent({ onError: handleError });
    const file = new File(["{}"], "backup.json", { type: "application/json" });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              result: null, // null is not a string
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
      expect(handleError.mock.calls[0][0].message).toContain(
        "Invalid file content",
      );
    });
  });

  it("does nothing when import file input changes but no file is selected", () => {
    const handleImportData = vi.fn();
    renderComponent({ onImportData: handleImportData });

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [] } });

    expect(handleImportData).not.toHaveBeenCalled();
  });

  it("imports backup successfully even when list fields are missing", async () => {
    const handleImportData = vi.fn();
    renderComponent({ onImportData: handleImportData });

    const mockFileContent = JSON.stringify({
      version: 1,
    });

    const file = new File([mockFileContent], "backup.json", {
      type: "application/json",
    });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              result: mockFileContent,
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleImportData).toHaveBeenCalledWith({
        scannedList: [],
        favoriteList: [],
        trashList: [],
      });
    });
  });
});
