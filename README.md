![Better Checkout Powered by GENE](./assets/logo.svg)

# Better Checkout PPCP Module

## Requirements

- Magento 2.4.6 or higher
- Node 16 or higher (for development purposes only)
- Latest version of Gene Better Checkout

## Installation

Ensure you have installed the latest version of Gene Better Checkout, which can be found here, [Gene Better Checkout](https://github.com/genecommerce/module-better-checkout).

To install the Better Checkout PPCP module, run the following command in your Magento 2 root directory:

``` composer require gene/module-better-checkout-ppcp:^1.0 ```

Better Checkout PPCP follows the standard installation process for Adobe Commerce.

For information about a module installation in Adobe Commerce, see [Enable or disable modules](https://experienceleague.adobe.com/en/docs/commerce-operations/installation-guide/tutorials/manage-modules).

Remember to clear any appropriate caches.

Once installed the module follows the same configuration settings as prescribed by the official rvvup integration documentation, see [PPCP for Magento](https://commercemarketplace.adobe.com/media/catalog/product/paypal-module-ppcp-1-0-0-ece/user_guides.pdf?1732699597).

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