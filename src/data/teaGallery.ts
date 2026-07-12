export type TeaItem = {
  id: string;
  name: string;
  nameUr: string;
  image: string;
  accent: string;
  description: string;
};

export const TEA_GALLERY: TeaItem[] = [
  {
    id: 'kashmiri',
    name: 'Kashmiri Chai',
    nameUr: 'کشمیری چائے',
    image: '/images/tea/tea-kashmiri.svg',
    accent: '#c45c7a',
    description: 'Pink, creamy & aromatic',
  },
  {
    id: 'black',
    name: 'Karachi Black',
    nameUr: 'سیاہ چائے',
    image: '/images/tea/tea-leaves.svg',
    accent: '#8b5a2b',
    description: 'Strong breakfast blend',
  },
  {
    id: 'green',
    name: 'Green & Mint',
    nameUr: 'سبز چائے',
    image: '/images/tea/tea-green.svg',
    accent: '#40916c',
    description: 'Light, fresh & healthy',
  },
];

export const HERO_TEAS = TEA_GALLERY;
