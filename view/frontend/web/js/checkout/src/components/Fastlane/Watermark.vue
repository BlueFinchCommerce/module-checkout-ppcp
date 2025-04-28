<template>
  <div
    v-if="fastlane.enabled
      && fastlane.policyActive && !userLoggedIn"
    :id="id">
    <img :alt="id" src="https://www.paypalobjects.com/fastlane-v1/assets/fastlane-with-tooltip_en_sm_light.0808.svg" />
  </div>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import useFastlaneStore from '../../stores/FastlaneStore';
import usePpcpStore from '../../stores/PpcpStore';

export default {
  name: 'FastlaneWatermark',

  data() {
    return {
      id: 'fastlaneEmailWatermark',
      userLoggedIn: false,
    };
  },

  computed: {
    ...mapState(usePpcpStore, ['fastlane']),
  },

  async mounted() {
    const {
      default: {
        stores: { useConfigStore, useCustomerStore },
      },
    } = await import(window.bluefinchCheckout.main);
    const customerStore = useCustomerStore();
    const configStore = useConfigStore();

    await configStore.getInitialConfig();
    this.userLoggedIn = !!customerStore.isLoggedIn;

    if (!this.userLoggedIn) {
      await this.setup();
      this.attachEmailListener();

      if (this.fastlane.enabled && this.fastlane.policyActive) {
        this.renderWatermark(`#${this.id}`);
      }
    }
  },

  methods: {
    ...mapActions(useFastlaneStore, ['setup', 'attachEmailListener', 'renderWatermark']),
  },
};

</script>
