/**
 * Added cart invalidation to clear the mini cart.
 */
 define(['Magento_Customer/js/customer-data'], function (customerData) {
    return function () {
        var sections = ['cart'];
        
        setTimeout(() => {
          customerData.invalidate(sections);
          customerData.reload(sections, true);
        }, 5000)
      
    }
});
