<template>
  <div>
    <p>CREDIT CARD</p>
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../../stores/PpcpStore';

// Helpers
import loadScript from '../../../../helpers/addScript';

// Services
import createPPCPPaymentRest from '../../../../services/createPPCPPaymentRest';

export default {
  name: 'PpcpCreditCardPayment',
  data() {
    return {

    };
  },
};
</script>