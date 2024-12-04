<template>
  <div
    v-if="applePayAvailable"
    class="ppcp-apple-pay-container"
    :class='!applePayLoaded ? "text-loading" : "ppcp-apple-pay"'>
    <apple-pay-button
      v-if="applePayLoaded"
      @click="onClick"
      id="ppcp-apple-pay"
      type="buy"
      locale="en" />
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../stores/PpcpStore';

// Helpers
import loadScript from '../../../helpers/addScript';

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
      await this.addSdkScript();
      this.showApplePay();
    } else {
      paymentStore.removeExpressMethod(this.key);
      this.applePayLoaded = true;
    }
  },
  methods: {
    ...mapActions(usePpcpStore, ['getInitialConfigValues', 'makePayment']),

    async addSdkScript() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const loadPayPalScript = loadScript();
      const params = {
        intent: this.apple.paymentAction,
        currency: configStore.currencyCode,
        components: 'applepay',
      };

      if (this.environment === 'sandbox') {
        params['buyer-country'] = this.buyerCountry;
        params['client-id'] = this.sandboxClientId;
      } else {
        params['client-id'] = this.productionClientId;
      }

      try {
        await Promise.all([
          loadPayPalScript(
            'https://www.paypal.com/sdk/js',
            params,
            'ppcp_applepay',
          ),
          loadPayPalScript(
            'https://applepay.cdn-apple.com/jsapi/v1.1.0/apple-pay-sdk.js',
            {},
            '',
          ),
        ]);
      } catch (error) {
        console.error('Error loading SDK scripts:', error);
        throw new Error('Failed to load required SDK scripts.');
      }
    },

    showApplePay() {
      // If the browser doesn't support Apple Pay then return early.
      if (
        !window.ApplePaySession
        || !window.ApplePaySession.canMakePayments
        || window.location.protocol !== 'https:'
      ) {
        return;
      }

      this.applePayAvailable = true;

      const applepay = window[`paypal_${this.method}`].Applepay();

      applepay.config()
        .then((applepayConfig) => {
          this.applePayConfig = applepayConfig;
          this.isEligible = !!applepayConfig.isEligible;
          this.applePayLoaded = true;
        })
        .catch(() => {
          console.error('Error while fetching Apple Pay configuration.');
        });
    },

    async onClick() {
      const [
        agreementStore,
        cartStore,
        customerStore,
        configStore,
        loadingStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.useCartStore',
        'stores.useCustomerStore',
        'stores.useConfigStore',
        'stores.useLoadingStore',
        'stores.usePaymentStore',
      ]);

      paymentStore.setErrorMessage('');

      // Check that the agreements (if any) is valid.
      const agreementsValid = agreementStore.validateAgreements();

      if (!agreementsValid) {
        return;
      }

      const applepay = window[`paypal_${this.method}`].Applepay();

      try {
        const requiredShippingContactFields = ['name', 'email', 'phone'];

        if (!cartStore.cart.is_virtual) {
          requiredShippingContactFields.push('postalAddress');
        }

        const paymentRequest = {
          countryCode: configStore.countryCode,
          currencyCode: configStore.currencyCode,
          merchantCapabilities: this.applePayConfig.merchantCapabilities,
          supportedNetworks: this.applePayConfig.supportedNetworks,
          requiredShippingContactFields,
          requiredBillingContactFields: ['postalAddress', 'name'],
          total: {
            label: this.apple.merchantName,
            amount: (cartStore.cartGrandTotal / 100).toString(),
            type: 'final',
          },
        };

        const session = new window.ApplePaySession(4, paymentRequest);

        session.onvalidatemerchant = (event) => {
          applepay.validateMerchant({
            validationUrl: event.validationURL,
          }).then((payload) => {
            session.completeMerchantValidation(payload.merchantSession);
          }).catch((err) => {
            // clear shipping address form
            customerStore.createNewAddress('shipping');
            console.error(err);
            session.abort();
            loadingStore.setLoadingState(false);
          });
        };

        if (!cartStore.cart.is_virtual) {
          session.onshippingcontactselected = (data) => this.onShippingContactSelect(data, session);
          session.onshippingmethodselected = (data) => this.onShippingMethodSelect(data, session);
        }

        // Handle session cancellation
        session.oncancel = () => {
          // clear shipping address form
          customerStore.createNewAddress('shipping');
        };

        session.onpaymentauthorized = (data) => this.onAuthorized(data, session);

        session.begin();
      } catch (err) {
        // clear shipping address form
        customerStore.createNewAddress('shipping');
        await this.setApplePayError();
      }
    },

    async onAuthorized(data, session) {
      const [
        cartStore,
        configStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const applepay = window[`paypal_${this.method}`].Applepay();

      const { shippingContact, billingContact } = data.payment;
      const email = shippingContact.emailAddress;
      const telephone = shippingContact.phoneNumber;
      const billingAddress = await this.mapAddress(billingContact, email, telephone);

      let shippingAddress = null;

      if (!cartStore.cart.is_virtual) {
        shippingAddress = await this.mapAddress(shippingContact, email, telephone);
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
              await window.geneCheckout.services.refreshCustomerData(['cart']);
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

    async setApplePayError() {
      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      paymentStore.setErrorMessage(
        "We're unable to take payments through Apple Pay at the moment. Please try an alternative payment method.",
      );
    },

    async mapAddress(address, email, telephone) {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const regionId = configStore.getRegionId(
        address.countryCode.toUpperCase(),
        address.administrativeArea,
      );
      return {
        email,
        telephone,
        firstname: address.givenName,
        lastname: address.familyName,
        company: address.company || '',
        street: address.addressLines,
        city: address.locality,
        country_code: address.countryCode.toUpperCase(),
        postcode: address.postalCode,
        region: {
          ...(address.administrativeArea ? { region: address.administrativeArea } : {}),
          ...(regionId ? { region_id: regionId } : {}),
        },
      };
    },
  },
};
</script>

<style lang='scss'>
@import '../expressPayments.scss';
</style>
