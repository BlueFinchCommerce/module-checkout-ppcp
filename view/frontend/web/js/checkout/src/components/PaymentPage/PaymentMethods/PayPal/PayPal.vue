<template>
  <div
    :class="{ active: isMethodSelected }"
    class="pay-pal-container"
  >
    <div
      class="pay-pal-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod">
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
        alt="pay-pal-logo">
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
      :id="`ppcp-paypal_ppcp_paypal`"
      :class="!paypalLoaded ? 'text-loading' : ''"
      :data-cy="'instant-checkout-ppcpPayPal'"
    />
    <div
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      class="paypal-button-container"
      :id="`ppcp-paypal_ppcp_paylater`"
      :class="!paypalLoaded ? 'text-loading' : ''"
      :data-cy="'instant-checkout-ppcpPayLater'"
    />
    <div
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      :class="!paypalLoaded ? 'text-loading' : ''"
      class="paypal-messages-container"
      :id="`ppcp-paypal_messages`"
      :data-cy="'instant-checkout-ppcpMessages'"
    />

    <div class="pay-pal-content" v-if="isMethodSelected">
      <component :is="PrivacyPolicy" />
      <component
        :is="Recaptcha"
        v-if="isRecaptchaVisible('placeOrder')"
        id="placeOrder"
        location="ppcpPayment"
      />
      <component :is="Agreements" id="ppcp-checkout-pay-pal" />
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
import payPalImage from '../../icons/pp-acceptance-medium.png';

export default {
  name: 'PpcpPayPalPayment',
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
      isRecaptchaVisible: () => {},
      orderID: null,
      paypalLoaded: false,
      address: {},
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
    await this.addScripts();

    this.namespace = `${this.namespace}`;

    if (this.paypal.payLaterActive) {
      this.namespace = `${this.method}_paylater`;
    }

    await this.renderPaypalInstance();

    if (this.open) {
      await this.selectPaymentMethod();
    }
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
  methods: {
    ...mapActions(usePpcpStore, ['makePayment']),

    async selectPaymentMethod() {
      this.isMethodSelected = true;

      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_paypal');
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

      if (this.paypal.payLaterMessageActive) {
        params.components += ',messages';
      }

      if (this.paypal.payLaterActive) {
        params['enable-funding'] = 'paylater';
      }

      return loadPayPalScript(
        'https://www.paypal.com/sdk/js',
        params,
        'ppcp_paypal',
      );
    },

    async renderPaypalInstance() {
      const cartStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);

      const paypalConfig = window[`paypal_${this.method}`];
      if (paypalConfig) {
        const commonRenderData = {
          env: this.environment,
          commit: true,
          style: {
            label: this.paypal.buttonLabel,
            size: 'responsive',
            shape: this.paypal.buttonShape,
            color: this.paypal.buttonColor,
            tagline: false,
          },
          fundingSource: this.paypal.payLaterActive
            ? paypalConfig.FUNDING.PAYLATER
            : paypalConfig.FUNDING.PAYPAL,
          createOrder: async () => {
            try {
              const data = await createPPCPPaymentRest(
                this.method,
                this.paypal.vaultActive,
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
            ] = await window.geneCheckout.helpers.loadFromCheckout([
              'stores.usePaymentStore',
              'stores.useLoadingStore',
            ]);

            return this.makePayment(cartStore.cart.email, this.orderID, this.method, false)
              .then(() => window.geneCheckout.services.refreshCustomerData(['cart']))
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
        // Render the PayPal button
        const paypalButtonData = {
          ...commonRenderData,
          fundingSource: paypalConfig.FUNDING.PAYPAL,
        };
        await paypalConfig.Buttons(paypalButtonData).render(
          '#ppcp-paypal_ppcp_paypal',
        );

        // Render the PayPal Pay Later button (if active)
        if (this.paypal.payLaterActive) {
          const payLaterButtonData = {
            ...commonRenderData,
            fundingSource: paypalConfig.FUNDING.PAYLATER,
            style: {
              ...commonRenderData.style,
              color: this.paypal.payLaterButtonColour,
              shape: this.paypal.payLaterButtonShape,
            },
          };
          await paypalConfig.Buttons(payLaterButtonData).render(
            '#ppcp-paypal_ppcp_paylater',
          );
        }

        const payLaterMessagingConfig = {
          amount: cartStore.cart.total,
          style: {
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
          },
        };

        // Render the PayPal messages (if active)
        if (this.paypal.payLaterMessageActive) {
          await paypalConfig.Messages(payLaterMessagingConfig).render(
            '#ppcp-paypal_messages',
          );
        }

        this.paypalLoaded = true;
      }
    },

    redirectToSuccess() {
      window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
    },
  },
};
</script>
