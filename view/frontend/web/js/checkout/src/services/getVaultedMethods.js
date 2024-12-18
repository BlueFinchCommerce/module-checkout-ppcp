export default async () => {
  const request = `{
    customerPaymentTokens {
      items {
        id
        public_hash
        payment_method_code
        type
        details
      }
    }
  }`;
  const methods = await window.geneCheckout.services.graphQlRequest(
    request,
    {},
    {},
    'BetterCheckoutVaultedPPCP',
  ).then((response) => response.data.customerPaymentTokens?.items || []);

  return methods
    // Remove methods that aren't Braintree cards.
    .filter(({ payment_method_code: code }) => code.includes('ppcp'))
    .reduce((prev, curr) => {
      const updated = prev;
      updated[curr.public_hash] = {
        ...curr,
        publicHash: curr.public_hash,
        details: JSON.parse(curr.details),
        selected: false,
      };
      return updated;
    }, {});
};
