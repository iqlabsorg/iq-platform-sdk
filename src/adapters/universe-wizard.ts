import { AccountId, AssetType } from 'caip';
import { BytesLike, ContractTransaction } from 'ethers';
import { Adapter } from '../adapter';
import { AddressTranslator } from '../address-translator';
import { ContractResolver } from '../contract-resolver';
import { IUniverseRegistry, UniverseWizard } from '../contracts';
import { TaxTerms, UniverseParams, WarperRegistrationParams } from '../types';

export class UniverseWizardAdapter extends Adapter {
  private readonly contract: UniverseWizard;

  constructor(accountId: AccountId, contractResolver: ContractResolver, addressTranslator: AddressTranslator) {
    super(contractResolver, addressTranslator);
    this.contract = contractResolver.resolveUniverseWizard(accountId.address);
  }

  /**
   * Creates new Universe. This includes minting new universe NFT, where the caller of this method becomes the
   * universe owner.
   * @param params The universe properties & initial configuration params.
   */
  async setupUniverse(universeParams: UniverseParams): Promise<ContractTransaction> {
    const params: IUniverseRegistry.UniverseParamsStruct = {
      name: universeParams.name,
      paymentTokens: universeParams.paymentTokens.map(x => this.accountIdToAddress(x)),
    };
    return this.contract.setupUniverse(params);
  }

  /**
   * Creates new Universe and registers Warper (either deploys new one or registers existing).
   * @param universeParams The universe properties & initial configuration params.
   * @param warper Warper reference.
   * @param warperTaxTerms Warper tax terms.
   * @param warperRegistrationParams Warper registration params.
   * @param warperPresetId Warper preset ID.
   * @param warperInitData Warper init data.
   * @returns
   */
  async setupUniverseAndWarper(
    universeParams: UniverseParams,
    warper: AssetType,
    warperTaxTerms: TaxTerms,
    warperRegistrationParams: WarperRegistrationParams,
    warperPresetId: BytesLike,
    warperInitData: BytesLike,
  ): Promise<ContractTransaction> {
    const params: IUniverseRegistry.UniverseParamsStruct = {
      name: universeParams.name,
      paymentTokens: universeParams.paymentTokens.map(x => this.accountIdToAddress(x)),
    };
    return this.contract.setupUniverseAndWarper(
      params,
      warperTaxTerms,
      this.assetTypeToAddress(warper),
      warperRegistrationParams,
      warperPresetId,
      warperInitData,
    );
  }
}
