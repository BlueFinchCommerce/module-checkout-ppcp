<?php
declare(strict_types=1);

namespace Gene\BetterCheckoutPPCP\Model\Resolver;

use Magento\Framework\GraphQl\Config\Element\Field;
use Magento\Framework\GraphQl\Exception\GraphQlInputException;
use Magento\Framework\GraphQl\Exception\GraphQlNoSuchEntityException;
use Magento\Framework\GraphQl\Query\ResolverInterface;
use Magento\Framework\GraphQl\Schema\Type\ResolveInfo;
use Magento\Framework\App\Config\ScopeConfigInterface;
use PayPal\PPCP\Model\ConfigProvider;
use PayPal\PPCP\Model\Adminhtml\Source\ApmMethods;

class PpcpApmConfig implements ResolverInterface
{
    /**
     * @param ScopeConfigInterface $scopeConfig
     * @param ConfigProvider $payPalConfigProvider
     * @param ApmMethods $apmMethods
     */
    public function __construct(
        private readonly ScopeConfigInterface $scopeConfig,
        private readonly ConfigProvider $payPalConfigProvider,
        private readonly ApmMethods $apmMethods
    ) {
    }

    /**
     * @inheritdoc
     */
    public function resolve(
        Field $field,
              $context,
        ResolveInfo $info,
        array $value = null,
        array $args = null
    ) {
        try {
            $apmAllowedMethods = explode(',', $this->payPalConfigProvider->getAllowedPaymentMethod());
            $methods = [];
            $apmMethods = $this->apmMethods->toOptionArray();
            foreach ($apmMethods as $option) {
                if (in_array($option['value'], $apmAllowedMethods)) {
                    $methods[] = $option;
                }
            }
            return json_encode($methods);
        } catch (GraphQlNoSuchEntityException $exception) {
            throw new GraphQlNoSuchEntityException(__($exception->getMessage()));
        }
    }
}
