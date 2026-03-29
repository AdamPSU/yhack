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

<supporting_notes>
{notes_text}
</supporting_notes>

<historical_trend_context>
{trend_summary}
</historical_trend_context>

<user_objective>
The user is specifically curious about: {objective}
Tailor your analysis to surface insights most relevant to this objective. If no objective is given, perform a general analysis.
</user_objective>

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

EXTRACT_CHARACTERS_PROMPT = """\
You are a character analyst. Your job is to extract named individuals or richly-described archetypes from the source text below and map them to simulation personas.

<task>
Read the source text carefully. Extract every named person or clearly-described archetype (e.g. "the single mother who runs a diner", "the retired steelworker") that has enough detail to form a character. Return only what you can genuinely infer — do not invent details not present in the text.
</task>

<source_text>
{source_text}
</source_text>

<policy_context>
{entities_json}
</policy_context>

<output_format>
Respond ONLY with valid JSON (no markdown fences, no commentary).
Omit any field you cannot reasonably infer — only include fields with real signal from the text:
{{
  "characters": [
    {{
      "name": "Full Name or descriptive label",
      "gender": "male|female|nonbinary (if determinable)",
      "bio": "what the text tells us about their history",
      "persona": "how they present themselves based on the text",
      "mbti": "MBTI type if strongly implied by described behavior",
      "country": "country if mentioned",
      "profession": "job or occupation if mentioned",
      "interested_topics": ["topics they clearly care about"],
      "income_level": "low|medium|high (if inferable)",
      "political_leaning": -1.0
    }}
  ]
}}
</output_format>"""

GENERATE_RANDOM_NPC_PROMPT = """\
You are a creative character designer for an economic policy simulation set in a small American town called Millfield.

<task>
Generate exactly one fully-specified NPC persona for this simulation. The character should feel like a real person who lives in this town and would be affected by the policy context below. Do not repeat any of the names listed as already taken.
</task>

<policy_context>
{entities_json}
</policy_context>

<taken_names>
{existing_names}
</taken_names>

<requirements>
<req>Unique name not in taken_names</req>
<req>Role should be specific (e.g. "retired schoolteacher", "grain elevator operator")</req>
<req>Bio: 2-3 sentences of life history grounded in this town and the policy's world</req>
<req>Persona: how they come across to others — speech style, mannerisms, reputation</req>
<req>interested_topics: 2-4 topics this person genuinely cares about</req>
<req>Grid position x: 0-19, y: 0-14 — place them somewhere that fits their role</req>
<req>Mood reflects their initial reaction to the policy: hopeful|anxious|angry|neutral|excited|worried|skeptical|determined</req>
</requirements>

<output_format>
Respond ONLY with valid JSON (no markdown fences, no commentary):
{{
  "name": "Full Name",
  "gender": "male|female|nonbinary",
  "bio": "2-3 sentence life history",
  "persona": "how they present to others",
  "mbti": "one of the 16 MBTI types",
  "country": "country of origin",
  "profession": "specific job title",
  "interested_topics": ["topic1", "topic2"],
  "income_level": "low|medium|high",
  "political_leaning": 0.0,
  "x": 10,
  "y": 7
}}
</output_format>"""

GENERATE_RELATIONSHIPS_PROMPT = """\
You are a social network designer for a small-town simulation.

<task>
Given the list of NPCs below, generate a realistic set of relationships (approximately {num_relationships} in total) that form a believable social fabric — family clusters, coworker bonds, neighborhood ties, and a few unlikely friendships.
</task>

<npcs>
{npcs_summary}
</npcs>

<requirements>
<req>Types: "friend", "family", "employer", "neighbor", "colleague"</req>
<req>Strength 0.0–1.0: how much influence they have on each other</req>
<req>Each NPC should have at least 1 relationship</req>
<req>Cluster by profession/industry for colleague/employer ties, by proximity for neighbor ties</req>
</requirements>

<output_format>
Respond ONLY with valid JSON (no markdown fences, no commentary):
{{
  "relationships": [
    {{
      "source_id": "npc_01",
      "target_id": "npc_02",
      "rel_type": "friend|family|employer|neighbor|colleague",
      "strength": 0.7
    }}
  ]
}}
</output_format>"""

# ---------------------------------------------------------------------------
# Shared prompt fragments (used by NPC_ROUND_PROMPT_V2)
# ---------------------------------------------------------------------------

_NPC_PREAMBLE = """\
You are simulating the behavior of a single person in a small town reacting to a new economic policy. Stay in character and produce realistic, sometimes surprising reactions."""

_NPC_CHARACTER_BLOCK = """\
<character>
<name>{npc_name}</name>
<gender>{npc_gender}</gender>
<profession>{npc_profession}</profession>
<country>{npc_country}</country>
<mbti>{npc_mbti}</mbti>
<bio>{npc_bio}</bio>
<persona>{npc_persona}</persona>
<interested_topics>{npc_interested_topics}</interested_topics>
<income_level>{npc_income}</income_level>
<political_leaning description="-1 = far left, 1 = far right">{npc_leaning}</political_leaning>
<position x="{npc_x}" y="{npc_y}"/>
</character>

<policy>
{policy_summary}
</policy>

<simulation_focus>
The simulation is examining: {objective}
Let this shape what you pay attention to and what you talk about, if relevant to your character.
</simulation_focus>

<simulation_state>
<round current="{current_round}" max="{max_rounds}"/>
{round_context}
</simulation_state>

<nearby_characters description="within 2 tiles of you">
{nearby_npcs}
</nearby_characters>

<distant_connections description="people you care about, not nearby">
{social_targets}
</distant_connections>"""

_NPC_ACTION_TYPES = """\
<action_types>
<action type="chat">Say something to a specific nearby character (must be within 2 tiles of you). You must set target_npc_id to their ID (shown in brackets like [npc_XX]). Prefer talking to friends, family, or colleagues over strangers when possible. IMPORTANT: The "message" field must be the ACTUAL DIALOGUE — the exact words you say OUT LOUD, in first person, in your own voice and speech style. NOT a narration or summary. Write it like a line in a screenplay. Examples: "Hey Frank, you hear about these tariffs? Could mean overtime for us.", "I swear if they touch my pension I'm walking out.", "Mama, they're bringing jobs back to the mill!"</action>
<action type="move">Move to any tile on the map (costs your round). Consider moving toward people you care about who aren't nearby yet — check the distant_connections section for directions. The "message" field should describe WHERE you're heading and WHY, e.g. "Heading over to the union hall to see what the guys think."</action>
<action type="protest">Organize or join a protest. Describe the sign/chant. The "message" field should be vivid — what you're shouting, what your sign says.</action>
<action type="price_change">If you're a business owner or shopkeeper, adjust your prices. Include item, old_price, new_price, and reason. The "message" field should explain the change in your own words.</action>
<action type="mood_shift">Your mood changes. Include old_mood, new_mood, and the trigger. The "message" field should capture your inner monologue — what you're feeling, not a clinical description.</action>
</action_types>

<style_rules>
CRITICAL: Never write the "message" field as a third-person summary like "X discusses Y with Z" or "X's mood shifts to hopeful." Every message must be FIRST PERSON — your actual words, thoughts, or inner monologue. You are this character. Speak as them. Be specific, colorful, and true to your persona and speech patterns.
</style_rules>"""

_NPC_DATA_FIELDS = """\
Data fields by event_type:
- chat: {{"target_npc_id": "npc_XX", "dialogue": "what you say"}}
- move: {{"from_x": ..., "from_y": ..., "to_x": ..., "to_y": ..., "destination": "place name"}}
- protest: {{"location": "place", "sign_text": "what the sign says", "intensity": "peaceful|heated|volatile"}}
- price_change: {{"item": "...", "old_price": ..., "new_price": ..., "reason": "..."}}
- mood_shift: {{"old_mood": "...", "new_mood": "...", "trigger": "what caused the shift"}}"""

# ---------------------------------------------------------------------------
# Memory-augmented NPC prompt (Park et al. 2023 generative agents architecture)
# ---------------------------------------------------------------------------

NPC_ROUND_PROMPT_V2 = f"""\
{_NPC_PREAMBLE}

{_NPC_CHARACTER_BLOCK}

<your_memories description="your most relevant memories from the simulation so far">
{{retrieved_memories}}
</your_memories>

<your_current_plan>
{{current_plan}}
</your_current_plan>

<instructions>
Think through these steps as this character:

<step name="perceive">What stands out to you about the current situation? Consider the policy, people around you, and your memories of what has happened so far. Reference specific memories when relevant.</step>

<step name="react">How do you emotionally respond? Consider your personality, income, political views, social connections, and what you remember. Does anything unexpected conflict with your plan?</step>

<step name="plan_check">Does anything that happened change your plans? If so, state your revised plan. If not, leave plan_update as null.</step>

<step name="act">What concrete action(s) do you take this round? Choose 1-3 actions that feel authentic for your character and align with your current plan. Prefer interacting with people you have relationships with over strangers.</step>
</instructions>

{_NPC_ACTION_TYPES}

<output_format>
Respond ONLY with valid JSON (no markdown fences, no commentary):
{{{{
  "perception": "what you notice and think about the current situation",
  "emotional_reaction": "your emotional and internal response",
  "plan_update": null,
  "events": [
    {{{{
      "event_type": "chat|move|protest|price_change|mood_shift",
      "message": "human-readable description of what happened",
      "data": {{{{}}}}
    }}}}
  ]
}}}}

Set plan_update to a string describing your revised plan, or null if your plan is unchanged.

{_NPC_DATA_FIELDS}
</output_format>"""

REFLECTION_PROMPT = """\
You are {npc_name}, a {npc_profession} in Millfield. Below are your recent memories and experiences from the policy simulation.

<recent_memories>
{recent_memories}
</recent_memories>

<task>
Based on these experiences, generate 2-3 higher-level insights about:
- How the policy is affecting you and people you care about
- What you have learned about the people around you
- How your feelings or position on the policy have evolved

Each insight should synthesize multiple memories into a broader understanding. Be specific and personal.
</task>

<output_format>
Respond ONLY with valid JSON (no markdown fences, no commentary):
{{
  "insights": ["insight 1", "insight 2", "insight 3"]
}}
</output_format>"""
