import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AssetType } from 'caip';
import { ContractTransaction } from 'ethers';
import { deployments, ethers } from 'hardhat';
import {
  AddressTranslator,
  IQSpace,
  WarperPresetFactoryAdapter,
  WarperPresetId,
  WARPER_PRESET_ERC721_IDS,
} from '../src';
import { ERC721ConfigurablePreset, ERC721Mock, IMetahub, IWarperPresetFactory } from '../src/contracts';
import { grantSupervisorRole } from './helpers/acl';
import { setupUniverse } from './helpers/setup';
import { toAccountId } from './helpers/utils';
import { findWarperByDeploymentTransaction } from './helpers/warper';

/**
 * @group integration
 */
describe('WarperPresetFactoryAdapter', () => {
  /** Signers */
  let deployer: SignerWithAddress;
  let supervisor: SignerWithAddress;

  /** Contracts */
  let metahub: IMetahub;
  let warperPresetFactory: IWarperPresetFactory;
  let warperPreset: ERC721ConfigurablePreset;
  let collection: ERC721Mock;

  /** SDK */
  let warperPresetFactoryAdapter: WarperPresetFactoryAdapter;
  let supervisorWarperPresetFactoryAdapter: WarperPresetFactoryAdapter;

  beforeEach(async () => {
    await deployments.fixture();

    deployer = await ethers.getNamedSigner('deployer');
    supervisor = await ethers.getNamedSigner('supervisor');

    metahub = await ethers.getContract('Metahub');
    warperPresetFactory = await ethers.getContract('WarperPresetFactory');
    warperPreset = await ethers.getContract('ERC721ConfigurablePreset');
    collection = await ethers.getContract('ERC721Mock');

    const iqspace = await IQSpace.init({ signer: deployer });
    const sIqspace = await await IQSpace.init({ signer: supervisor });
    warperPresetFactoryAdapter = iqspace.warperPresetFactory(toAccountId(warperPresetFactory.address));
    supervisorWarperPresetFactoryAdapter = sIqspace.warperPresetFactory(toAccountId(warperPresetFactory.address));

    await setupUniverse();
    await grantSupervisorRole();
  });

  describe('deployPreset', () => {
    let tx: ContractTransaction;

    beforeEach(async () => {
      tx = await warperPresetFactoryAdapter.deployPreset(WarperPresetId.ERC721_CONFIGURABLE_PRESET, {
        metahub: toAccountId(metahub.address),
        original: AddressTranslator.createAssetType(toAccountId(collection.address), 'erc721'),
      });
    });

    it('should deploy warper from a preset', async () => {
      const warper = await findWarperByDeploymentTransaction(tx.hash);
      expect(warper).toBeDefined();
      expect(warper?.length).toBeGreaterThan(0);
    });

    describe('findWarperByDeploymentTransaction', () => {
      let reference: AssetType;

      beforeEach(async () => {
        const warper = await findWarperByDeploymentTransaction(tx.hash);
        reference = AddressTranslator.createAssetType(toAccountId(warper!), 'erc721');
      });

      it('should return warper reference from deployment transaction', async () => {
        const warperReference = await warperPresetFactoryAdapter.findWarperByDeploymentTransaction(tx.hash);
        expect(warperReference).toBeDefined();
        expect(warperReference).toMatchObject(reference);
      });
    });
  });

  describe('preset', () => {
    it('it should return warper preset info', async () => {
      const preset = await warperPresetFactoryAdapter.preset(WarperPresetId.ERC721_CONFIGURABLE_PRESET);
      expect(preset.id).toBe(WarperPresetId.ERC721_CONFIGURABLE_PRESET);
      expect(preset.implementation.address).toBe(warperPreset.address);
      expect(preset.enabled).toBe(true);
    });
  });

  describe('presets', () => {
    it('it should return list of warper presets', async () => {
      const presets = await warperPresetFactoryAdapter.presets();
      const preset = presets[0];
      expect(preset.id).toBe(WarperPresetId.ERC721_CONFIGURABLE_PRESET);
      expect(preset.implementation.address).toBe(warperPreset.address);
      expect(preset.enabled).toBe(true);
    });
  });

  describe('enablePreset', () => {
    beforeEach(async () => {
      await warperPresetFactory.connect(supervisor).disablePreset(WARPER_PRESET_ERC721_IDS.ERC721_CONFIGURABLE_PRESET);
    });

    it('should enable the warper preset', async () => {
      await supervisorWarperPresetFactoryAdapter.enablePreset(WarperPresetId.ERC721_CONFIGURABLE_PRESET);
      expect(await warperPresetFactory.presetEnabled(WARPER_PRESET_ERC721_IDS.ERC721_CONFIGURABLE_PRESET)).toBe(true);
    });
  });

  describe('disablePreset', () => {
    it('should disable the warper preset', async () => {
      await supervisorWarperPresetFactoryAdapter.disablePreset(WarperPresetId.ERC721_CONFIGURABLE_PRESET);
      expect(await warperPresetFactory.presetEnabled(WARPER_PRESET_ERC721_IDS.ERC721_CONFIGURABLE_PRESET)).toBe(false);
    });
  });

  describe('presetEnabled', () => {
    describe('when disabled', () => {
      beforeEach(async () => {
        await warperPresetFactory
          .connect(supervisor)
          .disablePreset(WARPER_PRESET_ERC721_IDS.ERC721_CONFIGURABLE_PRESET);
      });

      it('should return false', async () => {
        const enabled = await warperPresetFactoryAdapter.presetEnabled(WarperPresetId.ERC721_CONFIGURABLE_PRESET);
        expect(enabled).toBe(false);
      });
    });

    describe('when enabled', () => {
      it('should return true', async () => {
        const enabled = await warperPresetFactoryAdapter.presetEnabled(WarperPresetId.ERC721_CONFIGURABLE_PRESET);
        expect(enabled).toBe(true);
      });
    });
  });
});
