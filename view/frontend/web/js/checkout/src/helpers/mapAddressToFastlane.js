export default function mapAddressToFastlane(address = {}) {
  return {
    countryId: address.country?.code ?? null,
    regionId: address.region?.id ?? null,
    regionCode: address.region?.code ?? null,
    region: address.region?.name ?? null,
    street: [
      address.street?.[0] ?? '',
      address.street?.[1] ?? '',
    ],
    company: address.company ?? '',
    telephone: address.telephone ?? '',
    postcode: address.postcode ?? '',
    city: address.city ?? '',
    firstname: address.firstname ?? '',
    lastname: address.lastname ?? '',
    saveInAddressBook: null,
  };
}
