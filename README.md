# Liquidity Migrations

## Usage

### Pre Requisites

Before running any command, make sure to install dependencies:

```sh
$ yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

### Kovan Deployment

LiquidityMigration:  0x22ebfB49e90f6616cdaC97Fef3F159bb56d601Ec

TokenSetAdapter:  0xd96B848eBbd0E2DDF192E1d9a66AD70523B157f6

IndexedAdapter:  0x4006c6232dA6dcC13D06b0a77F970808293742b4

PieDaoAdapter:  0x0Af5858Dbdc203428021A6b511bADcb4a07c08A3
