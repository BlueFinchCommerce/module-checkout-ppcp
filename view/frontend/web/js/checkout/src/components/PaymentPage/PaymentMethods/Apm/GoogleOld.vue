<template>
  <div
    :class="{ active: isMethodSelected }"
    class="google-pay-container"
  >
    <div
      class="google-pay-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod"
    >
      <component
        :is="RadioButton"
        id="google-pay-select"
        :text="google.title"
        :checked="isMethodSelected"
        :data-cy="'google-pay-radio'"
        class="google-pay-radio"
        @click="selectPaymentMethod"
        @keydown="selectPaymentMethod"
      />
      <img
        width="48px"
        class="google-pay-logo"
        :src="googlePayLogo"
        alt="google-pay-logo"
      >
    </div>
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />
    <div
      id="ppcp-google-pay"
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      :class="!googlePayLoaded && isMethodSelected ? 'text-loading' : ''"
      :data-cy="'checkout-PPCPGooglePay'"
    />
    <div v-if="isMethodSelected" class="google-pay-content">
      <component :is="PrivacyPolicy" />
      <div class="recaptcha">
        <component
          :is="Recaptcha"
          v-if="isRecaptchaVisible('placeOrder')"
          id="placeOrder"
          location="ppcpPaymentGoogle"
        />
      </div>
      <component :is="Agreements" id="ppcp-checkout-google-pay" />
    </div>
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../../stores/PpcpStore';

// Helpers
import loadScript from '../../../../helpers/addScript';

// Services
import createPPCPPaymentRest from '../../../../services/createPPCPPaymentRest';

// Icons
import googlePayImage from '../../icons/googlepaymark.png';

export default {
  name: 'PpcpGooglePayPayment',
  props: {
    open: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      isMethodSelected: false,
      googlePayLoaded: false,
      button: null,
      errorMessage: '',
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      paymentEmitter: null,
      isPaymentMethodAvailable: null,
      selectedMethod: 'ppcp_googlepay',
      method: 'ppcp_googlepay',
      isRecaptchaVisible: () => {},
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
    googlePayLogo() {
      return googlePayImage;
    },
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== 'ppcp_googlepay') {
          this.isMethodSelected = false;
        }
      },
      immediate: true,
      deep: true,
    },
  },
  async mounted() {
    const {
      default: {
        components: {
          ErrorMessage,
          PrivacyPolicy,
          RadioButton,
          Recaptcha,
          Agreements,
        },
      },
    } = await import(window.geneCheckout.main);

    this.Agreements = Agreements;
    this.ErrorMessage = ErrorMessage;
    this.RadioButton = RadioButton;
    this.Recaptcha = Recaptcha;
    this.PrivacyPolicy = PrivacyPolicy;

    // Check if the script is already included
    const scriptSrc = 'https://pay.google.com/gp/p/js/pay.js';
    const existingScript = Array.from(document.scripts).find(
      (script) => script.src === scriptSrc,
    );

    if (!existingScript) {
      // Script not found, insert it
      const googlePayScript = document.createElement('script');
      googlePayScript.setAttribute('src', scriptSrc);
      document.head.appendChild(googlePayScript);
    }
  },
  async created() {
    const [
      recaptchaStore,
      paymentStore,
      configStore,
      cartStore,
    ] = await window.geneCheckout.helpers.loadFromCheckout([
      'stores.useRecaptchaStore',
      'stores.usePaymentStore',
      'stores.useConfigStore',
      'stores.useCartStore',
    ]);

    this.paymentEmitter = paymentStore.paymentEmitter;
    this.isPaymentMethodAvailable = paymentStore.isPaymentMethodAvailable;
    this.isRecaptchaVisible = recaptchaStore.isRecaptchaVisible;

    paymentStore.$subscribe((mutation) => {
      if (typeof mutation.payload.selectedMethod !== 'undefined') {
        this.selectedMethod = mutation.payload.selectedMethod;
      }
    });

    this.paymentEmitter.on('changePaymentMethodDisplay', ({ visible }) => {
      this.paymentVisible = visible;
    });

    await configStore.getInitialConfig();
    await cartStore.getCart();
    await this.initGooglePay();

    if (this.open) {
      await this.selectPaymentMethod();
    }
  },
  methods: {
    ...mapActions(usePpcpStore, [
      'getEnvironment',
      'mapAddress',
      'makePayment',
      'mapSelectedAddress',
    ]),

    async selectPaymentMethod() {
      this.isMethodSelected = true;

      if (this.button) {
        document.getElementById('ppcp-google-pay').appendChild(this.button);
        this.googlePayLoaded = true;
      }

      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_googlepay');
    },

    async initGooglePay() {
      try {
        if (!window.paypal_ppcp_googlepay) {
          await this.addSdkScript();
        }
        const googlePayConfig = await this.deviceSupported();
        const clientConfig = await this.createGooglePayClient(googlePayConfig);
        this.button = await this.createGooglePayButton(clientConfig);
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

    createGooglePayButton(clientConfig) {
      return this.googlePayClient.createButton({
        allowedPaymentMethods: clientConfig.allowedPaymentMethods,
        buttonColor: this.google.buttonColor.toLowerCase(),
        buttonType: 'short',
        buttonSizeMode: 'fill',
        onClick: () => this.onClick(clientConfig),
      });
    },

    async onClick(googlePayConfig) {
      const [
        agreementStore,
        cartStore,
        configStore,
        loadingStore,
        paymentStore,
        recaptchaStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.useCartStore',
        'stores.useConfigStore',
        'stores.useLoadingStore',
        'stores.usePaymentStore',
        'stores.useRecaptchaStore',
      ]);

      paymentStore.setErrorMessage('');
      // Check that the agreements (if any) is valid.
      const agreementsValid = agreementStore.validateAgreements();
      const captchaValid = await recaptchaStore.validateToken('placeOrder');

      if (!agreementsValid || !captchaValid) {
        return false;
      }

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
          console.warn(err);
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

        try {
          await window.geneCheckout.services
            .setAddressesOnCart(
              await this.mapSelectedAddress(cartStore.cart.shipping_addresses[0]),
              mapBillingAddress,
              data.email,
            );

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
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.usePaymentStore',
      ]);

      if (data.liabilityShift && data.liabilityShift !== 'POSSIBLE') {
        throw new Error('Cannot validate payment');
      } else {
        return this.makePayment(paymentData.email, this.orderID, this.method, false)
          .then(() => {
            window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
          })
          .catch((err) => {
            loadingStore.setLoadingState(false);
            try {
              window.geneCheckout.helpers.handleServiceError(err);
            } catch (formattedError) {
              paymentStore.setErrorMessage(formattedError);
            }
          });
      }
    },
  },
};
</script>
