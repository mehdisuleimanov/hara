import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, C_HC, F, R, T, shadow, type TypeVariant } from '@/theme';
import { useTheme } from '@/hooks/useTheme';
import { PressableScale } from '@/motion/PressableScale';
import { SPRING } from '@/motion/springs';

/** In high-contrast mode, soft text colors are remapped to their strong versions. */
const HC_MAP: Record<string, string> = {
  [C.ink]: C_HC.ink,
  [C.ink2]: C_HC.ink2,
  [C.muted]: C_HC.muted,
  [C.faint]: C_HC.faint,
  [C.brand]: C_HC.brand,
  [C.route]: C_HC.route,
  [C.safe]: C_HC.safe,
  [C.warn]: C_HC.warn,
  [C.danger]: C_HC.danger,
};

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Decorative by default (hidden from screen readers); give a label when it carries meaning. */
export function Icon({
  name,
  size = 22,
  color = C.ink,
  style,
  label,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  label?: string;
}) {
  const t = useTheme();
  const col = t.hc ? HC_MAP[color] ?? color : color;
  return (
    <MaterialCommunityIcons
      name={name as IconName}
      size={Math.round(size * Math.min(t.s, 1.3))}
      color={col}
      style={style}
      {...(label ? { accessibilityLabel: label } : { 'aria-hidden': true })}
    />
  );
}

type TxtProps = TextProps & {
  /** type-scale variant (theme T); explicit w/size/lh/ls override it */
  v?: TypeVariant;
  w?: keyof typeof F;
  size?: number;
  color?: string;
  lh?: number;
  ls?: number;
  center?: boolean;
  /** uppercase (overline) */
  caps?: boolean;
};

/**
 * All app text. Scales with the accessibility mode (senior / low-vision) and remaps
 * colors in high contrast — so one tap restyles every screen.
 */
/** Azerbaijani/Turkish-aware uppercase (i → İ, ı → I). */
export function upperAz(s: string) {
  return s.replace(/i/g, 'İ').toUpperCase();
}

function capsChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return upperAz(children);
  if (Array.isArray(children)) return children.map((c) => (typeof c === 'string' ? upperAz(c) : c));
  return children;
}

export function Txt({ v, w, size, color = C.ink, lh, ls, center, caps, style, children, ...rest }: TxtProps) {
  const t = useTheme();
  const base = v ? T[v] : undefined;
  const fam = w ?? (base?.f as keyof typeof F | undefined) ?? 'med';
  const sz0 = size ?? base?.size ?? 15;
  const sz = t.font(sz0);
  const lh0 = lh ?? (size == null ? base?.lh : undefined);
  const lineHeight = lh0 != null ? lh0 * (sz / sz0) : undefined;
  const letterSpacing = ls ?? (size == null && base ? base.ls : sz0 >= 26 ? -1 : sz0 >= 18 ? -0.4 : 0);
  const col = t.hc ? HC_MAP[color] ?? (color.startsWith('rgba(255,255,255') ? '#FFFFFF' : color) : color;
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        {
          fontFamily: F[fam],
          fontSize: sz,
          color: col,
          lineHeight,
          letterSpacing,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    >
      {caps || v === 'overline' ? capsChildren(children) : children}
    </Text>
  );
}

/** Reference headings are heavy and tight ("Explore New Bus Trips"). */
export function Heading({
  light,
  bold,
  size = 34,
  color = C.ink,
  center,
  newline,
  style,
}: {
  light?: string;
  bold: string;
  size?: number;
  color?: string;
  center?: boolean;
  newline?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Txt w="black" size={size} lh={size * 1.08} color={color} center={center} style={style} accessibilityRole="header">
      {light ? `${light}${newline ? '\n' : ' '}` : ''}
      {bold}
    </Txt>
  );
}

export function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

const ICON_LABEL: Record<string, string> = {
  menu: 'Menyu',
  'chevron-left': 'Geri',
  close: 'Bağla',
  magnify: 'Axtar',
  'bell-outline': 'Bildirişlər',
  plus: 'Yaxınlaşdır',
  minus: 'Uzaqlaşdır',
  'crosshairs-gps': 'Mənim yerim',
  'share-variant-outline': 'Paylaş',
  'volume-high': 'Səsli oxu',
  'arrow-top-right': 'Aç',
  'keyboard-outline': 'Yazı ilə',
  'microphone-outline': 'Səslə',
  check: 'Göndər',
  'cog-outline': 'Ayarlar',
};

export function CircleButton({
  icon,
  onPress,
  onLongPress,
  size = 52,
  bg = C.surface,
  color = C.ink,
  iconSize,
  style,
  children,
  label,
}: {
  icon?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: number;
  bg?: string;
  color?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  label?: string;
}) {
  const t = useTheme();
  const sz = Math.round(size * Math.min(t.s, 1.2));
  const slop = sz < t.hit ? Math.ceil((t.hit - sz) / 2) : 0; // minimum target grows with a11y mode
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label ?? (icon ? ICON_LABEL[icon] : undefined)}
      hitSlop={slop}
      scaleTo={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={1200}
      style={[
        {
          width: sz,
          height: sz,
          borderRadius: sz / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        t.hc && bg !== 'transparent' ? { borderWidth: 2, borderColor: C_HC.line } : null,
        style,
      ]}
    >
      {children ?? (icon ? <Icon name={icon} size={iconSize ?? size * 0.42} color={color} /> : null)}
    </PressableScale>
  );
}

type Variant = 'brand' | 'black' | 'purple' | 'mint' | 'white' | 'outline' | 'danger';
const VARIANT: Record<Variant, { bg: string; fg: string; icon: string }> = {
  brand: { bg: C.brand, fg: C.onBrand, icon: C.onBrand }, // reference "Seats"
  mint: { bg: C.brand, fg: C.onBrand, icon: C.onBrand }, // legacy alias
  black: { bg: C.black, fg: '#FFFFFF', icon: C.brand },
  purple: { bg: C.purple, fg: C.ink, icon: C.ink }, // reference "Pay"
  white: { bg: C.surface, fg: C.ink, icon: C.ink },
  outline: { bg: 'transparent', fg: C.ink, icon: C.ink },
  danger: { bg: C.danger, fg: '#FFFFFF', icon: '#FFFFFF' },
};

export function PillButton({
  label,
  onPress,
  icon,
  variant = 'brand',
  style,
  height = 58,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  icon?: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  height?: number;
  disabled?: boolean;
}) {
  const v = VARIANT[variant];
  const t = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      haptic="medium"
      scaleTo={0.97}
      onPress={onPress}
      style={[
        {
          height: Math.round(height * Math.min(t.s, 1.25)),
          borderRadius: R.pill,
          backgroundColor: v.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingHorizontal: 22,
          borderWidth: variant === 'outline' || t.hc ? (t.hc ? 2 : 1.5) : 0,
          borderColor: t.hc ? C_HC.line : C.line,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={22} color={v.icon} /> : null}
      <Txt w="bold" size={16.5} color={v.fg}>
        {label}
      </Txt>
    </PressableScale>
  );
}

/**
 * Reference ticket bottom bar: black capsule with
 * [ gray circle icon ] [ caption / value ] [ purple pill "label" + white circle icon ].
 */
export function ActionBar({
  leftIcon = 'shield-check-outline',
  caption,
  value,
  label,
  icon = 'navigation-variant',
  onPress,
  onLeftPress,
  style,
}: {
  leftIcon?: string;
  caption: string;
  value: string;
  label: string;
  icon?: string;
  onPress: () => void;
  onLeftPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.actionBar, style]}>
      <CircleButton icon={leftIcon} size={56} bg={C.bg2} onPress={onLeftPress} label={caption} />
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <Txt w="med" size={12.5} color={C.muted}>
          {caption}
        </Txt>
        <Txt w="bold" size={15} color={C.ink} numberOfLines={1}>
          {value}
        </Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          tap(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        style={({ pressed }) => [styles.actionMain, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Txt w="bold" size={16} color={C.ink} style={{ paddingLeft: 20 }}>
          {label}
        </Txt>
        <View style={styles.actionDisc}>
          <Icon name={icon} size={22} color={C.onBrand} />
        </View>
      </Pressable>
    </View>
  );
}

/** Reference "orange slider" row: [orange pill with white disc] › › › [white disc] */
export function SlideRow({
  icon,
  onPress,
  endIcon,
  children,
}: {
  icon: string;
  onPress: () => void;
  endIcon: string;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [styles.slide, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.slideKnobWrap}>
        <View style={styles.slideKnob}>
          <Icon name={icon} size={24} />
        </View>
      </View>
      <Chevrons color={C.ink} />
      <View style={styles.slideEnd}>
        <Icon name={endIcon} size={22} />
      </View>
      {children}
    </Pressable>
  );
}

export function Chevrons({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name="chevron-right" size={18} color={color} style={{ opacity: 0.35 }} />
      <Icon name="chevron-right" size={18} color={color} style={{ marginLeft: -10, opacity: 0.65 }} />
      <Icon name="chevron-right" size={18} color={color} style={{ marginLeft: -10 }} />
    </View>
  );
}

export function Chip({
  label,
  icon,
  active,
  onPress,
  dark,
}: {
  label?: string;
  icon?: string;
  active?: boolean;
  onPress?: () => void;
  dark?: boolean;
}) {
  if (active || !icon) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ selected: !!active }}
        onPress={onPress}
        style={[styles.chipActive, dark && { backgroundColor: C.black }, !icon && { paddingLeft: 18 }]}
      >
        {icon ? (
          <View style={styles.chipIcon}>
            <Icon name={icon} size={22} color={C.onBrand} />
          </View>
        ) : null}
        {label ? (
          <Txt w="semi" size={14} color={dark ? '#fff' : C.ink}>
            {label}
          </Txt>
        ) : null}
      </PressableScale>
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: false }}
      scaleTo={0.9}
      onPress={onPress}
      style={styles.chipCircle}
    >
      <Icon name={icon} size={24} color={C.ink} />
    </PressableScale>
  );
}

export function Tag({
  label,
  bg = C.surface,
  color = C.ink,
  icon,
  style,
}: {
  label: string;
  bg?: string;
  color?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Txt w="semi" size={12.5} color={color}>
        {label}
      </Txt>
    </View>
  );
}

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, t.hc && styles.hcBorder, style]}>{children}</View>;
}

/** Plain surface block (cards, sheets); gains a strong border in high contrast. */
export function Surface({
  style,
  children,
  elevated,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  elevated?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: C.surface, borderRadius: R.lg, padding: 16 }, elevated && shadow(2), t.hc && styles.hcBorder, style]}>
      {children}
    </View>
  );
}

/** Segmented control with a sliding pill indicator. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  dark,
  style,
}: {
  options: { key: K; label: string; icon?: string }[];
  value: K;
  onChange: (k: K) => void;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useSharedValue(0);
  const seg = w > 0 ? (w - 8) / options.length : 0;
  useEffect(() => {
    x.value = withSpring(idx * seg, SPRING.snappy);
  }, [idx, seg, x]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', backgroundColor: dark ? C.navy2 : C.bg2, borderRadius: R.pill, padding: 4, height: 48 }, style]}
    >
      {seg > 0 ? (
        <Animated.View
          style={[
            { position: 'absolute', left: 4, top: 4, bottom: 4, width: seg, borderRadius: R.pill, backgroundColor: dark ? '#FFFFFF' : C.navy },
            ind,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.key === value;
        const fg = on ? (dark ? C.navy : '#FFFFFF') : dark ? '#FFFFFF' : C.ink;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.key);
            }}
            style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}
          >
            {o.icon ? <Icon name={o.icon} size={18} color={fg} /> : null}
            <Txt w="semi" size={14} color={fg}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipActive: {
    height: 56,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 6,
    paddingRight: 20,
  },
  chipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: R.pill,
    alignSelf: 'flex-start',
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 20,
    ...shadow(1),
  },
  hcBorder: { borderWidth: 2, borderColor: C_HC.line },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.black,
    borderRadius: R.pill,
    padding: 6,
  },
  actionMain: {
    height: 56,
    borderRadius: R.pill,
    backgroundColor: C.purple,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 5,
  },
  actionDisc: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  slide: {
    height: 64,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  slideKnobWrap: { height: 64, width: 108, borderRadius: R.pill, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
  slideKnob: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  slideEnd: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
});
