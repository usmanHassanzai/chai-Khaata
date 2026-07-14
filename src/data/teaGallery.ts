export type TeaItem = {
  id: string;
  name: string;
  nameUr: string;
  image: string;
  accent: string;
  description: string;
  region?: string;
};

export const TEA_GALLERY: TeaItem[] = [
  {
    id: 'kashmiri',
    name: 'Kashmiri Chai',
    nameUr: 'کشمیری چائے',
    image: '/images/tea/kashmiri-chai.jpg',
    accent: '#c45c7a',
    description: 'Pink noon chai with pistachio & cream',
    region: 'Northern Pakistan',
  },
  {
    id: 'karak',
    name: 'Karak Doodh Patti',
    nameUr: 'کرک دودھ پتی',
    image: '/images/tea/karak-chai.jpg',
    accent: '#b87333',
    description: 'Strong milky tea — dhaba favourite',
    region: 'Karachi · Lahore',
  },
  {
    id: 'green',
    name: 'Green & Mint',
    nameUr: 'سبز چائے',
    image: '/images/tea/green-mint-chai.jpg',
    accent: '#40916c',
    description: 'Fresh pudina wali light chai',
    region: 'Peshawar · Quetta',
  },
  {
    id: 'sada',
    name: 'Sada Black Tea',
    nameUr: 'سادہ چائے',
    image: '/images/tea/sada-chai.jpg',
    accent: '#5c4033',
    description: 'Bold amber breakfast blend',
    region: 'All Pakistan',
  },
  {
    id: 'dhaba',
    name: 'Dhaba Special',
    nameUr: 'ڈھابہ اسپیشل',
    image: '/images/tea/pakistani-dhaba-banner.jpg',
    accent: '#d4a853',
    description: 'Street-side chai culture',
    region: 'Highways & Bazaars',
  },
];

export const HERO_TEAS = TEA_GALLERY;

export const PAGE_TEA_IMAGES = {
  dashboard: '/images/tea/pakistani-dhaba-banner.jpg',
  dukaan: '/images/tea/karak-chai.jpg',
  godaam: '/images/tea/tea-leaves.svg',
  customers: '/images/tea/kashmiri-chai.jpg',
  stock: '/images/tea/green-mint-chai.jpg',
  settings: '/images/tea/sada-chai.jpg',
  admin: '/images/tea/pakistani-dhaba-banner.jpg',
} as const;
