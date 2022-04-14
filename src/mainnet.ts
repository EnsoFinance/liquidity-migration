import { ethers } from "hardhat";
import { BigNumber, constants, Contract, ContractInterface } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LiquidityMigrationV2__factory, PieDaoAdapter__factory } from "../typechain";
import { DeployedContracts, HolderBalanceTyped, PoolsToMigrate, PoolsToMigrateData, Adapter, Adapters, AcceptedProtocols } from "./types";
import deployments from "../deployments.json";
import poolsToMigrate from "../out/above_threshold.json";
const { AddressZero } = constants;

export function getMainnetDeployments(): DeployedContracts {
    if (!deployments.mainnet) { throw Error("deployments.json file not found") } 
    const d: DeployedContracts = deployments.mainnet
    return d
}


// Return contract interface if one of Adapters enum
export async function getAdapterAbi(adapter: string, contractName: Adapters, signer: SignerWithAddress): Promise<Contract> {
    let abi: Contract;
    console.log("Getting contract: ", contractName)
    switch (contractName) {
        case Adapters.IndexedAdapter:
            abi = (await ethers.getContractFactory("PieDaoAdapter")).connect(signer).attach(adapter)
        // TODO: Finish
        default: 
            throw Error("Adapter not found in deployments.json")
    }
    return abi;
}

export async function getAdapterFromType(adapterType: Adapters, signer: SignerWithAddress): Promise<Contract> { 
    const liveContracts = getMainnetDeployments()
    const keys = Object.keys(liveContracts)
    for (let i=0; i < keys.length; i++) { 
        const name = keys[i] as Adapters
        console.log(name, " == ", adapterType)
        if (name === adapterType) {
            console.log("Found matching adapter: ", adapterType)
            const adapter = await getAdapterAbi(liveContracts[name], adapterType, signer)
            console.log("Adapter is: ", adapter.address)
            return adapter;
        }
    }
    throw Error("Failed to find adapter")

}

// Find protocol adapter for this address on mainnet
export async function getAdapterFromAddr(addr: string, signer: SignerWithAddress): Promise<Contract> {
    const liveContracts = getMainnetDeployments()
    Object.keys(liveContracts).map(async (c: string) => { 
        console.log(c)
        console.log(liveContracts[c], " == ", addr)
        if (liveContracts[c].toLowerCase() == addr.toLowerCase()) {
            const adapterType = c as Adapters;
            console.log("Found matching adapter: ", adapterType)
            const adapter = await getAdapterAbi(liveContracts[c], adapterType, signer)
            console.log(adapter)
            return adapter;
        }
    })
    throw Error("Failed to find adapter")
    //return new Contract(AddressZero, [], signer.provider)
}

// Parse staked users json and populate balances as BigNumber + adapter as Contract
export async function getPoolsToMigrate(signer: SignerWithAddress): Promise<PoolsToMigrate[]> {
    const poolsData: PoolsToMigrateData[] = poolsToMigrate 
    const pools: PoolsToMigrate[] = []
    for (let i = 0; i < poolsData.length; i++) {
        const p = poolsData[i];
        const keys: string[] = Object(p.balances).keys()
        const balances: HolderBalanceTyped = {};
        keys.map((addr, iter) => {
            balances[addr] = BigNumber.from(p.balances[addr])
        })
        const adapter = await getAdapterFromAddr(p.adapter, signer)
        const pool: PoolsToMigrate = {users: p.users, balances, lp: p.lp, adapter }
        pools[i] = pool
    }
    return pools
}

export async function liveMigrationContract(signer: SignerWithAddress): Promise<Contract> {
    const LiquidityMigrationFactory = (await ethers.getContractFactory(
      "LiquidityMigrationV2",
    )) as LiquidityMigrationV2__factory;

    if (!deployments.mainnet || !deployments.mainnet.LiquidityMigrationV2) throw Error("Failed to find LiquidityMigration2 address");

    const liquidityMigration = await LiquidityMigrationFactory.connect(signer).attach(deployments.mainnet.LiquidityMigrationV2)

    return liquidityMigration;
}
