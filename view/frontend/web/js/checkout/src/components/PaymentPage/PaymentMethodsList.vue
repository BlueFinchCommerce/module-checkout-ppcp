<template>
  <div class="ppcp-payment-methods-list">
      <!--components added here from PaymentMethods-->
  </div>
</template>

<script>
import { mapState } from 'pinia';
import usePpcpStore from '../../stores/PpcpStore';

export default {
  name: 'PpcpPaymentPage',
  computed: {
    ...mapState(usePpcpStore, [
      'apple',
      'google',
      'venmo',
      'paypal',
      'card',
    ]),
  },
};
</script>

<style lang='scss'>
@import './paymentMethods.scss';
</style>
