<template>
  <div
    v-if="paypal.showOnTopCheckout && paypal.enabled"
    :id="`ppcp-express-paypal`"
    class="paypal-express--button-container"
    :class="!paypalLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-ppcpPayPal'"
  />
  <div
    v-if="paypal.showOnTopCheckout && paypal.payLaterActive"
    :id="`ppcp-express-paylater`"
    class="paypal-express--button-container"
    :class="!paypalLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-ppcpPayLater'"
  />
  <div
    v-if="paypal.showOnTopCheckout && paypal.payLaterMessageActive"
    :id="`ppcp-express-messages`"
    :class="!paypalLoaded ? 'text-loading' : ''"
    class="paypal-messages-container"
    :data-cy="'instant-checkout-ppcpMessages'"
  />
</template>

<script>
/* eslint-disable import/no-extraneous-dependencies */
import ppcp from 'ppcp-web';
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../stores/PpcpStore';

// Services
import createPPCPPaymentRest from '../../../services/createPPCPPaymentRest';
import changeShippingMethod from '../../../services/changeShippingMethod';
import changeShippingAddress from '../../../services/changeShippingAddress';
import finishPpcpOrder from '../../../services/finishPpcpOrder';
import getTotals from '../../../services/getTotals';

export default {
  name: 'PpcpPayPal',
  data() {
    return {
      key: 'ppcpPayPal',
      method: 'ppcp_paypal',
      namespace: 'paypal_ppcp_paypal',
      orderID: null,
      paypalLoaded: false,
      address: {},
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'paypal',
      'environment',
      'buyerCountry',
      'productionClientId',
      'sandboxClientId',
    ]),
  },
  async created() {
    const [
      cartStore,
      paymentStore,
      configStore,
    ] = await window.geneCheckout.helpers.loadFromCheckout([
      'stores.useCartStore',
      'stores.usePaymentStore',
      'stores.useConfigStore',
    ]);

    paymentStore.addExpressMethod(this.key);
    await configStore.getInitialConfig();
    await cartStore.getCart();

    const paypalPayConfig = paymentStore.availableMethods.find((method) => (
      method.code === this.method
    ));

    if (paypalPayConfig) {
      await this.getInitialConfigValues();
      if (this.paypal.showOnTopCheckout && this.paypal.enabled) {
        await this.renderPaypalInstance();
        await this.waitForButtonsToRender();
        this.paypalLoaded = true;
      } else {
        paymentStore.removeExpressMethod(this.key);
        this.paypalLoaded = true;
      }
    }
  },
  methods: {
    ...mapActions(usePpcpStore, ['getInitialConfigValues']),

    async waitForButtonsToRender() {
      const buttonContainers = document.querySelectorAll('.paypal-express--button-container');
      const isRendered = () => Array.from(buttonContainers).every((container) => container.children.length > 0);

      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (isRendered()) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    },

    async renderPaypalInstance() {
      const [
        cartStore,
        configStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const self = this;
      const element = 'ppcp-express';

      const configuration = {
        sandboxClientId: this.sandboxClientId,
        productionClientId: this.productionClientId,
        intent: this.paypal.paymentAction,
        pageType: 'checkout',
        environment: this.environment,
        commit: true,
        amount: cartStore.cart.prices.grand_total.value,
        buyerCountry: this.buyerCountry,
        currency: configStore.currencyCode,
        isPayLaterEnabled: this.paypal.payLaterActive,
        isPayLaterMessagingEnabled: this.paypal.payLaterMessageActive,
        messageStyles: {
          layout: this.paypal.payLaterMessageLayout,
          logo: {
            type: this.paypal.payLaterMessageLogoType,
            position: this.paypal.payLaterMessageLogoPosition,
          },
          text: {
            size: this.paypal.payLaterMessageTextSize,
            color: this.paypal.payLaterMessageColour,
            align: this.paypal.payLaterMessageTextAlign,
          },
        },
        buttonStyles: {
          paypal: {
            buttonLabel: this.paypal.buttonLabel,
            buttonSize: 'responsive',
            buttonShape: this.paypal.buttonShape,
            buttonColor: this.paypal.buttonColor,
            buttonTagline: false,
          },
          paylater: {
            buttonShape: this.paypal.payLaterButtonShape,
            buttonColor: this.paypal.payLaterButtonColour,
          },
        },
        buttonHeight: 40,
      };

      const callbacks = {
        createOrder: () => this.createOrder(self),
        onApprove: () => this.onApprove(self),
        onClick: () => this.onClick(),
        onCancel: () => this.onCancel(),
        onError: (err) => this.onError(err),
        onShippingAddressChange: (data) => this.onShippingAddressChange(self, data),
        onShippingOptionsChange: (data) => this.onShippingOptionsChange(self, data),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.paypalButtons(options, element);
    },

    createOrder: async (self) => {
      try {
        const data = await createPPCPPaymentRest(self.method);
        const orderData = JSON.parse(data);

        const [orderID] = orderData;

        /* eslint-disable no-param-reassign */
        self.orderID = orderID;

        return self.orderID;
      } catch (error) {
        console.error('Error during createOrder:', error);
        return null;
      }
    },

    onClick: async () => {
      const [
        paymentStore,
        shippingMethodsStore,
        agreementStore,
        loadingStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useShippingMethodsStore',
        'stores.useAgreementStore',
        'stores.useLoadingStore',
      ]);

      paymentStore.setErrorMessage('');
      const agreementsValid = agreementStore.validateAgreements();

      if (!agreementsValid) {
        return false;
      }

      await shippingMethodsStore.setNotClickAndCollect();
      loadingStore.setLoadingState(true);
      return true;
    },

    onShippingAddressChange: async (self, data) => {
      /* eslint-disable no-param-reassign */
      self.address = await self.mapAddress(data.shippingAddress);

      return getTotals(
        self.address,
        '',
        '',
        false,
      ).then(async () => changeShippingAddress(
        self.orderID,
        JSON.stringify(data.shippingAddress),
        self.method,
      )).catch(async (error) => {
        const [
          paymentStore,
          loadingStore,
        ] = await window.geneCheckout.helpers.loadFromCheckout([
          'stores.usePaymentStore',
          'stores.useLoadingStore',
        ]);

        loadingStore.setLoadingState(false);
        paymentStore.setErrorMessage(error);
      });
    },

    onShippingOptionsChange: async (self, data) => {
      const [carrierCode, ...methodCode] = data.selectedShippingOption.id.split('_');

      return getTotals(
        self.address,
        carrierCode,
        methodCode.join('_'),
        true,
      ).then(async () => changeShippingMethod(
        self.orderID,
        JSON.stringify(data.selectedShippingOption),
        self.method,
      )).catch(async (error) => {
        const [
          paymentStore,
          loadingStore,
        ] = await window.geneCheckout.helpers.loadFromCheckout([
          'stores.usePaymentStore',
          'stores.useLoadingStore',
        ]);

        loadingStore.setLoadingState(false);
        paymentStore.setErrorMessage(error);
      });
    },

    onApprove: async (self) => {
      const [
        paymentStore,
        loadingStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useLoadingStore',
      ]);
      try {
        const finishOrderResponse = await finishPpcpOrder({
          orderId: self.orderID,
          method: self.method,
        });
        if (finishOrderResponse !== null) {
          self.redirectToSuccess();
        } else {
          loadingStore.setLoadingState(false);
          paymentStore.setErrorMessage('Something went wrong. Please check your address.');
        }
      } catch (error) {
        loadingStore.setLoadingState(false);
        paymentStore.setErrorMessage(error);
      }
    },

    onCancel: async () => {
      const [
        customerStore,
        loadingStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCustomerStore',
        'stores.useLoadingStore',
      ]);

      loadingStore.setLoadingState(false);
      customerStore.createNewAddress('shipping');
    },

    onError: async (err) => {
      const [
        paymentStore,
        loadingStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useLoadingStore',
      ]);
      loadingStore.setLoadingState(false);
      paymentStore.setErrorMessage(err);
    },

    async mapAddress(shippingAddress) {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      return {
        city: shippingAddress.city,
        country_id: shippingAddress.countryCode,
        postcode: shippingAddress.postalCode,
        region: shippingAddress.state !== undefined ? shippingAddress.state : '',
        region_id: configStore.getRegionId(shippingAddress.countryCode, shippingAddress.state),
      };
    },

    redirectToSuccess() {
      window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
    },
  },
};
</script>

<style lang="scss">
@import "../expressPayments.scss";
</style>
