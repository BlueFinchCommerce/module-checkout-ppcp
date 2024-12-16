export default async () => {
  const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const url = 'ppcp/createAccessToken';

  try {
    const response = await window.geneCheckout.services.authenticatedRequest().post(
      url,
      { headers },
    );

    return response.data;
  } catch (error) {
    paymentStore.setPaymentErrorMessage(error.response.data.message);
    return null;
  }
};
