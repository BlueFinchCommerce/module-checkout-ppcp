<template>
  <div v-for="allowedMethod in allowedMethods" :key="allowedMethod.name">
    <!-- * We need to hide iDEAL from mobile devices as the webhook callbacks aren't currently available
         * so the method fails to completely successfully. -->
    <div
      :style="{
        display: allowedMethod.name === 'ideal' && isMobile ? 'none' : 'block',
      }"
    >
      <div
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
            :text="allowedMethod.title"
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
          v-if="errorMessages[allowedMethod.prefixedName]"
          :message="errorMessages[allowedMethod.prefixedName]"
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
              :location="`${allowedMethod.name}-ppcpPaymentApm`"
            />
          </div>
          <component :is="Agreements" id="ppcp-checkout-apm-payment" />
        </div>
      </div>
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
      errorMessages: {},
      errorMessage: '',
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      isRecaptchaVisible: () => {},
      orderID: null,
      availableMethods: [],
      prefix: 'ppcp_apm',
      isMobile: window.innerWidth <= 768,
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
        this.errorMessages = {};
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

    window.addEventListener('resize', this.updateDeviceType);
    this.updateDeviceType();
  },

  beforeUnmount() {
    window.removeEventListener('resize', this.updateDeviceType);
  },

  methods: {
    ...mapActions(usePpcpStore, [
      'getEnvironment',
      'mapAddress',
      'makePayment',
      'mapSelectedAddress',
    ]),

    updateDeviceType() {
      this.isMobile = window.innerWidth <= 768;
    },

    async selectPaymentMethod(method) {
      this.selectedMethod = method;

      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod(method);
    },

    getAllowedMethods() {
      const paymentsArray = this.apm.allowedPayments;
      const methods = {};

      paymentsArray.forEach((paymentMethod) => {
        methods[paymentMethod.value] = {
          title: paymentMethod.label,
          name: paymentMethod.value,
          prefixedName: `${this.prefix}_${paymentMethod.value}`,
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
        createOrder: (method) => this.createOrder(method, self),
        onApprove: (method) => this.onApprove(method, self),
        onClick: () => this.onClick(),
        onCancel: (method) => this.onCancel(method, self),
        onError: (err) => this.onError(err),
        isPaymentMethodAvailable: (bool, method) => this.isPaymentMethodAvailable(bool, method),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.apmPayments(options, element);
      this.apmPaymentLoaded = true;
    },

    isPaymentMethodAvailable(isAvailable, method) {
      const element = document.getElementById(`paypal_${method}_method`);
      element.style.display = isAvailable ? '' : 'none';
    },

    createOrder: async (method, self) => {
      try {
        const methodKey = `${self.prefix}_${method}`;
        const data = await createPPCPPaymentRest(
          methodKey,
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

    onApprove: async (method, self) => {
      const methodKey = `${self.prefix}_${method}`;
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
        self.prefix,
        false,
        false,
        methodKey,
      ).then(() => {
        self.errorMessages[methodKey] = '';
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

    onCancel: async (method, self) => {
      const methodKey = `${self.prefix}_${method}`;
      const error = 'Cannot validate payment.';
      const loadingStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
      ]);
      self.errorMessages[methodKey] = error;
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
