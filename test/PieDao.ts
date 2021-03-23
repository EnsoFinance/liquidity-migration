
import {ethers, waffle} from "hardhat";
import hre from "hardhat";
import { SmartPoolRegistry, SmartPoolRegistry__factory } from "../typechain";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Signers } from "../types";
import { shouldMigrateFromSmartPool } from "./PieDao.behavior";
import { PIE_DAO_REGISTRY } from "../src/constants";

const { Contract, provider } = ethers;
describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const pieDaoAdmin = "0x521946856bd1cee6efcae30a418810698a0f64a9";
    // TODO: INVALID QUANTITY
    // await hre.network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [pieDaoAdmin],
    // });
    this.signers.admin = await waffle.provider.getSigner(pieDaoAdmin);
    console.log('admin: ', await this.signers.admin.getAddress());
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {
      // const etherscanAbi = await ethers.getVerifiedContractAt(PIE_DAO_REGISTRY);

      this.smartPoolRegistry = (await SmartPoolRegistry__factory.connect(PIE_DAO_REGISTRY, this.signers.admin)) as SmartPoolRegistry;
      console.log("PieDaoRegistry: ", this.smartPoolRegistry.address);

    });

    shouldMigrateFromSmartPool();
  });
});
