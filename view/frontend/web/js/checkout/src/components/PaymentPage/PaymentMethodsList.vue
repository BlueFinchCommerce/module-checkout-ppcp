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
      dataLoaded: false,
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
    ]),
    sortedPaymentMethods() {
      const methods = [
        { ...this.google, component: this.PpcpGooglePayPayment },
        { ...this.apple, component: this.PpcpApplePayPayment },
        { ...this.paypal, component: this.PpcpPayPalPayment },
        { ...this.venmo, component: this.PpcpVenmoPayment },
        { ...this.card, component: this.PpcpCreditCardPayment },
        { ...this.apm, component: this.PpcpApmPayment },
      ];
      // Sort based on sortOrder
      return methods
        .filter((method) => method.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder);
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

    await configStore.getInitialConfig();
    await cartStore.getCart();
    await this.getInitialConfigValues();
    if (customerStore.isLoggedIn) {
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
