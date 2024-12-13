<template>
  <div
    v-if="Object.values(vaultedMethods).length"
    class="ppcp-vault"
  >
    <div
      v-show="!loading"
      class="ppcp-vaulted-methods-container"
      :class="`ppcp-vaulted-methods-container-${Object.values(vaultedMethods).length}`"
    >
      <div
        v-for="vaultedMethod in Object.values(vaultedMethods)"
        :key="vaultedMethod.publicHash"
      >
        <button
          class="ppcp-payment__payment-method__header__title button"
          :class="{ 'ppcp-payment__payment-method-disabled': !vaultedMethod.selected }"
          :aria-label="$t('paymentCard.storedPaymentLabel', { lastFour: vaultedMethod.details.maskedCC })"
          type="button"
          data-cy="ppcp-saved-payment-card-button"
          @click="selectPaymentCard(vaultedMethod)"
        >
          <component
            :is="Tick"
            v-if="vaultedMethod.selected"
            class="ppcp-payment__payment-method-tick"
            :data-cy="'ppcp-saved-payment-card-active-icon'"
          />
          <component
            :is="TextField"
            v-else
            class="ppcp-payment__payment-method-select"
            :text="$t('paymentCard.select')"
            :data-cy="'ppcp-saved-payment-card-select-text'"
          />
          <span
            class="ppcp-payment__payment-method__radio"
            aria-hidden="true"
          />
          <img
            :src="vaultedMethod.payment_method_code === 'ppcp_venmo' ? VenmoIcon
              : vaultedMethod.payment_method_code === 'ppcp_paypal' ? PayPalIcon
                : vaultedMethod.details.brand === 'VISA' ? VisaIcon
                  : vaultedMethod.details.brand === 'AMEX' ? AmexIcon
                    : vaultedMethod.details.brand === 'MASTERCARD' ? MasterCardIcon
                      : vaultedMethod.details.brand === 'DISCOVER' ? DiscoverIcon
                        : ''"
            :alt="vaultedMethod.payment_method_code"
            :class="vaultedMethod.payment_method_code"
            :data-cy="generateDataCY(vaultedMethod.payment_method_code, 'ppcp')"
          >
          <span
            v-if="vaultedMethod.details.maskedCC"
            class="ppcp-payment__payment-method__card-number"
            data-cy="ppcp-saved-payment-card-text"
          >
            {{ $t('paymentCard.cardNumber') }}
          </span>
          <span
            v-if="vaultedMethod.details.maskedCC"
            class="ppcp-payment__payment-method__name"
            data-cy="ppcp-saved-payment-card-text-number"
          >
            **** **** **** {{ vaultedMethod.details.maskedCC }}
          </span>
          <span
            v-if="vaultedMethod.details.payerEmail"
            class="ppcp-payment__payment-method__name"
            data-cy="ppcp-saved-payment-card-text-number"
          >
            {{ vaultedMethod.details.payerEmail }}
          </span>
          <span
            v-if="vaultedMethod.details.expirationDate"
            class="ppcp-payment__payment-method__expiry-label"
            data-cy="ppcp-saved-payment-card-expiry-text"
          >
            {{ $t('paymentCard.expiry') }}
          </span>
          <span
            v-if="vaultedMethod.details.expirationDate"
            class="ppcp-payment__payment-method__expiry"
            data-cy="ppcp-saved-payment-card-expiry-date"
          >
            {{ vaultedMethod.details.expirationDate }}
          </span>
        </button>
      </div>
    </div>
    <template v-if="selectedVault && !loading">
      <component
        :is="ErrorMessage"
        v-if="errorMessage"
        :message="errorMessage"
        :attached="false"
      />
      <component :is="Agreements" id="ppcpVault" />
      <component :is="PrivacyPolicy" />
      <!--      <component-->
      <!--        :is="Recaptcha"-->
      <!--        v-if="isRecaptchaVisible('placeOrder')"-->
      <!--        id="placeOrder"-->
      <!--        location="ppcpVaultedMethods"-->
      <!--      />-->
      <component
        :is="MyButton"
        class="ppcp-vaulted-methods-pay-button"
        label="Pay"
        primary
        :data-cy="'ppcp-saved-payment-card-pay-button'"
        @click="startPayment()"
      />
    </template>
  </div>
</template>

<script>

// Stores
import { mapActions, mapState } from 'pinia';
import PpcpStore from '../../../stores/PpcpStore';

// Icons
import VisaIcon from '../icons/vi.png';
import AmexIcon from '../icons/AmEx.png';
import MasterCardIcon from '../icons/Mastercard.png';
import DiscoverIcon from '../icons/Discover.png';
import VenmoIcon from '../icons/venmo_logo_blue.png';
import PayPalIcon from '../icons/paypal.png';

// Services
import createPPCPPaymentRest from '../../../services/createPPCPPaymentRest';

export default {
  name: 'VaultedMethodsList',
  data() {
    return {
      loading: false,
      ErrorMessage: null,
      PrivacyPolicy: null,
      RadioButton: null,
      Recaptcha: null,
      Agreements: null,
      TextField: null,
      Tick: null,
      MyButton: null,
      selectedMethod: '',
      cardMethod: 'ppcp_card_vault',
      paypalMethod: 'ppcp_paypal_vault',
      venmoMethod: 'ppcp_paypal_vault',
      type: '',
      selectedVault: null,
    };
  },
  computed: {
    ...mapState(PpcpStore, [
      'vaultedMethods',
    ]),
    PayPalIcon() {
      return PayPalIcon;
    },
    VenmoIcon() {
      return VenmoIcon;
    },
    VisaIcon() {
      return VisaIcon;
    },
    AmexIcon() {
      return AmexIcon;
    },
    MasterCardIcon() {
      return MasterCardIcon;
    },
    DiscoverIcon() {
      return DiscoverIcon;
    },
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && newVal !== 'ppcp_card_vault'
          && newVal !== 'ppcp_paypal_vault' && newVal !== 'ppcp_venmo_vault') {
          this.unselectVaultedMethods();
          this.selectedVault = null;
        }
      },
      immediate: true,
      deep: true,
    },
  },
  async created() {
    const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
      'stores.usePaymentStore',
    ]);

    paymentStore.$subscribe((mutation) => {
      if (typeof mutation.payload.selectedMethod !== 'undefined') {
        this.selectedMethod = mutation.payload.selectedMethod;
      }
    });
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
          TextField,
          Tick,
          MyButton,
        },
      },
    } = await import(window.geneCheckout.main);

    this.Agreements = Agreements;
    this.ErrorMessage = ErrorMessage;
    this.RadioButton = RadioButton;
    this.Recaptcha = Recaptcha;
    this.PrivacyPolicy = PrivacyPolicy;
    this.TextField = TextField;
    this.Tick = Tick;
    this.MyButton = MyButton;
  },
  methods: {
    ...mapActions(PpcpStore, [
      'selectVaultedMethod',
      'unselectVaultedMethods',
    ]),

    async selectPaymentCard(vaultedMethod) {
      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      // If the method is the same as the one already selected then we can return early.
      if (this.selectedVault !== null
        && vaultedMethod.publicHash === this.selectedVault.publicHash) {
        return;
      }

      switch (vaultedMethod.payment_method_code) {
        case 'ppcp_card':
          this.type = this.cardMethod;
          break;
        case 'ppcp_paypal':
          this.type = this.paypalMethod;
          break;
        default:
          this.type = this.venmoMethod;
          break;
      }

      paymentStore.setErrorMessage('');
      await this.selectVaultedMethod(vaultedMethod);
      this.selectedVault = Object.values(this.vaultedMethods).find((method) => method.selected);
      paymentStore.selectPaymentMethod(this.type);
      paymentStore.paymentEmitter.emit('paymentMethodSelected', this.type);
    },

    async startPayment() {
      const [
        paymentStore,
        agreementStore,
        loadingStore,
        cartStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useAgreementStore',
        'stores.useLoadingStore',
        'stores.useCartStore',
      ]);

      paymentStore.setErrorMessage('');

      // !captchaStore.validateToken('placeOrder') to add

      if (!agreementStore.validateAgreements()) {
        return;
      }

      loadingStore.setLoadingState(true);
      try {
        const data = await createPPCPPaymentRest(
          this.type,
          null,
          0,
          this.selectedVault.publicHash,
        );

        const orderData = JSON.parse(data);
        const [orderID, requestId] = orderData;

        const payment = {
          email: cartStore.cart.email,
          paymentMethod: {
            method: this.type,
            additional_data: {
              'paypal-order-id': orderID,
              paypal_request_id: requestId || '',
              public_hash: this.selectedVault.publicHash,
            },
            extension_attributes: window.geneCheckout.helpers.getPaymentExtensionAttributes(),
          },
        };

        window.geneCheckout.services.createPaymentRest(payment)
          .then(() => {
            window.location.href = window.geneCheckout.helpers.getSuccessPageUrl();
          })
          .catch((err) => {
            loadingStore.setLoadingState(false);
            paymentStore.setErrorMessage(err.message);
          });
      } catch (error) {
        loadingStore.setLoadingState(false);
        console.error('Error during createOrder:', error);
      }
    },

    generateDataCY(paymentIconName, serviceProvider) {
      return `checkout-${serviceProvider}-${paymentIconName}-icon`;
    },
  },
};
</script>

<style lang="scss">
@import "./vaultedMethods.scss";
</style>
