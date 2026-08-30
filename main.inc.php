<?php
/*
Plugin Name: ViewerForPiwigo
Version: 1.6.0
Description: Configurable Fancybox or PhotoSwipe viewer
Plugin URI: https://piwigo.org/ext/extension_view.php?eid=1107
Author: Alain.jpg
Has Settings: true

*/

if (!defined('PHPWG_ROOT_PATH')) die('Hacking attempt!');

define('VIEWERFORPIWIGO_PATH', PHPWG_PLUGINS_PATH . basename(dirname(__FILE__)) . '/');

load_language('plugin.lang', VIEWERFORPIWIGO_PATH);

add_event_handler('get_admin_plugin_menu_links', 'viewerforpiwigo_admin_menu');

if (defined('IN_ADMIN')) {
    function viewerforpiwigo_admin_menu($menu)
    {
        $menu[] = array(
            'NAME' => 'ViewerForPiwigo',
            'URL'  => get_root_url() . 'admin.php?page=plugin-' . basename(dirname(__FILE__))
        );

        return $menu;
    }
}

function viewerforpiwigo_get_default_config() {
    return array(
		'mobile_only' => false,
        'fancybox_source'      => 'cdn',
        'image_size'           => 'xlarge',
        'open_from_thumbnails' => true,
        'open_from_picture'    => true,
        'open_hint_mode'       => 'never', // never | corner_permanent | corner_fade | toolbar
		'open_from_slideshow'  => true,
		'open_from_osm_map'    => true,
        'load_full_album'      => true,
        'show_caption'         => true,
        'show_description'     => false,
        'show_author'          => false,
        'hide_auto_names'      => true,
        'page_link'            => true,
        'open_new_tab'         => false,
        'enable_download'      => true,
        'enable_zoom'          => false,
        'enable_fullscreen'    => true,
		'show_thumb_button'  	=> true,
		'thumbs_on_start'      => true,
        'show_mobile_arrows'   => false,
        'flat_arrows'          => false,
        'auto_hide_controls'   => false,
        'enable_slideshow'     => true,
        'autoplay_mode'        => 'slideshow_button', // never | slideshow_button | always
        'infinite'             => true,
		'slideshow_timeout' => 3000,

        'max_items_limit'      => 500,
        'filter_mode'          => 'all',
        'album_categories'     => array(),

        // --- Choix du moteur de visionneuse (experimental, 0.0.3) ---
        'viewer_engine'         => 'fancybox', // fancybox | photoswipe
        'photoswipe_source'     => 'local',    // cdn | local — PhotoSwipe est fourni avec le plugin, donc local par defaut
    );
}

function viewerforpiwigo_serialize($data) {
    return function_exists('safe_serialize') ? safe_serialize($data) : serialize($data);
}

function viewerforpiwigo_unserialize($data) {
    if (empty($data)) return array();
    return function_exists('safe_unserialize') ? safe_unserialize($data) : @unserialize($data);
}

// Migration de l'ancienne case 'disable_slideshow_autoplay' (booléen) vers
// le choix à 3 valeurs 'autoplay_mode'. Ne touche jamais une config déjà
// enregistrée avec 'autoplay_mode' (choix explicite de l'administrateur).
// Prend le tableau brut (avant fusion avec les valeurs par défaut) pour
// distinguer « jamais enregistré » de « déjà migré ».
function viewerforpiwigo_migrate_config($raw_config) {
    if (!is_array($raw_config) || isset($raw_config['autoplay_mode'])) {
        return $raw_config;
    }
    if (isset($raw_config['disable_slideshow_autoplay'])) {
        $raw_config['autoplay_mode'] = $raw_config['disable_slideshow_autoplay'] ? 'never' : 'slideshow_button';
    }
    return $raw_config;
}

add_event_handler('loc_end_page_header', 'viewerforpiwigo_inject');

function viewerforpiwigo_inject() {
    global $page, $template, $conf;

	$config = isset($conf['viewerforpiwigo'])
		? viewerforpiwigo_unserialize($conf['viewerforpiwigo'])
		: viewerforpiwigo_get_default_config();

	$config = viewerforpiwigo_migrate_config($config);

	$config = array_merge(
		viewerforpiwigo_get_default_config(),
		$config
	);

    $category_id = isset($page['category']['id']) ? (int)$page['category']['id'] : null;

    if ($category_id && !empty($config['filter_mode']) && $config['filter_mode'] !== 'all') {
        $selected_cats = !empty($config['album_categories']) ? array_map('intval', $config['album_categories']) : array();

        if ($config['filter_mode'] === 'include' && !in_array($category_id, $selected_cats, true)) {
            return;
        }
        if ($config['filter_mode'] === 'exclude' && in_array($category_id, $selected_cats, true)) {
            return;
        }
    }

    include_once(PHPWG_ROOT_PATH . 'include/functions_metadata.inc.php');

    // Récupération de la structure de catégorie complète pour les URLs
    $category_param = null;
    if (isset($page['category']) && isset($page['category']['name'])) {
        $category_param = $page['category'];
    } elseif ($category_id && function_exists('page_get_category_data')) {
        $category_param = page_get_category_data($category_id);
    }

    // Détermination des IDs selon la configuration (tout l'album ou page courante)
$items = array();

if (!empty($config['load_full_album']) || !empty($config['open_from_slideshow'])) {

    // Toutes les photos de l'album
    $items = isset($page['items']) ? $page['items'] : array();

    $limit = !empty($config['max_items_limit']) ? (int)$config['max_items_limit'] : 500;
    if (count($items) > $limit) {
        $items = isset($page['row_ids']) ? $page['row_ids'] : array_slice($items, 0, $limit);
    }

} else {

    // Si on est sur picture.php :
	if (isset($page['image_id'])) {

		$items[] = (int)$page['image_id'];

	} else {

        // Sinon, on récupère les photos de la page des miniatures
        $thumbnails = $template->get_template_vars('thumbnails');

        if (!empty($thumbnails) && is_array($thumbnails)) {

            foreach ($thumbnails as $thumb) {
                if (isset($thumb['id'])) {
                    $items[] = (int)$thumb['id'];
                }
            }
        }
    }
}

    $images_data = array();

    if (!empty($items)) {
        $clean_ids = implode(',', array_map('intval', $items));
        $query = '
        SELECT id, file, name, comment, author, path, width, height, rotation
          FROM ' . IMAGES_TABLE . '
          WHERE id IN (' . $clean_ids . ')
          ORDER BY FIELD(id, ' . $clean_ids . ')
        ;';

        $result = pwg_query($query);
		$gvideos = array();

		if (defined('GVIDEO_TABLE') && pwg_db_num_rows($result))
		{
			$query = '
		SELECT picture_id, type, video_id, url
		FROM '.GVIDEO_TABLE.'
		WHERE picture_id IN ('.$clean_ids.')
		;';

			$res = pwg_query($query);

			while ($video = pwg_db_fetch_assoc($res))
			{
				$gvideos[$video['picture_id']] = $video;
			}
		}
        while ($row = pwg_db_fetch_assoc($result)) {
            $src_image = DerivativeImage::url($config['image_size'], $row);
            $original_src = get_element_url($row);

            $url_params = array('image_id' => $row['id']);
            if ($category_param) {
                $url_params['category'] = $category_param;
            }

            $page_url = function_exists('duplicate_picture_url') 
                ? duplicate_picture_url($url_params) 
                : make_picture_url(array('image_id' => $row['id'], 'image_type' => 'picture'));
            $video = isset($gvideos[$row['id']]) ? $gvideos[$row['id']] : null;

            // Dimensions réelles telles qu'affichées : si l'image est tournée de
            // 90° ou 270° (rotation impaire), Piwigo inverse largeur/hauteur pour
            // le calcul de la taille (voir SrcImage::__construct dans le coeur).
            // On applique la même logique pour transmettre au JS des dimensions
            // cohérentes avec l'image réellement affichée (utile pour PhotoSwipe).
            $img_width  = isset($row['width']) ? (int)$row['width'] : 0;
            $img_height = isset($row['height']) ? (int)$row['height'] : 0;
            $img_rotation = isset($row['rotation']) ? ((int)$row['rotation'] % 4) : 0;
            if ($img_rotation % 2) {
                list($img_width, $img_height) = array($img_height, $img_width);
            }

			$images_data[] = array(
                'id'           => (int)$row['id'],
                'src'          => $src_image,
                'download_src' => $original_src,
                'page_url'     => $page_url,
                'name'         => isset($row['name']) ? $row['name'] : '',
                'comment'      => isset($row['comment']) ? $row['comment'] : '',
                'author'       => isset($row['author']) ? $row['author'] : '',
                'file'         => isset($row['file']) ? $row['file'] : '',
                'width'        => $img_width,
                'height'       => $img_height,
				'video_type' => $video ? $video['type'] : '',
				'video_id'   => $video ? $video['video_id'] : '',
				'video_url'  => $video ? $video['url'] : '',
            );
        }
    }

    $viewer_engine = in_array(@$config['viewer_engine'], array('fancybox', 'photoswipe')) ? $config['viewer_engine'] : 'fancybox';

    $viewer_css = '';
    $viewer_js = '';

    if ('photoswipe' === $viewer_engine) {
        if (isset($config['photoswipe_source']) && $config['photoswipe_source'] === 'local') {
            $viewer_css = VIEWERFORPIWIGO_PATH . 'vendor/photoswipe/photoswipe.css';
            $viewer_js  = VIEWERFORPIWIGO_PATH . 'vendor/photoswipe/photoswipe.umd.min.js';
        } else {
            $viewer_css = 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.css';
            $viewer_js  = 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/umd/photoswipe.umd.min.js';
        }
    } else {
        if (isset($config['fancybox_source']) && $config['fancybox_source'] === 'cdn') {
            $viewer_css = 'https://cdn.jsdelivr.net/npm/@fancyapps/ui@6.1.14/dist/fancybox/fancybox.css';
            $viewer_js  = 'https://cdn.jsdelivr.net/npm/@fancyapps/ui@6.1.14/dist/fancybox/fancybox.umd.js';
        } else {
            $viewer_css = VIEWERFORPIWIGO_PATH . 'vendor/fancybox/fancybox.css';
            $viewer_js  = VIEWERFORPIWIGO_PATH . 'vendor/fancybox/fancybox.umd.js';
        }
    }

    $html_head = '
    <link rel="stylesheet" href="' . $viewer_css . '" />
    <link rel="stylesheet" href="' . VIEWERFORPIWIGO_PATH . 'css/viewerforpiwigo.css" />
    <script src="' . $viewer_js . '"></script>
    <script type="text/javascript">
var VIEWERFORPIWIGO_DATA = ' . json_encode(array(
    'config'           => $config,
    'category_id'      => $category_id,
	'current_image_id' => isset($page['image_id']) ? (int)$page['image_id'] : 0,
	'items'            => $images_data,
    'lang'             => array(
        'page_link' => l10n('Open the photo page'),
        'autoplay'  => l10n('Start / Stop slideshow'),
        'see_more'  => l10n('See more')
    ),
    // Traductions des commandes natives des deux moteurs (Fancybox expose
    // une option l10n documentee ; PhotoSwipe n'a que 4 textes en dur,
    // remplaces directement dans le DOM cote JS).
    'fancybox_l10n'    => array(
        'CLOSE'              => l10n('Close'),
        'NEXT'               => l10n('Next'),
        'PREV'               => l10n('Previous'),
        'MODAL'              => l10n('You can close this modal content with the ESC key'),
        'ELEMENT_NOT_FOUND'  => l10n('HTML Element Not Found'),
        'IFRAME_ERROR'       => l10n('Error Loading Page'),
        'NO_CAPTION'         => l10n('No Caption'),
        'ERROR'              => l10n('Something went wrong, please try again later'),
        'GOTO'               => l10n('Go to slide #%d'),
        'DOWNLOAD'           => l10n('Download'),
        'TOGGLE_FULLSCREEN'  => l10n('Toggle full-screen mode'),
        'TOGGLE_THUMBS'      => l10n('Toggle thumbnails'),
        'TOGGLE_AUTOPLAY'    => l10n('Toggle slideshow'),
        'ZOOM_IN'            => l10n('Zoom in'),
        'ZOOM_OUT'           => l10n('Zoom out'),
        'TOGGLE_1TO1'        => l10n('Toggle zoom level'),
        'TOGGLE_FULL'        => l10n('Toggle zoom level'),
        'IMAGE_ERROR'        => l10n('This image could not be loaded')
    ),
    'pswp_l10n'        => array(
        'PREV'  => l10n('Previous'),
        'NEXT'  => l10n('Next'),
        'CLOSE' => l10n('Close'),
        'ZOOM'  => l10n('Zoom')
    )
), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) . ';
    </script>
    <script type="text/javascript" src="' . VIEWERFORPIWIGO_PATH . 'js/viewerforpiwigo.js"></script>
    ';

    $template->append('head_elements', $html_head);
}