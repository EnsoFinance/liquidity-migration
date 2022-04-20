import hre from "hardhat";
import { BigNumber, Contract } from "ethers";

const MAX_GAS_PRICE = hre.ethers.BigNumber.from("85000000000"); // 85 gWEI

export type TransactionArgs = {
  maxPriorityFeePerGas: BigNumber;
  maxFeePerGas: BigNumber;
};

export const waitForDeployment = async (txFunc: (txArgs: TransactionArgs) => Promise<Contract>, signer: any) => {
  return new Promise<Contract>(async resolve => {
    let isDeployed = false;
    while (!isDeployed) {
      const tip = await waitForLowGas(signer);
      let contract: Contract;
      try {
        contract = await txFunc({
          maxPriorityFeePerGas: tip,
          maxFeePerGas: MAX_GAS_PRICE,
        });
        await contract.deployed();
        isDeployed = true;
      } catch (e: any) {
        if (e.toString().includes("max fee per gas less than block base fee")) {
          //try again
          console.log(e);
          continue;
        } else {
          throw new Error(e);
        }
      }
      const receipt = await contract.deployTransaction.wait();
      const gasUsed = receipt.gasUsed;
      console.log("Gas used: ", gasUsed.toString());
      resolve(contract);
    }
  });
};

export const waitForTransaction = async (txFunc: (txArgs: TransactionArgs) => Promise<any>, signer: any) => {
  return new Promise<any>(async resolve => {
    let isCalled = false;
    while (!isCalled) {
      const tip = await waitForLowGas(signer);
      let receipt: any;
      try {
        const tx = await txFunc({
          maxPriorityFeePerGas: tip,
          maxFeePerGas: MAX_GAS_PRICE,
        });
        receipt = await tx.wait();
        isCalled = true;
      } catch (e: any) {
        if (e.toString().includes("max fee per gas less than block base fee")) {
          //try again
          console.log(e);
          continue;
        } else {
          throw new Error(e);
        }
      }
      const gasUsed = receipt.gasUsed;
      console.log("Gas used: ", gasUsed.toString());
      resolve(receipt);
    }
  });
};

export const waitForLowGas = async (signer: any) => {
  return new Promise<any>(async resolve => {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    //console.log('Next Block: ', blockNumber + 1)
    const [block, feeData] = await Promise.all([hre.ethers.provider.getBlock(blockNumber), signer.getFeeData()]);
    const expectedBaseFee = getExpectedBaseFee(block);
    if (expectedBaseFee.eq("0")) {
      console.log("Bad block. Waiting 15 seconds...");
      setTimeout(async () => {
        tip = await waitForLowGas(signer);
        resolve(tip);
      }, 15000);
    }
    // Pay 5% over expected tip
    let tip = feeData.maxPriorityFeePerGas.add(feeData.maxPriorityFeePerGas.div(20));
    const estimatedGasPrice = expectedBaseFee.add(tip);
    //console.log('Expected Base Fee: ', expectedBaseFee.toString())
    //console.log('Estimated Gas Price: ', estimatedGasPrice.toString())
    if (estimatedGasPrice.gt(MAX_GAS_PRICE)) {
      console.log("Gas too high. Waiting 15 seconds...");
      setTimeout(async () => {
        tip = await waitForLowGas(signer);
        resolve(tip);
      }, 15000);
    } else {
      resolve(tip);
    }
  });
};

export const getExpectedBaseFee = (block: any) => {
  let expectedBaseFee = hre.ethers.BigNumber.from("0");
  if (block.baseFeePerGas) {
    const target = block.gasLimit.div(2);
    if (block.gasUsed.gt(target)) {
      const diff = block.gasUsed.sub(target);
      expectedBaseFee = block.baseFeePerGas.add(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000));
    } else {
      const diff = target.sub(block.gasUsed);
      expectedBaseFee = block.baseFeePerGas.sub(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000));
    }
  }
  return expectedBaseFee;
};
