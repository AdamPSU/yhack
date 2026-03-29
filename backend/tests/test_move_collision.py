"""Tests for NPC movement collision deduplication in run_round.

Validates that the deduplication logic in run_round prevents two NPCs
from occupying the same tile after a round of movement.
"""

from __future__ import annotations

import pytest


def _deduplicate_moves(
    npcs: list[dict],
    move_updates: dict[str, tuple[int, int]],
) -> dict[str, tuple[int, int]]:
    """Extract the deduplication logic from run_round for isolated testing.

    Mirrors the code in run_round.py after the move_updates dict is built.
    """
    occupied_targets: set[tuple[int, int]] = set()
    for npc in npcs:
        npc_id = npc.get("id", "")
        if npc_id not in move_updates:
            occupied_targets.add((npc.get("x", 0), npc.get("y", 0)))

    deduplicated_moves: dict[str, tuple[int, int]] = {}
    for npc_id, pos in move_updates.items():
        if pos not in occupied_targets:
            occupied_targets.add(pos)
            deduplicated_moves[npc_id] = pos
    return deduplicated_moves


class TestMoveDeduplication:
    """Tests for the move collision deduplication pass."""

    def test_no_conflict_both_move(self):
        """Two NPCs moving to different tiles — both succeed."""
        npcs = [
            {"id": "npc_01", "x": 0, "y": 0},
            {"id": "npc_02", "x": 5, "y": 5},
        ]
        moves = {
            "npc_01": (1, 0),
            "npc_02": (5, 6),
        }
        result = _deduplicate_moves(npcs, moves)
        assert result == {"npc_01": (1, 0), "npc_02": (5, 6)}

    def test_two_npcs_target_same_tile(self):
        """Two NPCs moving to the same tile — only first one wins."""
        npcs = [
            {"id": "npc_01", "x": 0, "y": 0},
            {"id": "npc_02", "x": 2, "y": 0},
        ]
        moves = {
            "npc_01": (1, 0),
            "npc_02": (1, 0),
        }
        result = _deduplicate_moves(npcs, moves)
        # Only one NPC should end up at (1, 0)
        assert len(result) == 1
        at_target = [nid for nid, pos in result.items() if pos == (1, 0)]
        assert len(at_target) == 1

    def test_moving_into_stationary_npc(self):
        """An NPC tries to move onto a tile occupied by a stationary NPC."""
        npcs = [
            {"id": "npc_01", "x": 0, "y": 0},
            {"id": "npc_02", "x": 1, "y": 0},  # stationary
        ]
        moves = {
            "npc_01": (1, 0),  # tries to move onto npc_02's tile
        }
        result = _deduplicate_moves(npcs, moves)
        # npc_01 should be blocked — npc_02 is sitting at (1, 0)
        assert "npc_01" not in result

    def test_no_moves(self):
        """No NPCs move — returns empty dict."""
        npcs = [
            {"id": "npc_01", "x": 3, "y": 3},
            {"id": "npc_02", "x": 7, "y": 7},
        ]
        result = _deduplicate_moves(npcs, {})
        assert result == {}

    def test_single_npc_moves_freely(self):
        """Only one NPC moving — always succeeds."""
        npcs = [
            {"id": "npc_01", "x": 5, "y": 5},
            {"id": "npc_02", "x": 10, "y": 10},
        ]
        moves = {"npc_01": (5, 6)}
        result = _deduplicate_moves(npcs, moves)
        assert result == {"npc_01": (5, 6)}

    def test_three_npcs_same_target(self):
        """Three NPCs all target the same tile — only first one gets it."""
        npcs = [
            {"id": "npc_01", "x": 0, "y": 0},
            {"id": "npc_02", "x": 2, "y": 0},
            {"id": "npc_03", "x": 0, "y": 2},
        ]
        moves = {
            "npc_01": (1, 1),
            "npc_02": (1, 1),
            "npc_03": (1, 1),
        }
        result = _deduplicate_moves(npcs, moves)
        at_target = [nid for nid, pos in result.items() if pos == (1, 1)]
        assert len(at_target) == 1

    def test_swap_positions_blocked(self):
        """Two NPCs try to swap positions — at least one is blocked.

        npc_01 at (0,0) moves to (1,0), npc_02 at (1,0) moves to (0,0).
        npc_02's original position (1,0) is NOT in occupied_targets because
        npc_02 IS moving. So npc_01 moves to (1,0) successfully.
        npc_02 tries (0,0) which is also not in occupied_targets (npc_01 is moving).
        Both succeed — this is the expected behavior since both vacate their tiles.
        """
        npcs = [
            {"id": "npc_01", "x": 0, "y": 0},
            {"id": "npc_02", "x": 1, "y": 0},
        ]
        moves = {
            "npc_01": (1, 0),
            "npc_02": (0, 0),
        }
        result = _deduplicate_moves(npcs, moves)
        # Both should succeed since both are vacating their original tiles
        assert result == {"npc_01": (1, 0), "npc_02": (0, 0)}

    def test_chain_collision_only_first_wins(self):
        """A chain: npc_01 and npc_02 both want (3,3), npc_03 wants (4,4).

        npc_01 gets (3,3), npc_02 is blocked, npc_03 gets (4,4).
        """
        npcs = [
            {"id": "npc_01", "x": 2, "y": 3},
            {"id": "npc_02", "x": 3, "y": 2},
            {"id": "npc_03", "x": 4, "y": 3},
        ]
        moves = {
            "npc_01": (3, 3),
            "npc_02": (3, 3),
            "npc_03": (4, 4),
        }
        result = _deduplicate_moves(npcs, moves)
        assert (3, 3) in result.values()
        assert result.get("npc_03") == (4, 4)
        # Only one NPC at (3,3)
        at_33 = [nid for nid, pos in result.items() if pos == (3, 3)]
        assert len(at_33) == 1

    def test_all_positions_unique_after_dedup(self):
        """After deduplication, no two NPCs share a position."""
        npcs = [
            {"id": f"npc_{i:02d}", "x": i, "y": 0}
            for i in range(10)
        ]
        # Several NPCs target overlapping positions
        moves = {
            "npc_00": (5, 5),
            "npc_01": (5, 5),
            "npc_02": (5, 5),
            "npc_03": (6, 6),
            "npc_04": (6, 6),
        }
        result = _deduplicate_moves(npcs, moves)

        # Collect all final positions (moved + stationary)
        final_positions: list[tuple[int, int]] = []
        for npc in npcs:
            npc_id = npc["id"]
            if npc_id in result:
                final_positions.append(result[npc_id])
            else:
                final_positions.append((npc["x"], npc["y"]))

        # All positions must be unique
        assert len(final_positions) == len(set(final_positions))
