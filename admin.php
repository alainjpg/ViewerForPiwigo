<?php
if (!defined('PHPWG_ROOT_PATH')) die('Hacking attempt!');

global $template, $page, $conf;

$plugin_dir = basename(dirname(__FILE__));
include_once(PHPWG_PLUGINS_PATH . $plugin_dir . '/main.inc.php');

if (isset($_POST['submit'])) {
    check_pwg_token();

    $config = array(
		'mobile_only'          => isset($_POST['mobile_only']),		
        'fancybox_source'      => isset($_POST['fancybox_source']) ? $_POST['fancybox_source'] : 'cdn',
        'image_size'           => isset($_POST['image_size']) ? $_POST['image_size'] : 'xlarge',
        
        // --- NOUVELLES OPTIONS DE PORTE D'ENTRÉE ET CHARGEMENT ---
		'open_from_thumbnails' => isset($_POST['open_from_thumbnails']),
        'open_from_thumbnails' => isset($_POST['open_from_thumbnails']),
        'open_from_picture'    => isset($_POST['open_from_picture']),
		'open_from_slideshow'  => isset($_POST['open_from_slideshow']),      
        'load_full_album'      => isset($_POST['load_full_album']),
        'show_caption'         => isset($_POST['show_caption']),
        'show_description'     => isset($_POST['show_description']),
        'show_author'          => isset($_POST['show_author']),
        'hide_auto_names'      => isset($_POST['hide_auto_names']),
        'page_link'            => isset($_POST['page_link']),
        'open_new_tab'         => isset($_POST['open_new_tab']),
        'enable_download'      => isset($_POST['enable_download']),
        'enable_zoom'          => isset($_POST['enable_zoom']),
        'enable_fullscreen'    => isset($_POST['enable_fullscreen']),
		'show_thumb_button'    => isset($_POST['show_thumb_button']),
		'thumbs_on_start'      => isset($_POST['thumbs_on_start']),
        'enable_slideshow'     => isset($_POST['enable_slideshow']),
        'disable_slideshow_autoplay' => isset($_POST['disable_slideshow_autoplay']),
        'infinite'             => isset($_POST['infinite']),
        'slideshow_timeout'	   => isset($_POST['slideshow_timeout']) ? (int) $_POST['slideshow_timeout'] : 3000,
        'max_items_limit'      => isset($_POST['max_items_limit']) ? (int)$_POST['max_items_limit'] : 500,
        'filter_mode'          => isset($_POST['filter_mode']) ? $_POST['filter_mode'] : 'all',
        'album_categories'     => isset($_POST['categories']) && is_array($_POST['categories']) ? array_map('intval', $_POST['categories']) : array(),

        'viewer_engine'        => in_array(@$_POST['viewer_engine'], array('fancybox', 'photoswipe')) ? $_POST['viewer_engine'] : 'fancybox',
        'photoswipe_source'    => (isset($_POST['photoswipe_source']) && $_POST['photoswipe_source'] === 'local') ? 'local' : 'cdn',
    );

    // Troisième paramètre true pour forcer le rafraîchissement immédiat du cache
    conf_update_param('viewerforpiwigo', viewerforpiwigo_serialize($config), true);

    // Important : conf_update_param() écrit en base mais ne met pas à jour
    // le tableau global $conf pour la requête en cours, donc sans cette
    // ligne le formulaire se réaffichait avec les anciennes valeurs juste
    // après l'enregistrement (d'où l'impression qu'il fallait valider deux
    // fois pour que ça prenne effet).
    $conf['viewerforpiwigo'] = viewerforpiwigo_serialize($config);

    $page['infos'][] = l10n('Information data registered');
}

$raw_conf = isset($conf['viewerforpiwigo']) ? $conf['viewerforpiwigo'] : null;

$config = $raw_conf
    ? viewerforpiwigo_unserialize($raw_conf)
    : viewerforpiwigo_get_default_config();

$config = array_merge(
    viewerforpiwigo_get_default_config(),
    $config
);

$query = '
SELECT id, name
  FROM ' . CATEGORIES_TABLE . '
  ORDER BY name ASC
;';
$result = pwg_query($query);
$categories = array();
while ($row = pwg_db_fetch_assoc($result)) {
    $categories[] = $row;
}

$template->assign(array(
    'conf_viewerforpiwigo' => $config,
    'categories' => $categories,
    'PWG_TOKEN' => get_pwg_token(),
    'VIEWERFORPIWIGO_ADMIN_ACTION' => get_root_url() . 'admin.php?page=plugin-' . $plugin_dir
));

$template->set_filename('plugin_admin_content', dirname(__FILE__) . '/admin.tpl');
$template->assign_var_from_handle('ADMIN_CONTENT', 'plugin_admin_content');