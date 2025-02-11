<template>
  <div
    :class="{ active: isMethodSelected }"
    class="card-container"
  >
    <div
      class="card-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod"
    >
      <component
        :is="RadioButton"
        id="card-select"
        :text="card.title"
        :checked="isMethodSelected"
        :data-cy="'card-radio'"
        class="card-radio"
        @click="selectPaymentMethod"
        @keydown="selectPaymentMethod"
      />
    </div>
    <component
      :is="ErrorMessage"
      v-if="errorMessage"
      :message="errorMessage"
      :attached="false"
    />

    <fieldset
      class="card-fieldset"
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
    >
      <div class="field required">
        <label for="card-number-field-container" class="label">
          <span>
            Credit Card Number
          </span>
        </label>
        <div id="card-number-field-container" />
        <component
          :is="ErrorMessage"
          v-if="hostedNumberErrorMessage"
          :message="hostedNumberErrorMessage"
          :attached="false"
        />
      </div>

      <div class="field required">
        <label for="card-expiry-field-container" class="label">
          <span>
            Expiration Date
          </span>
        </label>
        <div id="card-expiry-field-container" />
        <component
          :is="ErrorMessage"
          v-if="hostedDateErrorMessage"
          :message="hostedDateErrorMessage"
          :attached="false"
        />
      </div>

      <div class="field required">
        <label for="card-cvv-field-container" class="label">
          <span>
            Card Verification Number
          </span>
        </label>
        <div id="card-cvv-field-container" />
        <component
          :is="ErrorMessage"
          v-if="hostedCvvErrorMessage"
          :message="hostedCvvErrorMessage"
          :attached="false"
        />
      </div>
    </fieldset>

    <component
      :is="MyButton"
      id="card-field-submit-button"
      :label="$t('Pay')"
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      primary
    />

    <div v-if="isMethodSelected" class="card-content">
      <component :is="PrivacyPolicy" />
      <div class="recaptcha">
        <component
          :is="Recaptcha"
          v-if="isRecaptchaVisible('placeOrder')"
          id="placeOrder"
          location="ppcpPaymentCredit"
        />
      </div>
      <component
        :is="checkboxComponent"
        v-if="isLoggedIn && (
          (selectedMethod === 'ppcp_card' && card.vaultActive)
        )"
        id="ppcp-store-method"
        class="ppcp-store-method"
        :checked="storeMethod"
        :change-handler="({ currentTarget }) => storeMethod = currentTarget.checked"
        text="Save for later use."
        :data-cy="'ppcp-save-payment-card-checkbox'"
      />
      <component :is="Agreements" id="ppcp-checkout-card" />
    </div>
  </div>
</template>

<script>
/* eslint-disable import/no-extraneous-dependencies */
import ppcp from 'bluefinch-ppcp-web';
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../../stores/PpcpStore';

// Services
import createPPCPPaymentRest from '../../../../services/createPPCPPaymentRest';

export default {
  name: 'PpcpCreditCardPayment',
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
      hostedNumberErrorMessage: '',
      hostedDateErrorMessage: '',
      hostedCvvErrorMessage: '',
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      MyButton: null,
      checkboxComponent: null,
      paymentEmitter: null,
      isPaymentMethodAvailable: null,
      selectedMethod: 'ppcp_card',
      method: 'ppcp_card',
      numberField: '#card-number-field-container',
      cvvField: '#card-cvv-field-container',
      expiryField: '#card-expiry-field-container',
      submitButton: '#card-field-submit-button',
      isRecaptchaVisible: () => {},
      orderID: null,
      storeMethod: false,
      isLoggedIn: false,
    };
  },
  computed: {
    ...mapState(usePpcpStore, [
      'card',
      'environment',
      'buyerCountry',
      'productionClientId',
      'sandboxClientId',
    ]),
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== 'ppcp_card') {
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
          MyButton,
          Checkbox,
        },
      },
    } = await import(window.bluefinchCheckout.main);

    this.Agreements = Agreements;
    this.ErrorMessage = ErrorMessage;
    this.RadioButton = RadioButton;
    this.Recaptcha = Recaptcha;
    this.PrivacyPolicy = PrivacyPolicy;
    this.MyButton = MyButton;
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
    await this.initCardFields();

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
      paymentStore.selectPaymentMethod('ppcp_card');
    },

    async initCardFields() {
      const configStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const self = this;
      const element = this.submitButton;

      const configuration = {
        sandboxClientId: this.sandboxClientId,
        productionClientId: this.productionClientId,
        intent: this.card.paymentAction,
        pageType: 'checkout',
        environment: this.environment,
        buyerCountry: this.buyerCountry,
        currency: configStore.currencyCode,
        style: this.getStyles(),
        cardFields: {
          numberField: {
            id: this.numberField,
            placeholder: '4111 1111 1111 1111',
            inputEvents: {
              blur: (data, input) => this.inputBlur(data, input, 'cardNumberField'),
              change: () => this.inputChange(self, 'cardNumberField'),
            },
          },
          expiryField: {
            id: this.expiryField,
            placeholder: 'MM/YY',
            inputEvents: {
              blur: (data, input) => this.inputBlur(data, input, 'cardExpiryField'),
              change: () => this.inputChange(self, 'cardExpiryField'),
            },
          },
          cvvField: {
            id: this.cvvField,
            placeholder: '123',
            inputEvents: {
              blur: (data, input) => this.inputBlur(data, input, 'cardCvvField'),
              change: () => this.inputChange(self, 'cardCvvField'),
            },
          },
        },
      };

      const callbacks = {
        createOrder: () => this.createOrder(self),
        onApprove: () => this.onApprove(self),
        onError: (error) => this.onError(error),
        active: (bool) => this.active(bool),
        onValidate: () => this.onValidate(),
        handleErrors: (errors) => this.handleErrors(errors, self),
      };

      const options = { ...configuration, ...callbacks };

      ppcp.cardPayment(options, element);
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

    active() {
      // Not needed in vue checkout
    },

    inputBlur(data, input, field) {
      /* eslint-disable no-param-reassign */
      input.className = data.fields[field].isValid
      || data.fields[field].isEmpty
        ? 'valid' : 'invalid';
    },

    inputChange(self, field) {
      switch (field) {
        case 'cardNumberField':
          self.hostedNumberErrorMessage = '';
          break;
        case 'cardExpiryField':
          self.hostedDateErrorMessage = '';
          break;
        case 'cardCvvField':
          self.hostedCvvErrorMessage = '';
          break;
        default:
          break;
      }
    },

    createOrder: async (self) => {
      const loadingStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
      ]);
      loadingStore.setLoadingState(true);

      const vault = self.storeMethod && self.card.vaultActive && self.isLoggedIn;

      try {
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
        loadingStore.setLoadingState(false);
        console.error('Error during createOrder:', error);
        return null;
      }
    },

    onApprove: async (self) => {
      const [
        loadingStore,
        paymentStore,
        cartStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.usePaymentStore',
        'stores.useCartStore',
      ]);

      return self.makePayment(
        cartStore.cart.email,
        self.orderID,
        self.method,
        false,
        self.storeMethod,
      ).then(() => {
        window.location.href = window.bluefinchCheckout.helpers.getSuccessPageUrl();
      })
        .catch((err) => {
          loadingStore.setLoadingState(false);
          paymentStore.setErrorMessage(err.message);
        });
    },

    handleErrors: async (errors, self) => {
      const [
        paymentStore,
        loadingStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useLoadingStore',
      ]);

      self.hostedNumberErrorMessage = '';
      self.hostedDateErrorMessage = '';
      self.hostedCvvErrorMessage = '';

      if (typeof errors === 'string') {
        paymentStore.setErrorMessage(errors);
        loadingStore.setLoadingState(false);
        self.errorMessage = errors;
        return;
      }

      if (Array.isArray(errors)) {
        errors.forEach((error) => {
          loadingStore.setLoadingState(false);
          switch (error) {
            case 'INVALID_NUMBER':
              self.hostedNumberErrorMessage = 'Card number is not valid.';
              break;
            case 'INVALID_EXPIRY':
              self.hostedDateErrorMessage = 'Expiry date is not valid.';
              break;
            case 'INVALID_CVV':
              self.hostedCvvErrorMessage = 'CVV is not valid.';
              break;
            default:
              paymentStore.setErrorMessage(error);
              break;
          }
        });
      } else {
        console.warn('Unexpected errors format:', errors);
      }
    },

    getStyles() {
      return {
        '.valid': {
          color: 'green',
        },
        '.invalid': {
          color: 'red',
        },
        input: {
          padding: '8px 15px',
          'font-size': '16px',
        },
      };
    },
  },
};
</script>
