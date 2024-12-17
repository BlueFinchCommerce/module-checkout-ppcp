<template>
  <div
    :class="{ active: isMethodSelected }"
    class="card-container"
  >
    <div
      class="card-title"
      :class="isMethodSelected ? 'selected' : ''"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod">
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
      :style="{ display: isMethodSelected ? 'block' : 'none' }">
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
      :label="$t('Pay')"
      :style="{ display: isMethodSelected ? 'block' : 'none' }"
      primary
      id="card-field-submit-button" />

    <div class="card-content" v-if="isMethodSelected">
      <component :is="PrivacyPolicy" />
      <div class="recaptcha">
        <component
          :is="Recaptcha"
          v-if="getTypeByPlacement('placeOrder')"
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
import { mapActions, mapState } from 'pinia';
import usePpcpStore from '../../../../stores/PpcpStore';

// Helpers
import loadScript from '../../../../helpers/addScript';

// Services
import createPPCPPaymentRest from '../../../../services/createPPCPPaymentRest';

export default {
  name: 'PpcpCreditCardPayment',
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
      getTypeByPlacement: () => {},
      orderID: null,
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
      'card',
      'environment',
      'buyerCountry',
      'productionClientId',
      'sandboxClientId',
    ]),
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
    } = await import(window.geneCheckout.main);

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
    ] = await window.geneCheckout.helpers.loadFromCheckout([
      'stores.useRecaptchaStore',
      'stores.usePaymentStore',
      'stores.useConfigStore',
      'stores.useCartStore',
      'stores.useCustomerStore',
    ]);

    this.paymentEmitter = paymentStore.paymentEmitter;
    this.isPaymentMethodAvailable = paymentStore.isPaymentMethodAvailable;
    this.getTypeByPlacement = recaptchaStore.getTypeByPlacement;
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
    await this.addScripts();
    await this.initCardFields();

    if (this.open) {
      await this.selectPaymentMethod();
    }
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
  methods: {
    ...mapActions(usePpcpStore, ['makePayment']),

    async selectPaymentMethod() {
      this.isMethodSelected = true;

      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );
      paymentStore.selectPaymentMethod('ppcp_card');
    },

    async addScripts() {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const loadPayPalScript = loadScript();
      const params = {
        intent: this.card.paymentAction,
        currency: configStore.currencyCode,
        components: 'card-fields',
      };

      if (this.environment === 'sandbox') {
        params['buyer-country'] = this.buyerCountry;
        params['client-id'] = this.sandboxClientId;
      } else {
        params['client-id'] = this.productionClientId;
      }

      return loadPayPalScript(
        'https://www.paypal.com/sdk/js',
        params,
        'ppcp_card',
      );
    },

    async initCardFields() {
      if (window[`paypal_${this.method}`]) {
        const cardFields = window[`paypal_${this.method}`].CardFields({
          createOrder: async () => {
            const loadingStore = await window.geneCheckout.helpers.loadFromCheckout([
              'stores.useLoadingStore',
            ]);

            loadingStore.setLoadingState(true);

            try {
              const data = await createPPCPPaymentRest(
                this.method,
                this.card.vaultActive,
                1,
              );
              const orderData = JSON.parse(data);

              const [orderID] = orderData;
              this.orderID = orderID;

              return this.orderID;
            } catch (error) {
              loadingStore.setLoadingState(false);
              console.error('Error during createOrder:', error);
              return null;
            }
          },
          onApprove: async () => {
            const [
              loadingStore,
              paymentStore,
              cartStore,
            ] = await window.geneCheckout.helpers.loadFromCheckout([
              'stores.useLoadingStore',
              'stores.usePaymentStore',
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
                paymentStore.setErrorMessage(err.message);
              });
          },
          onError: async (error) => {
            const [
              paymentStore,
              loadingStore,
            ] = await window.geneCheckout.helpers.loadFromCheckout([
              'stores.usePaymentStore',
              'stores.useLoadingStore',
            ]);

            paymentStore.setErrorMessage(error);
            loadingStore.setLoadingState(false);
          },
          style: this.getStyles(),
        });

        await this.renderFields(cardFields);
      }
    },

    async renderFields(cardFields) {
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

      if (cardFields.isEligible()) {
        const numberContainer = document.querySelector(this.numberField);
        const cvvContainer = document.querySelector(this.cvvField);
        const expiryContainer = document.querySelector(this.expiryField);

        const numberField = cardFields.NumberField({
          placeholder: '4111 1111 1111 1111',
          inputEvents: {
            onBlur: (data) => {
              numberContainer.className = data.fields.cardNumberField.isValid
              || data.fields.cardNumberField.isEmpty
                ? 'valid' : 'invalid';
            },
            onFocus: () => {
            },
          },
        });
        const cvvField = cardFields.CVVField({
          placeholder: '123',
          inputEvents: {
            onBlur: (data) => {
              cvvContainer.className = data.fields.cardCvvField.isValid
              || data.fields.cardCvvField.isEmpty
                ? 'valid' : 'invalid';
            },
            onFocus: () => {
            },
          },
        });
        const expiryField = cardFields.ExpiryField({
          placeholder: 'MM/YY',
          inputEvents: {
            onBlur: (data) => {
              expiryContainer.className = data.fields.cardExpiryField.isValid
              || data.fields.cardExpiryField.isEmpty
                ? 'valid' : 'invalid';
            },
            onFocus: () => {
            },
          },
        });

        if (numberContainer && !numberContainer.innerHTML.trim()) {
          numberField.render(numberContainer);
        }
        if (cvvContainer && !cvvContainer.innerHTML.trim()) {
          cvvField.render(cvvContainer);
        }
        if (expiryContainer && !expiryContainer.innerHTML.trim()) {
          expiryField.render(expiryContainer);
        }

        document.getElementById('card-field-submit-button').addEventListener('click', () => {
          const agreementsValid = agreementStore.validateAgreements();

          if (agreementsValid) {
            loadingStore.setLoadingState(true);

            cardFields.getState().then((data) => {
              if (data.isFormValid) {
                cardFields.submit().then(() => {
                  // Submit success
                }).catch((error) => {
                  paymentStore.setErrorMessage(error);
                });
              } else {
                if (data.errors.includes('INVALID_NUMBER')) {
                  loadingStore.setLoadingState(false);
                  this.hostedNumberErrorMessage = 'Card number is not valid.';
                }
                if (data.errors.includes('INVALID_EXPIRY')) {
                  loadingStore.setLoadingState(false);
                  this.hostedDateErrorMessage = 'Expiry date is not valid.';
                }
                if (data.errors.includes('INVALID_CVV')) {
                  loadingStore.setLoadingState(false);
                  this.hostedCvvErrorMessage = 'CVV is not valid.';
                }
              }
            });
          } else {
            loadingStore.setLoadingState(false);
            return false;
          }

          return true;
        });
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
