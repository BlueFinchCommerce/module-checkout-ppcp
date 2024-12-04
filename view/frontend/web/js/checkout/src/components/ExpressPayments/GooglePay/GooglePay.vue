<template>
  <div
    v-if="google.enabled"
    id="ppcp-google-pay"
    :class="!googlePayLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-PPCPGooglePay'"
  />
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../stores/PpcpStore';

// Helpers
import loadScript from '../../../helpers/addScript';

// Services
import createPPCPPaymentRest from '../../../services/createPPCPPaymentRest';

export default {
  name: 'PpcpGooglePay',
  data() {
    return {
      googlePayNoShippingMethods: '',
      googlePayLoaded: false,
      googlePayConfig: null,
      key: 'ppcpGooglePay',
      method: 'ppcp_googlepay',
      orderID: null,
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'google',
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
    await this.getInitialConfigValues();

    const googlePayConfig = paymentStore.availableMethods.find((method) => (
      method.code === this.method
    ));

    if (googlePayConfig) {
      await this.initGooglePay();
    } else {
      paymentStore.removeExpressMethod(this.key);
      this.googlePayLoaded = true;
    }
  },
  mounted() {
    const googlePayScript = document.createElement('script');
    googlePayScript.setAttribute('src', 'https://pay.google.com/gp/p/js/pay.js');
    document.head.appendChild(googlePayScript);
  },
  methods: {
    ...mapActions(usePpcpStore, [
      'getInitialConfigValues',
      'getEnvironment',
      'mapAddress',
      'makePayment',
    ]),

    async initGooglePay() {
      try {
        await this.addSdkScript();
        const googlePayConfig = await this.deviceSupported();
        const clientConfig = await this.createGooglePayClient(googlePayConfig);
        const button = await this.createGooglePayButton(clientConfig);

        if (button) {
          document.getElementById('ppcp-google-pay').appendChild(button);
          this.googlePayLoaded = true;
        }
      } catch (err) {
        console.warn(err);
      }
    },

    async addSdkScript() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const loadPayPalScript = loadScript();
      const params = {
        intent: this.google.paymentAction,
        currency: configStore.currencyCode,
        components: 'googlepay',
      };

      if (this.environment === 'sandbox') {
        params['buyer-country'] = this.buyerCountry;
        params['client-id'] = this.sandboxClientId;
      } else {
        params['client-id'] = this.productionClientId;
      }

      return loadPayPalScript(
        'https://www.paypal.com/sdk/js',
        params,
        'ppcp_googlepay',
      );
    },

    deviceSupported() {
      return new Promise((resolve, reject) => {
        if (window.location.protocol !== 'https:') {
          console.warn('Google Pay requires your checkout be served over HTTPS');
          reject(new Error('Insecure protocol: HTTPS is required for Google Pay'));
          return;
        }

        this.googlepay = window.paypal_ppcp_googlepay.Googlepay();

        this.googlepay.config()
          .then(async (googlePayConfig) => {
            if (googlePayConfig.isEligible) {
              googlePayConfig.allowedPaymentMethods.forEach((method) => {
                //  eslint-disable-next-line no-param-reassign
                method.parameters.billingAddressParameters.phoneNumberRequired = true;
              });
              resolve(googlePayConfig);
            } else {
              reject(new Error('Device not eligible for Google Pay'));
            }
          })
          .catch((error) => {
            reject(error);
          });
      });
    },

    createGooglePayClient(googlePayConfig) {
      const paymentDataCallbacks = {
        onPaymentAuthorized: this.onPaymentAuthorized,
      };

      if (this.onPaymentDataChanged) {
        paymentDataCallbacks.onPaymentDataChanged = (data) => this.onPaymentDataChanged(
          data,
          googlePayConfig,
        );
      }

      this.googlePayClient = new window.google.payments.api.PaymentsClient({
        environment: this.getEnvironment(),
        paymentDataCallbacks,
      });

      return this.googlePayClient.isReadyToPay({
        apiVersion: googlePayConfig.apiVersion,
        apiVersionMinor: googlePayConfig.apiVersionMinor,
        allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
      })
        .then((response) => {
          if (response.result) {
            return googlePayConfig;
          }
          return null;
        });
    },

    async createGooglePayButton(clientConfig) {
      const [
        loadingStore,
        customerStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.useCustomerStore',
      ]);

      return this.googlePayClient.createButton({
        allowedPaymentMethods: clientConfig.allowedPaymentMethods,
        buttonColor: this.google.buttonColor.toLowerCase(),
        buttonSizeMode: 'fill',
        onClick: () => this.onClick(clientConfig),
        onError: () => {
          customerStore.createNewAddress('shipping');
          loadingStore.setLoadingState(false);
        },
        onCancel: () => {
          customerStore.createNewAddress('shipping');
          loadingStore.setLoadingState(false);
        },
      });
    },

    async onClick(googlePayConfig) {
      const [
        agreementStore,
        cartStore,
        customerStore,
        configStore,
        loadingStore,
        shippingMethodsStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.useCartStore',
        'stores.useCustomerStore',
        'stores.useConfigStore',
        'stores.useLoadingStore',
        'stores.useShippingMethodsStore',
        'stores.usePaymentStore',
      ]);

      paymentStore.setErrorMessage('');
      // Check that the agreements (if any) is valid.
      const agreementsValid = agreementStore.validateAgreements();

      if (!agreementsValid) {
        return false;
      }

      await shippingMethodsStore.setNotClickAndCollect();

      const paymentDataRequest = { ...googlePayConfig };
      const callbackIntents = ['PAYMENT_AUTHORIZATION'];
      const requiresShipping = this.onPaymentDataChanged && !cartStore.cart.is_virtual;

      if (requiresShipping) {
        callbackIntents.push('SHIPPING_ADDRESS', 'SHIPPING_OPTION');
      }

      paymentDataRequest.allowedPaymentMethods = googlePayConfig.allowedPaymentMethods;
      paymentDataRequest.transactionInfo = {
        countryCode: googlePayConfig.countryCode,
        currencyCode: configStore.currencyCode,
        totalPriceStatus: 'FINAL',
        totalPrice: (cartStore.cartGrandTotal / 100).toString(),
      };
      paymentDataRequest.merchantInfo = googlePayConfig.merchantInfo;
      paymentDataRequest.shippingAddressRequired = requiresShipping;
      paymentDataRequest.shippingAddressParameters = {
        phoneNumberRequired: requiresShipping,
      };
      paymentDataRequest.emailRequired = true;
      paymentDataRequest.shippingOptionRequired = requiresShipping;
      paymentDataRequest.callbackIntents = callbackIntents;
      delete paymentDataRequest.countryCode;
      delete paymentDataRequest.isEligible;

      loadingStore.setLoadingState(true);

      return this.googlePayClient.loadPaymentData(paymentDataRequest)
        .catch((err) => {
          loadingStore.setLoadingState(false);
          customerStore.createNewAddress('shipping');
          console.warn(err);
        });
    },

    async onPaymentDataChanged(data, googlePayConfig) {
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
          region_id: configStore.getRegionId(
            data.shippingAddress.countryCode,
            data.shippingAddress.administrativeArea,
          ),
          street: ['0'],
          telephone: '000000000',
          firstname: 'UNKNOWN',
          lastname: 'UNKNOWN',
        };

        window.geneCheckout.services.getShippingMethods(address, this.method, true)
          .then(async (response) => {
            const methods = response.shipping_addresses[0].available_shipping_methods;
            const paymentDataRequestUpdate = {};

            const shippingMethods = methods.map((shippingMethod) => {
              const description = shippingMethod.carrier_title
                ? `${window.geneCheckout.helpers.formatPrice(shippingMethod.price_incl_tax.value)}
                   ${shippingMethod.carrier_title}`
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
              : methods.find(({ method_code: id }) => id === data.shippingOptionData.id)
              || methods[0];

            await shippingMethodsStore.submitShippingInfo(
              selectedShipping.carrier_code,
              selectedShipping.method_code,
            );

            loadingStore.setLoadingState(true);

            paymentDataRequestUpdate.newShippingOptionParameters = {
              defaultSelectedOptionId: selectedShipping.method_code,
              shippingOptions: fShippingMethods,
            };

            paymentDataRequestUpdate.newTransactionInfo = {
              displayItems: [
                {
                  label: 'Shipping',
                  type: 'LINE_ITEM',
                  price: selectedShipping.amount.value.toString(),
                  status: 'FINAL',
                },
              ],
              currencyCode: cartStore.cart.prices.grand_total.currency,
              totalPriceStatus: 'FINAL',
              totalPrice: cartStore.cart.prices.grand_total.value.toString(),
              totalPriceLabel: 'Total',
              countryCode: googlePayConfig.countryCode,
            };

            resolve(paymentDataRequestUpdate);
          });
      });
    },

    async onPaymentAuthorized(data) {
      const cartStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);
      //  eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve) => {
        // If there is no select shipping method at this point display an error.
        if (!cartStore.cart.is_virtual
          && !cartStore.cart.shipping_addresses[0].selected_shipping_method) {
          resolve({
            error: {
              reason: 'SHIPPING_OPTION_INVALID',
              message: 'No shipping method selected',
              intent: 'SHIPPING_OPTION',
            },
          });
          return;
        }

        const mapBillingAddress = await this.mapAddress(
          data.paymentMethodData.info.billingAddress,
          data.email,
          data.paymentMethodData.info.billingAddress.phoneNumber,
        );

        let mapShippingAddress = null;

        if (!cartStore.cart.is_virtual) {
          mapShippingAddress = await this.mapAddress(
            data.shippingAddress,
            data.email,
            data.shippingAddress.phoneNumber,
          );
        }

        try {
          await window.geneCheckout.services
            .setAddressesOnCart(mapShippingAddress, mapBillingAddress, data.email);

          // Create PPCP Payment and get the orderID

          const ppcpOrderId = await createPPCPPaymentRest(this.method);
          [this.orderID] = JSON.parse(ppcpOrderId);

          const confirmOrderData = {
            orderId: this.orderID,
            paymentMethodData: data.paymentMethodData,
          };

          // Confirm the order using Google Pay
          const response = await this.googlepay.confirmOrder(confirmOrderData);

          // Handle the onApprove callback
          await this.onApprove(response, data);

          resolve({
            transactionState: 'SUCCESS',
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

    async onApprove(data, paymentData) {
      const [
        loadingStore,
        customerStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.useCustomerStore',
        'stores.usePaymentStore',
      ]);

      if (data.liabilityShift && data.liabilityShift !== 'POSSIBLE') {
        throw new Error('Cannot validate payment');
      } else {
        return this.makePayment(paymentData.email, this.orderID, this.method, true)
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
      }
    },
  },
};
</script>

<style lang="scss">
@import "../expressPayments.scss";
</style>
