<template>
  <div
    :class="{ active: isMethodSelected }"
    class="google-pay-container"
  >
    <div
      class="google-pay-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod">
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
        alt="google-pay-logo">
    </div>
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />
    <div
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      id="ppcp-google-pay"
      :class="!googlePayLoaded && isMethodSelected ? 'text-loading' : ''"
      :data-cy="'checkout-PPCPGooglePay'"
    />
    <div class="google-pay-content" v-if="isMethodSelected">
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
/* eslint-disable import/no-extraneous-dependencies */
import ppcp from 'ppcp-web';
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../../stores/PpcpStore';

// Services
import createPPCPPaymentRest from '../../../../services/createPPCPPaymentRest';

// Icons
import googlePayImage from '../../icons/googlepaymark.png';

export default {
  name: 'PpcpGooglePayPayment',
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
  props: {
    open: {
      type: Boolean,
      required: false,
    },
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
  methods: {
    ...mapActions(usePpcpStore, [
      'getEnvironment',
      'mapAddress',
      'makePayment',
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
        onError: (error) => this.onError(error),
        onCancel: () => this.onCancel(),
        onValidate: () => this.onValidate(),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.googlePayment(options, element);
      this.googlePayLoaded = true;
    },

    async onValidate() {
      const [
        agreementStore,
        paymentStore,
        recaptchaStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.usePaymentStore',
        'stores.useRecaptchaStore',
      ]);
      paymentStore.setErrorMessage('');
      const agreementsValid = agreementStore.validateAgreements();
      const captchaValid = await recaptchaStore.validateToken('placeOrder');

      return agreementsValid && captchaValid;
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

        try {
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
        await this.placeOrder(paymentData);
      }
    },

    async onCancel() {
      const loadingStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
      ]);
      loadingStore.setLoadingState(false);
    },

    async onError(error) {
      const [
        loadingStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.usePaymentStore',
      ]);
      loadingStore.setLoadingState(false);
      paymentStore.setErrorMessage(error);
    },

    async placeOrder(paymentData) {
      const [
        loadingStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.usePaymentStore',
      ]);
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
    },
  },
};
</script>
