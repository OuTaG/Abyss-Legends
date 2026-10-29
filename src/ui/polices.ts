// Polices (guide de style 13) : Cinzel pour les titres, Barlow pour l'interface, avec replis CJK (japonais, coreen,
// chinois traditionnel) puis polices systeme. Memes piles en CSS (style.css) et dans les textes Pixi.
const CJK_SANS = '"Noto Sans JP", "Noto Sans KR", "Noto Sans TC", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Apple SD Gothic Neo", "Malgun Gothic", "PingFang TC", "Microsoft JhengHei", "Yu Gothic"';
const CJK_SERIF = '"Noto Serif JP", "Noto Serif KR", "Noto Serif TC", "Hiragino Mincho ProN", "AppleMyungjo", "Songti TC"';
export const POLICE_UI = `Barlow, -apple-system, "Segoe UI", Roboto, Arial, ${CJK_SANS}, sans-serif`;
export const POLICE_TITRE = `Cinzel, Georgia, "Times New Roman", ${CJK_SERIF}, serif`;
