<template>
  <div class="ppcp-payment-methods-list">
    <component
      v-if="google.enabled"
      :is="PpcpGooglePayPayment"
    />
    <component
      v-if="apple.enabled"
      :is="PpcpApplePayPayment"
    />
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../stores/PpcpStore';

// Components
import PpcpGooglePayPayment from './PaymentMethods/GooglePay/GooglePay.vue';
import PpcpApplePayPayment from './PaymentMethods/ApplePay/ApplePay.vue';

export default {
  name: 'PpcpPaymentPage',
  data() {
    return {
      PpcpGooglePayPayment: null,
      PpcpApplePayPayment: null,
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'apple',
      'google',
      'venmo',
      'paypal',
      'card',
    ]),
  },
  async created() {
    this.PpcpGooglePayPayment = PpcpGooglePayPayment;
    this.PpcpApplePayPayment = PpcpApplePayPayment;
    const [
      cartStore,
      configStore,
    ] = await window.geneCheckout.helpers.loadFromCheckout([
      'stores.useCartStore',
      'stores.useConfigStore',
    ]);

    await configStore.getInitialConfig();
    await cartStore.getCart();
    await this.getInitialConfigValues();
  },
  methods: {
    ...mapActions(usePpcpStore, ['getInitialConfigValues']),
  },
};
</script>

<style lang='scss'>
@import './paymentMethods.scss';
</style>
