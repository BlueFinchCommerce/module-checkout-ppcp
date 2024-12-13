<template>
  {{Object.values(vaultedMethods).length}}
</template>

<script>

// Stores
import { mapActions, mapState } from 'pinia';
import PpcpStore from '../../../stores/PpcpStore';

export default {
  name: 'VaultedMethodsList',
  data() {
    return {
      loading: false,
    };
  },
  computed: {
    ...mapState(PpcpStore, [
      'vaultedMethods',
      'selectedVaultMethod',
    ]),
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== 'ppcp-vaulted') {
          this.unselectVaultedMethods();
        }
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    ...mapActions(PpcpStore, [
      'selectVaultedMethod',
      'unselectVaultedMethods',
    ]),

    async selectPaymentCard(vaultedMethod) {
      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      // If the method is the same as the one already selected then we can return early.
      if (this.selectedVaultMethod && vaultedMethod.publicHash === this.selectedVaultMethod.publicHash) {
        return;
      }

      paymentStore.setErrorMessage('');
      await this.selectVaultedMethod(vaultedMethod);
    },

    async startPayment() {
      // const [
      //   paymentStore,
      //   agreementStore,
      //   captchaStore,
      // ] = await window.geneCheckout.helpers.loadFromCheckout([
      //   'stores.usePaymentStore',
      //   'stores.useAgreementStore',
      //   'stores.useRecaptchaStore',
      // ]);
      //
      // paymentStore.setErrorMessage('');
      //
      // if (!agreementStore.validateAgreements() || !captchaStore.validateToken('placeOrder')) {
      //   return;
      // }
    },

    getPaymentData(response) {
      const { publicHash } = this.selectedVaultMethod;

      return {
        paymentMethod: {
          method: 'ppcp_cc_vault',
          additional_data: {
            payment_method_nonce: response.nonce,
            public_hash: publicHash,
          },
          extension_attributes: window.geneCheckout.helpers.getPaymentExtensionAttributes(),
        },
      };
    },

    redirectToSuccess() {
      window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
    },
  },
};
</script>

<style lang="scss">
@import "./vaultedMethods.scss";
</style>
