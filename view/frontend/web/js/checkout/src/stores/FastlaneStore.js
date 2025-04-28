import { defineStore } from 'pinia';

import debounce from 'lodash.debounce';

import getAllowedLocations from '../helpers/getAllowedLocations';
import mapAddress from '../helpers/mapAddress';
import mapAddressToFastlane from '../helpers/mapAddressToFastlane';
import getFastlaneUserIdToken from '../helpers/getFastlaneUserIdToken';
import loadScript from '../helpers/addScript';

import usePpcpStore from './PpcpStore';

export default defineStore('fastlaneStore', {
  state: () => ({
    cache: {},
    clientInstance: null,
    threeDSecureInstance: null,
    customerContextId: null,
    dataCollectorInstance: null,
    fastlaneInstance: null,
    fastlanePaymentComponent: null,
    fastlaneWatermark: null,
    profileData: null,
    email: null,
    isLookingUpUser: false,
    profileEmail: null,
    profileAddress: null,
  }),
  getters: {},
  actions: {
    setData(data) {
      this.$patch(data);
    },

    async setup() {
      const { default: { stores: { useCustomerStore } } } = await import(window.bluefinchCheckout.main);
      const customerStore = useCustomerStore();

      if (!customerStore.isLoggedIn) {
        return this.getCachedResponse(async () => {
          const ppcpStore = usePpcpStore();

          await ppcpStore.getInitialConfigValues();
          const { enabled } = ppcpStore.fastlane;
          const { environment, sandboxClientId, productionClientId } = ppcpStore;

          // Early return if Fastlane is not active.
          if (!enabled) {
            return;
          }

          window.localStorage.setItem('axoEnv', environment);

          const clientToken = await getFastlaneUserIdToken();
          const params = {
            'client-id': environment === 'sandbox' ? sandboxClientId : productionClientId,
            components: 'buttons,fastlane',
          };

          const addPaypalScript = loadScript();

          await addPaypalScript(
            'https://www.paypal.com/sdk/js',
            params,
            'ppcp_fastlane',
            'checkout',
            null,
            clientToken,
          );

          const fastlaneInstance = await window.paypal_ppcp_fastlane.Connect({
            shippingAddressOptions: {
              allowedLocations: getAllowedLocations(),
            },
            styles: {
              root: {
                backgroundColor: '',
                errorColor: '',
                fontFamily: '',
                fontSize: '',
                padding: '',
                primaryColor: '',
                textColor: '',
              },
              input: {
                backgroundColor: '',
                borderColor: '',
                borderRadius: '',
                borderWidth: '',
                focusBorderColor: '',
                textColor: '',
              },
            },
          });

          this.setData({ fastlaneInstance });

          this.overrideGoToYouDetails();
        }, 'setup');
      }

      return undefined;
    },

    async attachEmailListener() {
      const { default: { stores: { useCustomerStore } } } = await import(window.bluefinchCheckout.main);
      const customerStore = useCustomerStore();

      this.$state.email = customerStore.customer.email;

      const debounced = debounce(this.lookupUser, 2000);
      customerStore.$subscribe(async (mutation, payload) => {
        if (mutation.type === 'direct' && typeof payload.customer.email !== 'undefined') {
          if (this.$state.email !== payload.customer.email) {
            debounced(payload.customer.email);
            this.$state.email = payload.customer.email;
          }
        }
      });
    },

    async lookupUser(email) {
      if (!email || this.isLookingUpUser) {
        return;
      }

      this.isLookingUpUser = true;

      const {
        default:
          {
            stores: {
              useLoadingStore,
              useStepsStore,
              useShippingMethodsStore,
              useConfigStore,
              useCustomerStore,
            },
            services: {
              getShippingMethods,
            },
          },
      } = await import(window.bluefinchCheckout.main);
      const loadingStore = useLoadingStore();
      const stepsStore = useStepsStore();
      const shippingMethodsStore = useShippingMethodsStore();
      const configStore = useConfigStore();
      const customerStore = useCustomerStore();

      loadingStore.setLoadingState(true);

      const {
        customerContextId,
      } = await this.$state.fastlaneInstance.identity.lookupCustomerByEmail(email);

      this.setData({
        customerContextId,
        profileData: null,
      });

      // If we have do have an account then trigger the authentication.
      if (customerContextId) {
        document.activeElement.blur();

        const {
          profileData,
        } = await this.$state.fastlaneInstance
          .identity.triggerAuthenticationFlow(customerContextId);

        if (profileData) {
          await customerStore.submitEmail(email);
          // Check to see if the User already has an address.
          if ((!this.$state.profileEmail && profileData.shippingAddress && !customerStore.selected.shipping.postcode)
            || (this.$state.profileEmail && this.$state.profileEmail !== email)) {
            await this.handleShippingAddress(profileData.shippingAddress);

            const profileDataAddress = profileData.shippingAddress;
            let mappedAddress;

            if (profileDataAddress) {
              mappedAddress = {
                id: null,
                street: [
                  profileDataAddress.address.addressLine1,
                ],
                city: profileDataAddress.address.adminArea2,
                region: profileDataAddress.address.adminArea1,
                region_id: configStore.getRegionId(
                  profileDataAddress.address.countryCode,
                  profileDataAddress.address.adminArea1,
                ),
                country_code: profileDataAddress.address.countryCode,
                postcode: profileDataAddress.address.postalCode,
                company: profileDataAddress.address.company !== 'undefined' ? profileDataAddress.address.company : '',
                telephone: profileDataAddress.phoneNumber.nationalNumber,
                firstname: profileDataAddress.name.firstName,
                lastname: profileDataAddress.name.lastName,
              };

              const result = await getShippingMethods(mappedAddress);
              const methods = result.shipping_addresses[0].available_shipping_methods;

              if (methods.length) {
                await shippingMethodsStore.submitShippingInfo(methods[0].carrier_code, methods[0].method_code);
                stepsStore.goToPayment();
              } else {
                stepsStore.goToShipping();
              }
            }
          }

          await this.setProfileData(profileData, email);
          this.setData({ profileEmail: email });
        }
      }

      this.isLookingUpUser = false;

      loadingStore.setLoadingState(false);
    },

    async setProfileData(profileData, email) {
      // Early return if there is no profile data.
      if (!profileData) {
        return;
      }

      this.setData({
        profileData,
      });

      const { default: { stores: { useCustomerStore } } } = await import(window.bluefinchCheckout.main);
      const customerStore = useCustomerStore();

      if (email) {
        await customerStore.submitEmail(email);
      }
    },

    async handleShippingAddress(shippingAddress) {
      const {
        default: {
          stores: {
            useCustomerStore, useStepsStore, useShippingMethodsStore, useValidationStore,
          },
        },
      } = await import(window.bluefinchCheckout.main);
      const customerStore = useCustomerStore();
      const shippingMethodsStore = useShippingMethodsStore();
      const validationStore = useValidationStore();

      customerStore.setEmailEntered();
      customerStore.setAddressAsCustom('shipping');

      const mappedAddress = await mapAddress(shippingAddress);
      customerStore.setAddressToStore(mappedAddress, 'shipping');
      customerStore.setAddressAsCustom('shipping');

      const isValid = validationStore.validateAddress('shipping', true)
        && validationStore.validateField(
          'shipping',
          'postcode',
          true,
        );

      if (!isValid) {
        customerStore.setAddressAsEditing('shipping', true);

        const stepsStore = useStepsStore();
        stepsStore.goToYouDetails();

        // Early return so we don't process getting shipping methods.
        return;
      }

      shippingMethodsStore.setAddressesOnCart();
    },

    async renderFastlanePaymentComponent(selector) {
      if (this.$state.fastlaneInstance) {
        const {
          default: {
            stores: {
              useCartStore,
              useCustomerStore,
            },
          },
        } = await import(window.bluefinchCheckout.main);

        const cartStore = useCartStore();
        const customerStore = useCustomerStore();

        const fields = {
          phoneNumber: {
            prefill: this.$state.profileData?.shippingAddress?.phoneNumber
              || cartStore.cart?.shipping_addresses[0]?.telephone,
          },
        };

        if (!this.$state.customerContextId) {
          await this.lookupUser(customerStore.customer.email);
        }

        const shippingAddress = cartStore.cart.shipping_addresses[0]
          ? mapAddressToFastlane(cartStore.cart.shipping_addresses[0])
          : {};

        const ppcpStore = usePpcpStore();
        const { showCardholderName } = ppcpStore.fastlane;

        // Add the card holder name field if enabled in config.
        if (showCardholderName) {
          fields.cardholderName = {};
        }

        const fastlanePaymentComponent = await this.$state.fastlaneInstance
          .FastlanePaymentComponent({ fields, shippingAddress });

        console.log(selector)
        
        fastlanePaymentComponent.render(selector);

        this.setData({ fastlanePaymentComponent });
      }
    },

    async renderWatermark(selector) {
      const ppcpStore = usePpcpStore();
      const { policyActive } = ppcpStore.fastlane;

      if (this.$state.fastlaneInstance) {
        // Return early if we are on the email component but with branding disabled.
        if (selector === '#fastlaneEmailWatermark' && !policyActive) {
          return;
        }

        const fastlaneWatermark = await this.$state.fastlaneInstance.FastlaneWatermarkComponent({
          includeAdditionalInfo: true,
        });

        fastlaneWatermark.render(selector);

        this.setData({ fastlaneWatermark });
      }
    },

    overrideGoToYouDetails() {
      window.bluefinchCheckout.overrides.setDetailsStepActive = async () => {
        const { default: { stores: { useStepsStore } } } = await import(window.bluefinchCheckout.main);
        const stepsStore = useStepsStore();

        if (this.profileData && this.$state.fastlaneInstance) {
          const {
            selectionChanged,
            selectedAddress,
          } = await this.$state.fastlaneInstance.profile.showShippingAddressSelector();

          if (selectionChanged) {
            this.handleShippingAddress(selectedAddress);
          }
        } else {
          stepsStore.goToYouDetails();
        }
      };
    },

    unmountComponent() {
      this.clearCaches(['setup']);

      if (this.$state.clientInstance) {
        this.$state.clientInstance.teardown();
      }
      if (this.$state.dataCollectorInstance) {
        this.$state.dataCollectorInstance.teardown();
      }

      this.setData({
        fastlaneInstance: null,
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

    clearCaches(cacheKeys) {
      if (cacheKeys.length) {
        cacheKeys.forEach((cacheKey) => {
          this.setData({
            cache: {
              [cacheKey]: undefined,
            },
          });
        });
      }
    },
  },
});
