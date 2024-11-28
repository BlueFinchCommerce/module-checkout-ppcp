export default async () => {
  const customerStore = await window.geneCheckout.helpers.loadFromCheckout([
    'stores.useCustomerStore',
  ]);

  const builtPath = customerStore.customer.tokenType
  === window.geneCheckout.helpers.getTokenTypes.guestUser
    ? '/ppcp/createGuestOrder'
    : '/ppcp/createOrder';

  return `${window.geneCheckout.helpers.getBaseRestUrl()}${builtPath}`;
};
