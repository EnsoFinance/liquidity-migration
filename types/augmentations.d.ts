// eslint-disable @typescript-eslint/no-explicit-any
import { Fixture } from "ethereum-waffle";

import { Signers } from "./";
import { SmartPoolRegistry } from "../typechain";

declare module "mocha" {
  export interface Context {
    smartPoolRegistry: SmartPoolRegistry;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}
