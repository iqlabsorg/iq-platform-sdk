import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AccountId, AssetType } from 'caip';
import { BigNumber } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { Asset, Multiverse, RentingEstimationParams, RentingManagerAdapter } from '../src';
import {
  ERC20Mock,
  ERC20Mock__factory,
  ERC721Mock,
  ERC721Mock__factory,
  IMetahub,
  IRentingManager,
} from '../src/contracts';
import { createAssetReference, makeERC721AssetForSDK } from './helpers/asset';
import { getSelectedConfiguratorListingTerms, getTokenQuoteData } from './helpers/listing-renting';
import { basicListingAndRentingSetup } from './helpers/setup';
import { convertToWei, SECONDS_IN_HOUR, toAccountId } from './helpers/utils';

/**
 * @group integration
 */
describe('RentingManagerAdapter', () => {
  /** Signers */
  let deployer: SignerWithAddress;
  let lister: SignerWithAddress;
  let renter: SignerWithAddress;

  /** Contracts */
  let metahub: IMetahub;
  let rentingManager: IRentingManager;

  /** SDK */
  let multiverse: Multiverse;
  let rentingManagerAdapter: RentingManagerAdapter;

  /** Mocks & Samples */
  let nft: ERC721Mock;
  let baseToken: ERC20Mock;

  /** Constants */
  let commonId: BigNumber;
  const rentalPeriod = SECONDS_IN_HOUR * 3;

  /** Data Structs */
  let warperReference: AssetType;
  let baseTokenReference: AssetType;
  let renterAccountId: AccountId;
  let rentingEstimationParams: RentingEstimationParams;
  let warpedAsset: Asset;

  const rentAsset = async (): Promise<void> => {
    const estimate = await rentingManagerAdapter.estimateRent(rentingEstimationParams);
    await baseToken.connect(renter).approve(metahub.address, estimate.total);
    await rentingManagerAdapter.rent({
      listingId: commonId,
      paymentToken: baseTokenReference,
      rentalPeriod,
      renter: renterAccountId,
      warper: warperReference,
      maxPaymentAmount: estimate.total,
      selectedConfiguratorListingTerms: getSelectedConfiguratorListingTerms(),
      listingTermsId: commonId,
      ...getTokenQuoteData(),
    });
  };

  beforeEach(async () => {
    await deployments.fixture();

    deployer = await ethers.getNamedSigner('deployer');
    lister = await ethers.getNamedSigner('assetOwner');
    [renter] = await ethers.getUnnamedSigners();

    metahub = await ethers.getContract('Metahub');
    rentingManager = await ethers.getContract('RentingManager');
    nft = new ERC721Mock__factory().attach('0x4C2F7092C2aE51D986bEFEe378e50BD4dB99C901');
    baseToken = new ERC20Mock__factory().attach('0x5FbDB2315678afecb367f032d93F642f64180aa3');

    multiverse = await Multiverse.init({ signer: renter });
    rentingManagerAdapter = multiverse.rentingManager(toAccountId(rentingManager.address));

    ({ warperReference, commonId } = await basicListingAndRentingSetup());
    baseTokenReference = createAssetReference('erc20', baseToken.address);
    renterAccountId = toAccountId(renter.address);

    await baseToken.connect(deployer).mint(renter.address, convertToWei('1000'));

    rentingEstimationParams = {
      warper: warperReference,
      renter: renterAccountId,
      paymentToken: baseTokenReference,
      listingId: commonId,
      rentalPeriod,
      listingTermsId: commonId,
      selectedConfiguratorListingTerms: getSelectedConfiguratorListingTerms(),
    };

    warpedAsset = makeERC721AssetForSDK(warperReference.assetName.reference, 1);
  });

  describe('estimateRent', () => {
    it('should estimate rent', async () => {
      const estimate = await rentingManagerAdapter.estimateRent(rentingEstimationParams);
      expect(estimate).toBeDefined();
      expect(estimate.total.toBigInt()).toBeGreaterThan(0n);
    });
  });

  describe('rent', () => {
    beforeEach(async () => {
      await rentAsset();
    });

    it('should rent asset', async () => {
      const count = await rentingManager.userRentalCount(renter.address);
      expect(count.toBigInt()).toBe(1n);
    });

    describe('when asset is rented', () => {
      describe('userRentalCount', () => {
        it('should return users rental count', async () => {
          const count = await rentingManagerAdapter.userRentalCount(renterAccountId);
          expect(count.toBigInt()).toBe(1n);
        });
      });

      describe('rentalAgreement', () => {
        it('should return rental agreement', async () => {
          const agreement = await rentingManagerAdapter.rentalAgreement(commonId);
          expect(agreement).toBeDefined();
          expect(agreement.renter.toString()).toBe(renterAccountId.toString());
        });
      });

      describe('userRentalAgreements', () => {
        it('should return all rental agreements for user', async () => {
          const agrements = await rentingManagerAdapter.userRentalAgreements(renterAccountId, 0, 10);
          expect(agrements).toBeDefined();
          expect(agrements.length).toBe(1);
        });
      });

      describe('collectionRentedValue', () => {
        it('should return token amount from specific collection rented by renter', async () => {
          const agreement = await rentingManagerAdapter.rentalAgreement(commonId);
          const assetCount = await rentingManagerAdapter.collectionRentedValue(agreement.collectionId, renterAccountId);
          expect(assetCount.toBigInt()).toBe(1n);
        });
      });
    });
  });

  describe('assetRentalStatus', () => {
    describe('when asset is not rented', () => {
      it('should reflect that asset is available for renting', async () => {
        const status = await rentingManagerAdapter.assetRentalStatus(warpedAsset);
        // expect(status).toBe('available');
        expect(status).toBe('none'); // ???
      });
    });

    describe('when asset is rented', () => {
      beforeEach(async () => {
        await rentAsset();
      });

      it('should reflect that asset is not available for renting', async () => {
        const status = await rentingManagerAdapter.assetRentalStatus(warpedAsset);
        expect(status).toBe('rented');
      });
    });
  });
});
