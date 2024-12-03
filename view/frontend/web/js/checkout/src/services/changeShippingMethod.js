import usePpcpStore from '../stores/PpcpStore';

export default async (orderId, shippingMethod, method) => {
  const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const { ppcpConfig } = usePpcpStore();
  const url = ppcpConfig.changeShippingMethodUrl;

  const data = {
    orderId,
    shippingMethod,
    method,
  };

  try {
    const response = await window.geneCheckout.services.authenticatedRequest().post(
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
