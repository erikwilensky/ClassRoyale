# Card Art Generation

This directory contains scripts and resources for generating card art images for the ClassRoyale game.

## Files

- `generate_card_art.py` - Main script to generate all card art images
- `CARD_ART_PROMPTS.md` - Complete prompt documentation and templates
- `requirements.txt` - Python dependencies
- `card_art/` - Output directory for generated images (organized by category)

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure your OpenAI API key is set in the script (or use environment variable)

## Usage

Run the generation script:
```bash
python generate_card_art.py
```

The script will:
- Parse the card catalog from `.cursor/cardlistnew.md`
- Generate images for all 55 cards using DALL-E 3
- Organize images by category in subfolders:
  - `time_tempo/` - 12 cards
  - `suggestion_control/` - 10 cards
  - `roles_coordination/` - 6 cards
  - `defense_counterplay/` - 4 cards
  - `gold_economy/` - 2 cards
  - `disruption/` - 7 cards (includes vision_clarity and disruption_light)
  - `cosmetic/` - 14 cards
- Create a `manifest.json` mapping card IDs to file paths
- Skip cards that have already been generated

## Configuration

Edit `generate_card_art.py` to change:
- `QUALITY`: `"standard"` (faster, cheaper) or `"hd"` (higher quality)
- `STYLE`: `"natural"` (recommended) or `"vivid"`
- `DELAY_BETWEEN_REQUESTS`: Seconds to wait between API calls (default: 2)
- `OUTPUT_DIR`: Where to save images (default: `card_art`)

## Output Structure

```
card_art/
├── time_tempo/
│   ├── brainwave_boost.png
│   ├── second_wind.png
│   └── ...
├── suggestion_control/
│   ├── focus_draft.png
│   └── ...
├── roles_coordination/
├── defense_counterplay/
├── gold_economy/
├── disruption/
├── cosmetic/
└── manifest.json
```

## Cost Estimate

- Standard quality: ~$0.04 per image
- HD quality: ~$0.08 per image
- 55 cards × $0.08 = ~$4.40 (HD)
- 55 cards × $0.04 = ~$2.20 (standard)

## Notes

- The script includes rate limiting (2 second delay between requests)
- Already generated images are skipped automatically
- All prompts are embedded in the script for consistency
- Images are saved as 1024x1024 PNG files
- Each image follows the style guidelines in `CARD_ART_PROMPTS.md`

