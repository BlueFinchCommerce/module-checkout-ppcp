<template>
  <div
    v-if="applePayAvailable"
    :class="{ active: isMethodSelected }"
    class="apple-pay-container"
  >
    <div
      class="apple-pay-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod">
      <component
        :is="RadioButton"
        id="apple-pay-select"
        :text="apple.title"
        :checked="isMethodSelected"
        :data-cy="'apple-pay-radio'"
        class="apple-pay-radio"
        @click="selectPaymentMethod"
        @keydown="selectPaymentMethod"
      />
      <img
        width="48px"
        class="apple-pay-logo"
        :src="applePayLogo"
        alt="apple-pay-logo">
    </div>
    <div
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      id="ppcp-apple-pay"
      class="ppcp-apple-pay-container"
      :class="!applePayLoaded && isMethodSelected ? 'text-loading' : ''"
      :data-cy="'checkout-PPCPApplePay'"
    />
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />
    <div class="apple-pay-content" v-if="isMethodSelected">
      <component :is="PrivacyPolicy" />
      <div class="recaptcha">
        <component
          :is="Recaptcha"
          v-if="isRecaptchaVisible('placeOrder')"
          id="placeOrder"
          location="ppcpPaymentApple"
        />
      </div>
      <component :is="Agreements" id="ppcp-checkout-apple-pay" />
    </div>
  </div>
</template>

<script>
/* eslint-disable import/no-extraneous-dependencies */
import ppcp from 'blufinch-ppcp-web';
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../../stores/PpcpStore';

// Services
import createPPCPPaymentRest from '../../../../services/createPPCPPaymentRest';

// Icons
import applePayImage from '../../icons/applepaymark.png';

export default {
  name: 'PpcpApplePayPayment',
  data() {
    return {
      isMethodSelected: false,
      applePayLoaded: false,
      applePayAvailable: false,
      applePayConfig: null,
      isEligible: false,
      errorMessage: '',
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      paymentEmitter: null,
      isPaymentMethodAvailable: null,
      selectedMethod: 'ppcp_applepay',
      method: 'ppcp_applepay',
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
      'apple',
      'environment',
      'buyerCountry',
      'productionClientId',
      'sandboxClientId',
    ]),
    applePayLogo() {
      return applePayImage;
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
    } = await import(window.bluefinchCheckout.main);

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
    ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
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
    this.renderApplePayButton();

    if (this.open) {
      await this.selectPaymentMethod();
    }
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== 'ppcp_applepay') {
          this.isMethodSelected = false;
        }
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    ...mapActions(usePpcpStore, [
      'makePayment',
      'mapAppleAddress',
    ]),

    async selectPaymentMethod() {
      this.isMethodSelected = true;
      const paymentStore = await window.bluefinchCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_applepay');
    },

    async renderApplePayButton() {
      const configStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const element = 'ppcp-apple-pay';
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
        onValidate: () => this.onValidate(),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.applePayment(options, element);
    },

    async onValidate() {
      const [
        agreementStore,
        paymentStore,
        recaptchaStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.usePaymentStore',
        'stores.useRecaptchaStore',
      ]);
      paymentStore.setErrorMessage('');
      const agreementsValid = agreementStore.validateAgreements();
      const captchaValid = await recaptchaStore.validateToken('placeOrder');

      return agreementsValid && captchaValid;
    },

    async getPaymentRequest(applePayConfig) {
      this.applePayAvailable = true;
      const [
        cartStore,
        configStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);
      const {
        countryCode,
        merchantCapabilities,
        supportedNetworks,
      } = applePayConfig;

      return {
        countryCode,
        currencyCode: configStore.currencyCode,
        merchantCapabilities,
        supportedNetworks,
        requiredBillingContactFields: [
          'name',
          'phone',
          'email',
          'postalAddress',
        ],
        requiredShippingContactFields: [],
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
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const { billingContact } = data.payment;

      const billingAddress = await this.mapAppleAddress(
        billingContact,
        cartStore.cart.email,
        cartStore.cart.shipping_addresses[0]?.telephone
        || cartStore.cart.billing_address?.telephone,
      );

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
          this.makePayment(
            cartStore.cart.email,
            this.orderID,
            this.method,
            false,
          ).then(async () => {
            session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
            window.location.href = window.bluefinchCheckout.helpers.getSuccessPageUrl();
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

    // we are not using those callbacks on payment page,
    // but they are required by ppcp-web
    onShippingContactSelect() {},

    onShippingMethodSelect() {},
  },
};
</script>
