import buildPpcpCartUrl from '../helpers/buildPpcpCartUrl';

export default async (method, vault = null, fromCheckout = 0, hash = '', singleUseToken = '') => {
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

  const payload = {
    cartId,
    method,
  };

  if (singleUseToken) {
    payload.singleUseToken = singleUseToken;
  }

  try {
    const response = await window.bluefinchCheckout.services.authenticatedRequest().post(
      url,
      payload,
      { headers },
    );

    return response.data;
  } catch (error) {
    paymentStore.setPaymentErrorMessage(error.response.data.message);
    return null;
  }
};
