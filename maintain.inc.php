<?php
if (!defined('PHPWG_ROOT_PATH')) die('Hacking attempt!');

class ViewerForPiwigo_maintain extends PluginMaintain {
    
    public function install($plugin_version, &$errors = array()) {
        global $conf;
        
        $dir = basename(dirname(__FILE__));
        include_once(PHPWG_PLUGINS_PATH . $dir . '/main.inc.php');
        $default_config = fancybox_viewer_get_default_config();

        if (empty($conf['fancybox_viewer'])) {
            $serialized = fancybox_viewer_serialize($default_config);
            conf_update_param('fancybox_viewer', $serialized);
        }
    }

    public function uninstall() {
        conf_delete_param('fancybox_viewer');
    }
}
