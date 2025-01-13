<template>
  <div
    v-if="methodEligible"
    :class="{ active: isMethodSelected }"
    class="venmo-container"
  >
    <div
      class="venmo-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod"
    >
      <component
        :is="RadioButton"
        id="venmo-select"
        :text="venmo.title"
        :checked="isMethodSelected"
        :data-cy="'venmo-radio'"
        class="venmo-radio"
        @click="selectPaymentMethod"
        @keydown="selectPaymentMethod"
      />
      <img
        width="48px"
        class="venmo-logo"
        :src="venmoLogo"
        alt="venmo-logo"
      >
    </div>
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />

    <div
      :id="`paypal-button-container-venmo`"
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      class="paypal-button-container"
      :class="!venmoLoaded ? 'text-loading' : ''"
      :data-cy="'instant-checkout-ppcpPayPalVenmo'"
    />
    <div v-if="isMethodSelected" class="venmo-content">
      <div class="recaptcha">
        <component
          :is="Recaptcha"
          v-if="isRecaptchaVisible('placeOrder')"
          id="placeOrder"
          location="ppcpPaymentVenmo"
        />
      </div>
      <component
        :is="checkboxComponent"
        v-if="isLoggedIn && (
          (selectedMethod === 'ppcp_venmo' && venmo.vaultActive)
        )"
        id="ppcp-store-method"
        class="ppcp-store-method"
        :checked="storeMethod"
        :change-handler="({ currentTarget }) => storeMethod = currentTarget.checked"
        text="Save for later use."
        :data-cy="'ppcp-save-payment-venmo-checkbox'"
      />
      <component :is="PrivacyPolicy" />
      <component :is="Agreements" id="ppcp-checkout-venmo" />
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
import venmoImage from '../../icons/venmo_logo_blue.png';

export default {
  name: 'PpcpVenmoPayment',
  props: {
    open: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      isMethodSelected: false,
      methodEligible: true,
      errorMessage: '',
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      paymentEmitter: null,
      isPaymentMethodAvailable: null,
      selectedMethod: 'ppcp_venmo',
      method: 'ppcp_venmo',
      isRecaptchaVisible: () => {},
      orderID: null,
      venmoLoaded: false,
      checkboxComponent: null,
      storeMethod: false,
      isLoggedIn: false,
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'venmo',
      'paypal',
      'environment',
      'buyerCountry',
      'productionClientId',
      'sandboxClientId',
    ]),
    venmoLogo() {
      return venmoImage;
    },
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== 'ppcp_venmo') {
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
    } = await import(window.geneCheckout.main);

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
    ] = await window.geneCheckout.helpers.loadFromCheckout([
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
    await this.renderVenmoInstance();

    if (this.open) {
      await this.selectPaymentMethod();
    }
  },
  methods: {
    ...mapActions(usePpcpStore, ['makePayment']),

    async selectPaymentMethod() {
      this.isMethodSelected = true;

      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_venmo');
    },

    async renderVenmoInstance() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);
      const cartStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);

      const self = this;
      const element = 'paypal-button-container-venmo';

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
        buttonStyles: {
          buttonLabel: this.paypal.buttonLabel,
          buttonSize: 'responsive',
          buttonShape: this.paypal.buttonShape,
          buttonColor: this.paypal.buttonColor,
          buttonTagline: false,
        },
        buttonHeight: 40,
      };

      const callbacks = {
        createOrder: () => this.createOrder(self),
        onApprove: () => this.onApprove(self),
        onClick: () => this.onClick(),
        onCancel: () => this.onCancel(),
        onError: (err) => this.onError(err),
        isPaymentMethodEligible: (bool) => this.isPaymentMethodEligible(bool),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.venmoPayment(options, element);
      this.venmoLoaded = true;
    },

    isPaymentMethodEligible(isAvailable) {
      this.methodEligible = isAvailable;
    },

    createOrder: async (self) => {
      try {
        const data = await createPPCPPaymentRest(
          self.method,
          self.venmo.vaultActive,
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

    onClick: async () => {
      const [
        paymentStore,
        agreementStore,
        loadingStore,
        recaptchaStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
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
      loadingStore.setLoadingState(true);
      return true;
    },

    onApprove: async (self) => {
      const [
        paymentStore,
        loadingStore,
        cartStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
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
            window.geneCheckout.helpers.handleServiceError(err);
          } catch (formattedError) {
            paymentStore.setErrorMessage(formattedError);
          }
        });
    },

    onCancel: async () => {
      const loadingStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
      ]);

      loadingStore.setLoadingState(false);
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

    redirectToSuccess() {
      window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
    },
  },
};
</script>
