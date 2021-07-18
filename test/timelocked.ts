import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import "ethers";
import { Signers } from "../types";
import {
    MockFundHolder__factory
 } from "../typechain";
import { getBlockTime } from "../src/utils";
import { BigNumber } from "ethers";



// create a mock contract that will import Timelocked - done
// then deploy the mockContract
// and then test if the timelocked functions are working appropriately

describe("Timelocked Test", function () {

    beforeEach(async function () {
        this.signers = {} as Signers;
        const signers = await ethers.getSigners();
        this.signers.default = signers[0];
        this.signers.otherAccount = signers[1];
        this.signers.admin = signers[10];

        const mockContractFactory = (await ethers.getContractFactory("mockFundHolder",)) as MockFundHolder__factory;
        this.blocktimestamp = await getBlockTime(0);
        console.log(
            `Approximate Deployment blocktime is ${this.blocktimestamp.toString()}`
            );
        this.mockFundHolder = await mockContractFactory.connect(this.signers.default).deploy();
        // console.log(await this.mockFundHolder.deployTransaction.block);
        // console.log(this.mockFundHolder.address);
    });

    it("only the Owner of the Contract is able update Modify blocktime", async function () {
        const newBlockTimeForModification = (await getBlockTime(0)).add(500);
        await expect(this.mockFundHolder.connect(this.signers.otherAccount).updateUnlock(newBlockTimeForModification)).to.be.revertedWith("Ownable: caller is not the owner");
        await this.mockFundHolder.connect(this.signers.default).updateUnlock(newBlockTimeForModification);
        expect((await this.mockFundHolder.unlocked()).eq(newBlockTimeForModification)).to.be.true;
    });

    it("Owner of the Contract is not able update Modify if the Modify timeperiod has lapsed", async function () {
        const newBlockTimeForModification = (await getBlockTime(0)).add(500);
        // increasing blocktime
        const time = this.blocktimestamp.add(5000)
        await ethers.provider.send('evm_setNextBlockTimestamp', [time.toNumber()]);
        await ethers.provider.send('evm_mine', []);
        // attempting to change modifyTimeStamp
        await expect (this.mockFundHolder.connect(this.signers.default).updateUnlock(newBlockTimeForModification)).to.be.revertedWith("Timelock#onlyModify: cannot modify");
    });

    it("depositer is not able to withdraw before the unlocked time", async function () {
        // Depositing Ether
        await this.mockFundHolder.connect(this.signers.otherAccount).depositETH({value: ethers.utils.parseEther("1.0")});
        // attempting to withdraw the ether deposited
        await expect(this.mockFundHolder.connect(this.signers.otherAccount).withdraw(ethers.utils.parseEther("1.0"))).to.be.revertedWith("Timelock#onlyUnlocked: not unlocked");
    });

    it("depositer is able to withdraw after the unlocked time", async function () {
        // depositing ether
        await this.mockFundHolder.connect(this.signers.otherAccount).depositETH({value: ethers.utils.parseEther("1.0")});
        const holderBalance = await this.mockFundHolder.addressBalance(this.signers.otherAccount.getAddress());
        // console.log(holderBalance);
        // console.log(BigNumber.from(1));
        expect(holderBalance.eq(ethers.utils.parseEther("1.0"))).to.be.true;
        
        // increasing the blocktime
        const time = this.blocktimestamp.add(5000)
        await ethers.provider.send('evm_setNextBlockTimestamp', [time.toNumber()]);
        await ethers.provider.send('evm_mine', []);
    
        // attempting to withdraw the ether deposited
        await this.mockFundHolder.connect(this.signers.otherAccount).withdraw(ethers.utils.parseEther("1.0"));
        const updatedHolderBalance = await this.mockFundHolder.addressBalance(this.signers.otherAccount.getAddress());
        expect(updatedHolderBalance.eq(BigNumber.from(0))).to.be.true;
    


    });
        
        
        



});