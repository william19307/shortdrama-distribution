/**
 * antd v5 ConfigProvider 主题映射 —— 营销站电影感风格
 * 用法：<ConfigProvider theme={getAntdTheme({ mode: 'dark', density: 'compact' })}>
 */
import { theme } from 'antd';
import type { ThemeConfig } from 'antd';
import { colors, font, radius, shadow, type ThemeName, type Density } from './tokens';

export interface AntdThemeOptions { mode?: ThemeName; density?: Density }

export function getAntdTheme({ mode = 'dark', density = 'comfortable' }: AntdThemeOptions = {}): ThemeConfig {
  const c = colors[mode];
  const dark = mode === 'dark';
  const compact = density === 'compact';
  const sh = shadow[mode];
  const algorithm = [dark ? theme.darkAlgorithm : theme.defaultAlgorithm, ...(compact ? [theme.compactAlgorithm] : [])];
  const ctl = compact ? 30 : 40;
  const fs = compact ? 13 : 14;

  return {
    algorithm,
    cssVar: { key: `ds-${mode}${compact ? "-compact" : ""}` },
    hashed: false,
    token: {
      colorPrimary: c.primary, colorInfo: c.info, colorSuccess: c.success, colorWarning: c.warning, colorError: c.error,
      colorLink: c.primaryText, colorLinkHover: c.primaryHover,
      colorBgBase: dark ? '#000000' : '#FFFFFF', colorTextBase: c.text,
      colorBgLayout: c.bg, colorBgContainer: c.surface, colorBgElevated: dark ? c.surface2 : '#FFFFFF', colorBgSpotlight: dark ? '#26262C' : '#1B1B20',
      colorBgMask: c.overlay,
      colorText: c.text, colorTextSecondary: c.textSecondary, colorTextTertiary: c.textTertiary, colorTextQuaternary: dark ? '#5C5C62' : '#AEAEB2',
      colorBorder: c.borderStrong, colorBorderSecondary: c.border, colorSplit: c.border,
      colorFillSecondary: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', colorFillTertiary: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)',
      colorFillQuaternary: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
      fontFamily: font.family, fontFamilyCode: font.mono,
      fontSize: fs, fontSizeHeading1: compact ? 30 : 40, fontSizeHeading2: compact ? 24 : 32, fontSizeHeading3: compact ? 20 : 24,
      fontWeightStrong: 600,
      borderRadius: radius.md, borderRadiusSM: radius.sm - 2, borderRadiusLG: radius.lg, borderRadiusXS: radius.xs,
      controlHeight: ctl, controlHeightSM: compact ? 24 : 32, controlHeightLG: compact ? 36 : 48,
      boxShadow: sh.md, boxShadowSecondary: sh.lg, boxShadowTertiary: sh.sm,
      controlOutline: c.focusRing, controlOutlineWidth: 2,
      motionDurationFast: '0.15s', motionDurationMid: '0.3s', motionDurationSlow: '0.45s',
      motionEaseOut: 'cubic-bezier(.22,1,.36,1)', motionEaseInOut: 'cubic-bezier(.65,0,.35,1)', motionEaseOutCirc: 'cubic-bezier(.22,1,.36,1)',
      wireframe: false,
    },
    components: {
      Button: {
        fontWeight: 600, borderRadius: radius.pill, borderRadiusSM: radius.pill, borderRadiusLG: radius.pill,
        paddingInline: compact ? 14 : 22, paddingInlineLG: 28,
        primaryShadow: compact ? 'none' : sh.glow, defaultShadow: 'none', dangerShadow: 'none',
        defaultBg: dark ? 'rgba(255,255,255,.08)' : '#FFFFFF', defaultBorderColor: c.borderStrong, defaultColor: c.text,
        defaultHoverBg: dark ? 'rgba(255,255,255,.16)' : '#F0F0F3', defaultHoverBorderColor: dark ? 'rgba(255,255,255,.32)' : 'rgba(0,0,0,.3)', defaultHoverColor: c.text,
        defaultActiveBg: dark ? 'rgba(255,255,255,.2)' : '#E8E8ED', defaultActiveBorderColor: c.borderStrong, defaultActiveColor: c.text,
        textHoverBg: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)',
      },
      Input: {
        activeBorderColor: dark ? '#FFFFFF' : '#0B0B0D', hoverBorderColor: c.borderStrong, activeShadow: `0 0 0 3px ${c.focusRing}`,
        colorBgContainer: dark ? 'rgba(255,255,255,.04)' : '#FFFFFF', activeBg: dark ? 'rgba(255,255,255,.07)' : '#FFFFFF',
        borderRadius: compact ? radius.sm : radius.md + 2, paddingInline: compact ? 10 : 14,
      },
      InputNumber: { activeBorderColor: dark ? '#FFFFFF' : '#0B0B0D', colorBgContainer: dark ? 'rgba(255,255,255,.04)' : '#FFFFFF', activeShadow: `0 0 0 3px ${c.focusRing}` },
      Select: {
        activeBorderColor: dark ? '#FFFFFF' : '#0B0B0D', hoverBorderColor: c.borderStrong, activeOutlineColor: c.focusRing,
        selectorBg: dark ? 'rgba(255,255,255,.04)' : '#FFFFFF', optionSelectedBg: c.primarySoft, optionSelectedColor: c.text,
        optionActiveBg: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', borderRadius: compact ? radius.sm : radius.md + 2,
        multipleItemBg: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)',
      },
      DatePicker: { activeBorderColor: dark ? '#FFFFFF' : '#0B0B0D', colorBgContainer: dark ? 'rgba(255,255,255,.04)' : '#FFFFFF' },
      Checkbox: { borderRadiusSM: 5 },
      Switch: { colorPrimary: c.primary, colorPrimaryHover: c.primaryHover },
      Card: {
        colorBgContainer: dark ? '#0E0E11' : '#FFFFFF', borderRadiusLG: compact ? radius.lg : radius.xl,
        paddingLG: compact ? 16 : 28, headerBg: 'transparent', headerFontSize: compact ? 14 : 17, headerHeight: compact ? 44 : 60,
        extraColor: c.textSecondary, actionsBg: 'transparent',
      },
      Table: {
        colorBgContainer: dark ? '#0E0E11' : '#FFFFFF',
        headerBg: dark ? '#121215' : '#FAFAFB', headerColor: c.textTertiary, headerSplitColor: 'transparent', headerBorderRadius: compact ? radius.sm : radius.lg,
        rowHoverBg: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.025)', rowSelectedBg: c.primarySoft, rowSelectedHoverBg: dark ? 'rgba(214,21,60,.22)' : 'rgba(214,21,60,.12)',
        borderColor: c.border, cellPaddingBlock: compact ? 8 : 16, cellPaddingInline: compact ? 12 : 16,
        cellPaddingBlockSM: 6, cellPaddingInlineSM: 10, cellFontSize: fs, cellFontSizeSM: 12,
        footerBg: 'transparent', filterDropdownBg: dark ? '#1B1B20' : '#FFFFFF', expandIconBg: 'transparent', stickyScrollBarBg: c.borderStrong,
      },
      Tag: { defaultBg: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', defaultColor: c.textSecondary, borderRadiusSM: radius.pill, fontSizeSM: 12, lineHeightSM: 1.75 },
      Modal: {
        contentBg: dark ? '#121215' : '#FFFFFF', headerBg: 'transparent', footerBg: 'transparent', titleFontSize: compact ? 16 : 22,
        borderRadiusLG: compact ? radius.lg : radius.xl, boxShadow: sh.modal,
      },
      Drawer: { colorBgElevated: dark ? '#0E0E11' : '#FFFFFF', footerPaddingBlock: 16, footerPaddingInline: 24 },
      Menu: {
        itemBg: 'transparent', subMenuItemBg: 'transparent', darkItemBg: '#000000',
        itemColor: c.textSecondary, itemHoverColor: c.text, itemHoverBg: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)',
        itemSelectedBg: c.primarySoft, itemSelectedColor: dark ? '#FFFFFF' : c.primaryText, itemActiveBg: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)',
        itemBorderRadius: radius.md, itemHeight: compact ? 34 : 42, itemMarginInline: 8, iconSize: compact ? 15 : 17,
        groupTitleColor: c.textTertiary, groupTitleFontSize: 11, horizontalItemSelectedColor: c.text, activeBarBorderWidth: 0,
        horizontalItemSelectedBg: 'transparent', collapsedIconSize: 18,
      },
      Tabs: {
        inkBarColor: c.primary, itemColor: c.textSecondary, itemSelectedColor: c.text, itemHoverColor: c.text, itemActiveColor: c.text,
        titleFontSize: fs + 1, horizontalItemGutter: compact ? 20 : 28, cardBg: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
      },
      Steps: {
        colorPrimary: c.primary, dotSize: 10, iconSize: compact ? 24 : 30, iconFontSize: compact ? 12 : 14,
        titleLineHeight: compact ? 24 : 30, customIconSize: compact ? 24 : 30, navArrowColor: c.textTertiary,
      },
      Layout: {
        bodyBg: c.bg, headerBg: dark ? 'rgba(0,0,0,.72)' : 'rgba(255,255,255,.8)', siderBg: dark ? '#0A0A0C' : '#FFFFFF',
        headerHeight: compact ? 52 : 68, headerPadding: compact ? '0 16px' : '0 32px', footerBg: 'transparent',
        triggerBg: dark ? '#121215' : '#F0F0F3', triggerColor: c.text, lightSiderBg: '#FFFFFF',
      },
      Segmented: { itemSelectedBg: dark ? '#FFFFFF' : '#0B0B0D', itemSelectedColor: dark ? '#000000' : '#FFFFFF', trackBg: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', borderRadius: radius.pill, borderRadiusSM: radius.pill },
      Statistic: { contentFontSize: compact ? 26 : 36, titleFontSize: compact ? 12 : 13 },
      Badge: { colorError: c.primary },
      Progress: { defaultColor: c.primary, remainingColor: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)' },
      Pagination: { itemActiveBg: 'transparent', borderRadius: radius.pill },
      Tooltip: { colorBgSpotlight: dark ? '#26262C' : '#1B1B20' },
      Form: { labelColor: c.textSecondary, verticalLabelPadding: compact ? '0 0 4px' : '0 0 8px', itemMarginBottom: compact ? 14 : 22 },
      Alert: { borderRadiusLG: radius.lg },
      Descriptions: { labelBg: dark ? '#121215' : '#FAFAFB', titleColor: c.text },
      Empty: { colorTextDescription: c.textTertiary },
    },
  };
}

export const darkTheme = getAntdTheme({ mode: 'dark' });
export const lightTheme = getAntdTheme({ mode: 'light' });
export const darkCompactTheme = getAntdTheme({ mode: 'dark', density: 'compact' });
export const lightCompactTheme = getAntdTheme({ mode: 'light', density: 'compact' });

/** antd Tag color 对应 bizStatus.tone */
export const toneToTagColor = { neutral: 'default', warning: 'warning', success: 'success', error: 'error', info: 'processing', brand: 'magenta' } as const;
export default getAntdTheme;
