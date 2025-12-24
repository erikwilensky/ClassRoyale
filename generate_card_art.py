#!/usr/bin/env python3
"""
Card Art Generation Script
Generates all card art images using gpt-image-1.5 API with transparent backgrounds and organizes them by category.
"""

import os
import re
import json
import time
import requests
import base64
import io
from pathlib import Path
from openai import OpenAI
from PIL import Image
from typing import Dict, List, Tuple

# Configuration
API_KEY = "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"
OUTPUT_DIR = Path("card_art")
DELAY_BETWEEN_REQUESTS = 2  # seconds to wait between API calls

# Category to display name mapping
CATEGORY_NAMES = {
    "time_tempo": "time_tempo",
    "suggestion_control": "suggestion_control",
    "roles_coordination": "roles_coordination",
    "defense_counterplay": "defense_counterplay",
    "gold_economy": "gold_economy",
    "disruption": "disruption",
    "vision_clarity": "disruption",  # Map to disruption folder
    "disruption_light": "disruption",  # Map to disruption folder
    "cosmetic": "cosmetic"
}

# Base Style
BASE_STYLE = (
    "CENTER ART ONLY (not a full card). Single fantasy game-item icon, clean vector + soft cel shading, "
    "bold silhouette, thick outline, crisp edges, subtle inner glow, gentle drop shadow, slight 3/4 perspective. "
    "Subject must fill most of the canvas with ~15% padding and be readable at small size. "
    "Background must be truly transparent (alpha channel). "
    "DO NOT include any UI, card frame, border, rounded-square tile, button, mockup, design sheet, grid, "
    "color swatches, color chips, or transparency checkerboard pattern. "
    "No text, no letters, no numbers, no watermark, no logo. No people, faces, or hands."
)

# Category Colors
COLORS = {
    "TIME": "Colors: blues and violets with soft glow accents.",
    "COMMS": "Colors: cyan and magenta with neon accents.",
    "DECK": "Colors: warm reds and oranges with bright highlights.",
    "DEFENSE": "Colors: teal and green with glassy highlights.",
    "ECON": "Colors: gold and amber with metallic shine.",
    "DISRUPT": "Colors: deep purple and near-black with glitch sparkle accents.",
    "COSMETIC": "Colors: silver and soft pastels with gentle sparkle."
}

def make_prompt(category: str, subject: str) -> str:
    """Generate a prompt from category and subject."""
    return f"{BASE_STYLE} {COLORS[category]} Subject: {subject}"

# Card metadata: (category, subject_description)
CARD_META = {
    # TIME
    "brainwave-boost": ("TIME", "A stylized brain emitting a zig-zag energy wave wrapping around a small clock face; lightning arcs; clear clock hands."),
    "second-wind": ("TIME", "A spiral gust forming a refresh swirl around a stopwatch; motion streaks; clean silhouette."),
    "deadline-extension": ("TIME", "A calendar page stretched by an elastic band connected to a tiny hourglass; paper curl; tension lines."),
    "time-tax": ("TIME", "A siphon tube draining glowing sand from an hourglass into a coin stack; the hourglass looks lighter."),
    "clock-snip": ("TIME", "Sharp scissors cutting a clock face; two halves separated slightly; bright cut edge."),
    "stopwatch-tap": ("TIME", "A stopwatch with a pulsing impact ripple on its top button; spark burst; no finger."),
    "sandstorm": ("TIME", "An hourglass inside a swirling sand vortex; sand grains spiral like a storm; strong silhouette."),
    "momentum-surge": ("TIME", "A wave-shaped arrow pushing a tilted clock forward; strong speed lines; energetic glow."),
    "tempo-thief": ("TIME", "A hooked magnet pulling a glowing clock-hand off a clock face; hand mid-air; tension lines."),
    "last-minute-grace": ("TIME", "A feather quill stroke forming a protective halo around a small clock; soft glow; elegant swoosh."),
    "tick-tock-nudge": ("TIME", "A small gear nudging a clock hand forward; contact point emphasized; mechanical detail."),
    "hourglass-flip": ("TIME", "An hourglass mid-flip with curved motion arcs; sand frozen mid-fall; crisp outline."),

    # COMMS
    "focus-draft": ("COMMS", "A pen nib inside a speech bubble enclosed by a quiet barrier ring; signal waves bouncing off."),
    "focus-draft-lite": ("COMMS", "A smaller pen nib with a short quiet ring; minimal waves; light glow."),
    "deep-focus": ("COMMS", "Concentric focus rings around a pen nib; a strong silence dome; waves fading out."),
    "slow-suggestion": ("COMMS", "A speech bubble riding on a tiny snail shell; trailing signal waves behind it."),
    "gentle-lag": ("COMMS", "A speech bubble with a small embedded hourglass icon; one delayed wave trail."),
    "heavy-lag": ("COMMS", "A speech bubble weighed down by an anchor; signal waves sagging downward."),
    "lag-spike": ("COMMS", "A signal waveform with one tall spike like lightning; speech bubble silhouette behind."),
    "suggestion-jam-short": ("COMMS", "Two speech bubbles tangled by a knot; small sparks; clean readable shape."),
    "suggestion-jam-long": ("COMMS", "A speech bubble wrapped with a chain and padlock; strong blocked silhouette."),
    "quiet-room": ("COMMS", "A closed door with sound-damping panel texture; signal waves stop at the door edge."),

    # DECK / ROLES
    "swap-writer": ("DECK", "Two role cards swapping positions with curved arrows; one card has a pen icon, the other a lightbulb icon."),
    "rapid-swap": ("DECK", "Two cards with double curved arrows and fast motion streaks; energetic speed lines."),
    "double-shuffle": ("DECK", "Three cards in a shuffle loop triangle with two-step arrows; tidy composition."),
    "stability-lock": ("DECK", "A padlock clamping two cards in place; lock over card corners like a clamp."),
    "role-roulette": ("DECK", "A roulette wheel segmented with tiny card silhouettes; one segment glowing as selected."),
    "bench-boost": ("DECK", "A bench seat with an upward rocket-arrow and sparks; bold athletic vibe; energetic boost motion."),

    # DEFENSE
    "idea-shield": ("DEFENSE", "A lightbulb protected behind a glossy shield; bright highlight edge; protective glow."),
    "quick-shield": ("DEFENSE", "A shield with forward speed lines and a spark at the leading edge; snappy silhouette."),
    "fortified-shield": ("DEFENSE", "A shield reinforced with plate segments and thicker rim; sturdy geometry."),
    "shield-recharge": ("DEFENSE", "A shield being charged by a lightning bolt; circular energy ring behind it."),

    # ECON
    "gold-rush": ("ECON", "A bursting pile of coins with a star-shaped shine; crisp rim highlights; metallic depth."),
    "payday": ("ECON", "A coin pouch beside a blank receipt slip with a wax-seal circle (no text); tidy and shiny."),

    # DISRUPTION
    "shake": ("DISRUPT", "A cracked screen slab (no UI) surrounded by jagged vibration lines; strong shake energy."),
    "overclock": ("DISRUPT", "A microchip with lightning surging out; small glitch squares drifting away."),
    "blur": ("DISRUPT", "An eye with layered blur-wave ribbons passing over it; soft fog bands; clear outline; visual distortion effect."),
    "smudge": ("DISRUPT", "A smeared brush stroke dragging across an eye; visible smear texture; clean outline; messy distortion."),
    "pixel-drift": ("DISRUPT", "Pixel blocks drifting off a circular lens; square fragments trailing; glitch sparkle; digital decay effect."),
    "blackout-blink": ("DISRUPT", "A shutter-like eyelid closing with a bright flash edge; brief intense silhouette; dramatic blink motion."),
    "distract": ("DISRUPT", "A swirl vortex with a tiny spark-star at the center; subtle but readable."),

    # COSMETIC
    "writer-spotlight": ("COSMETIC", "A theatrical spotlight cone shining down onto a floating pen nib emblem; dust sparkles in the light beam; strong cone shape, centered."),
    "team-banner-color": ("COSMETIC", "A waving fabric banner on a short pole with a paint droplet splashing across it; a simple two-tone color stripe flowing through the fabric; sparkle accents."),
    "victory-flourish": ("COSMETIC", "A celebratory confetti burst with curled ribbons and star sparkles; layered depth, strong silhouette, centered explosion shape."),
    "signature-style": ("COSMETIC", "A quill pen drawing a graceful flourish swoosh (no letters); sparkle at stroke end; elegant motion trail."),
    "ink-trail-cursor": ("COSMETIC", "A cursor arrow leaving a flowing ink trail curling into a droplet; shiny ink; motion blur effect."),
    "page-turn-sfx": ("COSMETIC", "A page corner flipping with gentle sound-wave arcs; slight paper texture; mid-flip position."),
    "team-entrance-stinger": ("COSMETIC", "A banner sliding in with motion streaks and a small burst sparkle behind it; dynamic entrance pose."),
    "typewriter-mode": ("COSMETIC", "A compact vintage typewriter with a soft glow and tiny sparkles; classic mechanical details."),
    "golden-outline": ("COSMETIC", "An ornate floating frame outline in warm gold; subtle shine; decorative border only, no full card tile."),
    "emoji-sparkles": ("COSMETIC", "A speech bubble silhouette emitting star sparkles; no emoji faces or text; clean bubble shape."),
    "banner-pattern-pack": ("COSMETIC", "Three fabric-like pattern swatches (stripes, dots, waves) stacked neatly; textile texture visible."),
    "calm-theme": ("COSMETIC", "A calm zen wave flowing with soft glow and one small sparkle; peaceful flowing shape; serene motion."),
    "victory-pose-frame": ("COSMETIC", "A trophy silhouette inside a decorative ring frame; confetti accents; centered composition."),
    "team-chant-button": ("COSMETIC", "A round button with a speaker cone and clean sound waves; sparkle accents; audio visualization.")
}

# Generate prompts from metadata
CARD_PROMPTS = {cid: make_prompt(cat, subj) for cid, (cat, subj) in CARD_META.items()}


def parse_card_catalog(file_path: str) -> Dict:
    """Parse the JavaScript card catalog file and extract card data."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    cards = {}
    
    # Find all card entries - look for pattern: "card-id": { ... }
    # This regex handles nested braces by counting them
    card_pattern = r'"([a-z0-9-]+)":\s*\{'
    
    for match in re.finditer(card_pattern, content):
        card_id = match.group(1)
        start_pos = match.end()
        
        # Find the matching closing brace
        brace_count = 1
        pos = start_pos
        while pos < len(content) and brace_count > 0:
            if content[pos] == '{':
                brace_count += 1
            elif content[pos] == '}':
                brace_count -= 1
            pos += 1
        
        if brace_count == 0:
            card_data = content[start_pos:pos-1]
            
            # Extract key fields
            name_match = re.search(r'name:\s*"([^"]+)"', card_data)
            category_match = re.search(r'category:\s*"([^"]+)"', card_data)
            
            if name_match and category_match:
                cards[card_id] = {
                    'id': card_id,
                    'name': name_match.group(1),
                    'category': category_match.group(1)
                }
    
    return cards


def get_filename(card_id: str) -> str:
    """Convert card ID to filename."""
    return f"{card_id.replace('-', '_')}.png"


def is_rgba(png_bytes: bytes) -> bool:
    """Check if PNG bytes are RGBA format (has transparency)."""
    try:
        im = Image.open(io.BytesIO(png_bytes))
        return im.mode == "RGBA"
    except Exception:
        return False


def generate_image(client: OpenAI, prompt: str, card_id: str, output_path: Path) -> bool:
    """Generate a single image using gpt-image-1 with transparent background."""
    try:
        print(f"Generating: {card_id}...")
        response = client.images.generate(
            model="gpt-image-1.5",
            prompt=prompt,
            size="1024x1024",
            background="transparent",
            output_format="png",
            n=1
        )
        
        # Get image data (may be URL or base64)
        if hasattr(response.data[0], 'url') and response.data[0].url:
            # Download from URL
            img_response = requests.get(response.data[0].url)
            img_response.raise_for_status()
            png_bytes = img_response.content
        elif hasattr(response.data[0], 'b64_json'):
            # Decode base64
            png_bytes = base64.b64decode(response.data[0].b64_json)
        else:
            raise ValueError("No image data found in response")
        
        # Validate RGBA
        if not is_rgba(png_bytes):
            print(f"  [WARN] Image is not RGBA, regenerating...")
            # Try one more time
            response = client.images.generate(
                model="gpt-image-1.5",
                prompt=prompt,
                size="1024x1024",
                background="transparent",
                output_format="png",
                n=1
            )
            if hasattr(response.data[0], 'url') and response.data[0].url:
                img_response = requests.get(response.data[0].url)
                img_response.raise_for_status()
                png_bytes = img_response.content
            elif hasattr(response.data[0], 'b64_json'):
                png_bytes = base64.b64decode(response.data[0].b64_json)
            
            if not is_rgba(png_bytes):
                print(f"  [ERROR] Image still not RGBA after retry, skipping")
                return False
        
        # Save to file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(png_bytes)
        
        print(f"  [OK] Saved RGBA PNG to {output_path}")
        return True
        
    except Exception as e:
        print(f"  [ERROR] Error generating {card_id}: {e}")
        return False


def main():
    """Main execution function."""
    print("=" * 60)
    print("Card Art Generation Script")
    print("=" * 60)
    print(f"Model: gpt-image-1.5")
    print(f"Background: transparent")
    print(f"Output directory: {OUTPUT_DIR}")
    print()
    
    # Initialize OpenAI client
    client = OpenAI(api_key=API_KEY)
    
    # Parse card catalog
    print("Parsing card catalog...")
    try:
        cards = parse_card_catalog(".cursor/cardlistnew.md")
        print(f"Found {len(cards)} cards")
    except Exception as e:
        print(f"Error parsing catalog: {e}")
        return
    
    # Organize cards by category
    cards_by_category = {}
    for card_id, card_data in cards.items():
        category = card_data['category']
        folder_category = CATEGORY_NAMES.get(category, category)
        if folder_category not in cards_by_category:
            cards_by_category[folder_category] = []
        cards_by_category[folder_category].append((card_id, card_data))
    
    print(f"\nCards organized into {len(cards_by_category)} categories:")
    for category, card_list in cards_by_category.items():
        print(f"  {category}: {len(card_list)} cards")
    print()
    
    # Generate images
    total_cards = len(cards)
    generated = 0
    failed = 0
    skipped = 0
    
    print("Starting image generation...")
    print("-" * 60)
    
    for category, card_list in sorted(cards_by_category.items()):
        category_dir = OUTPUT_DIR / category
        print(f"\n[{category.upper()}] Generating {len(card_list)} cards...")
        
        for card_id, card_data in card_list:
            # Check if prompt exists
            if card_id not in CARD_PROMPTS:
                print(f"  [WARN] No prompt found for {card_id}, skipping")
                skipped += 1
                continue
            
            # Check if already generated (force regenerate with new prompts)
            filename = get_filename(card_id)
            output_path = category_dir / filename
            
            # Remove old file if it exists to force regeneration
            if output_path.exists():
                output_path.unlink()
                print(f"  [REGEN] Removing old image: {card_id}")
            
            # Generate image
            prompt = CARD_PROMPTS[card_id]
            success = generate_image(client, prompt, card_id, output_path)
            
            if success:
                generated += 1
            else:
                failed += 1
            
            # Rate limiting
            if generated + failed < total_cards:
                time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # Summary
    print()
    print("=" * 60)
    print("Generation Complete!")
    print("=" * 60)
    print(f"Total cards: {total_cards}")
    print(f"Generated: {generated}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    print(f"\nImages saved to: {OUTPUT_DIR.absolute()}")
    
    # Create manifest
    manifest = {}
    for category, card_list in cards_by_category.items():
        for card_id, card_data in card_list:
            filename = get_filename(card_id)
            manifest[card_id] = f"{category}/{filename}"
    
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"Manifest saved to: {manifest_path}")


if __name__ == "__main__":
    main()

