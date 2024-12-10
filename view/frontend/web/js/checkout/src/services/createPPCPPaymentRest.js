import buildPpcpCartUrl from '../helpers/buildPpcpCartUrl';

export default async (method, vault = null, fromCheckout = 0) => {
  const [
    paymentStore,
    customerStore,
    cartStore,
  ] = await window.geneCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
    'stores.useCustomerStore',
    'stores.useCartStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const { maskedId, getMaskedId } = cartStore;

  let cartId;

  if (customerStore.customer.tokenType
    === window.geneCheckout.helpers.getTokenTypes.guestUser) {
    if (!maskedId) {
      cartId = await getMaskedId();
    } else {
      cartId = maskedId;
    }
  } else {
    const quote = await window.geneCheckout.services.getQuote();
    cartId = quote.id;
  }

  const url = vault !== null && fromCheckout !== 0 ? `${await buildPpcpCartUrl()}?vault=${vault}&fromCheckout=1`
    : await buildPpcpCartUrl();

  try {
    const response = await window.geneCheckout.services.authenticatedRequest().post(
      url,
      {
        cartId,
        method,
      },
      { headers },
    );

    return response.data;
  } catch (error) {
    paymentStore.setPaymentErrorMessage(error.response.data.message);
    return null;
  }
};
