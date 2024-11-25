<template>
  <div
    id="ppcp-google-pay"
    ref="PPCPGooglePay"
    :class="!googlePayLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-PPCPGooglePay'"
  />
</template>

<script>
import { mapActions, mapState } from 'pinia';
import { markRaw } from 'vue';

import usePpcpStore from '../../../stores/PpcpStore';

export default {
  name: 'PpcpGooglePay',
  data() {
    return {
      googlePayNoShippingMethods: '',
      instance: null,
      googleClient: null,
      googlePaymentInstance: null,
      googlePayLoaded: false,
      key: 'ppcpGooglePay',
      method: 'ppcp_googlepay',
    };
  },
  computed: {
    ...mapState(usePpcpStore, [

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

    const googlePayConfig = paymentStore.availableMethods.find((method) => (
      method.code === this.method
    ));

    if (!googlePayConfig) {
      // Early return if Braintree Google Pay isn't enabled.
      paymentStore.removeExpressMethod(this.key);
      this.googlePayLoaded = true;
      return;
    }

    await this.createClientToken();

    this.googleClient = markRaw(new window.google.payments.api.PaymentsClient({
      environment: this.environment === 'sandbox' ? 'TEST' : 'PRODUCTION',
      paymentDataCallbacks: {
        ...(cartStore.cart.is_virtual ? {} : { onPaymentDataChanged: this.onPaymentDataChanged }),
        onPaymentAuthorized: this.onPaymentAuthorized,
      },
    }));

    this.instance = await markRaw(braintree.client.create({
      authorization: this.clientToken,
    }));

    braintree.googlePayment.create({
      client: this.instance,
      googlePayVersion: 2,
    }, (error, googlePaymentInstance) => {
      this.googlePaymentInstance = markRaw(googlePaymentInstance);

      this.googleClient
        .isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: googlePaymentInstance.createPaymentDataRequest().allowedPaymentMethods,
          existingPaymentMethodRequired: true,
        }).then(async (isReadyToPay) => {
        if (isReadyToPay) {
          const button = this.googleClient.createButton({
            buttonColor: this.google.buttonColor,
            buttonType: 'buy',
            buttonSizeMode: 'fill',
            onClick: () => this.onClick(googlePayConfig.code),
          });
          this.$refs.braintreeGooglePay.append(button);
          this.googlePayLoaded = true;
        }
      });
    });
  },
  mounted() {
    const googlePayScript = document.createElement('script');
    googlePayScript.setAttribute('src', 'https://pay.google.com/gp/p/js/pay.js');
    document.head.appendChild(googlePayScript);
  },
  methods: {
    ...mapActions(usePpcpStore, ['createClientToken']),
    async onClick(type) {
      const [
        agreementStore,
        cartStore,
        configStore,
        loadingStore,
        customerStore,
        shippingMethodsStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.useCartStore',
        'stores.useConfigStore',
        'stores.useLoadingStore',
        'stores.useCustomerStore',
        'stores.useShippingMethodsStore',
        'stores.usePaymentStore',
      ]);

      paymentStore.setErrorMessage('');
      // Check that the agreements (if any) is valid.
      const agreementsValid = agreementStore.validateAgreements();

      if (!agreementsValid) {
        return false;
      }

      shippingMethodsStore.setNotClickAndCollect();

      const callbackIntents = ['PAYMENT_AUTHORIZATION'];

      if (!cartStore.cart.is_virtual) {
        callbackIntents.push('SHIPPING_ADDRESS', 'SHIPPING_OPTION');
      }

      const paymentRequest = {
        transactionInfo: {
          countryCode: configStore.countryCode,
          currencyCode: configStore.currencyCode,
          totalPriceStatus: 'FINAL',
          totalPrice: (cartStore.cartGrandTotal / 100).toString(),
        },
        emailRequired: true,
        shippingAddressRequired: !cartStore.cart.is_virtual,
        shippingAddressParameters: {
          phoneNumberRequired: !cartStore.cart.is_virtual,
        },
        shippingOptionRequired: !cartStore.cart.is_virtual,
        callbackIntents,
      };

      if (this.environment !== 'sandbox') {
        paymentRequest.merchantInfo = {
          merchantId: this.google.merchantId,
        };
      }

      const paymentDataRequest = this.googlePaymentInstance.createPaymentDataRequest(paymentRequest);

      const cardPaymentMethod = paymentDataRequest.allowedPaymentMethods[0];
      cardPaymentMethod.parameters.billingAddressRequired = true;
      cardPaymentMethod.parameters.billingAddressParameters = {
        format: 'FULL',
        phoneNumberRequired: true,
      };

      window.geneCheckout.helpers.expressPaymentOnClickDataLayer(type);

      loadingStore.setLoadingState(true);

      return this.googleClient.loadPaymentData(paymentDataRequest)
        .then(this.makePayment)
        .then(() => window.geneCheckout.services.refreshCustomerData(['cart']))
        .then(() => {
          window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
        })
        .catch((err) => {
          loadingStore.setLoadingState(false);

          try {
            window.geneCheckout.helpers.handleServiceError(err);
          } catch (formattedError) {
            // clear shipping address form
            customerStore.createNewAddress('shipping');
            paymentStore.setErrorMessage(formattedError);
          }
        });
    },

    getGooglePayMethod(paymentMethodsResponse) {
      return paymentMethodsResponse.paymentMethods.find(({ type }) => (
        type === 'paywithgoogle' || 'googlepay'
      ));
    },

    async onPaymentDataChanged(data) {
      const [
        cartStore,
        configStore,
        loadingStore,
        shippingMethodsStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
        'stores.useLoadingStore',
        'stores.useShippingMethodsStore',
      ]);

      return new Promise((resolve) => {
        const address = {
          city: data.shippingAddress.locality,
          company: '',
          country_code: data.shippingAddress.countryCode,
          postcode: data.shippingAddress.postalCode,
          region: data.shippingAddress.administrativeArea,
          region_id: configStore.getRegionId(data.shippingAddress.countryCode, data.shippingAddress.administrativeArea),
          street: ['0'],
          telephone: '000000000',
          firstname: 'UNKNOWN',
          lastname: 'UNKNOWN',
        };

        window.geneCheckout.services.getShippingMethods(address, this.method, true).then(async (response) => {
          const methods = response.shipping_addresses[0].available_shipping_methods;

          const shippingMethods = methods.map((shippingMethod) => {
            const description = shippingMethod.carrier_title
              ? `${window.geneCheckout.helpers.formatPrice(shippingMethod.price_incl_tax.value)} ${shippingMethod.carrier_title}`
              : window.geneCheckout.helpers.formatPrice(shippingMethod.price_incl_tax.value);

            return {
              id: shippingMethod.method_code,
              label: shippingMethod.method_title,
              description,
            };
          });

          // Filter out nominated day as this isn't available inside of Google Pay.
          const fShippingMethods = shippingMethods.filter((sid) => sid.id !== 'nominated_delivery');

          // Any error message means we need to exit by resolving with an error state.
          if (!fShippingMethods.length) {
            resolve({
              error: {
                reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
                message: this.$t('errorMessages.googlePayNoShippingMethods'),
                intent: 'SHIPPING_ADDRESS',
              },
            });
            return;
          }

          const selectedShipping = data.shippingOptionData.id === 'shipping_option_unselected'
            ? methods[0]
            : methods.find(({ method_code: id }) => id === data.shippingOptionData.id) || methods[0];

          await shippingMethodsStore.submitShippingInfo(selectedShipping.carrier_code, selectedShipping.method_code);
          loadingStore.setLoadingState(true);

          const paymentDataRequestUpdate = {
            newShippingOptionParameters: {
              defaultSelectedOptionId: selectedShipping.method_code,
              shippingOptions: fShippingMethods,
            },
            newTransactionInfo: {
              displayItems: [
                {
                  label: 'Shipping',
                  type: 'LINE_ITEM',
                  price: cartStore.cart.shipping_addresses[0].selected_shipping_method.amount.value.toString(),
                  status: 'FINAL',
                },
              ],
              currencyCode: cartStore.cart.prices.grand_total.currency,
              totalPriceStatus: 'FINAL',
              totalPrice: cartStore.cart.prices.grand_total.value.toString(),
              totalPriceLabel: 'Total',
              countryCode: configStore.countryCode,
            },
          };
          resolve(paymentDataRequestUpdate);
        });
      });
    },

    async onPaymentAuthorized(data) {
      const [
        cartStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);

      return new Promise((resolve) => {
        // If there is no select shipping method at this point display an error.
        if (!cartStore.cart.is_virtual && !cartStore.cart.shipping_addresses[0].selected_shipping_method) {
          resolve({
            error: {
              reason: 'SHIPPING_OPTION_INVALID',
              message: 'No shipping method selected',
              intent: 'SHIPPING_OPTION',
            },
          });
          return;
        }

        const {androidPayCards} = JSON.parse(data.paymentMethodData.tokenizationData.token);

        if (!androidPayCards?.[0]?.nonce || !androidPayCards?.[0]?.details?.bin) {
          resolve({
            error: {
              reason: 'SHIPPING_OPTION_INVALID',
              message: 'Unable to validate payment. Please try again with another payment method.',
              intent: 'SHIPPING_OPTION',
            },
          });
          return;
        }

        const {email} = data;
        const {billingAddress} = data.paymentMethodData.info;
        const {phoneNumber} = billingAddress;
        const mapBillingAddress = this.mapAddress(billingAddress, email, phoneNumber);

        let mapShippingAddress = null;

        if (!cartStore.cart.is_virtual) {
          const {shippingAddress} = data;
          const {phoneNumber: shippingPhoneNumber} = shippingAddress;
          mapShippingAddress = this.mapAddress(shippingAddress, email, shippingPhoneNumber);
        }

        try {
          window.geneCheckout.services.setAddressesOnCart(mapShippingAddress, mapBillingAddress, email)
            .then(() => {
              resolve({
                transactionState: 'SUCCESS',
              });
            });
        } catch (error) {
          resolve({
            error: {
              reason: 'PAYMENT_DATA_INVALID',
              message: error.message,
              intent: 'PAYMENT_AUTHORIZATION',
            },
          });
        }
      });
    },

    makePayment(response) {
      const payment = {
        email: response.email,
        paymentMethod: {
          method: this.method,
          additional_data: {
            payment_method_nonce: response.nonce,
          },
          extension_attributes: window.geneCheckout.helpers.getPaymentExtensionAttributes(),
        },
      };

      return window.geneCheckout.services.createPayment(payment);
    },

    async mapAddress(address, email, telephone) {
      const [
        configStore
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const [firstname, ...lastname] = address.name.split(' ');
      const regionId = configStore.getRegionId(address.countryCode, address.administrativeArea);
      return {
        street: [
          address.address1,
          address.address2,
        ],
        postcode: address.postalCode,
        country_code: address.countryCode,
        company: address.company || '',
        email,
        firstname,
        lastname: lastname.length ? lastname.join(' ') : 'UNKNOWN',
        city: address.locality,
        telephone,
        region: {
          ...(address.administrativeArea ? {region: address.administrativeArea} : {}),
          ...(regionId ? {region_id: regionId} : {}),
        },
      };
    },
  },
};
</script>

<style lang="scss">
@import "../expressPayments.scss";
</style>
