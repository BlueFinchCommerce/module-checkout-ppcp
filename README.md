[![CircleCI](https://dl.circleci.com/status-badge/img/gh/bluefinchcommerce/module-checkout-ppcp/tree/main.svg?style=svg&circle-token=CCIPRJ_shdRbwX6CZwdWayXko8Kf_fc053dfb47603a733a4b4265ff8be69118cffec9)](https://dl.circleci.com/status-badge/redirect/gh/bluefinchcommerce/module-checkout-ppcp/tree/main)

![Checkout Powered by BlueFinch](./assets/logo.svg)

# BlueFinch Checkout PPCP Module

## Requirements

- Magento 2.4.6 or higher
- Node 16 or higher (for development purposes only)
- Latest version of the BlueFinch Checkout

## Installation

Ensure you have installed the latest version of the BlueFinch Checkout, which can be found here, [BlueFinch Checkout](https://github.com/bluefinchcommerce/module-checkout).

To install the BlueFinch Checkout PPCP module, run the following command in your Magento 2 root directory:

``` composer require bluefinchcommerce/module-checkout-ppcp ```

BlueFinch Checkout PPCP follows the standard installation process for Adobe Commerce.

For information about a module installation in Adobe Commerce, see [Enable or disable modules](https://experienceleague.adobe.com/en/docs/commerce-operations/installation-guide/tutorials/manage-modules).

Remember to clear any appropriate caches.

Once installed the module follows the same configuration settings as prescribed by the official PPCP for Magento integration documentation, see [PPCP for Magento](https://commercemarketplace.adobe.com/media/catalog/product/paypal-module-ppcp-1-0-0-ece/user_guides.pdf?1732699597).

## CircleCi

CircleCi is a tool for us to use to allow for tested to be run on our modules before they are deployed.

This template comes with EsLint and PHPStan.

You can add more tests to this if you need to.


### Testing your module locally

You can test CircleCi before you push your code.

To do this you need to install circleci locally.

``` brew install circleci```

Then once this has been installed in the main directory of your package then.

```circleci local execute```