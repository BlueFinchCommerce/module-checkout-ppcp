<template>
  <div
    v-if="fastlane.enabled && MyButton && !userLoggedIn"
    class="fastlane-payment"
    :class="{ active: isMethodSelected }"
  >
    <component
      :is="RadioButton"
      :text="paymentTitle"
      :checked="isMethodSelected"
      class="fastlane-payment-radio"
      @click="selectPaymentMethod"
      @keydown="selectPaymentMethod"
    />
    <component
      :is="ErrorMessage"
      v-if="errorMessage && isMethodSelected"
      :message="errorMessage"
      :attached="false"
    />
    <div
      :id="id"
      :class="{ hidden: !isMethodSelected }"
    />
    <component
      :is="Agreements"
      v-if="isMethodSelected"
      id="fastlane"
    />
    <component :is="PrivacyPolicy" v-if="isMethodSelected" />
    <div class="recaptcha" v-if="isMethodSelected">
      <component
        :is="Recaptcha"
        v-if="isRecaptchaVisible('placeOrder')"
        id="placeOrder"
        location="fastlane"
      />
    </div>
    <component
      :is="MyButton"
      v-if="isMethodSelected"
      class="fastlane-payment-button"
      :label="$t('Pay')"
      primary
      :disabled="buttonDisabled"
      @click="placeFastlaneOrder"
      @keydown="placeFastlaneOrder"
    />
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import useFastlaneStore from '../../../../stores/FastlaneStore';
import usePpcpStore from '../../../../stores/PpcpStore';

import createPPCPPaymentRest from '../../../../services/createPPCPPaymentRest';

export default {
  name: 'FastlanePaymentMethod',
  props: {
    open: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      errorMessage: '',
      id: 'fastlanePaymentComponent',
      isMethodSelected: false,
      selectedMethod: 'fastlane',
      getTypeByPlacement: null,
      paymentTitle: '',
      paymentType: 'fastlane',
      Agreements: null,
      ErrorMessage: null,
      MyButton: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      userLoggedIn: false,
      orderID: null,
      isRecaptchaVisible: () => {
      },
    };
  },
  computed: {
    ...mapState(useFastlaneStore, ['profileData', 'fastlanePaymentComponent']),
    ...mapState(usePpcpStore, ['fastlane']),
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== this.paymentType) {
          this.isMethodSelected = false;
        }
      },
      immediate: true,
      deep: true,
    },
  },
  async created() {
    if (this.open) {
      await this.selectPaymentMethod();
    }
  },
  async mounted() {
    const {
      default: {
        components: {
          Agreements,
          ErrorMessage,
          MyButton,
          PrivacyPolicy,
          RadioButton,
          Recaptcha,
        },
        stores: {
          useCartStore, useConfigStore, usePaymentStore, useRecaptchaStore, useCustomerStore, useLoadingStore,
        },
      },
    } = await import(window.bluefinchCheckout.main);

    this.Agreements = Agreements;
    this.ErrorMessage = ErrorMessage;
    this.MyButton = MyButton;
    this.RadioButton = RadioButton;
    this.Recaptcha = Recaptcha;
    this.PrivacyPolicy = PrivacyPolicy;

    const cartStore = useCartStore();
    const configStore = useConfigStore();
    const paymentStore = usePaymentStore();
    const recaptchaStore = useRecaptchaStore();
    const customerStore = useCustomerStore();
    const loadingStore = useLoadingStore();

    this.isRecaptchaVisible = recaptchaStore.isRecaptchaVisible;

    this.userLoggedIn = customerStore.isLoggedIn;
    if (!this.userLoggedIn) {
      loadingStore.setLoadingState(true);

      await configStore.getInitialConfig();
      await cartStore.getCart();

      this.getTypeByPlacement = recaptchaStore.getTypeByPlacement('placeOrder');
      this.paymentTitle = 'Credit or Debit Card';

      paymentStore.$subscribe((mutation) => {
        if (typeof mutation.payload !== 'undefined'
          && typeof mutation.payload.errorMessage !== 'undefined') {
          this.errorMessage = mutation.payload.errorMessage;
        }
      });

      paymentStore.setPaymentErrorMessage('');
      this.errorMessage = paymentStore.errorMessage;

      paymentStore.$subscribe((mutation) => {
        if (typeof mutation.payload.selectedMethod !== 'undefined') {
          this.selectedMethod = mutation.payload.selectedMethod;
        }
      });

      await this.setup();

      this.renderFastlanePaymentComponent(`#${this.id}`);

      loadingStore.setLoadingState(false);
    }
  },

  methods: {
    ...mapActions(useFastlaneStore, [
      'renderFastlanePaymentComponent',
      'setup',
      'unmountComponent',
    ]),
    ...mapActions(usePpcpStore, ['makePayment']),

    async selectPaymentMethod() {
      this.isMethodSelected = true;

      const paymentStore = await window.bluefinchCheckout.helpers.loadFromCheckout(
        'stores.usePaymentStore',
      );

      paymentStore.selectPaymentMethod('ppcp_card');
    },

    async placeFastlaneOrder() {
      try {
        const isValid = await this.onValidate();

        if (isValid) {
          try {
            const { id } = await this.getPaymentToken();
            await this.createPayment(id);
          } catch (error) {
            console.error(error);
            this.handleErrors('Cannot validate payment.');
          }
        }
      } catch (error) {
        console.error('Validation error:', error);
      }
    },

    async handleErrors(errors) {
      const [
        paymentStore,
        loadingStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useLoadingStore',
      ]);

      if (typeof errors === 'string') {
        paymentStore.setErrorMessage(errors);
        loadingStore.setLoadingState(false);
        this.errorMessage = errors;
      }
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

    async onApprove() {
      const [
        loadingStore,
        paymentStore,
        cartStore,
      ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
        'stores.usePaymentStore',
        'stores.useCartStore',
      ]);

      const fastlaneProfile = this.profileData !== null ? 'Yes' : 'No';

      return this.makePayment(
        cartStore.cart.email,
        this.orderID,
        'ppcp_card',
        false,
        false,
        false,
        true,
        fastlaneProfile,
      ).then(() => {
        window.location.href = window.bluefinchCheckout.helpers.getSuccessPageUrl();
      })
        .catch((err) => {
          loadingStore.setLoadingState(false);
          paymentStore.setErrorMessage(err.message);
        });
    },

    async getPaymentToken() {
      return this.fastlanePaymentComponent.getPaymentToken();
    },

    async createPayment(singleUseToken) {
      const loadingStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
        'stores.useLoadingStore',
      ]);
      loadingStore.setLoadingState(true);

      try {
        const data = await createPPCPPaymentRest(
          'ppcp_card',
          false,
          1,
          '',
          singleUseToken,
        );
        const orderData = JSON.parse(data);

        const [orderID] = orderData;
        /* eslint-disable no-param-reassign */
        this.orderID = orderID;

        if (orderID) {
          this.onApprove();
        }

        return orderID;
      } catch (error) {
        loadingStore.setLoadingState(false);
        console.error('Error during createOrder:', error);
        return null;
      }
    },
  },
  unmounted() {
    this.unmountComponent();
  },
};

</script>

<style lang="scss">
@import "./fastlanePayment.scss";
</style>
