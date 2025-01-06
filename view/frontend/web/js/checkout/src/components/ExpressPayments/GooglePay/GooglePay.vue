<template>
  <div
    v-if="google.enabled && google.showOnTopCheckout"
    id="ppcp-google-pay"
    :class="!googlePayLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-PPCPGooglePay'"
  />
</template>

<script>
/* eslint-disable import/no-extraneous-dependencies */
import ppcp from 'ppcp-web';
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../stores/PpcpStore';

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

    if (googlePayConfig && this.google.showOnTopCheckout) {
      await this.initGooglePay();
    } else {
      paymentStore.removeExpressMethod(this.key);
      this.googlePayLoaded = true;
    }
  },
  methods: {
    ...mapActions(usePpcpStore, [
      'getInitialConfigValues',
      'getEnvironment',
      'mapAddress',
      'makePayment',
    ]),

    async initGooglePay() {
      const [
        cartStore,
        configStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const element = 'ppcp-google-pay';
      const configuration = {
        sandboxClientId: this.sandboxClientId,
        productionClientId: this.productionClientId,
        intent: this.google.paymentAction,
        pageType: 'checkout',
        environment: this.environment,
        buyerCountry: this.buyerCountry,
        googlePayVersion: 2,
        transactionInfo: {
          currencyCode: configStore.currencyCode,
          totalPriceStatus: 'FINAL',
          totalPrice: (cartStore.cartGrandTotal / 100).toString(),
        },
        button: {
          buttonColor: this.google.buttonColor.toLowerCase(),
        },
      };

      const callbacks = {
        placeOrder: (paymentData) => this.placeOrder(paymentData),
        onPaymentAuthorized: (paymentData, googlepay) => this.onPaymentAuthorized(paymentData, googlepay),
        onPaymentDataChanged: (paymentData, googlePayConfig) => this.onPaymentDataChanged(paymentData, googlePayConfig),
        onError: (error) => this.onError(error),
        onCancel: () => this.onCancel(),
        onValidate: () => this.onValidate(),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.googlePayment(options, element);
    },

    async onValidate() {
      const [
        agreementStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.usePaymentStore',
      ]);
      paymentStore.setErrorMessage('');
      return agreementStore.validateAgreements();
    },

    async onError(error) {
      const [
        customerStore,
        loadingStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCustomerStore',
        'stores.useLoadingStore',
        'stores.usePaymentStore',
      ]);
      customerStore.createNewAddress('shipping');
      loadingStore.setLoadingState(false);
      paymentStore.setErrorMessage(error);
    },

    async onCancel() {
      const [
        customerStore,
        loadingStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCustomerStore',
        'stores.useLoadingStore',
      ]);
      customerStore.createNewAddress('shipping');
      loadingStore.setLoadingState(false);
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
      if (cartStore.cart.is_virtual) return null;
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

    async onPaymentAuthorized(data, googlepay) {
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
          const response = await googlepay.confirmOrder(confirmOrderData);

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
      if (data.liabilityShift && data.liabilityShift !== 'POSSIBLE') {
        throw new Error('Cannot validate payment');
      } else {
        this.placeOrder(paymentData);
      }
    },

    async placeOrder(paymentData) {
      const [
        loadingStore,
        customerStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.useCustomerStore',
        'stores.usePaymentStore',
      ]);
      return this.makePayment(paymentData.email, this.orderID, this.method, true)
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
  },
};
</script>

<style lang="scss">
@import "../expressPayments.scss";
</style>
