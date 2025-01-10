import { defineStore } from 'pinia';
import getVaultedMethods from '../services/getVaultedMethods';

export default defineStore('ppcpStore', {
  state: () => ({
    cache: {},
    environment: 'sandbox',
    isPPCPenabled: false,
    sandboxClientId: '',
    productionClientId: '',
    buyerCountry: '',
    errorMessage: null,
    vaultedMethods: [],
    apple: {
      merchantName: '',
      enabled: false,
      showOnTopCheckout: false,
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
      showOnTopCheckout: false,
      paymentAction: '',
      sortOrder: null,
      title: '',
    },
    paypal: {
      enabled: false,
      showOnTopCheckout: false,
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
    ppcpConfig: {
      createOrderUrl: '',
      createGuestOrderUrl: '',
      changeShippingMethodUrl: '',
      changeShippingAddressUrl: '',
      finishOrderUrl: '',
    },
    ppcpPaymentsIcons: [],
  }),
  getters: {
    selectedVaultMethod: (state) => (
      Object.values(state.vaultedMethods).find(({ selected }) => selected)
    ),
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
          ppcp_config {
            create_order_url
            create_guest_order_url
            change_shipping_method_url
            change_shipping_address_url
            finish_order_url
          }

          ppcp_environment
          ppcp_active
          ppcp_sandbox_client_id
          ppcp_client_id_production
          ppcp_buyer_country

          ppcp_googlepay_active
          ppcp_googlepay_top_checkout
          ppcp_googlepay_title
          ppcp_googlepay_payment_action
          ppcp_googlepay_button_colour
          ppcp_googlepay_sort_order

          ppcp_applepay_active
          ppcp_applepay_top_checkout
          ppcp_applepay_title
          ppcp_applepay_payment_action
          ppcp_applepay_merchant_name
          ppcp_applepay_sort_order

          ppcp_paypal_active
          ppcp_paypal_top_checkout
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
      }`, {}, {}, 'BetterCheckoutStoreConfigPPCP').then(this.handleInitialConfig);

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
          ppcpConfig: {
            createOrderUrl: storeconfig.ppcp_config.create_order_url,
            createGuestOrderUrl: storeconfig.ppcp_config.create_guest_order_url,
            changeShippingMethodUrl: storeconfig.ppcp_config.change_shipping_method_url,
            changeShippingAddressUrl: storeconfig.ppcp_config.change_shipping_address_url,
            finishOrderUrl: storeconfig.ppcp_config.finish_order_url,
          },
          card: {
            enabled: storeconfig.ppcp_card_active === '1',
            vaultActive: storeconfig.ppcp_card_vault_active === '1',
            title: storeconfig.ppcp_card_title,
            paymentAction: storeconfig.ppcp_card_payment_action
              === 'authorize_capture' ? 'capture' : storeconfig.ppcp_card_payment_action,
            threeDSecureStatus: storeconfig.ppcp_card_three_d_secure,
            sortOrder: storeconfig.ppcp_card_sort_order,
          },
          google: {
            buttonColor: storeconfig.ppcp_googlepay_button_colour,
            enabled: storeconfig.ppcp_googlepay_active === '1',
            showOnTopCheckout: storeconfig.ppcp_googlepay_top_checkout === '1',
            paymentAction: storeconfig.ppcp_googlepay_payment_action
            === 'authorize_capture' ? 'capture' : storeconfig.ppcp_googlepay_payment_action,
            sortOrder: storeconfig.ppcp_googlepay_sort_order,
            title: storeconfig.ppcp_googlepay_title,
          },
          apple: {
            merchantName: storeconfig.ppcp_applepay_merchant_name,
            enabled: storeconfig.ppcp_applepay_active === '1',
            showOnTopCheckout: storeconfig.ppcp_applepay_top_checkout === '1',
            paymentAction: storeconfig.ppcp_applepay_payment_action
            === 'authorize_capture' ? 'capture' : storeconfig.ppcp_applepay_payment_action,
            sortOrder: storeconfig.ppcp_applepay_sort_order,
            title: storeconfig.ppcp_applepay_title,
          },
          venmo: {
            vaultActive: storeconfig.ppcp_venmo_vault_active === '1',
            enabled: storeconfig.ppcp_venmo_active === '1',
            paymentAction: storeconfig.ppcp_venmo_payment_action
            === 'authorize_capture' ? 'capture' : storeconfig.ppcp_venmo_payment_action,
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
            showOnTopCheckout: storeconfig.ppcp_paypal_top_checkout === '1',
            vaultActive: storeconfig.ppcp_paypal_vault_active === '1',
            title: storeconfig.ppcp_paypal_title,
            paymentAction: storeconfig.ppcp_paypal_payment_action
            === 'authorize_capture' ? 'capture' : storeconfig.ppcp_paypal_payment_action,
            requireBillingAddress: storeconfig
              .ppcp_paypal_require_billing_address,
            sortOrder: storeconfig.ppcp_paypal_sort_order,
            buttonLabel: storeconfig.ppcp_paypal_button_paypal_label,
            buttonColor: storeconfig.ppcp_paypal_button_paypal_color,
            buttonShape: storeconfig.ppcp_paypal_button_paypal_shape,
            payLaterActive: storeconfig.ppcp_paypal_paylater_enable_paylater === '1',
            payLaterButtonColour: storeconfig
              .ppcp_paypal_paylater_button_paylater_color,
            payLaterButtonShape: storeconfig
              .ppcp_paypal_paylater_button_paylater_shape,
            payLaterMessageActive: storeconfig
              .ppcp_paypal_paylater_message_enable === '1',
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

    async setPaymentIcons() {
      const cartStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useCartStore',
      ]);

      // Retrieve available payment methods from the cart store
      const paymentMethods = cartStore.cart.available_payment_methods;

      // Filter and transform the payment methods
      const ppcpPaymentsIcons = paymentMethods
        .filter((method) => method.code.includes('ppcp'))
        .map((method) => ({
          name: method.code,
        }));

      this.setData({ ppcpPaymentsIcons });
    },

    getEnvironment() {
      return this.$state.environment === 'sandbox'
        ? 'TEST'
        : 'PRODUCTION';
    },

    async mapAddress(address, email, telephone) {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);
      const [firstname, ...lastname] = address.name.split(' ');
      const regionId = configStore.getRegionId(address.countryCode, address.administrativeArea);
      return {
        street: [
          address.address1,
          address.address2,
        ],
        postcode: address.postalCode,
        country_code: address.countryCode,
        company: address.company || '',
        email,
        firstname,
        lastname: lastname.length ? lastname.join(' ') : 'UNKNOWN',
        city: address.locality,
        telephone,
        region: {
          ...(address.administrativeArea ? { region: address.administrativeArea } : {}),
          ...(regionId ? { region_id: regionId } : {}),
        },
      };
    },

    async mapAppleAddress(address, email, telephone) {
      const configStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const regionId = configStore.getRegionId(
        address.countryCode.toUpperCase(),
        address.administrativeArea,
      );
      return {
        email,
        telephone,
        firstname: address.givenName,
        lastname: address.familyName,
        company: address.company || '',
        street: address.addressLines,
        city: address.locality,
        country_code: address.countryCode.toUpperCase(),
        postcode: address.postalCode,
        region: {
          ...(address.administrativeArea ? { region: address.administrativeArea } : {}),
          ...(regionId ? { region_id: regionId } : {}),
        },
      };
    },

    async makePayment(email, orderID, method, express, vault = false) {
      const payment = {
        email,
        paymentMethod: {
          method,
          additional_data: {
            'express-payment': express,
            'paypal-order-id': orderID,
            is_active_payment_token_enabler: vault,
          },
          extension_attributes: window.geneCheckout.helpers.getPaymentExtensionAttributes(),
        },
      };

      return window.geneCheckout.services.createPaymentRest(payment);
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

    async getVaultedMethodsData() {
      const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      const result = await getVaultedMethods();

      this.setData({
        vaultedMethods: result,
      });

      if (Object.keys(result).length) {
        paymentStore.setHasVaultedMethods(true);
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
