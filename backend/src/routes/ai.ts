import { Router, Request, Response } from 'express';
import { HazardCategory, HazardSeverity } from './hazards';

export interface ClassifyRequest {
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  imageBase64?: string;
  currentCategory?: HazardCategory;
}

export interface ClassifyResponse {
  category: HazardCategory;
  severity: HazardSeverity;
  transcript?: string;
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
function heuristicClassify(
  text = '',
  currentCategory?: HazardCategory
): ClassifyResponse {
  const lower = text.toLowerCase();

  let category: HazardCategory = currentCategory || 'pothole_manhole';
  let severity: HazardSeverity = 'Medium';
  let waterlogging_depth: 'Ankle-deep' | 'Knee-deep' | 'Impassable' | undefined;
  let confidence = 0.85;
  let matchedKeyword = false;

  // 1. Waterlogging
  if (
    /pani|water|jola|jal|flood|waterlog|doba|brishti|drain overflow|khal|talap|noyordoma|kadamer|bheshe|waterlogging|পানি|জলাবদ্ধতা|বৃষ্টি/.test(
      lower
    )
  ) {
    category = 'waterlogging';
    confidence = 0.92;
    matchedKeyword = true;

    if (/komor|waist|impassable|thoi thoi|bheshe|boat|duibe|কোমর/.test(lower)) {
      waterlogging_depth = 'Impassable';
      severity = 'Critical';
    } else if (/hathu|knee|dubi|gari|moddho|হাঁটু/.test(lower)) {
      waterlogging_depth = 'Knee-deep';
      severity = 'Critical';
    } else if (/takhnu|ankle|tola|pata|choto|গোড়ালি/.test(lower)) {
      waterlogging_depth = 'Ankle-deep';
      severity = 'Low';
    } else {
      waterlogging_depth = 'Knee-deep';
      severity = 'Medium';
    }
  }
  // 2. Extortion Choke-point
  else if (
    /chanda|extortion|toll|mastaan|threat|danger|chada|chokepoint|hijack|chintai|snatch|gunda|chandabaji|dakat|চাঁদা|মাস্তান|ছিনতাই/.test(
      lower
    )
  ) {
    category = 'extortion_spot';
    severity = 'Critical';
    confidence = 0.9;
    matchedKeyword = true;
  }
  // 3. Unsafe Footbridge
  else if (
    /footbridge|overbridge|bridge|shanko|stairs|railing|railings|step|shiri|pul|ফুটব্রিজ|ওভারব্রিজ|ব্রিজ/.test(
      lower
    )
  ) {
    category = 'unsafe_footbridge';
    confidence = 0.88;
    matchedKeyword = true;
    if (/bhanga|broken|danger|hazard|lored|morichika|slub nai|ভাঙা/.test(lower)) {
      severity = 'Critical';
    } else if (/slippery|pichil|wet|পিচ্ছিল/.test(lower)) {
      severity = 'Low';
    } else {
      severity = 'Medium';
    }
  }
  // 4. Unlit / Dark Alley
  else if (
    /ondhokar|dark|unlit|batti nai|light nai|alley|goli|bati noshto|cherag|street light|andhar|alo nai|অন্ধকার|বাতি|গলি|আলো/.test(
      lower
    )
  ) {
    category = 'unlit_alley';
    confidence = 0.89;
    matchedKeyword = true;
    severity = /chintai|danger|bipod|ekebare|ছিনতাই|বিপদ/.test(lower) ? 'Critical' : 'Medium';
  }
  // 5. Explicit Pothole / Open Manhole keywords
  else if (
    /pothole|manhole|gorto|khana|khanda|dhakna|hole|broken road|গর্ত|ম্যানহোল|ভাঙা রাস্তা/.test(
      lower
    )
  ) {
    category = 'pothole_manhole';
    confidence = 0.86;
    matchedKeyword = true;
    if (
      /open|dhakna nai|bipojjonok|manhole|danger|accident|mora|fatal|খোলা/.test(lower)
    ) {
      severity = 'Critical';
    } else {
      severity = 'Medium';
    }
  } else if (!currentCategory) {
    category = 'pothole_manhole';
    confidence = 0.5;
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
    transcript: text.trim() || undefined,
    landmark_context,
    waterlogging_depth,
    confidence: matchedKeyword ? confidence : 0.5,
    fallback: true,
    reasoning: matchedKeyword
      ? 'Classified using Bangla/Banglish/English keyword heuristics'
      : 'No Gemini API key configured — preserved selected category',
  };
}

/**
 * POST /api/ai/classify
 * Accepts { text?: string, audioBase64?: string, audioMimeType?: string, imageBase64?: string, currentCategory?: HazardCategory }
 * Calls Gemini 2.5 Flash; falls back to heuristic classifier on error/timeout.
 */
router.post('/classify', async (req: Request, res: Response) => {
  const { text, audioBase64, audioMimeType, imageBase64, currentCategory } =
    req.body as ClassifyRequest;

  const combinedText = (text || '').trim();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const heuristic = heuristicClassify(combinedText, currentCategory);
    return res.status(200).json(heuristic);
  }

  const hasMedia = Boolean(audioBase64 || imageBase64);
  const timeoutMs = hasMedia ? 9000 : 4500;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const parts: any[] = [];

    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageBase64.replace(/^data:image\/[^;]+;base64,/, ''),
        },
      });
    }

    if (audioBase64) {
      const resolvedMime =
        audioMimeType && audioMimeType.startsWith('audio/')
          ? audioMimeType
          : 'audio/mp4';
      parts.push({
        inline_data: {
          mime_type: resolvedMime,
          data: audioBase64.replace(/^data:audio\/[^;]+;base64,/, ''),
        },
      });
    }

    const systemPrompt =
      'You are an AI hazard classifier for GoliSafe civic safety in Dhaka, Bangladesh.\n' +
      'Listen to the audio and/or inspect the image and text (in Bangla, Banglish, or English) and classify into JSON.\n' +
      'Allowed category values: "pothole_manhole", "waterlogging", "unlit_alley", "unsafe_footbridge", "extortion_spot".\n' +
      'Allowed severity values: "Low", "Medium", "Critical".\n' +
      'If audio is provided, transcribe what the citizen actually said in the "transcript" field.\n' +
      'If category is "waterlogging", set waterlogging_depth to "Ankle-deep", "Knee-deep", or "Impassable".\n' +
      'Extract landmark_context if a Dhaka neighborhood or street is mentioned.\n' +
      'Return ONLY a raw valid JSON object with keys: category, severity, transcript, landmark_context, waterlogging_depth, confidence, reasoning.';

    parts.push({
      text: `${systemPrompt}\nUser Context: "${combinedText || 'Analyze the provided audio/image accurately'}"`,
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
      : heuristicClassify(combinedText, currentCategory).category;

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
      transcript:
        typeof parsed.transcript === 'string' && parsed.transcript.trim()
          ? parsed.transcript.trim()
          : combinedText || undefined,
      landmark_context: parsed.landmark_context || undefined,
      waterlogging_depth:
        category === 'waterlogging' &&
        ['Ankle-deep', 'Knee-deep', 'Impassable'].includes(parsed.waterlogging_depth)
          ? parsed.waterlogging_depth
          : undefined,
      confidence,
      fallback: false,
      reasoning: parsed.reasoning || `Classified by ${geminiModel}`,
    };

    return res.status(200).json(result);
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Graceful fallback on timeout or API error
    const fallbackResult = heuristicClassify(combinedText, currentCategory);
    return res.status(200).json(fallbackResult);
  }
});

export default router;
