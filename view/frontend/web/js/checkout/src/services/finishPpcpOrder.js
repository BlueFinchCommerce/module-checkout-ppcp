import usePpcpStore from '../stores/PpcpStore';

export default async (data) => {
  const paymentStore = await window.geneCheckout.helpers.loadFromCheckout([
    'stores.usePaymentStore',
  ]);

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const { ppcpConfig } = usePpcpStore();
  const url = ppcpConfig.finishOrderUrl;

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
