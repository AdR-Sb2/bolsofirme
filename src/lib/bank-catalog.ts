export type BankCatalogEntry = {
  name: string;
  color: string;
  logo: string;
};

const repositoryCommit = "fe1d43f0cf379135bd01c987bc147a04fdf48c6d";
const repositoryLogo = (path: string) =>
  `https://cdn.jsdelivr.net/gh/Tgentil/Bancos-em-SVG@${repositoryCommit}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

export const BANK_CATALOG: BankCatalogEntry[] = [
  {
    name: "Banco do Brasil",
    color: "#f5c400",
    logo: repositoryLogo("Banco do Brasil S.A/banco-do-brasil-sem-fundo.svg"),
  },
  {
    name: "Nubank",
    color: "#820ad1",
    logo: repositoryLogo("Nu Pagamentos S.A/nubank-logo-2021.svg"),
  },
  { name: "Itaú", color: "#ec7000", logo: repositoryLogo("Itaú Unibanco S.A/itau.svg") },
  { name: "iti Itaú", color: "#ec7000", logo: repositoryLogo("Itaú Unibanco S.A/itau.svg") },
  { name: "Bradesco", color: "#cc092f", logo: repositoryLogo("Bradesco S.A/bradesco.svg") },
  {
    name: "Caixa",
    color: "#0066a1",
    logo: repositoryLogo("Caixa Econômica Federal/caixa-economica-federal-1.svg"),
  },
  {
    name: "Santander",
    color: "#ec0000",
    logo: repositoryLogo("Banco Santander Brasil S.A/banco-santander-logo.svg"),
  },
  { name: "Banco Inter", color: "#ff7a00", logo: repositoryLogo("Banco Inter S.A/inter.svg") },
  { name: "C6 Bank", color: "#242424", logo: repositoryLogo("Banco C6 S.A/c6 bank.svg") },
  {
    name: "BTG Pactual",
    color: "#003b5c",
    logo: repositoryLogo("Banco BTG Pacutal/btg-pactual.svg"),
  },
  { name: "Sicredi", color: "#3b7d23", logo: repositoryLogo("Sicredi/logo-svg2.svg") },
  { name: "Sicoob", color: "#009b63", logo: repositoryLogo("Sicoob/sicoob-vector-logo.svg") },
  {
    name: "PagBank",
    color: "#00a5e5",
    logo: repositoryLogo("PagSeguro Internet S.A/logo-pagbank.svg"),
  },
  {
    name: "Mercado Pago",
    color: "#009ee3",
    logo: repositoryLogo("Mercado Pago/mercado-pago.svg"),
  },
  { name: "PicPay", color: "#21c25e", logo: repositoryLogo("PicPay/Logo-PicPay.svg") },
  { name: "Neon", color: "#00a5a8", logo: repositoryLogo("Neon/header-logo-neon.svg") },
  { name: "Next", color: "#00c8b4", logo: "https://cdn.simpleicons.org/next" },
  {
    name: "Original",
    color: "#00a859",
    logo: repositoryLogo("Banco Original S.A/banco-original-logo-verde.svg"),
  },
  {
    name: "Safra",
    color: "#a18a52",
    logo: repositoryLogo("Banco Safra S.A/logo-safra.svg"),
  },
  {
    name: "XP",
    color: "#111111",
    logo: repositoryLogo("XP Investimentos/xp-investimentos-logo.svg"),
  },
  { name: "Genial", color: "#00a99d", logo: "https://cdn.simpleicons.org/genial" },
  { name: "Modalmais", color: "#5b2c83", logo: "https://cdn.simpleicons.org/modalmais" },
  {
    name: "Daycoval",
    color: "#003b70",
    logo: repositoryLogo("Banco Daycoval/logo-Daycoval.svg"),
  },
  { name: "BMG", color: "#006b54", logo: repositoryLogo("Banco BMG/banco-bmg-logo.svg") },
  { name: "BRB", color: "#0067a5", logo: repositoryLogo("BRB - Banco de Brasilia/brb-logo.svg") },
  { name: "Banrisul", color: "#00529b", logo: repositoryLogo("Banrisul/banrisul-logo-2023.svg") },
  {
    name: "Banestes",
    color: "#00529b",
    logo: repositoryLogo("Banco do Estado do Espirito Santo/banestes.svg"),
  },
  { name: "Banco Pan", color: "#ff6600", logo: repositoryLogo("Banco Pan/bancoPan.svg") },
  { name: "Will Bank", color: "#ffde00", logo: "https://cdn.simpleicons.org/willbank" },
  {
    name: "Stone",
    color: "#00a868",
    logo: repositoryLogo("Stone Pagamentos S.A/stone.svg"),
  },
  {
    name: "PagSeguro",
    color: "#00a5e5",
    logo: repositoryLogo("PagSeguro Internet S.A/pagseguro.svg"),
  },
];

export function getBankLogo(name: string): string | undefined {
  return BANK_CATALOG.find((bank) => bank.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    ?.logo;
}
