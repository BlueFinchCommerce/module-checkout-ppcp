<template>
  <div
    :class="{ active: isMethodSelected }"
    class="pay-pal-container"
  >
    <div
      class="pay-pal-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod"
    >
      <component
        :is="RadioButton"
        id="pay-pal-select"
        :text="paypal.title"
        :checked="isMethodSelected"
        :data-cy="'pay-pal-radio'"
        class="pay-pal-radio"
        @click="selectPaymentMethod"
        @keydown="selectPaymentMethod"
      />
      <img
        width="48px"
        class="pay-pal-logo"
        :src="payPalLogo"
        alt="pay-pal-logo"
      >
    </div>
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />

    <div
      v-if="paypal.enabled"
      :id="`ppcp-paypal-paypal`"
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      class="paypal-button-container"
      :class="!paypalLoaded ? 'text-loading' : ''"
      :data-cy="'instant-checkout-ppcpPayPal'"
    />
    <div
      v-if="paypal.payLaterActive"
      :id="`ppcp-paypal-paylater`"
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      class="paypal-button-container"
      :class="!paypalLoaded ? 'text-loading' : ''"
      :data-cy="'instant-checkout-ppcpPayLater'"
    />

    <div v-if="isMethodSelected" class="pay-pal-content">
      <div class="recaptcha">
        <component
          :is="Recaptcha"
          v-if="isRecaptchaVisible('placeOrder')"
          id="placeOrder"
          location="ppcpPaymentPayPal"
        />
      </div>
      <component
        :is="checkboxComponent"
        v-if="isLoggedIn && (
          (selectedMethod === 'ppcp_paypal' && paypal.vaultActive)
        )"
        id="ppcp-store-method"
        class="ppcp-store-method"
        :checked="storeMethod"
        :change-handler="({ currentTarget }) => storeMethod = currentTarget.checked"
        text="Save for later use."
        :data-cy="'ppcp-save-payment-paypal-checkbox'"
      />
      <component :is="PrivacyPolicy" />
      <component :is="Agreements" id="ppcp-checkout-pay-pal" />
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
import payPalImage from '../../icons/pp-acceptance-medium.png';

export default {
  name: 'PpcpPayPalPayment',
  props: {
    open: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      isMethodSelected: false,
      errorMessage: '',
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      paymentEmitter: null,
      isPaymentMethodAvailable: null,
      selectedMethod: 'ppcp_paypal',
      method: 'ppcp_paypal',
      namespace: 'paypal_ppcp_paypal',
      fundingSource: '',
      isRecaptchaVisible: () => {},
      orderID: null,
      paypalLoaded: false,
      address: {},
      checkboxComponent: null,
      storeMethod: false,
      isLoggedIn: false,
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
    payPalLogo() {
      return payPalImage;
    },
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== 'ppcp_paypal') {
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
          Checkbox,
        },
      },
    } = await import(window.bluefinchCheckout.main);

    this.Agreements = Agreements;
    this.ErrorMessage = ErrorMessage;
    this.RadioButton = RadioButton;
    this.Recaptcha = Recaptcha;
    this.PrivacyPolicy = PrivacyPolicy;
    this.checkboxComponent = Checkbox;
  },
  async created() {
    const [
      recaptchaStore,
      paymentStore,
      configStore,
      cartStore,
      customerStore,
    ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
      'stores.useRecaptchaStore',
      'stores.usePaymentStore',
      'stores.useConfigStore',
      'stores.useCartStore',
      'stores.useCustomerStore',
    ]);

    this.paymentEmitter = paymentStore.paymentEmitter;
    this.isPaymentMethodAvailable = paymentStore.isPaymentMethodAvailable;
    this.isRecaptchaVisible = recaptchaStore.isRecaptchaVisible;
    this.isLoggedIn = customerStore.isLoggedIn;

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
    await this.renderPaypalInstance();

    if (this.open) {
      await this.selectPaymentMethod();
    }
  },
  methods: {
    ...mapActions(usePpcpStore, ['makePayment']),

    async selectPaymentMethod() {
      this.isMethodSelected = true;

      const paymentStore = await window.bluefinchCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_paypal');
    },

    async renderPaypalInstance() {
      const configStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);
      const cartStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);

      const self = this;
      const element = 'ppcp-paypal';

      let messageStyles;
      if (this.paypal.payLaterMessageActive) {
        messageStyles = {
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
        };
      }

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
        messageStyles,
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
        onClick: (data) => this.onClick(data, self),
        onCancel: () => this.onCancel(),
        onError: (err) => this.onError(err),
        onShippingAddressChange: (data) => this.onShippingAddressChange(self, data),
        onShippingOptionsChange: (data) => this.onShippingOptionsChange(self, data),
        isPaymentMethodEligible: (bool, method) => this.isPaymentMethodEligible(bool, method),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.paypalButtons(options, element);
      this.paypalLoaded = true;
    },

    isPaymentMethodEligible() {
      // Function only required for express checkout
    },

    createOrder: async (self) => {
      try {
        const vault = self.fundingSource === 'paypal' && self.paypal.vaultActive;
        const data = await createPPCPPaymentRest(
          self.method,
          vault,
          1,
        );
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
    onClick: async (data, self) => {
      const [
        paymentStore,
        agreementStore,
        loadingStore,
        recaptchaStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useAgreementStore',
        'stores.useLoadingStore',
        'stores.useRecaptchaStore',
      ]);

      paymentStore.setErrorMessage('');
      const agreementsValid = agreementStore.validateAgreements();
      const captchaValid = await recaptchaStore.validateToken('placeOrder');

      if (!agreementsValid || !captchaValid) {
        return false;
      }
      self.fundingSource = data.fundingSource;
      loadingStore.setLoadingState(true);
      return true;
    },

    onApprove: async (self) => {
      const [
        paymentStore,
        loadingStore,
        cartStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useLoadingStore',
        'stores.useCartStore',
      ]);

      return self.makePayment(
        cartStore.cart.email,
        self.orderID,
        self.method,
        false,
        self.storeMethod,
      ).then(() => {
        self.redirectToSuccess();
      })
        .catch((err) => {
          loadingStore.setLoadingState(false);
          try {
            window.bluefinchCheckout.helpers.handleServiceError(err);
          } catch (formattedError) {
            paymentStore.setErrorMessage(formattedError);
          }
        });
    },
    onCancel: async () => {
      const loadingStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
      ]);

      loadingStore.setLoadingState(false);
    },
    onError: async (err) => {
      const [
        paymentStore,
        loadingStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useLoadingStore',
      ]);
      loadingStore.setLoadingState(false);
      paymentStore.setErrorMessage(err);
    },

    onShippingAddressChange: () => {
      // Function only required for express checkout
    },
    onShippingMethodChange: () => {
      // Function only required for express checkout
    },

    redirectToSuccess() {
      window.location.href = window.bluefinchCheckout.helpers.getSuccessPageUrl();
    },
  },
};
</script>
