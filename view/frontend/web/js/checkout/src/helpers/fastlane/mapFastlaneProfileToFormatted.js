export default function mapFastlaneProfileToFormatted(profileAddress = {}) {
  const line1 = profileAddress.address?.addressLine1 ?? '';
  const rawLine2 = profileAddress.address?.addressLine2 ?? '';
  const line2 = rawLine2 && rawLine2.trim() !== '' ? rawLine2 : undefined;

  return {
    firstName: profileAddress.name?.firstName ?? '',
    lastName: profileAddress.name?.lastName ?? '',
    company: profileAddress.address?.company || undefined,
    locality: profileAddress.address?.adminArea2 ?? '',
    region: profileAddress.address?.adminArea1 ?? '',
    postalCode: profileAddress.address?.postalCode ?? '',
    countryCodeAlpha2: profileAddress.address?.countryCode ?? '',
    phoneNumber: `${profileAddress.phoneNumber?.countryCode ?? ''}
    ${profileAddress.phoneNumber?.nationalNumber ?? ''}`,
    streetAddress: line1,
    extendedAddress: line2,
  };
}
