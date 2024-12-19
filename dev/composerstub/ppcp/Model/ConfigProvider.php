<?php
namespace PayPal\PPCP\Model;

class ConfigProvider
{
    /**
     * @return bool
     */
    public function isExtensionActive()
    {
        return (bool) rand(0,1);
    }
}
