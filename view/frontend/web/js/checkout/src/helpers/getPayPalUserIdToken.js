export default async (id) => {
  const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
  };

  const url = 'ppcp/createAccessToken';
  const body = {
    targetCustomerId: id,
  };

  try {
    const response = await window.geneCheckout.services.authenticatedRequest().post(
      url,
      JSON.stringify(body),
      { headers },
    );

    return response.data;
  } catch (error) {
    paymentStore.setPaymentErrorMessage(error.response.data.message);
    return null;
  }
};
