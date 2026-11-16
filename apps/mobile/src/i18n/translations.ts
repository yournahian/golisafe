export type Language = 'en' | 'bn';

export interface CategoryTranslations {
  'ChandaAlert': string;
  'Dark-Zone Safety': string;
  WaterLogging: string;
  'Road Hazard': string;
}

export interface TabTranslations {
  map: string;
  alerts: string;
  report: string;
}

export interface ActionTranslations {
  findRoute: string;
  reportHere: string;
  clearRoute: string;
  confirmHazard: string;
  markCleared: string;
  crowdVerified: string;
  pendingVerification: string;
  highRisk: string;
  mediumRisk: string;
  lowRisk: string;
  safeDetourActive: string;
  away: string;
}

export interface TranslationDictionary {
  searchPlaceholder: string;
  cityBadge: string;
  categories: CategoryTranslations;
  tabs: TabTranslations;
  actions: ActionTranslations;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    searchPlaceholder: 'Search places or hazards',
    cityBadge: 'Dhaka',
    categories: {
      'ChandaAlert': 'ChandaAlert',
      'Dark-Zone Safety': 'Dark-Zone Safety',
      WaterLogging: 'WaterLogging',
      'Road Hazard': 'Road Hazard',
    },
    tabs: {
      map: 'Map',
      alerts: 'Alerts',
      report: 'Report',
    },
    actions: {
      findRoute: 'Find Route',
      reportHere: '+ Report Here',
      clearRoute: 'Clear Route',
      confirmHazard: 'Confirm',
      markCleared: 'Cleared',
      crowdVerified: 'Crowd-Verified',
      pendingVerification: 'Pending',
      highRisk: 'High risk',
      mediumRisk: 'Medium risk',
      lowRisk: 'Low risk',
      safeDetourActive: 'Safe Detour Active',
      away: 'away',
    },
  },
  bn: {
    searchPlaceholder: 'স্থান বা ঝুঁকি খুঁজুন',
    cityBadge: 'ঢাকা',
    categories: {
      'ChandaAlert': 'চাঁদা অ্যালার্ট',
      'Dark-Zone Safety': 'অন্ধকার গলি',
      WaterLogging: 'জলাবদ্ধতা',
      'Road Hazard': 'রাস্তার ঝুঁকি',
    },
    tabs: {
      map: 'ম্যাপ',
      alerts: 'অ্যালার্ট',
      report: 'রিপোর্ট',
    },
    actions: {
      findRoute: 'নিরাপদ পথ',
      reportHere: '+ এখানে রিপোর্ট',
      clearRoute: 'পথ মুছুন',
      confirmHazard: 'নিশ্চিত করুন',
      markCleared: 'সমাধান হয়েছে',
      crowdVerified: 'জনতা যাচাইকৃত',
      pendingVerification: 'যাচাই অপেক্ষমাণ',
      highRisk: 'উচ্চ ঝুঁকি',
      mediumRisk: 'মাঝারি ঝুঁকি',
      lowRisk: 'কম ঝুঁকি',
      safeDetourActive: 'নিরাপদ পথ সক্রিয়',
      away: 'দূরে',
    },
  },
};

export default TRANSLATIONS;
