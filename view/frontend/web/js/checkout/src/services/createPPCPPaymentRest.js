import buildPpcpCartUrl from '../helpers/buildPpcpCartUrl';

export default async (method, vault = null, fromCheckout = 0, hash = '') => {
  const [
    paymentStore,
    customerStore,
    cartStore,
  ] = await window.bluefinchCheckout.helpers.loadFromCheckout([
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
    === window.bluefinchCheckout.helpers.getTokenTypes.guestUser) {
    if (!maskedId) {
      cartId = await getMaskedId();
    } else {
      cartId = maskedId;
    }
  } else {
    const quote = await window.bluefinchCheckout.services.getQuote();
    cartId = quote.id;
  }

  let url;

  if (vault !== null && fromCheckout !== 0) {
    url = `${await buildPpcpCartUrl()}?vault=${vault}&fromCheckout=${fromCheckout}`;
  } else if (hash !== '' && fromCheckout !== 0) {
    url = `${await buildPpcpCartUrl()}?public_hash=${hash}&fromCheckout=${fromCheckout}`;
  } else {
    url = await buildPpcpCartUrl();
  }

  try {
    const response = await window.bluefinchCheckout.services.authenticatedRequest().post(
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
