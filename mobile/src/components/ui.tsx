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

export function Icon({
  name,
  size = 22,
  color = C.ink,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color} style={style} />;
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
          letterSpacing: ls ?? (size >= 26 ? -0.8 : size >= 18 ? -0.3 : 0),
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    />
  );
}

export function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

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
}) {
  return (
    <Pressable
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
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}
    >
      {children ?? (icon ? <Icon name={icon} size={iconSize ?? size * 0.42} color={color} /> : null)}
    </Pressable>
  );
}

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
  variant?: 'brand' | 'black' | 'white' | 'outline' | 'danger';
  style?: StyleProp<ViewStyle>;
  height?: number;
  disabled?: boolean;
}) {
  const bg =
    variant === 'brand'
      ? C.brand
      : variant === 'black'
        ? C.black
        : variant === 'danger'
          ? C.danger
          : variant === 'white'
            ? C.surface
            : 'transparent';
  const fg = variant === 'white' || variant === 'outline' ? C.ink : '#fff';
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height,
          borderRadius: R.pill,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingHorizontal: 22,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: C.line,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={22} color={fg} /> : null}
      <Txt w="bold" size={17} color={fg}>
        {label}
      </Txt>
    </Pressable>
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
  // Active chip: white pill with orange icon disc + label (reference style).
  // Inactive chip: plain white circle with icon.
  if (active || !icon) {
    return (
      <Pressable
        onPress={() => {
          tap();
          onPress?.();
        }}
        style={[
          styles.chipActive,
          dark && { backgroundColor: C.black },
          !icon && { paddingLeft: 18 },
        ]}
      >
        {icon ? (
          <View style={styles.chipIcon}>
            <Icon name={icon} size={20} color="#fff" />
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
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={styles.chipCircle}
    >
      <Icon name={icon} size={22} color={C.ink} />
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
  return <Tag label="Demo data" bg="rgba(18,18,18,0.06)" color={C.muted} style={style} />;
}

const styles = StyleSheet.create({
  chipActive: {
    height: 52,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 6,
    paddingRight: 18,
  },
  chipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
});
