/**
 * RankBadge —— 排名奖牌。仅用于排行榜（Top10 等）。
 * rank 1/2/3 → 金/银/铜奖牌（冠军 CrownFilled，亚/季军 TrophyFilled）+ 名次数字；其余 → 普通等宽数字。
 * size: 'sm' 列表行内；'lg' 封面卡角标。依赖 tokens.css + components.css 的 .ds-rank*。
 */
import { CrownFilled, TrophyFilled } from '@ant-design/icons';
import { rankMeta, rankTier } from './tokens';

/** placement：inline = 行内（默认）；top-left / top-right = 绝对定位为封面卡角标（父元素需 position:relative） */
export type RankPlacement = 'inline' | 'top-left' | 'top-right';
export interface RankBadgeProps { rank: number; size?: 'sm' | 'lg'; placement?: RankPlacement; lang?: 'zh' | 'en'; className?: string }

export function RankBadge({ rank, size = 'sm', placement = 'inline', lang = 'zh', className = '' }: RankBadgeProps) {
  const tier = rankTier(rank);
  if (placement !== 'inline') className = `ds-rank--${placement} ${className}`;
  if (!tier) {
    const label = lang === 'zh' ? `第 ${rank} 名` : `Rank ${rank}`;
    return <span className={`ds-rank ds-rank--plain ds-rank--${size} ${className}`} aria-label={label} title={label}>{size === 'lg' ? rank : String(rank).padStart(2, '0')}</span>;
  }
  const meta = rankMeta[tier];
  const Icon = tier === 'gold' ? CrownFilled : TrophyFilled;
  const label = lang === 'zh' ? `${meta.zh}（第 ${rank} 名）` : `${meta.en} (#${rank})`;
  return <span className={`ds-rank ds-rank--medal ds-rank--${tier} ds-rank--${size} ${className}`} role="img" aria-label={label} title={label}><Icon aria-hidden />{rank}</span>;
}
export default RankBadge;
