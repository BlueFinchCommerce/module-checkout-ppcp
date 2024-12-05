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
      v-if="applePayAvailable && isMethodSelected"
      class="ppcp-apple-pay-button"
      :class='!applePayLoaded ? "text-loading" : "ppcp-apple-pay"'>
      <apple-pay-button
        v-if="applePayLoaded"
        @click="onClick"
        id="ppcp-apple-pay"
        type="plain"
        locale="en" />
    </div>
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />
    <div
      v-show="isMethodSelected"
      id="ppcp-apple-pay"
      :class="!applePayLoaded && isMethodSelected ? 'text-loading' : ''"
      :data-cy="'checkout-PPCPApplePay'"
    />
    <div class="apple-pay-content" v-if="isMethodSelected">
      <component :is="PrivacyPolicy" />
      <component
        :is="Recaptcha"
        v-if="isRecaptchaVisible('placeOrder')"
        id="placeOrder"
        location="ppcpPayment"
      />
      <component :is="Agreements" id="ppcp-checkout-apple-pay" />
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
      isRecaptchaVisible: () => {},
      orderID: null,
    };
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

    if (!this.apple.merchantName) {
      await this.getInitialConfigValues();
    }

    await this.addSdkScript();
    this.showApplePay();
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
      'getInitialConfigValues',
      'makePayment',
      'mapSelectedAddress',
      'mapAppleAddress',
    ]),

    async selectPaymentMethod() {
      this.isMethodSelected = true;
      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_applepay');
    },

    async addSdkScript() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const loadPayPalScript = loadScript();
      const params = {
        intent: this.apple.paymentAction,
        currency: configStore.currencyCode,
        components: 'applepay',
      };

      if (this.environment === 'sandbox') {
        params['buyer-country'] = this.buyerCountry;
        params['client-id'] = this.sandboxClientId;
      } else {
        params['client-id'] = this.productionClientId;
      }

      try {
        await Promise.all([
          loadPayPalScript(
            'https://www.paypal.com/sdk/js',
            params,
            'ppcp_applepay',
          ),
          loadPayPalScript(
            'https://applepay.cdn-apple.com/jsapi/v1.1.0/apple-pay-sdk.js',
            {},
            '',
          ),
        ]);
      } catch (error) {
        console.error('Error loading SDK scripts:', error);
        throw new Error('Failed to load required SDK scripts.');
      }
    },

    showApplePay() {
      // If the browser doesn't support Apple Pay then return early.
      if (
        !window.ApplePaySession
        || !window.ApplePaySession.canMakePayments
        || window.location.protocol !== 'https:'
      ) {
        return;
      }

      this.applePayAvailable = true;

      const applepay = window[`paypal_${this.selectedMethod}`].Applepay();

      applepay.config()
        .then((applepayConfig) => {
          this.applePayConfig = applepayConfig;
          this.isEligible = !!applepayConfig.isEligible;
          this.applePayLoaded = true;
        })
        .catch(() => {
          console.error('Error while fetching Apple Pay configuration.');
        });
    },

    async onClick() {
      const [
        agreementStore,
        cartStore,
        configStore,
        loadingStore,
        paymentStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useAgreementStore',
        'stores.useCartStore',
        'stores.useConfigStore',
        'stores.useLoadingStore',
        'stores.usePaymentStore',
      ]);

      paymentStore.setErrorMessage('');

      // Check that the agreements (if any) is valid.
      const agreementsValid = agreementStore.validateAgreements();

      if (!agreementsValid) {
        return;
      }

      const applepay = window[`paypal_${this.selectedMethod}`].Applepay();

      try {
        const paymentRequest = {
          countryCode: configStore.countryCode,
          currencyCode: configStore.currencyCode,
          merchantCapabilities: this.applePayConfig.merchantCapabilities,
          supportedNetworks: this.applePayConfig.supportedNetworks,
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

        const session = new window.ApplePaySession(4, paymentRequest);

        session.onvalidatemerchant = (event) => {
          applepay.validateMerchant({
            validationUrl: event.validationURL,
          }).then((payload) => {
            session.completeMerchantValidation(payload.merchantSession);
          }).catch((err) => {
            console.error(err);
            session.abort();
            loadingStore.setLoadingState(false);
          });
        };

        session.onpaymentauthorized = (data) => this.onAuthorized(data, session);

        session.begin();
      } catch (err) {
        await this.setApplePayError();
      }
    },

    async onAuthorized(data, session) {
      const [
        cartStore,
        configStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const applepay = window[`paypal_${this.selectedMethod}`].Applepay();

      const { billingContact } = data.payment;
      const billingAddress = await this.mapAppleAddress(
        billingContact,
        cartStore.cart.email,
        cartStore.cart.shipping_addresses[0].telephone,
      );

      let shippingAddress = null;
      if (!cartStore.cart.is_virtual) {
        shippingAddress = await this.mapSelectedAddress(cartStore.cart.shipping_addresses[0]);
      }

      if (!configStore.countries.some(({ id }) => id === billingAddress.country_code)) {
        session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        return;
      }

      const ppcpOrderId = await createPPCPPaymentRest(this.selectedMethod);
      [this.orderID] = JSON.parse(ppcpOrderId);

      applepay.confirmOrder({
        orderId: this.orderID,
        token: data.payment.token,
        billingContact: data.payment.billingContact,
      }).then(async () => {
        try {
          window.geneCheckout.services.setAddressesOnCart(
            shippingAddress,
            billingAddress,
            cartStore.cart.email,
          ).then(() => this.makePayment(
            cartStore.cart.email,
            this.orderID,
            this.selectedMethod,
            false,
          )).then(async () => {
            session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
            await window.geneCheckout.services.refreshCustomerData(
              window.geneCheckout.helpers.getCartSectionNames(),
            );
            window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
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
  },
};
</script>
