export type AaveTokenList = {
    name: string,
    decimals: number,
    symbol: string, 
    address: string,
    chainId: number,
    logoURI: string,
    tags: string[]
}

const erc20s = () => JSON.parse('./tokenlist.json') as AaveTokenList[];

export enum Networks { Mainnet, LocalTestnet, ExternalTestnet};