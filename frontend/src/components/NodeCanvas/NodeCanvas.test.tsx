import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/navigation";
import NodeCanvas from "./index";

const { uploadContextSource, startSimulation } = vi.hoisted(() => ({
  uploadContextSource: vi.fn(),
  startSimulation: vi.fn(),
}));

vi.mock("@/services/wsClient", () => ({
  uploadContextSource,
  startSimulation,
}));

describe("NodeCanvas PDF Policy Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("uploads a primary PDF, attaches a CSV, and starts the simulation", async () => {
    const mockPush = vi.fn();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    });

    uploadContextSource.mockImplementation(async (file: File) => {
      if (file.name.endsWith(".pdf")) {
        return {
          id: "src_policy",
          kind: "pdf",
          filename: file.name,
          label: "Primary Policy PDF",
          status: "ready",
          preview_text:
            "National industrial policy focused on strategic manufacturing.",
          summary:
            "National industrial policy focused on strategic manufacturing.",
          metadata: { page_count_estimate: 4 },
        };
      }

      return {
        id: "src_trend",
        kind: "csv",
        filename: file.name,
        label: file.name,
        status: "ready",
        preview_text: "Inflation rate: 3.1 -> 3.4 (up).",
        summary: "Inflation rate: 3.1 -> 3.4 (up).",
        metadata: {
          row_count: 12,
          columns: ["month", "inflation_rate"],
          indicator_snapshots: [],
        },
      };
    });
    startSimulation.mockResolvedValue("sim-123");

    render(<NodeCanvas />);

    const pdfInput = screen.getByTestId("policy-pdf-input");
    const pdfFile = new File(["pdf"], "policy.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(pdfInput, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByText("policy.pdf")).toBeInTheDocument();
    });

    const notesTextarea = screen.getByTestId("policy-textarea");
    fireEvent.change(notesTextarea, {
      target: {
        value: "Focus on inflation pass-through and lower-income households.",
      },
    });

    const npcsSlider = screen.getByTestId("npcs-slider");
    fireEvent.change(npcsSlider, { target: { value: "40" } });

    const roundsSlider = screen.getByTestId("rounds-slider");
    fireEvent.change(roundsSlider, { target: { value: "10" } });

    const objectiveTextarea = screen.getByTestId("objective-textarea");
    fireEvent.change(objectiveTextarea, {
      target: { value: "How does this affect local inflation?" },
    });

    const csvInput = screen.getByTestId("trend-csv-input");
    const csvFile = new File(
      ["month,inflation_rate\n2024-01,3.1"],
      "inflation.csv",
      {
        type: "text/csv",
      },
    );
    fireEvent.change(csvInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(screen.getByText("inflation.csv")).toBeInTheDocument();
    });

    const runButton = screen.getByTestId("run-button");
    expect(runButton).not.toBeDisabled();
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(startSimulation).toHaveBeenCalledWith({
        primary_policy_source_id: "src_policy",
        notes_text:
          "Focus on inflation pass-through and lower-income households.",
        trend_source_ids: ["src_trend"],
        num_rounds: 10,
        num_npcs: 40,
        objective: "How does this affect local inflation?",
        map_id: "ccity",
      });
    });

    expect(sessionStorage.getItem("agora-policy")).toBe("policy.pdf");
    expect(sessionStorage.getItem("agora-notes")).toBe(
      "Focus on inflation pass-through and lower-income households.",
    );
    expect(sessionStorage.getItem("agora-num-npcs")).toBe("40");
    expect(sessionStorage.getItem("agora-num-rounds")).toBe("10");
    expect(sessionStorage.getItem("agora-objective")).toBe(
      "How does this affect local inflation?",
    );
    expect(mockPush).toHaveBeenCalledWith("/simulate?id=sim-123");
  });

  it("disables the run button until a primary PDF is uploaded", () => {
    render(<NodeCanvas />);
    expect(screen.getByTestId("run-button")).toBeDisabled();
  });

  it("uploads and displays CSV trend sources", async () => {
    uploadContextSource.mockResolvedValue({
      id: "src_trend",
      kind: "csv",
      filename: "gdp.csv",
      label: "gdp.csv",
      status: "ready",
      preview_text: "GDP: 2.1 -> 2.5 (up).",
      summary: "GDP: 2.1 -> 2.5 (up).",
      metadata: {
        row_count: 8,
        columns: ["quarter", "gdp_growth"],
        indicator_snapshots: [],
      },
    });

    render(<NodeCanvas />);
    const csvInput = screen.getByTestId("trend-csv-input");
    const csvFile = new File(["quarter,gdp_growth\n2024-Q1,2.1"], "gdp.csv", {
      type: "text/csv",
    });
    fireEvent.change(csvInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(screen.getByText("gdp.csv")).toBeInTheDocument();
      expect(screen.getByText("GDP: 2.1 -> 2.5 (up).")).toBeInTheDocument();
    });
  });
});
