import { Router, Request, Response } from 'express';
import { HazardCategory, HazardSeverity } from './hazards';

export interface ClassifyRequest {
  text?: string;
  audioBase64?: string;
  imageBase64?: string;
}

export interface ClassifyResponse {
  category: HazardCategory;
  severity: HazardSeverity;
  landmark_context?: string;
  waterlogging_depth?: 'Ankle-deep' | 'Knee-deep' | 'Impassable';
  confidence: number;
  fallback: boolean;
  reasoning?: string;
}

const router = Router();

const DHAKA_LANDMARKS = [
  'Dhanmondi',
  'Mirpur',
  'Farmgate',
  'Mohakhali',
  'Badda',
  'Shahbagh',
  'Motijheel',
  'Uttara',
  'Mohammadpur',
  'Banani',
  'Jatrabari',
  'Bijoy Sarani',
  'Gulshan',
  'Khilkhet',
  'Malibagh',
  'Rampura',
  'Moghbazar',
  'Tejgaon',
  'Paltan',
  'Azimpur',
  'Lalbagh',
  'Shyamoli',
  'Kalyanpur',
  'Gabtoli',
  'Bashundhara',
  'Banasree',
  'Elephant Road',
  'New Market',
];

/**
 * Fast Bangla, Banglish, and English rule-based heuristic classifier.
 * Invoked as an immediate offline/timeout fallback per SRS NFR-19.
 */
function heuristicClassify(text = ''): ClassifyResponse {
  const lower = text.toLowerCase();

  let category: HazardCategory = 'pothole_manhole';
  let severity: HazardSeverity = 'Medium';
  let waterlogging_depth: 'Ankle-deep' | 'Knee-deep' | 'Impassable' | undefined;
  let confidence = 0.85;

  // 1. Waterlogging
  if (
    /pani|water|jola|jal|flood|waterlog|doba|brishti|drain overflow|khal|talap|noyordoma|kadamer|bheshe|waterlogging/.test(
      lower
    )
  ) {
    category = 'waterlogging';
    confidence = 0.92;

    if (/komor|waist|impassable|thoi thoi|bheshe|boat|duibe/.test(lower)) {
      waterlogging_depth = 'Impassable';
      severity = 'Critical';
    } else if (/hathu|knee|dubi|gari|moddho/.test(lower)) {
      waterlogging_depth = 'Knee-deep';
      severity = 'Critical';
    } else if (/takhnu|ankle|tola|pata|choto/.test(lower)) {
      waterlogging_depth = 'Ankle-deep';
      severity = 'Low';
    } else {
      waterlogging_depth = 'Knee-deep';
      severity = 'Medium';
    }
  }
  // 2. Extortion Choke-point
  else if (
    /chanda|extortion|toll|mastaan|threat|danger|chada|chokepoint|hijack|chintai|snatch|gunda|chandabaji|dakat/.test(
      lower
    )
  ) {
    category = 'extortion_spot';
    severity = 'Critical';
    confidence = 0.9;
  }
  // 3. Unsafe Footbridge
  else if (
    /footbridge|overbridge|bridge|shanko|stairs|railing|railings|step|shiri|pul/.test(
      lower
    )
  ) {
    category = 'unsafe_footbridge';
    confidence = 0.88;
    if (/bhanga|broken|danger|hazard|lored|morichika|slub nai/.test(lower)) {
      severity = 'Critical';
    } else if (/slippery|pichil|wet/.test(lower)) {
      severity = 'Low';
    } else {
      severity = 'Medium';
    }
  }
  // 4. Unlit / Dark Alley
  else if (
    /ondhokar|dark|unlit|batti nai|light nai|alley|goli|bati noshto|cherag|street light|andhar|alo nai/.test(
      lower
    )
  ) {
    category = 'unlit_alley';
    confidence = 0.89;
    severity = /chintai|danger|bipod|ekebare/.test(lower) ? 'Critical' : 'Medium';
  }
  // 5. Pothole / Open Manhole
  else {
    category = 'pothole_manhole';
    confidence = 0.85;
    if (
      /open|dhakna nai|bipojjonok|manhole|danger|accident|mora|fatal/.test(lower)
    ) {
      severity = 'Critical';
    } else {
      severity = 'Medium';
    }
  }

  // Extract landmark if present
  let landmark_context: string | undefined;
  for (const landmark of DHAKA_LANDMARKS) {
    if (lower.includes(landmark.toLowerCase())) {
      landmark_context = landmark;
      break;
    }
  }

  return {
    category,
    severity,
    landmark_context,
    waterlogging_depth,
    confidence,
    fallback: true,
    reasoning: 'Classified using local Bangla/Banglish/English keyword heuristics',
  };
}

/**
 * POST /api/ai/classify
 * Accepts { text?: string, audioBase64?: string, imageBase64?: string }
 * Calls Gemini 2.5 Flash with strict 4.5s timeout; falls back to heuristic classifier on error/timeout.
 */
router.post('/classify', async (req: Request, res: Response) => {
  const { text, audioBase64, imageBase64 } = req.body as ClassifyRequest;

  const combinedText = (text || '').trim();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const heuristic = heuristicClassify(combinedText);
    return res.status(200).json(heuristic);
  }

  // Strict 4.5s AbortController timeout per SRS NFR-19
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const parts: any[] = [];

    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    }

    if (audioBase64) {
      parts.push({
        inline_data: {
          mime_type: 'audio/mp3',
          data: audioBase64.replace(/^data:audio\/\w+;base64,/, ''),
        },
      });
    }

    const systemPrompt =
      'You are an AI hazard classifier for GoliSafe civic safety in Dhaka, Bangladesh.\n' +
      'Classify the citizen report (in Bangla, Banglish, or English) into JSON.\n' +
      'Allowed category values: "pothole_manhole", "waterlogging", "unlit_alley", "unsafe_footbridge", "extortion_spot".\n' +
      'Allowed severity values: "Low", "Medium", "Critical".\n' +
      'If category is "waterlogging", set waterlogging_depth to "Ankle-deep", "Knee-deep", or "Impassable".\n' +
      'Extract landmark_context if a Dhaka neighborhood or street is mentioned.\n' +
      'Return ONLY a raw valid JSON object with keys: category, severity, landmark_context, waterlogging_depth, confidence, reasoning.';

    parts.push({
      text: `${systemPrompt}\nUser Report: "${combinedText || 'Analyze the provided media'}"`,
    });

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API HTTP ${response.status}`);
    }

    const jsonResult: any = await response.json();
    const rawText =
      jsonResult?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Parse extracted JSON
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch {
      parsed = {};
    }

    const VALID_CATEGORIES: HazardCategory[] = [
      'pothole_manhole',
      'waterlogging',
      'unlit_alley',
      'unsafe_footbridge',
      'extortion_spot',
    ];

    const VALID_SEVERITIES: HazardSeverity[] = ['Low', 'Medium', 'Critical'];

    const category: HazardCategory = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : heuristicClassify(combinedText).category;

    const severity: HazardSeverity = VALID_SEVERITIES.includes(parsed.severity)
      ? parsed.severity
      : 'Medium';

    const confidence =
      typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
        ? Number(parsed.confidence.toFixed(2))
        : 0.95;

    const result: ClassifyResponse = {
      category,
      severity,
      landmark_context: parsed.landmark_context || undefined,
      waterlogging_depth:
        category === 'waterlogging' &&
        ['Ankle-deep', 'Knee-deep', 'Impassable'].includes(parsed.waterlogging_depth)
          ? parsed.waterlogging_depth
          : undefined,
      confidence,
      fallback: false,
      reasoning: parsed.reasoning || 'Classified by Gemini 2.5 Flash',
    };

    return res.status(200).json(result);
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Graceful fallback on timeout (>4.5s) or API error
    const fallbackResult = heuristicClassify(combinedText);
    return res.status(200).json(fallbackResult);
  }
});

export default router;
