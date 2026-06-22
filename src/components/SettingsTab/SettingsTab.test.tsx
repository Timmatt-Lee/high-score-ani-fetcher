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
      uploadDate: new Date("2024-01-01T00:00:00.000Z"),
      score: 4.5,
      ratingCount: 10,
      description: "Desc",
      scannedAt: new Date("2024-01-02T00:00:00.000Z"),
    },
    {
      link: "https://example.com/anime/2",
      title: "Anime 2",
      watchCount: 200,
      episodeCount: 24,
      uploadDate: new Date("2024-02-01T00:00:00.000Z"),
      score: 4.6,
      ratingCount: 20,
      description: "Desc 2",
      scannedAt: undefined,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <SettingsTab
        settings={defaultSettings}
        onSave={vi.fn()}
        searchList={[]}
        favoriteList={[]}
        trashList={[]}
        onImportData={vi.fn()}
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
      searchList: sampleSearchList,
    });

    const exportBtn = screen.getByTestId("btn-export-backup");
    fireEvent.click(exportBtn);

    expect(mockCreateUrl).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeUrl).toHaveBeenCalled();
    expect(screen.getByText("Backup exported successfully!")).toBeDefined();
  });

  it("imports backup successfully", async () => {
    const handleImportData = vi.fn();
    renderComponent({
      onImportData: handleImportData,
    });

    // Mock FileReader behavior with scannedAt string field included
    const mockFileContent = JSON.stringify({
      searchList: [
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
      expect(screen.getByText("Backup restored successfully!")).toBeDefined();
    });
  });

  it("renders validation error on invalid backup file schema", async () => {
    renderComponent();

    // Invalid JSON schema
    const mockFileContent = JSON.stringify({
      searchList: [
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
      const msg = screen.getByTestId("backup-status-msg");
      expect(msg.textContent).toContain("Data schema validation failed");
    });
  });

  it("renders validation error on string throws during import", async () => {
    renderComponent();
    const file = new File(["{}"], "backup.json", { type: "application/json" });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              get result() {
                throw "string error thrown";
              },
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const msg = screen.getByTestId("backup-status-msg");
      expect(msg.textContent).toContain("string error thrown");
    });
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

    renderComponent({
      searchList: sampleSearchList,
    });

    const exportBtn = screen.getByTestId("btn-export-backup");
    fireEvent.click(exportBtn);

    expect(screen.getByText("Failed to export backup data")).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("renders error when reader result is not a string", async () => {
    renderComponent();
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

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const msg = screen.getByTestId("backup-status-msg");
      expect(msg.textContent).toContain("Invalid file content");
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
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
        searchList: [],
        favoriteList: [],
        trashList: [],
      });
      expect(screen.getByText("Backup restored successfully!")).toBeDefined();
    });
  });

  it("renders default fallback message when import fails with empty string error", async () => {
    renderComponent();
    const file = new File(["{}"], "backup.json", { type: "application/json" });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              get result() {
                throw "";
              },
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
      const msg = screen.getByTestId("backup-status-msg");
      expect(msg.textContent).toContain(
        "Failed to parse or validate backup file",
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
