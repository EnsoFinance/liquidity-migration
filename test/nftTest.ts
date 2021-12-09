import { ethers } from "hardhat";
import { assert } from "console";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { initial } from "underscore";
import { TASK_COMPILE_SOLIDITY_LOG_COMPILATION_RESULT } from "hardhat/builtin-tasks/task-names";
import { ConstructorFragment } from "ethers/lib/utils";


describe('claimable', () => {
    let accounts: SignerWithAddress[],
        attacker: SignerWithAddress,
        user: SignerWithAddress,
        ERC1155: ContractFactory,
        erc1155: Contract,
        initialURI = 'https://gateway.pinata.cloud/ipfs/Qmcoqx2GTGYdu3eUQtYtxbRNvPvuMRxVuLp2CgjTbc9KnN/',
        state = [0, 1, 2], // 0 = pending, 1 = active, 2 = closed
        name = 'degen',
        decimals = 18,
        supply = 4000,
        emptyAddress = "0x0000000000000000000000000000000000000000",
        stake = (10 * decimals),
        protocols = [0, 1, 2, 3, 4, 5], // 0 = dpi, 1 = TS, 2=enz, 3=ind, 4=pie, 5= bask
        max = 6

    before(async () => {
        accounts = await ethers.getSigners();
        user = accounts[0];
        attacker = accounts[10];

        ERC1155 = await ethers.getContractFactory("Root1155");
        erc1155 = await ERC1155.deploy(initialURI, accounts[0].address);
    });
    describe('quick', () => {
        it('fix', async () => {
            await erc1155.create(accounts[0].address, supply, initialURI, "0x")
            console.log(await erc1155.uri(0))
        });
    });
});