<template>
  <div v-for="allowedMethod in allowedMethods">
    <div
      v-if="allowedMethod.isAvailable"
      :id="`paypal_${allowedMethod.name}_method`"
      :style="{ display: 'none' }"
      :class="{ active: selectedMethod === allowedMethod.prefixedName }"
      class="apm-payment-container"
    >
      <div
        class="apm-payment-title"
        :class="selectedMethod === allowedMethod.prefixedName ? 'selected' : ''"
        @click="selectPaymentMethod(allowedMethod.prefixedName)"
        @keydown="selectPaymentMethod(allowedMethod.prefixedName)"
      >
        <component
          :is="RadioButton"
          :id="`paypal_${allowedMethod.name}_select`"
          :text="allowedMethod.name"
          :checked="selectedMethod === allowedMethod.prefixedName"
          :data-cy="'apm-payment-radio'"
          class="apm-payment-radio"
          @click="selectPaymentMethod(allowedMethod.prefixedName)"
          @keydown="selectPaymentMethod(allowedMethod.prefixedName)"
        />
        <span :id="`paypal_${allowedMethod.name}_mark`" />
      </div>
      <component
        :is="ErrorMessage"
        v-if="errorMessage"
        :message="errorMessage"
        :attached="false"
      />
      <div
        id="ppcp-apm-payment"
        :style="{ display: selectedMethod === allowedMethod.prefixedName ? 'block' : 'none' }"
        :class="!apmPaymentLoaded && selectedMethod === allowedMethod.prefixedName ? 'text-loading' : ''"
        :data-cy="'checkout-PPCP-apm-payment'"
      />
      <div
        :style="{ display: selectedMethod === allowedMethod.prefixedName ? 'block' : 'none' }"
        class="apm-payment-content"
      >
        <div class="actions-toolbar" data-bind="css: {'ppcp-disabled': !isPlaceOrderActionAllowed()}">
          <div :id="`paypal_${allowedMethod.name}_fields`" />
          <div :id="`paypal_${allowedMethod.name}_button`" />
        </div>
        <component :is="PrivacyPolicy" />
        <div class="recaptcha">
          <component
            :is="Recaptcha"
            v-if="isRecaptchaVisible('placeOrder')"
            id="placeOrder"
            location="ppcpPaymentApm"
          />
        </div>
        <component :is="Agreements" id="ppcp-checkout-apm-payment" />
      </div>
    </div>
  </div>
</template>

<script>
/* eslint-disable import/no-extraneous-dependencies */
import ppcp from 'ppcp-web';
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../../stores/PpcpStore';

export default {
  name: 'PpcpApmPayment',
  props: {
    open: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      selectedMethod: null,
      apmPaymentLoaded: false,
      allowedMethods: {},
      errorMessage: '',
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      isRecaptchaVisible: () => {},
      orderID: null,
      availableMethods: [],
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'apm',
      'environment',
      'buyerCountry',
      'productionClientId',
      'sandboxClientId',
    ]),
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null) {
          this.selectedMethod = newVal;
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

    this.isRecaptchaVisible = recaptchaStore.isRecaptchaVisible;

    paymentStore.$subscribe((mutation) => {
      if (typeof mutation.payload.selectedMethod !== 'undefined') {
        this.selectedMethod = mutation.payload.selectedMethod;
      }
    });

    await configStore.getInitialConfig();
    await cartStore.getCart();

    this.allowedMethods = this.getAllowedMethods();
    await Promise.all(
      Object.values(this.allowedMethods).map((method) => this.initApmPay(method.name)),
    );

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

    async selectPaymentMethod(method) {
      this.selectedMethod = method;

      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod(method);
    },

    getAllowedMethods() {
      const paymentsArray = this.apm.allowedPayments.split(',');
      const methods = {};

      // Add a prefix to each element using map
      const prefix = 'ppcp_';

      paymentsArray.forEach((paymentMethod) => {
        methods[paymentMethod] = {
          name: paymentMethod,
          prefixedName: prefix + paymentMethod,
          isAvailable: true,
        };
      });
      this.allowedMethods = methods;
      return methods;
    },

    async initApmPay(element) {
      const [
        configStore,
        cartStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
        'stores.useCartStore',
      ]);

      const self = this;

      const configuration = {
        sandboxClientId: this.sandboxClientId,
        productionClientId: this.productionClientId,
        pageType: 'checkout',
        environment: this.environment,
        commit: true,
        amount: cartStore.cart.prices.grand_total.value,
        buyerCountry: this.buyerCountry,
        currency: configStore.currencyCode,
      };

      const callbacks = {
        createOrder: () => this.createOrder(self),
        onApprove: () => this.onApprove(self),
        onClick: () => this.onClick(),
        onCancel: () => this.onCancel(),
        onError: (err) => this.onError(err),
        isPaymentMethodAvailable: (bool, method) => this.isPaymentMethodAvailable(bool, method),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.apmPayments(options, element);
      this.apmPaymentLoaded = true;
    },

    isPaymentMethodAvailable(isAvailable, method) {
      this.allowedMethods[method].isAvailable = isAvailable;
      const element = document.getElementById(`paypal_${method}_method`);
      element.style.display = isAvailable ? '' : 'none';
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
<style>
.paypal-mark {
    margin: 0;
    padding: 5px;
    img {
        width: 36px;
    }
}
</style>
