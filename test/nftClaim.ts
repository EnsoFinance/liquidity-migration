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
        MockLiquidityMigration: ContractFactory,
        MockStrategy: ContractFactory,
        ERC1155: ContractFactory,
        Claimable: ContractFactory,
        claimable: Contract,
        liquidityMigration: Contract,
        erc1155: Contract,
        strategies: Contract[],
        strategyAddr: String[],
        initialURI = 'https://token-cdn-domain/{id}.json',
        state = [0, 1, 2], // 0 = pending, 1 = active, 2 = closed
        name = 'degen',
        decimals = 18,
        supply = 100,
        emptyAddress = "0x0000000000000000000000000000000000000000",
        stake = (10 * decimals),
        protocols = [0, 1, 2, 3, 4, 5], // 0 = dpi, 1 = TS, 2=enz, 3=ind, 4=pie, 5= bask
        max = 6

    before(async () => {
        accounts = await ethers.getSigners();
        user = accounts[0];
        attacker = accounts[10];
        strategies = [];
    
        MockLiquidityMigration = await ethers.getContractFactory("MockLiquidityMigration");
        ERC1155 = await ethers.getContractFactory("Root1155");
        MockStrategy = await ethers.getContractFactory("MockStrategy");
        Claimable = await ethers.getContractFactory("Claimable");
    });

    const initialize = async (name:string, tests:any) => {
        describe(name, () => {
            before(async () => {
                strategyAddr = [];
                liquidityMigration = await MockLiquidityMigration.deploy();
                erc1155 = await ERC1155.deploy(initialURI);
                for (let i = 0; i < protocols.length; i++) {
                    strategies.push(await MockStrategy.deploy(name, decimals))
                    strategies[i].mint(user.address, stake);
                }
                claimable = await Claimable.deploy(
                    liquidityMigration.address,
                    erc1155.address,
                    max
                );
            });
            tests();
        });
    }

    const collectInitialize = async (name:string, tests:any) => {
        describe(name, () => {
            before(async () => {
                await erc1155.create(
                    claimable.address,
                    supply,
                    initialURI,
                    "0x"
                )
            });
            tests();
        });
    }
    
    const stakeAll = async (name:string, starting:number, tests:any) => {
        describe(name, () => {
            before(async () => {
                await claimable.stateChange(state[1])
                for (let i = starting; i < protocols.length; i++) {
                    await strategies[i].approve(liquidityMigration.address, stake)
                    await liquidityMigration.stake(strategies[i].address, stake, protocols[i])
                    await erc1155.create(
                        claimable.address,
                        supply,
                        initialURI,
                        "0x"
                    )
                    strategyAddr.push(strategies[i].address);
                }
            });
        tests();
        });
    }

    initialize('deployed', () => {
        describe('validate set constructor', () => {
            it('collection valid', async () => {
                expect(await claimable.collection()).to.equal(erc1155.address);
            });
            it('migration valid', async () => {
                expect(await claimable.migration()).to.equal(liquidityMigration.address);
            });
        });
    })
    initialize('stateChange', () => {
        describe('non-functional', () => {
            it('revert when not owner', async () => {
                await expect(claimable.connect(attacker).stateChange(state[1]))
                .to.be.revertedWith('Ownable: caller is not the owner')
            });
            it('revert when current state', async () => {
                await expect(claimable.stateChange(await claimable.state()))
                .to.be.revertedWith('Claimable#changeState: current')
            });
        });
        describe('functional', () => {
            beforeEach(async () => {
                await claimable.stateChange(state[1])
            });
            it('state updated', async () => {
                expect(await claimable.state()).to.equal(state[1])
            });
        });
    });
    initialize('updateMigration', () => {
        let changeTo: Contract;
        before(async () => {
            changeTo = await MockLiquidityMigration.deploy();
        });
        describe('non-functional', () => {
            it('revert when not owner', async () => {
                await expect(claimable.connect(attacker).updateMigration(changeTo.address))
                .to.be.revertedWith('Ownable: caller is not the owner')
            });
            it('revert when current', async () => {
                await expect(claimable.updateMigration(liquidityMigration.address))
                .to.be.revertedWith('Claimable#UpdateMigration: exists')
            });
        });
        describe('functional', () => {
            before(async () => {
                await claimable.updateMigration(changeTo.address)
            });
            it('migration updated', async () => {
                expect(await claimable.migration()).to.equal(changeTo.address)
            });
        });
    });
    initialize('updateCollection', () => {
        let changeTo: Contract;
        before(async () => {
            changeTo = await ERC1155.deploy(initialURI);
        });
        describe('non-functional', () => {
            it('revert when not owner', async () => {
                await expect(claimable.connect(attacker).updateCollection(changeTo.address))
                .to.be.revertedWith('Ownable: caller is not the owner')
            });
            it('revert when current', async () => {
                await expect(claimable.updateCollection(erc1155.address))
                .to.be.revertedWith('Claimable#UpdateCollection: exists')
            });
        });
        describe('functional', () => {
            before(async () => {
                await claimable.updateCollection(changeTo.address)
            });
            it('collection updated', async () => {
                expect(await claimable.collection()).to.equal(changeTo.address)
            });
        });
    });
    describe('claim', () => {
        let staked: any[];
        let protocol = protocols[0];
        initialize('non-functional', () => {
            it('revert when incorrect state', async () => {
                await expect(claimable.claim(strategies[0].address))
                .to.be.revertedWith('Claimable#onlyState: ONLY_STATE_ALLOWED')
            });
            describe('active state', () => {
                before(async () => {
                    await claimable.stateChange(state[1])
                });
                it('revert when empty address', async () => {
                    await expect(claimable.claim(emptyAddress))
                    .to.be.revertedWith('Claimable#claim: empty address')
                });
                it('revert when no stake', async () => {
                    await expect(claimable.claim(strategies[0].address))
                    .to.be.revertedWith('Claimable#claim: Has not staked')
                });
                describe('has staked', () => {
                    before(async () => {
                        await strategies[0].approve(liquidityMigration.address, stake)
                        await liquidityMigration.stake(strategies[0].address, stake, protocol)
                    });
                    it('no NFTs avail', async () => {
                        await expect(claimable.claim(strategies[0].address))
                        .to.be.revertedWith('Claimable#claim: no NFTs left')
                    });
                    collectInitialize('collec init + state change', () => {
                        before(async () => {
                            await claimable.claim(strategies[0].address)
                        });
                        it('revert when already claimed', async () => {
                            await expect(claimable.claim(strategies[0].address))
                            .to.be.revertedWith('Claimable#claim: already claimed')
                        });
                    });
                });
            });
        });
        initialize('functional', () => {
            describe('approve migration', () => {
                before(async() => {
                    await strategies[0].approve(liquidityMigration.address, stake)
                });
                it('approval set', async () => {
                    expect(await strategies[0].allowance(user.address, liquidityMigration.address))
                    .to.equal(stake)
                });
                describe('stake', () => {
                    before(async () => {
                        await liquidityMigration.stake(strategies[0].address, stake, protocol)
                        staked = await liquidityMigration.hasStaked(user.address, strategies[0].address)
                    });
                    it('staked bool', async () => {
                        expect(staked[0]).to.equal(true)
                    });
                    it('amount valid', async () => {
                        expect(staked[1]).to.equal(protocol)
                    });
                    collectInitialize('collection initialized', async () => {
                        it('claimable balance', async () => {
                            expect(await erc1155.balanceOf(claimable.address, protocol))
                            .to.equal(supply)
                        });
                        describe('update state', () => {
                            before(async () => {
                                await claimable.stateChange(state[1])
                            });
                            describe('claim', () => {
                                before(async () => {
                                    await claimable.claim(strategies[0].address)
                                });
                                it('user balance', async () => {
                                    expect(await erc1155.balanceOf(user.address, protocol))
                                    .to.equal(1)
                                });
                                it('claimable blanace', async () => {
                                    expect(await erc1155.balanceOf(claimable.address, protocol))
                                    .to.equal(supply-1)
                                });
                                it('claimed updated', async () => {
                                    expect(await claimable.claimed(user.address, protocol))
                                    .to.equal(true)
                                });
                            });
                        })
                    })
                });
            });
        });
    })
    initialize('set-up claim all', () => {
        stakeAll('claim all', 0, () => {
            describe('functional', () => {
                before(async () => {
                    await claimable.claimAll(strategyAddr)
                });
                it('balances updated', async () => {
                    for (let i = 0; i < protocols.length; i++) {
                        expect(await erc1155.balanceOf(user.address, protocols[i]))
                        .to.equal(1)
                        expect(await erc1155.balanceOf(claimable.address, protocols[i]))
                        .to.equal(supply-1)
                    }
                });
                it('claimed updated', async () => {
                    for (let i = 0; i < protocols.length; i++) {
                        expect(await claimable.claimed(user.address, protocols[i]))
                        .to.equal(true)
                    }
                });
            })
            describe('non-functional', () => {
                let greater: String[] = []
                let deployed: Contract[] = []
                describe('deploy additonal strategy', () => {
                    before(async () => {
                        for (let i = 0; i < 2; i++) {
                            deployed.push(await MockStrategy.deploy(name, decimals))
                            greater.push(deployed[i].address)
                        }
                        greater.push(...strategyAddr)
                    });
                    it('revert over pass', async () => {
                        await expect(claimable.claimAll(greater))
                        .to.be.revertedWith('Claimable#master: incorrect length')
                    });
                });
            });
        })
    })
    describe('master', () => {
        initialize('non-functional', () => {
            collectInitialize('NFT 0', () => {
                before(async () => {
                    await claimable.stateChange(state[1])
                    await strategies[0].approve(liquidityMigration.address, stake)
                    await liquidityMigration.stake(strategies[0].address, stake, 0)
                    await claimable.claim(strategies[0].address)
                });
                it('revert when not all staked', async () => {
                    await expect(claimable.master())
                    .to.be.revertedWith('Claimable#master: not all')
                });
                describe('not holding', () => {
                    before(async () => {
                        await erc1155.safeTransferFrom(
                            user.address,
                            attacker.address,
                            0,
                            1,
                            "0x"
                        )
                    });
                    it('revert when not holding NFT', async () => {
                        await expect(claimable.master())
                        .to.be.revertedWith('Claimable#master: not holding')
                    });
                });
            })
        });
        initialize('functional', () => {
            stakeAll('stake all', 0, () => {
                before(async () => {
                    await claimable.claimAll(strategyAddr)
                });
                collectInitialize('master NFT deployed', () => {
                    it('master deployed', async () => {
                        expect(await erc1155.getMaxTokenID()-1)
                        .to.equal(await claimable.max())
                    });
                    describe('master claim', () => {
                        before(async () => {
                            await claimable.master()
                        });
                        it('user balance', async () => {
                            expect(await erc1155.balanceOf(user.address, max))
                            .to.equal(1)
                        });
                        it('claimable blanace', async () => {
                            expect(await erc1155.balanceOf(claimable.address, max))
                            .to.equal(supply-1)
                        });
                        it('claimed updated', async () => {
                            expect(await claimable.claimed(user.address, protocols.length))
                            .to.equal(true)
                        });
                        it('revert when claimed', async () => {
                            await expect(claimable.master())
                            .to.be.revertedWith('Claimable#master: claimed')
                        });
                    });
                })
            });
        });
    });
    initialize('wipe', () => {
        let start =  0,
            end = max;

        describe('non-functional', () => {
            it('reverts when not from owner', async () => {
                await expect(claimable.connect(attacker).wipe(start, end))
                .to.be.revertedWith('Ownable: caller is not the owner')
            });
            it('revert mix numbers', async () => {
                await expect(claimable.wipe(end, start))
                .to.be.revertedWith('Claimable#Wipe: range out')
            });
            it('revert greater than max', async () => {
                await expect(claimable.wipe(start, (end+1)))
                .to.be.revertedWith('Claimable#Wipe: out of bounds')
            });
        });
        describe('functional', () => {
            describe('NFTs', () => {
                before(async () => {
                    for (let i = 0; i < max; i++) {
                        await erc1155.create(
                            claimable.address,
                            supply,
                            initialURI,
                            "0x"
                        )
                    }
                });
                describe('wipe it', () => {
                    before(async () => {
                        await claimable.wipe(start, end)
                    });
                    it('balance updated', async () => {
                        for (let i = 0; i < max; i++) {
                            expect(await erc1155.balanceOf(user.address, i))
                            .to.equal(0)
                        }
                    });
                });
            });
        });
    });
});
