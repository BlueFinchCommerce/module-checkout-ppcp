export default async (orderId, shippingAddress, method) => {
  const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const url = 'ppcp/changeShippingAddress';
  const data = {
    orderId,
    shippingAddress,
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
