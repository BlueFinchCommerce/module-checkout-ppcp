<template>
  <div class="ppcp-payment-methods-list" v-if="dataLoaded && isPPCPenabled">
    <component
      v-for="(method, index) in sortedPaymentMethods"
      :key="index"
      v-bind="{ open: index === 0 }"
      :is="method.component"
    />
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../stores/PpcpStore';

// Components
import PpcpGooglePayPayment from './PaymentMethods/GooglePay/GooglePay.vue';
import PpcpApplePayPayment from './PaymentMethods/ApplePay/ApplePay.vue';
import PpcpPayPalPayment from './PaymentMethods/PayPal/PayPal.vue';
import PpcpVenmoPayment from './PaymentMethods/Venmo/Venmo.vue';
import PpcpCreditCardPayment from './PaymentMethods/CreditCard/CreditCard.vue';
import PpcpApmPayment from './PaymentMethods/Apm/Apm.vue';
import PpcpFastlanePayment from './PaymentMethods/Fastlane/Fastlane.vue';

export default {
  name: 'PpcpPaymentPage',
  data() {
    return {
      PpcpGooglePayPayment: null,
      PpcpApplePayPayment: null,
      PpcpPayPalPayment: null,
      PpcpVenmoPayment: null,
      PpcpCreditCardPayment: null,
      PpcpApmPayment: null,
      PpcpFastlanePayment: null,
      dataLoaded: false,
      userLoggedIn: false,
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'isPPCPenabled',
      'apple',
      'google',
      'venmo',
      'paypal',
      'card',
      'apm',
      'fastlane',
    ]),
    computed: {
      sortedPaymentMethods() {
        const fastlaneActive = this.fastlane.enabled && !this.userLoggedIn;

        const regular = [
          { ...this.google, component: this.PpcpGooglePayPayment },
          { ...this.apple, component: this.PpcpApplePayPayment },
          { ...this.paypal, component: this.PpcpPayPalPayment },
          { ...this.venmo, component: this.PpcpVenmoPayment },
          { ...this.apm, component: this.PpcpApmPayment },
          {
            ...this.card,

            component: fastlaneActive
              ? this.PpcpFastlanePayment
              : this.PpcpCreditCardPayment,

            sortOrder: fastlaneActive
              ? -999
              : this.card.sortOrder,
          },
        ];

        return regular
          .filter((m) => m.enabled)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },
    },
  },
  async created() {
    const [
      cartStore,
      configStore,
      loadingStore,
      customerStore,
    ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
      'stores.useCartStore',
      'stores.useConfigStore',
      'stores.useLoadingStore',
      'stores.useCustomerStore',
    ]);

    loadingStore.setLoadingState(true);

    this.PpcpGooglePayPayment = PpcpGooglePayPayment;
    this.PpcpApplePayPayment = PpcpApplePayPayment;
    this.PpcpPayPalPayment = PpcpPayPalPayment;
    this.PpcpCreditCardPayment = PpcpCreditCardPayment;
    this.PpcpVenmoPayment = PpcpVenmoPayment;
    this.PpcpApmPayment = PpcpApmPayment;
    this.PpcpFastlanePayment = PpcpFastlanePayment;

    await configStore.getInitialConfig();
    await cartStore.getCart();
    await this.getInitialConfigValues();

    this.userLoggedIn = customerStore.isLoggedIn;
    if (this.userLoggedIn) {
      await this.getVaultedMethodsData();
    }
    this.dataLoaded = true;
    loadingStore.setLoadingState(false);
  },
  methods: {
    ...mapActions(usePpcpStore, ['getInitialConfigValues', 'getVaultedMethodsData']),
  },
};
</script>

<style lang='scss'>
@import './paymentMethods.scss';
</style>
