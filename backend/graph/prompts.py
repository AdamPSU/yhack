"""Prompt templates for the policy simulation LangGraph nodes."""

PARSE_POLICY_PROMPT = """\
You are an expert policy analyst specializing in economic impact assessment.

<task>
Given the policy text below, perform a thorough analysis and extract structured information about its potential effects.
</task>

<dimensions>
<dimension name="affected_economic_sectors">Identify every industry, market, or sector that would feel direct or indirect effects.</dimension>
<dimension name="key_stakeholders">People, groups, or institutions impacted. Include a mix of powerful actors (corporations, government bodies) and everyday people (workers, consumers, small business owners).</dimension>
<dimension name="expected_economic_impacts">Be specific. Think about employment, prices, trade, investment, innovation, housing, wages, and inequality. Include both intended and unintended consequences.</dimension>
<dimension name="controversy_level">How politically divisive is this policy? Consider who wins and who loses.</dimension>
</dimensions>

<policy_text>
{policy_text}
</policy_text>

<output_format>
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
}}
</output_format>"""

GENERATE_NPCS_PROMPT = """\
You are a creative world-builder designing characters for an economic policy simulation set in a small American town called Millfield.

<task>
Based on the policy analysis below, generate exactly 25 diverse NPC personas who live and work in this town. These characters should represent a realistic cross-section of people who would be affected by the policy. Also generate 30-40 relationships between them.
</task>

<policy_analysis>
{entities_json}
</policy_analysis>

<npc_requirements>
<requirement>Each NPC needs a unique, memorable name and distinct personality</requirement>
<requirement>Include a realistic mix of: workers, business owners, politicians, students, retirees, activists, farmers, and shopkeepers</requirement>
<requirement>Vary income levels (low/medium/high), political leanings (-1.0 far left to 1.0 far right), and industries</requirement>
<requirement>Each personality should be 1-2 sentences capturing how they think, what they care about, and how they might react to change</requirement>
<requirement>Assign grid positions (x: 0-19, y: 0-14) — spread characters across the map, clustering related characters near each other (e.g., shopkeepers near each other in a "downtown" area, farmers on the outskirts)</requirement>
<requirement>Starting mood should reflect their likely initial reaction to the policy: "hopeful", "anxious", "angry", "neutral", "excited", "worried", "skeptical", or "determined"</requirement>
</npc_requirements>

<relationship_requirements>
<requirement>Types: "friend", "family", "employer", "neighbor", "colleague"</requirement>
<requirement>Strength: 0.0 to 1.0 (how much influence they have on each other)</requirement>
<requirement>Make the social network realistic — family clusters, workplace connections, neighborhood proximity, unlikely friendships</requirement>
</relationship_requirements>

<output_format>
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
}}
</output_format>"""

NPC_ROUND_PROMPT = """\
You are simulating the behavior of a single person in a small town reacting to a new economic policy. Stay in character and produce realistic, sometimes surprising reactions.

<character>
<name>{npc_name}</name>
<role>{npc_role}</role>
<industry>{npc_industry}</industry>
<income_level>{npc_income}</income_level>
<political_leaning description="-1 = far left, 1 = far right">{npc_leaning}</political_leaning>
<personality>{npc_personality}</personality>
<current_mood>{npc_mood}</current_mood>
<position x="{npc_x}" y="{npc_y}"/>
</character>

<policy>
{policy_summary}
</policy>

<simulation_state>
<round current="{current_round}" max="{max_rounds}"/>
{round_context}
</simulation_state>

<nearby_characters description="within 2 tiles of you">
{nearby_npcs}
</nearby_characters>

<distant_connections description="people you care about, not nearby">
{social_targets}
</distant_connections>

<last_round_events description="what nearby characters did last round">
{neighbor_events}
</last_round_events>

<instructions>
Think through three steps as this character:

<step name="perceive">What stands out to you about the policy and what the people around you are doing? Pay attention to people you have relationships with — friends, family, and colleagues matter more than strangers.</step>

<step name="react">How do you emotionally and economically respond? Consider your personality, income, political views, and social connections. If a friend or family member is nearby, you're more likely to engage with them. If someone you care about is far away, you might want to move toward them.</step>

<step name="act">What concrete action(s) do you take this round? Choose 1-3 actions that feel authentic for your character. Prefer interacting with people you have relationships with over strangers. Your social connections act as a gravitational pull.</step>
</instructions>

<action_types>
<action type="chat">Say something to a specific nearby character (must be within 2 tiles of you). You must set target_npc_id to their ID (shown in brackets like [npc_XX]). Prefer talking to friends, family, or colleagues over strangers when possible.</action>
<action type="move">Walk one tile in any direction (you can only move 1 step per round). Consider moving toward people you care about who aren't nearby yet — check the distant_connections section for directions.</action>
<action type="protest">Organize or join a protest. Describe the sign/chant.</action>
<action type="price_change">If you're a business owner or shopkeeper, adjust your prices. Include item, old_price, new_price, and reason.</action>
<action type="mood_shift">Your mood changes. Include old_mood, new_mood, and the trigger.</action>
</action_types>

<output_format>
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

Data fields by event_type:
- chat: {{"target_npc_id": "npc_XX", "dialogue": "what you say"}}
- move: {{"from_x": ..., "from_y": ..., "to_x": ..., "to_y": ..., "destination": "place name"}}
- protest: {{"location": "place", "sign_text": "what the sign says", "intensity": "peaceful|heated|volatile"}}
- price_change: {{"item": "...", "old_price": ..., "new_price": ..., "reason": "..."}}
- mood_shift: {{"old_mood": "...", "new_mood": "...", "trigger": "what caused the shift"}}
</output_format>"""
