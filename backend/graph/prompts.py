"""Prompt templates for the policy simulation LangGraph nodes."""

PARSE_POLICY_PROMPT = """\
You are an expert policy analyst specializing in economic impact assessment. \
Given the following policy text, perform a thorough analysis and extract structured information about its potential effects.

Analyze the policy across multiple dimensions:
1. **Affected economic sectors** — identify every industry, market, or sector that would feel direct or indirect effects.
2. **Key stakeholders** — people, groups, or institutions impacted. Include a mix of powerful actors (corporations, government bodies) and everyday people (workers, consumers, small business owners).
3. **Expected economic impacts** — be specific. Think about employment, prices, trade, investment, innovation, housing, wages, and inequality. Include both intended and unintended consequences.
4. **Controversy level** — how politically divisive is this policy? Consider who wins and who loses.

Policy text:
{policy_text}

Respond ONLY with valid JSON (no markdown fences, no commentary):
{{
  "sectors": ["sector1", "sector2", ...],
  "stakeholders": [
    {{"name": "descriptive name", "type": "individual|group|institution", "impact": "brief description of how they are affected"}},
    ...
  ],
  "economic_impacts": [
    {{"description": "specific impact description", "direction": "positive|negative", "magnitude": "low|medium|high", "timeframe": "immediate|short-term|long-term"}},
    ...
  ],
  "controversy_level": "low|medium|high"
}}"""

GENERATE_NPCS_PROMPT = """\
You are a creative world-builder designing characters for an economic policy simulation set in a small American town called Millfield.

Based on the following policy analysis, generate exactly 25 diverse NPC (non-player character) personas who live and work in this town. These characters should represent a realistic cross-section of people who would be affected by the policy.

Policy analysis:
{entities_json}

Requirements for the 25 NPCs:
- Each NPC needs a unique, memorable name and distinct personality
- Include a realistic mix of: workers, business owners, politicians, students, retirees, activists, farmers, and shopkeepers
- Vary income levels (low/medium/high), political leanings (-1.0 far left to 1.0 far right), and industries
- Each personality should be 1-2 sentences capturing how they think, what they care about, and how they might react to change
- Assign grid positions (x: 0-19, y: 0-14) — spread characters across the map, clustering related characters near each other (e.g., shopkeepers near each other in a "downtown" area, farmers on the outskirts)
- Starting mood should reflect their likely initial reaction to the policy: "hopeful", "anxious", "angry", "neutral", "excited", "worried", "skeptical", or "determined"

Also generate 30-40 relationships between NPCs. Relationships create the social network through which information and reactions spread:
- Types: "friend", "family", "employer", "neighbor", "colleague"
- Strength: 0.0 to 1.0 (how much influence they have on each other)
- Make the social network realistic — family clusters, workplace connections, neighborhood proximity, unlikely friendships

Respond ONLY with valid JSON (no markdown fences, no commentary):
{{
  "npcs": [
    {{
      "id": "npc_01",
      "name": "Full Name",
      "role": "worker|business_owner|politician|student|retiree|activist|farmer|shopkeeper",
      "income_level": "low|medium|high",
      "political_leaning": -1.0 to 1.0,
      "industry": "specific industry",
      "personality": "1-2 sentence personality description",
      "x": 0-19,
      "y": 0-14,
      "mood": "initial mood"
    }},
    ...
  ],
  "relationships": [
    {{
      "source_id": "npc_01",
      "target_id": "npc_02",
      "rel_type": "friend|family|employer|neighbor|colleague",
      "strength": 0.0-1.0
    }},
    ...
  ]
}}"""

NPC_ROUND_PROMPT = """\
You are simulating the behavior of a single person in a small town reacting to a new economic policy. Stay in character and produce realistic, sometimes surprising reactions.

=== YOUR CHARACTER ===
Name: {npc_name}
Role: {npc_role}
Industry: {npc_industry}
Income level: {npc_income}
Political leaning: {npc_leaning} (-1 = far left, 1 = far right)
Personality: {npc_personality}
Current mood: {npc_mood}
Current position: ({npc_x}, {npc_y})

=== THE POLICY ===
{policy_summary}

=== SIMULATION STATE ===
Round {current_round} of {max_rounds}
{round_context}

=== WHAT YOUR NEIGHBORS DID LAST ROUND ===
{neighbor_events}

=== YOUR TASK ===
Think through three steps as this character:

1. **PERCEIVE**: What stands out to you about the policy and what your neighbors are doing? What rumors or news have you heard? How does this affect your daily life?

2. **REACT**: How do you emotionally and economically respond? Consider your personality, income, political views, and relationships. Are you scared? Angry? Opportunistic? Resigned? People are complex — show that.

3. **ACT**: What concrete action(s) do you take this round? Choose 1-3 actions that feel authentic for your character.

Action types:
- **chat**: Say something to a neighbor or make a public statement. Include who you're talking to if applicable.
- **move**: Physically go somewhere meaningful (e.g., town hall, market, neighbor's house). Provide new x,y coordinates within the grid (0-19, 0-14).
- **protest**: Organize or join a protest. Describe the sign/chant.
- **price_change**: If you're a business owner or shopkeeper, adjust your prices. Include item, old_price, new_price, and reason.
- **mood_shift**: Your mood changes. Include old_mood, new_mood, and the trigger.

Respond ONLY with valid JSON (no markdown fences, no commentary):
{{
  "events": [
    {{
      "event_type": "chat|move|protest|price_change|mood_shift",
      "message": "human-readable description of what happened",
      "data": {{}}
    }},
    ...
  ]
}}

For data fields:
- chat: {{"target_npc_id": "npc_XX", "dialogue": "what you say"}}
- move: {{"from_x": ..., "from_y": ..., "to_x": ..., "to_y": ..., "destination": "place name"}}
- protest: {{"location": "place", "sign_text": "what the sign says", "intensity": "peaceful|heated|volatile"}}
- price_change: {{"item": "...", "old_price": ..., "new_price": ..., "reason": "..."}}
- mood_shift: {{"old_mood": "...", "new_mood": "...", "trigger": "what caused the shift"}}"""
