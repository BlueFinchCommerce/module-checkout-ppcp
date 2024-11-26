import { defineStore } from 'pinia';

export default defineStore('ppcpStore', {
  state: () => ({
    cache: {},
    environment: 'sandbox',
    isPPCPenabled: false,
    sandboxClientId: '',
    productionClientId: '',
    buyerCountry: '',
    errorMessage: null,
    apple: {
      merchantName: '',
      enabled: false,
      paymentAction: '',
      sortOrder: null,
      title: '',
    },
    venmo: {
      vaultActive: false,
      enabled: false,
      paymentAction: '',
      sortOrder: null,
      title: '',
    },
    apm: {
      enabled: false,
      title: '',
      sortOrder: null,
      allowedPayments: [],
    },
    google: {
      buttonColor: 'white',
      enabled: false,
      paymentAction: '',
      sortOrder: null,
      title: '',
    },
    paypal: {
      enabled: false,
      vaultActive: false,
      title: '',
      paymentAction: '',
      requireBillingAddress: false,
      sortOrder: null,
      buttonLabel: '',
      buttonColor: 'gold',
      buttonShape: '',
      payLaterActive: false,
      payLaterButtonColour: 'black',
      payLaterButtonShape: '',
      payLaterMessageActive: false,
      payLaterMessageLayout: '',
      payLaterMessageLogoType: '',
      payLaterMessageLogoPosition: '',
      payLaterMessageColour: '',
      payLaterMessageTextSize: '',
      payLaterMessageTextAlign: '',
    },
    card: {
      enabled: false,
      vaultActive: false,
      title: '',
      paymentAction: '',
      threeDSecureStatus: '',
      sortOrder: null,
    },
  }),
  getters: {
    selectedVaultMethod: (state) => [],
  },
  actions: {
    setData(data) {
      this.$patch(data);
    },

    async getInitialConfigValues() {
      const graphQlRequest = await window.geneCheckout.helpers.loadFromCheckout([
        'services.graphQlRequest',
      ]);
      
      const request = async () => graphQlRequest(`{
        storeConfig {
          ppcp_environment
          ppcp_active
          ppcp_sandbox_client_id
          ppcp_client_id_production
          ppcp_buyer_country
          
          ppcp_googlepay_active
          ppcp_googlepay_title
          ppcp_googlepay_payment_action
          ppcp_googlepay_button_colour
          ppcp_googlepay_sort_order
          
          ppcp_applepay_active
          ppcp_applepay_title
          ppcp_applepay_payment_action
          ppcp_applepay_merchant_name
          ppcp_applepay_sort_order
    
          ppcp_paypal_active
          ppcp_paypal_vault_active
          ppcp_paypal_title
          ppcp_paypal_payment_action
          ppcp_paypal_require_billing_address
          ppcp_paypal_sort_order
          ppcp_paypal_button_paypal_label
          ppcp_paypal_button_paypal_color
          ppcp_paypal_button_paypal_shape
          ppcp_paypal_paylater_enable_paylater
          ppcp_paypal_paylater_button_paylater_color
          ppcp_paypal_paylater_button_paylater_shape
          ppcp_paypal_paylater_message_enable
          ppcp_paypal_paylater_message_layout
          ppcp_paypal_paylater_message_logo_type
          ppcp_paypal_paylater_message_logo_position
          ppcp_paypal_paylater_message_text_color
          ppcp_paypal_paylater_message_text_size
          ppcp_paypal_paylater_message_text_align

          ppcp_venmo_active
          ppcp_venmo_title
          ppcp_venmo_payment_action
          ppcp_venmo_vault_active
          ppcp_venmo_sort_order
          
          ppcp_apm_active
          ppcp_apm_title
          ppcp_apm_allowed_methods
          ppcp_apm_sort_order
          
          ppcp_card_active
          ppcp_card_vault_active
          ppcp_card_title
          ppcp_card_payment_action
          ppcp_card_three_d_secure
          ppcp_card_sort_order
        }
      }`).then(this.handleInitialConfig);
    
      await this.getCachedResponse(request, 'getInitialConfig');
    },

    async handleInitialConfig(config) {
      if (config?.data?.storeConfig) {
        const storeConfig = config.data.storeConfig;
        this.setData({
          environment: storeConfig.ppcp_environment,
          isPPCPenabled: storeConfig.ppcp_active,
          sandboxClientId: storeConfig.ppcp_sandbox_client_id,
          productionClientId: storeConfig.ppcp_client_id_production,
          buyerCountry: storeConfig.ppcp_buyer_country,
  
          card: {
            enabled: storeConfig.ppcp_card_active,
            vaultActive: storeConfig.ppcp_card_vault_active,
            title: storeConfig.ppcp_card_title,
            paymentAction: storeConfig.ppcp_card_payment_action,
            threeDSecureStatus: storeConfig.ppcp_card_three_d_secure,
            sortOrder: storeConfig.ppcp_card_sort_order,
          },
          google: {
            buttonColor: storeConfig.ppcp_googlepay_button_colour,
            enabled: storeConfig.ppcp_googlepay_active,
            paymentAction: storeConfig.ppcp_googlepay_payment_action,
            sortOrder: storeConfig.ppcp_googlepay_sort_order,
            title: storeConfig.ppcp_googlepay_title,
          },
          apple: {
            merchantName: storeConfig.ppcp_applepay_merchant_name,
            enabled: storeConfig.ppcp_applepay_active,
            paymentAction: storeConfig.ppcp_applepay_payment_action,
            sortOrder: storeConfig.ppcp_applepay_sort_order,
            title: storeConfig.ppcp_applepay_title,
          },
          venmo: {
            vaultActive: storeConfig.ppcp_venmo_payment_action,
            enabled: storeConfig.ppcp_venmo_active,
            paymentAction: storeConfig.ppcp_venmo_payment_action,
            sortOrder: storeConfig.ppcp_venmo_sort_order,
            title: storeConfig.ppcp_venmo_title,
          },
          apm: {
            enabled: storeConfig.ppcp_apm_active,
            title: storeConfig.ppcp_apm_title,
            sortOrder: storeConfig.ppcp_apm_sort_order,
            allowedPayments: storeConfig.ppcp_apm_allowed_methods,
          },
          paypal: {
            enabled: storeConfig.ppcp_paypal_active,
            vaultActive: storeConfig.ppcp_paypal_vault_active,
            title: storeConfig.ppcp_paypal_title,
            paymentAction: storeConfig.ppcp_paypal_payment_action,
            requireBillingAddress: storeConfig.ppcp_paypal_require_billing_address,
            sortOrder: storeConfig.ppcp_paypal_sort_order,
            buttonLabel: storeConfig.ppcp_paypal_button_paypal_label,
            buttonColor: storeConfig.ppcp_paypal_button_paypal_color,
            buttonShape: storeConfig.ppcp_paypal_button_paypal_shape,
            payLaterActive: storeConfig.ppcp_paypal_paylater_enable_paylater,
            payLaterButtonColour: storeConfig.ppcp_paypal_paylater_button_paylater_color,
            payLaterButtonShape: storeConfig.ppcp_paypal_paylater_button_paylater_shape,
            payLaterMessageActive: storeConfig.ppcp_paypal_paylater_message_enable,
            payLaterMessageLayout: storeConfig.ppcp_paypal_paylater_message_layout,
            payLaterMessageLogoType: storeConfig.ppcp_paypal_paylater_message_logo_type,
            payLaterMessageLogoPosition: storeConfig.ppcp_paypal_paylater_message_logo_position,
            payLaterMessageColour: storeConfig.ppcp_paypal_paylater_message_text_color,
            payLaterMessageTextSize: storeConfig.ppcp_paypal_paylater_message_text_size,
            payLaterMessageTextAlign: storeConfig.ppcp_paypal_paylater_message_text_align,
          },
        });
      }
    },

    async createClientToken() {
    
    },

    setClientInstance(clientInstance) {
      this.setData({
        clientInstance,
      });
    },

    setThreeDSInstance(threeDSecureInstance) {
      this.setData({
        threeDSecureInstance,
      });
    },

    setErrorMessage(errorMessage) {
      this.setData({
        errorMessage,
      });
    },

    clearErrorMessage() {
      this.setData({
        errorMessage: null,
      });
    },

    escapeNonAsciiCharacters(str) {
      return str
        .split('')
        .map((c) => (
          // Intentional disable to check for invisible characters.
          // eslint-disable-next-line no-control-regex
          /[^\x00-\x7F]$/.test(c) ? c : c.split('').map((a) => `\\u00${a.charCodeAt().toString(16)}`).join('')
        ))
        .join('');
    },

    async getVaultedMethods() {
    
    },

    selectVaultedMethod(vaultedMethod) {
      this.unselectVaultedMethods();
      this.setData({
        vaultedMethods: {
          [vaultedMethod.publicHash]: {
            selected: true,
          },
        },
      });
    },

    mapCartTypes(cartType) {
      switch (cartType) {
        case 'AE':
          return 'american-express';
        case 'DI':
          return 'discover';
        case 'DN':
          return 'diners-club';
        case 'JCB':
          return 'jcb';
        case 'MC':
          return 'master-card';
        case 'MI':
          return 'maestro';
        case 'UPD':
          return 'unionpay';
        case 'VI':
          return 'visa';
        default:
          return '';
      }
    },

    unselectVaultedMethods() {
      Object.keys(this.vaultedMethods).forEach((publicHash) => {
        this.setData({
          vaultedMethods: {
            [publicHash]: {
              selected: false,
            },
          },
        });
      });
    },

    getCachedResponse(request, cacheKey, args = {}) {
      if (typeof this.$state.cache[cacheKey] !== 'undefined') {
        return this.$state.cache[cacheKey];
      }

      const data = request(args);
      this.$patch({
        cache: {
          [cacheKey]: data,
        },
      });
      return data;
    },
    
    clearCache(cacheKey) {
      if (cacheKey) {
        this.setData({
          cache: {
            [cacheKey]: undefined,
          },
        });
      }
    },
  },
});
