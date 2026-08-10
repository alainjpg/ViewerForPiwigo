<?php
if (!defined('PHPWG_ROOT_PATH')) die('Hacking attempt!');

class ViewerForPiwigo_maintain extends PluginMaintain {
    
    public function install($plugin_version, &$errors = array()) {
        global $conf;
        
        $dir = basename(dirname(__FILE__));
        include_once(PHPWG_PLUGINS_PATH . $dir . '/main.inc.php');
        $default_config = viewerforpiwigo_get_default_config();

        if (empty($conf['viewerforpiwigo'])) {
            $serialized = viewerforpiwigo_serialize($default_config);
            conf_update_param('viewerforpiwigo', $serialized);
        }
    }

    public function uninstall() {
        conf_delete_param('viewerforpiwigo');
    }
}
