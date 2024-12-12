<template>
  <div
    :class="{ active: isMethodSelected }"
    class="venmo-container"
  >
    <div
      class="venmo-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod">
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
        alt="venmo-logo">
    </div>
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />

    <div
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      class="paypal-button-container"
      :id="`paypal-button-container-venmo`"
      :class="!venmoLoaded ? 'text-loading' : ''"
      :data-cy="'instant-checkout-ppcpPayPalVenmo'"
    />
    <div class="venmo-content" v-if="isMethodSelected">
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
      <component
        :is="Recaptcha"
        v-if="isRecaptchaVisible('placeOrder')"
        id="placeOrder"
        location="ppcpPayment"
      />
      <component :is="Agreements" id="ppcp-checkout-venmo" />
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
import venmoImage from '../../icons/venmo_logo_blue.png';

export default {
  name: 'PpcpVenmoPayment',
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
  props: {
    open: {
      type: Boolean,
      required: false,
    },
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
    if (!window.paypal_ppcp_venmo) {
      await this.addScripts();
    }
    await this.renderPaypalInstance();

    if (this.open) {
      await this.selectPaymentMethod();
    }
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
  methods: {
    ...mapActions(usePpcpStore, ['makePayment']),

    async selectPaymentMethod() {
      this.isMethodSelected = true;

      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_venmo');
    },

    async addScripts() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const loadPayPalScript = loadScript();
      const params = {
        intent: this.paypal.paymentAction,
        currency: configStore.currencyCode,
        components: 'buttons',
      };

      if (this.environment === 'sandbox') {
        params['buyer-country'] = this.buyerCountry;
        params['client-id'] = this.sandboxClientId;
      } else {
        params['client-id'] = this.productionClientId;
      }

      params['enable-funding'] = 'venmo';

      return loadPayPalScript(
        'https://www.paypal.com/sdk/js',
        params,
        'ppcp_venmo',
      );
    },

    async renderPaypalInstance() {
      const paypalConfig = window.paypal_ppcp_venmo;
      if (paypalConfig) {
        const commonRenderData = {
          env: this.environment,
          commit: true,
          style: {
            label: this.paypal.buttonLabel,
            size: 'responsive',
            shape: this.paypal.buttonShape,
            color: this.paypal.buttonColor === 'gold' ? 'blue' : this.paypal.buttonColor,
            tagline: false,
          },
          fundingSource: paypalConfig.FUNDING.VENMO,
          createOrder: async () => {
            try {
              const data = await createPPCPPaymentRest(
                this.method,
                this.venmo.vaultActive,
                1,
              );
              const orderData = JSON.parse(data);

              const [orderID] = orderData;
              this.orderID = orderID;

              return this.orderID;
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
            ] = await window.geneCheckout.helpers.loadFromCheckout([
              'stores.usePaymentStore',
              'stores.useAgreementStore',
              'stores.useLoadingStore',
            ]);

            paymentStore.setErrorMessage('');
            const agreementsValid = agreementStore.validateAgreements();

            if (!agreementsValid) {
              return false;
            }
            loadingStore.setLoadingState(true);
            return true;
          },
          onApprove: async () => {
            const [
              paymentStore,
              loadingStore,
              cartStore,
            ] = await window.geneCheckout.helpers.loadFromCheckout([
              'stores.usePaymentStore',
              'stores.useLoadingStore',
              'stores.useCartStore',
            ]);
            return this.makePayment(
              cartStore.cart.email,
              this.orderID,
              this.method,
              false,
              this.storeMethod,
            ).then(() => {
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
        };

        await paypalConfig.Buttons(commonRenderData).render(
          '#paypal-button-container-venmo',
        );

        this.venmoLoaded = true;
      }
    },

    redirectToSuccess() {
      window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
    },
  },
};
</script>
