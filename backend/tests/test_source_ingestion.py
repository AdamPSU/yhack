from __future__ import annotations

import pytest

from models.schemas import PolicyInput
from routers import extract as extract_router
from routers import simulate as simulate_router
from services.context_store import clear_sources


async def _fake_extract_pdf(_: bytes) -> str:
    return "Federal industrial policy with tariff relief and tax credits for domestic production."


class DummyUploadFile:
    def __init__(self, filename: str, data: bytes) -> None:
        self.filename = filename
        self._data = data

    async def read(self) -> bytes:
        return self._data


class TestSourceIngestion:
    def setup_method(self) -> None:
        clear_sources()
        simulate_router.simulations.clear()

    @pytest.mark.asyncio
    async def test_uploads_primary_pdf_source(self, monkeypatch) -> None:
        monkeypatch.setattr(extract_router, "_extract_pdf", _fake_extract_pdf)

        source = await extract_router.upload_context_source(
            file=DummyUploadFile("policy.pdf", b"%PDF-1.4 fake"),  # type: ignore[arg-type]
            label="Primary Policy PDF",
        )

        assert source.kind == "pdf"
        assert source.filename == "policy.pdf"
        assert source.label == "Primary Policy PDF"
        assert source.id.startswith("src_")
        assert "Federal industrial policy" in source.summary

    @pytest.mark.asyncio
    async def test_uploads_csv_trend_source_with_indicator_metadata(self) -> None:
        source = await extract_router.upload_context_source(
            file=DummyUploadFile(
                "inflation.csv",
                b"month,inflation_rate\n2024-01,3.1\n2024-02,3.4\n",
            ),  # type: ignore[arg-type]
            label=None,
        )

        assert source.kind == "csv"
        assert source.filename == "inflation.csv"
        assert source.metadata["row_count"] == 2
        assert source.metadata["indicator_snapshots"][0]["metric"] == "inflation_rate"

    @pytest.mark.asyncio
    async def test_start_simulation_accepts_pdf_plus_csv_source_ids(self, monkeypatch) -> None:
        monkeypatch.setattr(extract_router, "_extract_pdf", _fake_extract_pdf)

        pdf_source = await extract_router.upload_context_source(
            file=DummyUploadFile("policy.pdf", b"%PDF-1.4 fake"),  # type: ignore[arg-type]
            label="Primary Policy PDF",
        )
        csv_source = await extract_router.upload_context_source(
            file=DummyUploadFile(
                "gdp.csv",
                b"quarter,gdp_growth\n2024-Q1,2.1\n2024-Q2,2.5\n",
            ),  # type: ignore[arg-type]
            label=None,
        )

        response = await simulate_router.start_simulation(
            PolicyInput(
                primary_policy_source_id=pdf_source.id,
                notes_text="Focus on inflation and wages.",
                trend_source_ids=[csv_source.id],
                num_rounds=10,
                num_npcs=20,
                objective="Measure pressure on consumer prices.",
                map_id="ccity",
            )
        )

        assert response["simulation_id"]
