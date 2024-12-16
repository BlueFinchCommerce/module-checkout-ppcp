<template>
  <div
    v-if="Object.values(vaultedMethods).length"
    class="ppcp-vault"
  >
    <div
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
            class="ppcp-payment__payment-method__name email"
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
    <template v-if="selectedVault">
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
        v-if="selectedVault.payment_method_code === 'ppcp_card'"
        :is="MyButton"
        class="ppcp-vaulted-methods-pay-button"
        label="Pay"
        primary
        :data-cy="'ppcp-saved-payment-card-pay-button'"
        @click="startPayment()"
      />
      <div v-if="selectedVault.payment_method_code === 'ppcp_paypal'">
        <div
          class="paypal-button-container"
          :id="`ppcp_paypal_vault_placeholder`"
          :class="!paypalLoaded ? 'text-loading' : ''"
          :data-cy="'vaulted-checkout-ppcpPayPal'"
        />
        <div
          class="paypal-button-container"
          :id="`ppcp-paypal_ppcp_paylater_vaulted`"
          :class="!paypalLoaded ? 'text-loading' : ''"
          :data-cy="'vaulted-checkout-ppcpPayLater'"
        />
        <div
          :class="!paypalLoaded ? 'text-loading' : ''"
          class="paypal-messages-container"
          :id="`ppcp-paypal_messages_vaulted`"
          :data-cy="'vaulted-checkout-ppcpMessages'"
        />
      </div>
      <div v-if="selectedVault.payment_method_code === 'ppcp_venmo'">
        <div
          class="paypal-button-container"
          :id="`paypal-button-container-venmo-vaulted`"
          :class="!venmoLoaded ? 'text-loading' : ''"
          :data-cy="'vaulted-checkout-ppcpPayPalVenmo'"
        />
        <component
          v-if="environment === 'sandbox'"
          :is="TextField"
          class="venmo-sandbox-message"
          text="Vaulted Venmo is not supported in Sandbox mode"
          :data-cy="'venmo-sandbox-message'"
        />
      </div>
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

// Helpers
import getPayPalUserIdToken from '../../../helpers/getPayPalUserIdToken';
import loadScript from '../../../helpers/addScript';

export default {
  name: 'VaultedMethodsList',
  data() {
    return {
      venmoLoaded: false,
      paypalLoaded: false,
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
      venmoMethod: 'ppcp_venmo_vault',
      type: '',
      selectedVault: null,
      orderData: [],
    };
  },
  computed: {
    ...mapState(PpcpStore, [
      'vaultedMethods',
      'environment',
      'venmo',
      'paypal',
      'card',
      'buyerCountry',
      'productionClientId',
      'sandboxClientId',
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

      // delay added to render buttons on select event first into dom
      if (this.selectedVault.payment_method_code === 'ppcp_venmo') {
        setTimeout(async () => {
          const userIdToken = await getPayPalUserIdToken();
          await this.addScripts(userIdToken, 'ppcp_venmo_vault');
          await this.renderVenmoInstance();
        }, 0);
      } else if (this.selectedVault.payment_method_code === 'ppcp_paypal') {
        setTimeout(async () => {
          const userIdToken = await getPayPalUserIdToken();
          await this.addScripts(userIdToken, 'ppcp_paypal_vault');
          await this.renderPayPalVaultButton();
        }, 0);
      }
    },

    async addScripts(userIdToken, paymentCode) {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const loadPayPalScript = loadScript();
      const params = {
        intent: this.paypal.paymentAction,
        currency: configStore.currencyCode,
        components: 'buttons',
        commit: true,
        'disable-funding': 'card',
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

      if (paymentCode === 'ppcp_paypal_vault' && this.paypal.payLaterActive) {
        params['enable-funding'] = 'paylater';
      } else {
        params['enable-funding'] = 'venmo';
      }

      return loadPayPalScript(
        'https://www.paypal.com/sdk/js',
        params,
        paymentCode,
        'checkout',
        userIdToken,
      );
    },

    async renderVenmoInstance() {
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
                this.type,
                null,
                1,
                this.selectedVault.publicHash,
              );

              this.orderData = JSON.parse(data);
              return this.orderData[0];
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
            const [orderID, requestId] = this.orderData;
            return this.placeOrder(orderID, requestId);
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
          '#paypal-button-container-venmo-vaulted',
        );

        this.venmoLoaded = true;
      }
    },

    async renderPayPalVaultButton() {
      const cartStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);

      const paypalConfig = window.paypal_ppcp_paypal;
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
                this.type,
                null,
                1,
                this.selectedVault.publicHash,
              );

              this.orderData = JSON.parse(data);
              console.log(this.orderData);
              return this.orderData[0];
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
            const [orderID, requestId] = this.orderData;
            return this.placeOrder(orderID, requestId);
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
        await paypalConfig.Buttons(commonRenderData).render(
          '#ppcp_paypal_vault_placeholder',
        );

        // Render the PayPal Pay Later button (if active)
        if (this.paypal.payLaterActive) {
          const payLaterButtonData = {
            ...commonRenderData,
            style: {
              ...commonRenderData.style,
              color: this.paypal.payLaterButtonColour,
              shape: this.paypal.payLaterButtonShape,
            },
          };
          await paypalConfig.Buttons(payLaterButtonData).render(
            '#ppcp-paypal_ppcp_paylater_vaulted',
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
            '#ppcp-paypal_messages_vaulted',
          );
        }

        this.paypalLoaded = true;
      }
    },

    async startPayment() {
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

      // !captchaStore.validateToken('placeOrder') to add

      if (!agreementStore.validateAgreements()) {
        return;
      }

      loadingStore.setLoadingState(true);
      try {
        const data = await createPPCPPaymentRest(
          this.type,
          null,
          1,
          this.selectedVault.publicHash,
        );

        this.orderData = JSON.parse(data);
        await this.placeOrder();
      } catch (error) {
        loadingStore.setLoadingState(false);
        console.error('Error during createOrder:', error);
      }
    },

    async placeOrder() {
      const [
        paymentStore,
        loadingStore,
        cartStore,
      ] = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
        'stores.useLoadingStore',
        'stores.useCartStore',
      ]);

      const [orderID, requestId] = this.orderData;

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
