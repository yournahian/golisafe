import type {
  HazardCategory,
  HazardSeverity,
} from '../../../../packages/shared/api-contract';

export interface AiClassificationResult {
  category: HazardCategory;
  severity: HazardSeverity;
  confidence?: number;
  transcript?: string;
  sub_tag?: string;
  landmark_context?: string;
}

export interface ClassifyPayload {
  text?: string;
  audioBase64?: string;
  imageBase64?: string;
}

/**
 * Upload an image to Supabase Storage `hazard-images` bucket via REST API.
 * Uses EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * If credentials are missing or network fails, gracefully returns localUri.
 */
export async function uploadHazardImage(localUri: string): Promise<string | null> {
  if (!localUri) return null;

  // If already a remote URL, return directly
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Graceful offline/local fallback
    return localUri;
  }

  try {
    const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType =
      fileExt === 'png'
        ? 'image/png'
        : fileExt === 'webp'
        ? 'image/webp'
        : 'image/jpeg';
    const fileName = `hazard_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const formData = new FormData();
    formData.append('', {
      uri: localUri,
      name: fileName,
      type: mimeType,
    } as any);

    const uploadEndpoint = `${supabaseUrl}/storage/v1/object/hazard-images/${fileName}`;

    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (response.ok) {
      // Standard public URL structure for Supabase Storage public buckets
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/hazard-images/${fileName}`;
      return publicUrl;
    }

    // If bucket returned non-200, return localUri as fallback
    return localUri;
  } catch (error) {
    console.warn('[Storage] Image upload fallback to local URI:', error);
    return localUri;
  }
}

/**
 * Local heuristic classifier used when AI endpoint times out or is offline.
 */
function localRuleBasedClassification(payload: ClassifyPayload): AiClassificationResult {
  const text = (payload.text || '').toLowerCase();

  if (
    text.includes('chanda') ||
    text.includes('চাঁদা') ||
    text.includes('extortion') ||
    text.includes('মাস্তান') ||
    text.includes('দাবি')
  ) {
    return {
      category: 'extortion_spot',
      severity: 'Critical',
      confidence: 0.94,
      transcript: payload.text || 'চাঁদাবাজি স্পট চিহ্নিত',
    };
  }

  if (
    text.includes('dark') ||
    text.includes('অন্ধকার') ||
    text.includes('light') ||
    text.includes('বাতি') ||
    text.includes('unlit') ||
    text.includes('alley') ||
    text.includes('গলি')
  ) {
    return {
      category: 'unlit_alley',
      severity: 'Medium',
      confidence: 0.88,
      transcript: payload.text || 'অন্ধকার গলির পথ',
    };
  }

  if (
    text.includes('water') ||
    text.includes('পানি') ||
    text.includes('flood') ||
    text.includes('জলাবদ্ধতা') ||
    text.includes('বৃষ্টি') ||
    text.includes('drain')
  ) {
    return {
      category: 'waterlogging',
      severity: 'Medium',
      confidence: 0.91,
      transcript: payload.text || 'রাস্তায় জলাবদ্ধতা ও পানি জমেছে',
    };
  }

  if (
    text.includes('footbridge') ||
    text.includes('ব্রিজ') ||
    text.includes('snatch') ||
    text.includes('ছিনতাই') ||
    text.includes('হকার') ||
    text.includes('crossing')
  ) {
    return {
      category: 'unsafe_footbridge',
      severity: 'Critical',
      confidence: 0.89,
      sub_tag: text.includes('হকার')
        ? 'Hawker Blocked'
        : 'Addicts/Snatchers at Night',
      transcript: payload.text || 'ঝুঁকিপূর্ণ ফুটব্রিজ চিহ্নিত',
    };
  }

  // Default pothole / open manhole
  return {
    category: 'pothole_manhole',
    severity: 'Medium',
    confidence: 0.85,
    transcript: payload.text || 'রাস্তায় ম্যানহোল / গর্ত পরিলক্ষিত',
  };
}

/**
 * Classify hazard content (audio voice transcript, image evidence, or text note)
 * via backend AI endpoint with a 5-second timeout and graceful local fallback.
 */
export async function classifyWithAI(
  payload: ClassifyPayload,
): Promise<AiClassificationResult | null> {
  const apiBase =
    process.env.EXPO_PUBLIC_API_URL || 'https://golisafe.onrender.com/api';
  const url = `${apiBase}/ai/classify`;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.category) {
        return {
          category: data.category as HazardCategory,
          severity: (data.severity as HazardSeverity) || 'Medium',
          confidence: data.confidence ?? 0.9,
          transcript: data.transcript || payload.text,
          sub_tag: data.sub_tag,
          landmark_context: data.landmark_context,
        };
      }
    }

    // Graceful fallback if backend returned non-ok
    return localRuleBasedClassification(payload);
  } catch (error: any) {
    clearTimeout(timer);
    const isTimeout = error?.name === 'AbortError';
    if (isTimeout) {
      console.warn('[Storage] classifyWithAI request timed out after 5s');
    }
    // Graceful heuristic fallback
    return localRuleBasedClassification(payload);
  }
}
