<template>
  <div
    class="paypal-express--button-container"
    :id="`ppcp-express-paypal_ppcp_paypal`"
    :class="!paypalLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-ppcpPayPal'"
  />
  <div
    class="paypal-express--button-container"
    :id="`ppcp-express-paypal_ppcp_paylater`"
    :class="!paypalLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-ppcpPayLater'"
  />
  <div
    :class="!paypalLoaded ? 'text-loading' : ''"
    class="paypal-messages-container"
    :id="`ppcp-express-paypal_messages`"
    :data-cy="'instant-checkout-ppcpMessages'"
  />
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../stores/PpcpStore';

// Helpers
import loadScript from '../../../helpers/addScript';

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
      await this.addScripts();

      this.namespace = `${this.namespace}`;

      if (this.paypal.payLaterActive) {
        this.namespace = `${this.method}_paylater`;
      }

      await this.renderPaypalInstance();
    } else {
      paymentStore.removeExpressMethod(this.key);
      this.paypalLoaded = true;
    }
  },
  methods: {
    ...mapActions(usePpcpStore, ['getInitialConfigValues']),

    async addScripts() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const loadPayPalScript = loadScript();
      const params = {
        intent: this.paypal.paymentAction,
        currency: configStore.currencyCode,
        components: 'buttons',
      };

      if (this.environment === 'sandbox') {
        params['buyer-country'] = this.buyerCountry;
        params['client-id'] = this.sandboxClientId;
      } else {
        params['client-id'] = this.productionClientId;
      }

      if (this.paypal.payLaterMessageActive) {
        params.components += ',messages';
      }

      if (this.paypal.payLaterActive) {
        params['enable-funding'] = 'paylater';
      }

      return loadPayPalScript(
        'https://www.paypal.com/sdk/js',
        params,
        'ppcp_paypal',
      );
    },

    async renderPaypalInstance() {
      const cartStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);

      const commonRenderData = {
        env: this.environment,
        commit: true,
        style: {
          label: this.paypal.buttonLabel,
          size: 'responsive',
          shape: this.paypal.buttonShape,
          color: this.paypal.buttonColor,
          tagline: false,
        },
        fundingSource: this.paypal.payLaterActive
          ? window[`paypal_${this.method}`].FUNDING.PAYLATER
          : window[`paypal_${this.method}`].FUNDING.PAYPAL,
        createOrder: async () => {
          try {
            const data = await createPPCPPaymentRest(this.method);
            const orderData = JSON.parse(data);

            const [orderID] = orderData;
            this.orderID = orderID;

            return this.orderID;
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
        onShippingAddressChange: async (data) => {
          this.address = await this.mapAddress(data.shippingAddress);

          return getTotals(
            this.address,
            '',
            '',
            false,
          ).then(async () => changeShippingAddress(
            this.orderID,
            JSON.stringify(data.shippingAddress),
            this.method,
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
        onShippingOptionsChange: async (data) => {
          const [carrierCode, ...methodCode] = data.selectedShippingOption.id.split('_');

          return getTotals(
            this.address,
            carrierCode,
            methodCode.join('_'),
            true,
          ).then(async () => changeShippingMethod(
            this.orderID,
            JSON.stringify(data.selectedShippingOption),
            this.method,
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
        onApprove: async () => {
          try {
            await finishPpcpOrder({
              orderId: this.orderID,
              method: this.method,
            }).then(() => {
              this.redirectToSuccess();
            });
          } catch (error) {
            const [
              paymentStore,
              loadingStore,
            ] = await window.geneCheckout.helpers.loadFromCheckout([
              'stores.usePaymentStore',
              'stores.useLoadingStore',
            ]);
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
      };

      // Render the PayPal button
      const paypalButtonData = {
        ...commonRenderData,
        fundingSource: window[`paypal_${this.method}`].FUNDING.PAYPAL,
      };
      await window[`paypal_${this.method}`].Buttons(paypalButtonData).render(
        '#ppcp-express-paypal_ppcp_paypal',
      );

      // Render the PayPal Pay Later button (if active)
      if (this.paypal.payLaterActive) {
        const payLaterButtonData = {
          ...commonRenderData,
          fundingSource: window[`paypal_${this.method}`].FUNDING.PAYLATER,
          style: {
            ...commonRenderData.style,
            color: this.paypal.payLaterButtonColour,
            shape: this.paypal.payLaterButtonShape,
          },
        };
        await window[`paypal_${this.method}`].Buttons(payLaterButtonData).render(
          '#ppcp-express-paypal_ppcp_paylater',
        );
      }

      const payLaterMessagingConfig = {
        amount: cartStore.cart.total,
        style: {
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
      };

      // Render the PayPal messages (if active)
      if (this.paypal.payLaterMessageActive) {
        await window[`paypal_${this.method}`].Messages(payLaterMessagingConfig).render(
          '#ppcp-express-paypal_messages',
        );
      }

      this.paypalLoaded = true;
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
