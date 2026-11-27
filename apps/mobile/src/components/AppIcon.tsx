import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
}

/**
 * Pure react-native-svg icon renderer (zero font dependency for standalone APKs).
 * Maps all Ionicons names used across GoliSafe modals & screens to crisp SVGs.
 */
export default function AppIcon({
  name,
  size = 18,
  color = '#F8FAFC',
}: AppIconProps) {
  const s = size;

  switch (name) {
    case 'add':
    case 'add-outline':
    case 'add-circle':
    case 'add-circle-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 12h14"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'remove':
    case 'remove-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'close':
    case 'close-outline':
    case 'close-circle':
    case 'close-circle-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M18 6 6 18M6 6l12 12"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'arrow-back':
    case 'arrow-back-outline':
    case 'chevron-back':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M19 12H5M12 19l-7-7 7-7"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'options':
    case 'options-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 6h16M4 12h16M4 18h16"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={9} cy={6} r={2} fill={color} />
          <Circle cx={15} cy={12} r={2} fill={color} />
          <Circle cx={9} cy={18} r={2} fill={color} />
        </Svg>
      );

    case 'refresh':
    case 'refresh-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 4v6h-6"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M19.5 15a8 8 0 1 1-1.9-8.3L21 10"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'checkmark':
    case 'checkmark-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 13l4 4L19 7"
            stroke={color}
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'checkmark-circle':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} fill={color} />
          <Path
            d="m7.5 12.5 3 3 6-6.5"
            stroke="#FFFFFF"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'checkmark-circle-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={1.9} />
          <Path
            d="m8 12.5 2.8 2.8 5.5-5.8"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'shield':
    case 'shield-outline':
    case 'shield-checkmark':
    case 'shield-checkmark-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5 4.5 5.5v5.8c0 5 3.2 9.5 7.5 10.5 4.3-1 7.5-5.5 7.5-10.5V5.5L12 2.5Z"
            stroke={color}
            strokeWidth={1.9}
            strokeLinejoin="round"
          />
          <Path
            d="m9 12 2 2 4-4"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'people':
    case 'people-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={9} cy={7.5} r={3} stroke={color} strokeWidth={1.8} />
          <Path
            d="M3 20v-1.8A4.2 4.2 0 0 1 7.2 14h3.6a4.2 4.2 0 0 1 4.2 4.2V20"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Path
            d="M16 4.5a3 3 0 0 1 0 6M21 20v-1.8a3.8 3.8 0 0 0-3-3.7"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'person':
    case 'person-outline':
    case 'person-circle':
    case 'person-circle-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={1.9} />
          <Path
            d="M5 20a7 7 0 0 1 14 0"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'compass':
    case 'compass-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={1.8} />
          <Path
            d="m16 8-2.2 6.2L8 16l2.2-6.2L16 8Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'location':
    case 'location-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5c-3.9 0-7 3.1-7 7 0 5.2 7 12 7 12s7-6.8 7-12c0-3.9-3.1-7-7-7Z"
            stroke={color}
            strokeWidth={1.9}
          />
          <Circle cx={12} cy={9.5} r={2.4} stroke={color} strokeWidth={1.9} />
        </Svg>
      );

    case 'location-sharp':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5c-3.9 0-7 3.1-7 7 0 5.2 7 12 7 12s7-6.8 7-12c0-3.9-3.1-7-7-7Z"
            fill={color}
          />
          <Circle cx={12} cy={9.5} r={2.4} fill="#FFFFFF" />
        </Svg>
      );

    case 'camera':
    case 'camera-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={13} r={3.2} stroke={color} strokeWidth={1.8} />
        </Svg>
      );

    case 'image':
    case 'image-outline':
    case 'images':
    case 'images-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect
            x={3}
            y={4}
            width={18}
            height={16}
            rx={2.5}
            stroke={color}
            strokeWidth={1.8}
          />
          <Circle cx={8.5} cy={9.5} r={1.5} fill={color} />
          <Path
            d="m21 16-5-5-6 6-2-2-5 5"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'mic':
    case 'mic-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect
            x={9}
            y={2.5}
            width={6}
            height={11}
            rx={3}
            stroke={color}
            strokeWidth={1.9}
          />
          <Path
            d="M5 10.5a7 7 0 0 0 14 0M12 17.5V21M8.5 21h7"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'stop':
    case 'stop-circle':
    case 'stop-circle-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x={6} y={6} width={12} height={12} rx={2.5} fill={color} />
        </Svg>
      );

    case 'mail':
    case 'mail-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect
            x={3}
            y={5}
            width={18}
            height={14}
            rx={2.5}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="m4 7 8 6 8-6"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'lock-closed':
    case 'lock-closed-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect
            x={5}
            y={10.5}
            width={14}
            height={10}
            rx={2.5}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M8 10.5V7.5a4 4 0 0 1 8 0v3"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'eye':
    case 'eye-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2.5 12S6.2 6 12 6s9.5 6 9.5 6-3.7 6-9.5 6-9.5-6-9.5-6Z"
            stroke={color}
            strokeWidth={1.8}
          />
          <Circle cx={12} cy={12} r={2.8} stroke={color} strokeWidth={1.8} />
        </Svg>
      );

    case 'eye-off':
    case 'eye-off-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 3l18 18M10.5 10.6a2.8 2.8 0 0 0 3.9 3.9M6.5 6.8C4.2 8.4 2.5 12 2.5 12s3.7 6 9.5 6c1.8 0 3.4-.5 4.8-1.3M14.5 6.3c4 .9 7 5.7 7 5.7a15 15 0 0 1-2.5 3.2"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'log-out':
    case 'log-out-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'sparkles':
    case 'sparkles-outline':
    case 'star':
    case 'star-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="m12 3 2.2 6.2L20.5 11l-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-1.8L12 3Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'sunny':
    case 'sunny-outline':
    case 'moon':
    case 'moon-outline':
    case 'bulb':
    case 'bulb-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.5 1 1.2 1 2.1h5c0-.9.3-1.6 1-2.1A6 6 0 0 0 12 3Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'warning':
    case 'warning-outline':
    case 'alert-circle':
    case 'alert-circle-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            stroke={color}
            strokeWidth={1.9}
            strokeLinejoin="round"
          />
          <Path
            d="M12 9v4.2M12 16.8h.01"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'document-text':
    case 'document-text-outline':
    case 'ribbon':
    case 'ribbon-outline':
    case 'trophy':
    case 'trophy-outline':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect
            x={5}
            y={3}
            width={14}
            height={18}
            rx={2.5}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M8.5 8h7M8.5 12h7M8.5 16h4.5"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );

    default:
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={2} fill={color} />
        </Svg>
      );
  }
}
