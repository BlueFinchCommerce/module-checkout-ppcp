import usePpcpStore from '../stores/PpcpStore';

export default async () => {
  const customerStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
    'stores.useCustomerStore',
  ]);

  const { ppcpConfig } = usePpcpStore();

  const ppcpOrderUrl = customerStore.customer.tokenType
  === window.bluefinchCheckout.helpers.getTokenTypes.guestUser
    ? ppcpConfig.createGuestOrderUrl
    : ppcpConfig.createOrderUrl;

  return `${ppcpOrderUrl}`;
};
