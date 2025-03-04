import usePpcpStore from '../stores/PpcpStore';

export default async (orderId, shippingAddress, method) => {
  const paymentStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const { ppcpConfig } = usePpcpStore();
  const url = ppcpConfig.changeShippingAddressUrl;

  const data = {
    orderId,
    shippingAddress,
    method,
  };

  try {
    const response = await window.bluefinchCheckout.services.authenticatedRequest().post(
      url,
      data,
      { headers },
    );

    return response.data;
  } catch (error) {
    paymentStore.setPaymentErrorMessage(error.response.data.message);
    return null;
  }
};
