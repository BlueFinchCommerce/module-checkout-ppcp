export default async (address, carrierCode, methodCode, setShippingInfo) => {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  const body = {
    addressInformation: {
      address,
    },
  };

  if (setShippingInfo) {
    body.shipping_carrier_code = carrierCode;
    body.shipping_method_code = methodCode;
  }

  try {
    const response = await window.geneCheckout.services.authenticatedRequest().post(
      window.geneCheckout.helpers.buildCartUrl('totals-information'),
      body,
      { headers },
    );

    return response.data;
  } catch (error) {
    console.log(error);
    return null;
  }
};
