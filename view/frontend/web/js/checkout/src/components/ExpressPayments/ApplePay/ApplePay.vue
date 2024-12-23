<template>
  <div
    v-if="applePayAvailable"
    id="ppcp-apple-pay"
    class="ppcp-apple-pay-container"
    :class="!applePayLoaded ? 'text-loading' : 'ppcp-apple-pay'"
  />
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../stores/PpcpStore';
import ppcp from 'ppcp-web';

// Services
import createPPCPPaymentRest from '../../../services/createPPCPPaymentRest';

export default {
  name: 'PpcpApplePay',
  data() {
    return {
      applePayLoaded: false,
      applePayConfig: null,
      key: 'ppcpApplePay',
      method: 'ppcp_applepay',
      orderID: null,
      applePayAvailable: false,
      applePayTotal: '',
      dataCollectorInstance: null,
      shippingMethods: [],
      isEligible: false,
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'apple',
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

    if (!this.apple.merchantName) {
      await this.getInitialConfigValues();
    }

    const applePayConfig = paymentStore.availableMethods.find((method) => (
      method.code === this.method
    ));

    if (applePayConfig) {
      this.renderApplePayButton();
    } else {
      paymentStore.removeExpressMethod(this.key);
      this.applePayLoaded = true;
    }
  },
  methods: {
    ...mapActions(usePpcpStore, ['getInitialConfigValues', 'makePayment', 'mapAppleAddress']),

    async renderApplePayButton() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const element = 'ppcp-apple-pay-new';
      const configuration = {
        sandboxClientId: this.sandboxClientId,
        productionClientId: this.productionClientId,
        intent: this.apple.paymentAction,
        pageType: 'checkout',
        environment: this.environment,
        currency: configStore.currencyCode,
        buyerCountry: this.buyerCountry,
      };

      const callbacks = {
        getPaymentRequest: (applePayConfig) => this.getPaymentRequest(applePayConfig),
        onShippingContactSelect: (data, session) => this.onShippingContactSelect(data, session),
        onShippingMethodSelect: (data, session) => this.onShippingMethodSelect(data, session),
        onPaymentAuthorized: (data, session, applepay) => this.onPaymentAuthorized(data, session, applepay),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.applePayment(options, element);
      this.applePayAvailable = true;
      this.applePayLoaded = true;
    },

    async getPaymentRequest(applePayConfig) {
      const [
        cartStore,
        configStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);
      const {
        countryCode,
        merchantCapabilities,
        supportedNetworks,
      } = applePayConfig;
      const requiredShippingContactFields = ['name', 'email', 'phone'];

      if (!cartStore.cart.is_virtual) {
        requiredShippingContactFields.push('postalAddress');
      }

      return {
        countryCode,
        currencyCode: configStore.currencyCode,
        merchantCapabilities,
        supportedNetworks,
        requiredShippingContactFields,
        requiredBillingContactFields: ['postalAddress', 'name'],
        total: {
          label: this.apple.merchantName,
          amount: (cartStore.cartGrandTotal / 100).toString(),
          type: 'final',
        },
      };
    },

    async onPaymentAuthorized(data, session, applepay) {
      const [
        cartStore,
        configStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const { shippingContact, billingContact } = data.payment;
      const email = shippingContact.emailAddress;
      const telephone = shippingContact.phoneNumber;
      const billingAddress = await this.mapAppleAddress(billingContact, email, telephone);

      let shippingAddress = null;

      if (!cartStore.cart.is_virtual) {
        shippingAddress = await this.mapAppleAddress(shippingContact, email, telephone);
      }

      if (!configStore.countries.some(({ id }) => id === billingAddress.country_code)) {
        session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        return;
      }

      const ppcpOrderId = await createPPCPPaymentRest(this.method);
      [this.orderID] = JSON.parse(ppcpOrderId);

      applepay.confirmOrder({
        orderId: this.orderID,
        token: data.payment.token,
        billingContact: data.payment.billingContact,
      }).then(async () => {
        try {
          window.geneCheckout.services.setAddressesOnCart(shippingAddress, billingAddress, email)
            .then(() => this.makePayment(email, this.orderID, this.method, true))
            .then(async () => {
              session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
              window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
            });
        } catch (error) {
          console.log(error);
          session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        }
      }).catch((confirmError) => {
        if (confirmError) {
          console.error('Error confirming order with applepay token');
          console.error(confirmError);
          session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        }
      });
    },

    async onShippingContactSelect(data, session) {
      const [
        cartStore,
        configStore,
        shippingMethodsStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
        'stores.useShippingMethodsStore',
      ]);

      const address = {
        city: data.shippingContact.locality,
        company: '',
        region: data.shippingContact.administrativeArea,
        region_id: configStore.getRegionId(
          data.shippingContact.countryCode,
          data.shippingContact.administrativeArea,
        ),
        country_code: data.shippingContact.countryCode.toUpperCase(),
        postcode: data.shippingContact.postalCode,
        street: ['0'],
        telephone: '000000000',
        firstname: 'UNKNOWN',
        lastname: 'UNKNOWN',
      };

      this.address = address;

      const result = await window.geneCheckout.services.getShippingMethods(
        address,
        this.method,
        true,
      );

      const methods = result.shipping_addresses[0].available_shipping_methods;

      const filteredMethods = methods.filter(({ method_code: methodCode }) => (
        methodCode !== 'nominated_delivery'
      ));

      this.shippingMethods = filteredMethods;

      // If there are no shipping methods available show an error.
      if (!filteredMethods.length) {
        const errors = {
          errors: [
            new window.ApplePayError('addressUnserviceable', 'postalAddress', this.applePayNoShippingMethods),
          ],
          newTotal: {
            label: configStore.websiteName,
            amount: '0.00',
            type: 'pending',
          },
        };
        session.completeShippingContactSelection(errors);
        return;
      }

      // Set the shipping method back to the first available method.
      const selectedShipping = filteredMethods[0];

      await shippingMethodsStore.submitShippingInfo(
        selectedShipping.carrier_code,
        selectedShipping.method_code,
      );
      const newShippingMethods = this.mapShippingMethods(filteredMethods);

      const applePayShippingContactUpdate = {
        newShippingMethods,
        newTotal: {
          label: this.applePayTotal,
          amount: parseFloat(cartStore.cartGrandTotal / 100).toFixed(2),
        },
        newLineItems: [
          {
            type: 'final',
            label: 'Subtotal',
            amount: cartStore.cart.prices.subtotal_including_tax.value.toString(),
          },
          {
            type: 'final',
            label: 'Shipping',
            amount: selectedShipping.amount.value.toString(),
          },
        ],
      };

      // Add discount price if available.
      if (cartStore.cartDiscountTotal) {
        applePayShippingContactUpdate.newLineItems.push({
          type: 'final',
          label: 'Discount',
          amount: cartStore.cartDiscountTotal.toString(),
        });
      }

      session.completeShippingContactSelection(applePayShippingContactUpdate);
    },

    async onShippingMethodSelect(data, session) {
      const [
        cartStore,
        shippingMethodsStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useShippingMethodsStore',
      ]);

      const selectedShipping = this.shippingMethods.find(({ method_code: id }) => (
        id === data.shippingMethod.identifier
      ));

      await shippingMethodsStore.submitShippingInfo(
        selectedShipping.carrier_code,
        selectedShipping.method_code,
      );
      const applePayShippingContactUpdate = {
        newTotal: {
          label: this.applePayTotal,
          amount: parseFloat(cartStore.cartGrandTotal / 100).toFixed(2),
        },
        newLineItems: [
          {
            type: 'final',
            label: 'Subtotal',
            amount: cartStore.cart.prices.subtotal_including_tax.value.toString(),
          },
          {
            type: 'final',
            label: 'Shipping',
            amount: selectedShipping.amount.value.toString(),
          },
        ],
      };

      // Add discount price if available.
      if (cartStore.cartDiscountTotal) {
        applePayShippingContactUpdate.newLineItems.push({
          type: 'final',
          label: 'Discount',
          amount: cartStore.cartDiscountTotal.toString(),
        });
      }

      session.completeShippingMethodSelection(applePayShippingContactUpdate);
    },

    mapShippingMethods(shippingMethods) {
      return shippingMethods.map((shippingMethod) => (
        {
          label: shippingMethod.method_title,
          detail: shippingMethod.carrier_title || '',
          amount: shippingMethod.amount.value.toString(),
          identifier: shippingMethod.method_code,
          carrierCode: shippingMethod.carrier_code,
        }
      ));
    },
  },
};
</script>

<style lang='scss'>
@import '../expressPayments.scss';
</style>
