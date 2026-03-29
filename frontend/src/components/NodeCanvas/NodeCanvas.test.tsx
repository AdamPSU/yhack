import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NodeCanvas from "./index";
import { useRouter } from "next/navigation";

// Mock the wsClient extractFile
vi.mock("@/services/wsClient", () => ({
	extractFile: vi.fn().mockResolvedValue("Extracted policy text content."),
}));

describe("NodeCanvas End-to-End Simulation Flow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
	});

	it("should complete the full simulation configuration and trigger run", async () => {
		const mockPush = vi.fn();
		(useRouter as any).mockReturnValue({ push: mockPush });

		render(<NodeCanvas />);

		// 1. Policy Node: Enter text
		const policyTextarea = screen.getByTestId("policy-textarea");
		fireEvent.change(policyTextarea, { target: { value: "A comprehensive economic policy about universal basic income." } });
		expect(policyTextarea).toHaveValue("A comprehensive economic policy about universal basic income.");

		// 2. Config Node: Adjust sliders
		const npcsSlider = screen.getByTestId("npcs-slider");
		fireEvent.change(npcsSlider, { target: { value: "40" } });
		expect(npcsSlider).toHaveValue("40");

		const roundsSlider = screen.getByTestId("rounds-slider");
		fireEvent.change(roundsSlider, { target: { value: "10" } });
		expect(roundsSlider).toHaveValue("10");

		// 3. Objective Node: Enter objective
		const objectiveTextarea = screen.getByTestId("objective-textarea");
		fireEvent.change(objectiveTextarea, { target: { value: "How does this affect local inflation?" } });
		expect(objectiveTextarea).toHaveValue("How does this affect local inflation?");

		// 4. Run Node: Trigger simulation
		const runButton = screen.getByTestId("run-button");
		expect(runButton).not.toBeDisabled();
		fireEvent.click(runButton);

		// Verify sessionStorage persistence
		expect(sessionStorage.getItem("agora-policy")).toBe("A comprehensive economic policy about universal basic income.");
		expect(sessionStorage.getItem("agora-num-npcs")).toBe("40");
		expect(sessionStorage.getItem("agora-num-rounds")).toBe("10");
		expect(sessionStorage.getItem("agora-objective")).toBe("How does this affect local inflation?");

		// Verify navigation
		expect(mockPush).toHaveBeenCalledWith("/simulate");
	});

	it("should disable the run button if policy text is too short", () => {
		render(<NodeCanvas />);
		const policyTextarea = screen.getByTestId("policy-textarea");
		const runButton = screen.getByTestId("run-button");

		fireEvent.change(policyTextarea, { target: { value: "Too short" } });
		expect(runButton).toBeDisabled();
	});

	it("should handle file uploads and extract content", async () => {
		render(<NodeCanvas />);
		const fileInput = screen.getByTestId("policy-file-input");
		const policyTextarea = screen.getByTestId("policy-textarea");

		const file = new File(["test policy content"], "policy.pdf", { type: "application/pdf" });
		fireEvent.change(fileInput, { target: { files: [file] } });

		await waitFor(() => {
			expect(policyTextarea.value).toContain("Extracted policy text content.");
		});
	});
});
