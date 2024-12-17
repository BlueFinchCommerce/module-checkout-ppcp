<?php
declare(strict_types=1);

namespace Gene\BetterCheckoutPPCP\Plugin\Resolver;

use Magento\Framework\GraphQl\Config\Element\Field;
use Magento\Framework\GraphQl\Exception\GraphQlAuthorizationException;
use Magento\Framework\GraphQl\Schema\Type\ResolveInfo;
use Magento\GraphQl\Model\Query\ContextInterface;
use Magento\Vault\Model\PaymentTokenManagement;
use Magento\VaultGraphQl\Model\Resolver\PaymentTokens as Subject;
use PayPal\PPCP\Model\ConfigProvider;

class PaymentTokens
{
    /**
     * @param ConfigProvider $configProvider
     */
    public function __construct(
        private readonly PaymentTokenManagement $paymentTokenManagement,
        private readonly ConfigProvider $configProvider
    ) {}

    public function aroundResolve(
        Subject $subject,
        callable $proceed,
        Field $field,
        $context,
        ResolveInfo $info,
        array $value = null,
        array $args = null
    ) {
        if (!$this->configProvider->isExtensionActive()) {
            return $proceed($field, $context, $info, $value, $args);
        } else {
            /** @var ContextInterface $context */
            if (false === $context->getExtensionAttributes()->getIsCustomer()) {
                throw new GraphQlAuthorizationException(__('The current customer isn\'t authorized.'));
            }

            $tokens = $this->paymentTokenManagement->getVisibleAvailableTokens($context->getUserId());
            $result = [];

            foreach ($tokens as $token) {
                $result[] = [
                    'id' => $token->getEntityId(),
                    'public_hash' => $token->getPublicHash(),
                    'payment_method_code' => $token->getPaymentMethodCode(),
                    'type' => $token->getType(),
                    'details' => $token->getTokenDetails(),
                ];
            }
            return ['items' => $result];
        }
    }
}
