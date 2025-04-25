export default async (id) => {
  const paymentStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
  };

  const url = 'ppcp/fastlaneCreateAccessToken';

  try {
    const response = await window.bluefinchCheckout.services.authenticatedRequest().post(
      url,
      { headers },
    );

    return response.data;
  } catch (error) {
    paymentStore.setPaymentErrorMessage(error.response.data.message);
    return null;
  }
};
