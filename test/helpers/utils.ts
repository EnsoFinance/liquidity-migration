import { ethers } from "hardhat";

export const defaultSigner = async () => {
  const localSigners = await ethers.getSigners();
  return localSigners[0];
};