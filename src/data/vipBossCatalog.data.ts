import type { VipBossMapping } from '@/lib/vipBossCatalog';
import type { VipTicketLevel } from '@/types';

/**
 * 各VIP重置券等級實際能重置的既有王與難度對照表。
 * 名稱/水晶收益/組隊人數上限不重複存放於此,一律查 BOSS_CATALOG。
 *
 * 難度收錄規則:沒有極限/終極難度的王,該王所有「每週重置」難度都收錄進所屬等級;
 * 有極限/終極難度的王(史烏/賽蓮/卡洛斯/最初的敵對者/咖凌/瑪莉西亞),
 * 該王的極限/終極難度只收錄在「終極」券等級,其餘較低的每週難度收錄在中/上對應等級。
 */
export const VIP_BOSS_MAPPING: Record<VipTicketLevel, VipBossMapping[]> = {
  下: [
    { bossCatalogId: 'zakum', difficulties: ['渾沌'] }, // 炎魔
    { bossCatalogId: 'magnus', difficulties: ['困難'] }, // 梅格耐斯
    { bossCatalogId: 'hilla', difficulties: ['困難'] }, // 希拉
    { bossCatalogId: 'papulatus', difficulties: ['渾沌'] }, // 拉圖斯
    { bossCatalogId: 'pierre', difficulties: ['渾沌'] }, // 比艾樂
    { bossCatalogId: 'von-bon', difficulties: ['渾沌'] }, // 斑斑
    { bossCatalogId: 'crimson-queen', difficulties: ['渾沌'] }, // 血腥皇后
    { bossCatalogId: 'vellum', difficulties: ['渾沌'] }, // 貝倫
    { bossCatalogId: 'pink-bean', difficulties: ['渾沌'] }, // 粉豆
    { bossCatalogId: 'cygnus', difficulties: ['簡單', '普通'] }, // 西格諾斯
    { bossCatalogId: 'princess-no', difficulties: ['普通'] }, // 濃姬
  ],
  中: [
    { bossCatalogId: 'lotus', difficulties: ['普通', '困難'] }, // 史烏(極限留給終極)
    { bossCatalogId: 'damien', difficulties: ['普通', '困難'] }, // 戴米安
    { bossCatalogId: 'guardian-angel-slime', difficulties: ['普通', '渾沌'] }, // 守護天使綠水靈
    { bossCatalogId: 'lucid', difficulties: ['簡單', '普通', '困難'] }, // 露希妲
    { bossCatalogId: 'will', difficulties: ['簡單', '普通', '困難'] }, // 威爾
    { bossCatalogId: 'gloom', difficulties: ['普通', '渾沌'] }, // 戴斯克
    { bossCatalogId: 'verus-hilla', difficulties: ['普通', '困難'] }, // 真希拉
    { bossCatalogId: 'darknell', difficulties: ['普通', '困難'] }, // 頓凱爾
    { bossCatalogId: 'seren', difficulties: ['普通', '困難'] }, // 受選的賽蓮(極限留給終極)
    { bossCatalogId: 'kalos', difficulties: ['簡單', '普通', '渾沌'] }, // 監視者卡洛斯(極限留給終極)
    { bossCatalogId: 'kaling', difficulties: ['簡單', '普通', '困難'] }, // 咖凌(極限留給終極)
    { bossCatalogId: 'first-adversary', difficulties: ['簡單', '普通', '困難'] }, // 最初的敵對者(極限留給終極)
    { bossCatalogId: 'malitia', difficulties: ['普通'] }, // 瑪莉西亞(終極留給終極)
  ],
  上: [
    { bossCatalogId: 'limbo', difficulties: ['普通', '困難'] }, // 林波
    { bossCatalogId: 'baldrix', difficulties: ['普通', '困難'] }, // 巴德洛斯
  ],
  終極: [
    { bossCatalogId: 'lotus', difficulties: ['極限'] }, // 史烏
    { bossCatalogId: 'seren', difficulties: ['極限'] }, // 賽蓮
    { bossCatalogId: 'kalos', difficulties: ['極限'] }, // 卡洛斯
    { bossCatalogId: 'first-adversary', difficulties: ['極限'] }, // 最初的敵對者
    { bossCatalogId: 'kaling', difficulties: ['極限'] }, // 咖凌
    { bossCatalogId: 'malitia', difficulties: ['終極'] }, // 瑪莉西亞
  ],
  每月: [
    { bossCatalogId: 'black-mage', difficulties: ['困難', '極限'] }, // 黑魔法師(不限難度)
  ],
};
