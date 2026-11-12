import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, F, R, shadow } from '@/theme';

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
  return (
    <MaterialCommunityIcons
      name={name as IconName}
      size={size}
      color={color}
      style={style}
      {...(label ? { accessibilityLabel: label } : { 'aria-hidden': true })}
    />
  );
}

type TxtProps = TextProps & {
  w?: keyof typeof F;
  size?: number;
  color?: string;
  lh?: number;
  ls?: number;
  center?: boolean;
};

export function Txt({ w = 'med', size = 15, color = C.ink, lh, ls, center, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: F[w],
          fontSize: size,
          color,
          lineHeight: lh,
          letterSpacing: ls ?? (size >= 26 ? -1 : size >= 18 ? -0.4 : 0),
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    />
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
  const slop = size < 48 ? Math.ceil((48 - size) / 2) : 0; // 48dp minimum target
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? (icon ? ICON_LABEL[icon] : undefined)}
      hitSlop={slop}
      onPress={() => {
        tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      delayLongPress={600}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {children ?? (icon ? <Icon name={icon} size={iconSize ?? size * 0.42} color={color} /> : null)}
    </Pressable>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height,
          borderRadius: R.pill,
          backgroundColor: v.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingHorizontal: 22,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: C.line,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={22} color={v.icon} /> : null}
      <Txt w="bold" size={16.5} color={v.fg}>
        {label}
      </Txt>
    </Pressable>
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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!active }}
        onPress={() => {
          tap();
          onPress?.();
        }}
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
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: false }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={styles.chipCircle}
    >
      <Icon name={icon} size={24} color={C.ink} />
    </Pressable>
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
  return <View style={[styles.card, style]}>{children}</View>;
}

export function DemoBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return <Tag label="Demo data" bg="rgba(15,27,45,0.05)" color={C.muted} style={style} />;
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
