<template>
  <template v-if="isPPCPenabled">
    <div class="ppcp-payment-icons">
      <ul
        class="pay-with__column"
        v-if="filteredPaymentIcons.length > 0">
        <template v-for="(paymentType, index) in filteredPaymentIcons" :key="index">
          <li class="pay-with__content">
            <img
              :src="getIcon(paymentType.name)"
              :alt="paymentType.name"
              :class="generateClass(paymentType.name)"
              :data-cy="generateDataCY(paymentType.name, 'ppcp')"
            />
          </li>
        </template>
      </ul>
    </div>
  </template>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import PpcpStore from '../../stores/PpcpStore';

// Icons
import ApplePaySvg from '../../icons/payments/colour/applepaymark.png';
import GooglePaySvg from '../../icons/payments/colour/googlepaymark.png';
import PayPalSvg from '../../icons/payments/colour/paypal.png';
import VenmoSvg from '../../icons/payments/colour/Venmo-Logo.png';

export default {
  name: 'PpcpPaymentIcons',
  async created() {
    const [cartStore, configStore] = await window.bluefinchCheckout.helpers.loadFromCheckout([
      'stores.useCartStore',
      'stores.useConfigStore',
    ]);

    await configStore.getInitialConfig();
    await cartStore.getCart();
    await this.setPaymentIcons();
  },
  computed: {
    ...mapState(PpcpStore, ['isPPCPenabled', 'ppcpPaymentsIcons']),

    // Filter only supported payment methods
    filteredPaymentIcons() {
      const supportedIcons = ['ppcp_applepay', 'ppcp_paypal', 'ppcp_googlepay', 'ppcp_venmo'];
      return this.ppcpPaymentsIcons.filter((icon) => supportedIcons.includes(icon.name));
    },
  },
  methods: {
    ...mapActions(PpcpStore, ['getInitialConfigValues', 'setPaymentIcons']),

    getIcon(paymentName) {
      switch (paymentName) {
        case 'ppcp_applepay':
          return ApplePaySvg;
        case 'ppcp_paypal':
          return PayPalSvg;
        case 'ppcp_googlepay':
          return GooglePaySvg;
        case 'ppcp_venmo':
          return VenmoSvg;
        default:
          return '';
      }
    },

    generateClass(paymentName) {
      // Convert paymentType.name to lowercase and replace spaces with underscores
      return paymentName.toLowerCase().replace(/\s+/g, '_');
    },

    generateDataCY(paymentIconName, serviceProvider) {
      let iconName = paymentIconName;

      if (serviceProvider === 'ppcp') {
        const match = paymentIconName.match(/\/logos\/(.*?)\.(svg|png)/);
        if (match) {
          [, iconName] = match;
        }
      }

      return `footer-${serviceProvider}-${iconName}-icon`;
    },
  },
};
</script>

<style lang="scss">
@import "./PaymentIconsStyles";
</style>
