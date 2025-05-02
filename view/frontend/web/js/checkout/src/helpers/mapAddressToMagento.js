export default async (address) => {
  const configStore = await window.bluefinchCheckout.helpers.loadFromCheckout([
    'stores.useConfigStore',
  ]);

  const regionId = configStore.getRegionId(address.country?.code, address.region?.code);

  const cleanedPhone = (address.telephone ?? '')
    .toString()
    .replace(/\s+/g, '')
    .replace(/\n/g, '')
    .replace(/^1(?=\d{10}$)/, '');

  return {
    countryId: address.country?.code ?? '',
    regionId: regionId ?? null,
    regionCode: address.region?.code ?? '',
    region: address.region?.name ?? '',

    street: [
      address.street?.[0] ?? '',
      address.street?.[1] ?? '',
    ],

    company: address.company ?? '',
    telephone: cleanedPhone,
    postcode: address.postcode ?? '',
    city: address.city ?? '',
    firstname: address.firstname ?? '',
    lastname: address.lastname ?? '',
    saveInAddressBook: null,
  };
};
