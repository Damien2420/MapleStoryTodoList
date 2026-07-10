/** 伺服器列表(組隊/世界頻道分區) */
export const SERVERS = ['艾麗亞', '普力特', '琉德', '優依娜', '愛麗西亞', '殺人鯨', '挑戰者'] as const;
export type Server = (typeof SERVERS)[number];
