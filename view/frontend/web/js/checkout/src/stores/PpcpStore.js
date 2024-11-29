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
        const storeconfig = config.data.storeConfig;
        this.setData({
          environment: storeconfig.ppcp_environment,
          isPPCPenabled: storeconfig.ppcp_active === '1',
          sandboxClientId: storeconfig.ppcp_sandbox_client_id,
          productionClientId: storeconfig.ppcp_client_id_production,
          buyerCountry: storeconfig.ppcp_buyer_country,

          card: {
            enabled: storeconfig.ppcp_card_active === '1',
            vaultActive: storeconfig.ppcp_card_vault_active,
            title: storeconfig.ppcp_card_title,
            paymentAction: storeconfig.ppcp_card_payment_action,
            threeDSecureStatus: storeconfig.ppcp_card_three_d_secure,
            sortOrder: storeconfig.ppcp_card_sort_order,
          },
          google: {
            buttonColor: storeconfig.ppcp_googlepay_button_colour,
            enabled: storeconfig.ppcp_googlepay_active === '1',
            paymentAction: storeconfig.ppcp_googlepay_payment_action,
            sortOrder: storeconfig.ppcp_googlepay_sort_order,
            title: storeconfig.ppcp_googlepay_title,
          },
          apple: {
            merchantName: storeconfig.ppcp_applepay_merchant_name,
            enabled: storeconfig.ppcp_applepay_active === '1',
            paymentAction: storeconfig.ppcp_applepay_payment_action,
            sortOrder: storeconfig.ppcp_applepay_sort_order,
            title: storeconfig.ppcp_applepay_title,
          },
          venmo: {
            vaultActive: storeconfig.ppcp_venmo_payment_action,
            enabled: storeconfig.ppcp_venmo_active === '1',
            paymentAction: storeconfig.ppcp_venmo_payment_action,
            sortOrder: storeconfig.ppcp_venmo_sort_order,
            title: storeconfig.ppcp_venmo_title,
          },
          apm: {
            enabled: storeconfig.ppcp_apm_active,
            title: storeconfig.ppcp_apm_title === '1',
            sortOrder: storeconfig.ppcp_apm_sort_order,
            allowedPayments: storeconfig.ppcp_apm_allowed_methods,
          },
          paypal: {
            enabled: storeconfig.ppcp_paypal_active === '1',
            vaultActive: storeconfig.ppcp_paypal_vault_active,
            title: storeconfig.ppcp_paypal_title,
            paymentAction: storeconfig.ppcp_paypal_payment_action,
            requireBillingAddress: storeconfig
              .ppcp_paypal_require_billing_address,
            sortOrder: storeconfig.ppcp_paypal_sort_order,
            buttonLabel: storeconfig.ppcp_paypal_button_paypal_label,
            buttonColor: storeconfig.ppcp_paypal_button_paypal_color,
            buttonShape: storeconfig.ppcp_paypal_button_paypal_shape,
            payLaterActive: storeconfig.ppcp_paypal_paylater_enable_paylater,
            payLaterButtonColour: storeconfig
              .ppcp_paypal_paylater_button_paylater_color,
            payLaterButtonShape: storeconfig
              .ppcp_paypal_paylater_button_paylater_shape,
            payLaterMessageActive: storeconfig
              .ppcp_paypal_paylater_message_enable,
            payLaterMessageLayout: storeconfig
              .ppcp_paypal_paylater_message_layout,
            payLaterMessageLogoType: storeconfig
              .ppcp_paypal_paylater_message_logo_type,
            payLaterMessageLogoPosition: storeconfig
              .ppcp_paypal_paylater_message_logo_position,
            payLaterMessageColour: storeconfig
              .ppcp_paypal_paylater_message_text_color,
            payLaterMessageTextSize: storeconfig
              .ppcp_paypal_paylater_message_text_size,
            payLaterMessageTextAlign: storeconfig
              .ppcp_paypal_paylater_message_text_align,
          },
        });
      }
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
