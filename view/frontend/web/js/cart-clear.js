/**
 * Added cart invalidation to clear the mini cart.
 */
define(['Magento_Customer/js/customer-data'], function (customerData) {
    'use strict';
    return function () {
        const sections = ['cart'];

        customerData.invalidate(sections);
        customerData.reload(sections, true);
    };
});
