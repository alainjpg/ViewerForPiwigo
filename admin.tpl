<div class="titrePage">
  <h2>{'ViewerForPiwigo'|@translate}</h2>
</div>

<style type="text/css">
  .vfp-help { font-size: 0.9em; color: #767676; margin: 2px 0 10px 26px; }
  .vfp-inline-note { font-size: 0.9em; color: #767676; font-weight: normal; text-decoration: none; }
  .vfp-engine-summary { margin: 4px 0 10px 0; font-size: 0.95em; color: #555; }
  .vfp-local-info { margin: 6px 0 10px 0; }
  input.vfp-dimmed { opacity: 0.5; }
</style>

<form method="post" action="{$VIEWERFORPIWIGO_ADMIN_ACTION}" class="properties">
  <input type="hidden" name="pwg_token" value="{$PWG_TOKEN}">

  <fieldset>
    <legend>{'General'|@translate}</legend>
    <ul>
      <li>
        <label><strong>{'Viewer:'|@translate}</strong>
          <select name="viewer_engine" id="vfp-viewer-engine">
            <option value="fancybox" {if $conf_viewerforpiwigo.viewer_engine == 'fancybox'}selected="selected"{/if}>Fancybox</option>
            <option value="photoswipe" {if $conf_viewerforpiwigo.viewer_engine == 'photoswipe'}selected="selected"{/if}>PhotoSwipe</option>
          </select>
        </label>
        <p id="vfp-summary-fancybox" class="vfp-engine-summary" style="{if $conf_viewerforpiwigo.viewer_engine != 'fancybox'}display:none;{/if}">
          <em>{'Modern and feature-rich • many features • commercial license required for some uses'|@translate}</em>
        </p>
        <p id="vfp-summary-photoswipe" class="vfp-engine-summary" style="{if $conf_viewerforpiwigo.viewer_engine != 'photoswipe'}display:none;{/if}">
          <em>{'Lightweight and fast • well suited to mobile • MIT License'|@translate}</em>
        </p>
      </li>

      <li id="vfp-source-fancybox" style="{if $conf_viewerforpiwigo.viewer_engine != 'fancybox'}display:none;{/if}">
        <label><strong>{'Fancybox library source:'|@translate}</strong></label><br>
        <label><input type="radio" name="fancybox_source" value="cdn" class="vfp-source-radio" data-engine="fancybox" {if $conf_viewerforpiwigo.fancybox_source == 'cdn'}checked="checked"{/if}> {'Official CDN (jsDelivr - Recommended)'|@translate}</label><br>
        <label><input type="radio" name="fancybox_source" value="local" class="vfp-source-radio" data-engine="fancybox" {if $conf_viewerforpiwigo.fancybox_source == 'local'}checked="checked"{/if}> {'Local mode'|@translate}</label>
        <p id="vfp-local-info-fancybox" class="vfp-local-info" style="{if $conf_viewerforpiwigo.fancybox_source != 'local'}display:none;{/if}">
          {'Local mode: if enabled, download Fancybox 6 and copy <code>fancybox.css</code> and <code>fancybox.umd.js</code> to <code>plugins/ViewerForPiwigo/vendor/fancybox/</code>.'|@translate}
        </p>
      </li>

      <li id="vfp-source-photoswipe" style="{if $conf_viewerforpiwigo.viewer_engine != 'photoswipe'}display:none;{/if}">
        <label><strong>{'PhotoSwipe library source:'|@translate}</strong></label><br>
        <label><input type="radio" name="photoswipe_source" value="local" class="vfp-source-radio" data-engine="photoswipe" {if $conf_viewerforpiwigo.photoswipe_source == 'local'}checked="checked"{/if}> {'Local (Recommended)'|@translate}</label><br>
        <label><input type="radio" name="photoswipe_source" value="cdn" class="vfp-source-radio" data-engine="photoswipe" {if $conf_viewerforpiwigo.photoswipe_source == 'cdn'}checked="checked"{/if}> {'Official CDN (jsDelivr)'|@translate}</label>
        <p id="vfp-local-info-photoswipe" class="vfp-local-info" style="{if $conf_viewerforpiwigo.photoswipe_source != 'local'}display:none;{/if}">
          {'Uses the PhotoSwipe files already included in <code>plugins/ViewerForPiwigo/vendor/photoswipe/</code>.'|@translate}
        </p>
      </li>

      <li>
        <label>
          <input type="checkbox" name="mobile_only" value="1" {if $conf_viewerforpiwigo.mobile_only}checked="checked"{/if}>
          <strong>{'Enable only on mobile and tablet'|@translate}</strong>
        </label>
        <p class="vfp-help">{'On desktop, Piwigo\'s standard behavior is preserved.'|@translate}</p>
      </li>

      <li>
        <label><strong>{'Image display size:'|@translate}</strong>
          <select name="image_size">
            {foreach from=$available_sizes item=vfp_size_type}
            <option value="{$vfp_size_type}" {if $conf_viewerforpiwigo.image_size == $vfp_size_type}selected="selected"{/if}>{if $vfp_size_type == 'medium'}{'Medium'|@translate}{elseif $vfp_size_type == 'large'}{'Large'|@translate}{elseif $vfp_size_type == 'xlarge'}{'XLarge'|@translate}{elseif $vfp_size_type == 'xxlarge'}{'XXLarge'|@translate}{elseif $vfp_size_type == '3xlarge'}{'3XLarge'|@translate}{elseif $vfp_size_type == '4xlarge'}{'4XLarge'|@translate}{else}{$vfp_size_type}{/if}</option>
            {/foreach}
          </select>
        </label>
      </li>
    </ul>
  </fieldset>

  <fieldset>
    <legend>{'Opening & Navigation'|@translate}</legend>
    <ul>
      <li>
        <label>
          <input type="checkbox" name="open_from_slideshow" value="1" {if $conf_viewerforpiwigo.open_from_slideshow}checked="checked"{/if}>
          <strong>{'Open the viewer from the slideshow button'|@translate}</strong>
        </label>
        <span class="vfp-inline-note">{'The display of the "Slideshow" button also depends on Piwigo or theme display settings.'|@translate}</span>
      </li>
      <li>
        <label>
          <input type="checkbox" name="open_from_thumbnails" value="1" {if !empty($conf_viewerforpiwigo.open_from_thumbnails)}checked="checked"{/if}>
          <strong>{'Open the viewer from thumbnails'|@translate}</strong> {'(album page grid)'|@translate}
        </label>
      </li>
      <li>
        <label>
          <input type="checkbox" name="open_from_picture" value="1" {if !empty($conf_viewerforpiwigo.open_from_picture)}checked="checked"{/if}>
          <strong>{'Open the viewer from the main image'|@translate}</strong> {'(on the individual photo page)'|@translate}
        </label>
      </li>
      <li>
        <label>
          <input type="checkbox" name="load_full_album" value="1" id="vfp-load-full-album" {if !empty($conf_viewerforpiwigo.load_full_album)}checked="checked"{/if}>
          <strong>{'Load all photos from the album'|@translate}</strong>
        </label>
        <p class="vfp-help">{'The viewer can then navigate through the entire album instead of only the photos displayed on the current page.'|@translate}</p>
      </li>
      <li>
        <label><strong>{'Maximum number of photos loaded'|@translate}</strong>
          <input type="number" name="max_items_limit" id="vfp-max-items-limit" value="{$conf_viewerforpiwigo.max_items_limit}" min="50" max="5000" class="{if empty($conf_viewerforpiwigo.load_full_album)}vfp-dimmed{/if}">
        </label>
        <p class="vfp-help">{'This limit applies when all photos of the album are loaded.'|@translate}</p>
      </li>
    </ul>
  </fieldset>

  <fieldset>
    <legend>{'Captions & Titles'|@translate}</legend>
    <ul>
      <li><label><input type="checkbox" name="show_caption" value="1" {if $conf_viewerforpiwigo.show_caption}checked="checked"{/if}> {'Show the photo title'|@translate}</label></li>
      <li>
        <label><input type="checkbox" name="show_description" value="1" {if !empty($conf_viewerforpiwigo.show_description)}checked="checked"{/if}> {'Show the photo description'|@translate}</label>
        <p class="vfp-help">{'A long description is visually truncated with a link to the photo page.'|@translate}</p>
      </li>
      <li><label><input type="checkbox" name="show_author" value="1" {if !empty($conf_viewerforpiwigo.show_author)}checked="checked"{/if}> {'Show the photo author'|@translate}</label></li>
      <li><label><input type="checkbox" name="hide_auto_names" value="1" {if $conf_viewerforpiwigo.hide_auto_names}checked="checked"{/if}> {'Automatically hide generated names (IMG_..., PXL_..., etc.)'|@translate}</label></li>
    </ul>
  </fieldset>

  <fieldset>
    <legend>{'Buttons'|@translate}</legend>
    <ul>
      <li><label><input type="checkbox" name="page_link" value="1" {if $conf_viewerforpiwigo.page_link}checked="checked"{/if}> {'Show the button to the Piwigo photo page'|@translate}</label></li>
      <li><label><input type="checkbox" name="open_new_tab" value="1" {if $conf_viewerforpiwigo.open_new_tab}checked="checked"{/if}> {'Open the Piwigo photo page in a new tab'|@translate}</label></li>
      <li><label><input type="checkbox" name="enable_download" value="1" {if $conf_viewerforpiwigo.enable_download}checked="checked"{/if}> {'Image download button'|@translate}</label></li>
      <li><label><input type="checkbox" name="enable_zoom" value="1" {if $conf_viewerforpiwigo.enable_zoom}checked="checked"{/if}> {'Zoom button'|@translate}</label></li>
      <li><label><input type="checkbox" name="enable_fullscreen" value="1" {if $conf_viewerforpiwigo.enable_fullscreen}checked="checked"{/if}> {'Fullscreen button'|@translate}</label></li>
    </ul>
  </fieldset>

  <fieldset id="vfp-fancybox-options" style="{if $conf_viewerforpiwigo.viewer_engine != 'fancybox'}display:none;{/if}">
    <legend>{'Fancybox Options'|@translate}</legend>
    <ul>
      <li><label><input type="checkbox" name="show_thumb_button" value="1" {if $conf_viewerforpiwigo.show_thumb_button}checked="checked"{/if}> {'Show the thumbnails button'|@translate}</label></li>
      <li>
        <label><input type="checkbox" name="thumbs_on_start" value="1" {if !empty($conf_viewerforpiwigo.thumbs_on_start)}checked="checked"{/if}> {'Show thumbnails when opening'|@translate}</label>
        <p class="vfp-help">{'If disabled, Fancybox opens without the thumbnail strip; it can still be shown using the thumbnails button above.'|@translate}</p>
      </li>
    </ul>
  </fieldset>

  <fieldset>
    <legend>{'Slideshow'|@translate}</legend>
    <ul>
      <li><label><input type="checkbox" name="enable_slideshow" value="1" {if $conf_viewerforpiwigo.enable_slideshow}checked="checked"{/if}> {'Show controls even when the viewer is not opened from the "Slideshow" button'|@translate}</label></li>
      <li>
        <label><input type="checkbox" name="disable_slideshow_autoplay" value="1" {if !empty($conf_viewerforpiwigo.disable_slideshow_autoplay)}checked="checked"{/if}> {'Disable autoplay when opening the slideshow'|@translate}</label>
        <p class="vfp-help">{'The Play button remains available so the user can start it manually.'|@translate}</p>
      </li>
      <li><label><input type="checkbox" name="infinite" value="1" {if $conf_viewerforpiwigo.infinite}checked="checked"{/if}> {'Infinite loop navigation'|@translate}</label></li>
      <li>
        <label>
          {'Slideshow interval (ms)'|@translate}
          <input type="number"
                 name="slideshow_timeout"
                 min="500"
                 step="100"
                 value="{$conf_viewerforpiwigo.slideshow_timeout}">
        </label>
      </li>
    </ul>
  </fieldset>

  <fieldset>
    <legend>{'Album Restriction'|@translate}</legend>
    <ul>
      <li>
        <label><strong>{'Filter mode:'|@translate}</strong>
          <select name="filter_mode">
            <option value="all" {if $conf_viewerforpiwigo.filter_mode == 'all'}selected="selected"{/if}>{'Active on all albums'|@translate}</option>
            <option value="include" {if $conf_viewerforpiwigo.filter_mode == 'include'}selected="selected"{/if}>{'Active ONLY on the selected albums'|@translate}</option>
            <option value="exclude" {if $conf_viewerforpiwigo.filter_mode == 'exclude'}selected="selected"{/if}>{'Active everywhere EXCEPT on the selected albums'|@translate}</option>
          </select>
        </label>
      </li>
      {if !empty($categories)}
      <li>
        <label><strong>{'Albums concerned:'|@translate}</strong></label><br>
        <select name="categories[]" multiple="multiple" size="6" style="min-width:250px;">
          {foreach from=$categories item=cat}
            <option value="{$cat.id}" {if in_array($cat.id, $conf_viewerforpiwigo.album_categories)}selected="selected"{/if}>{$cat.name}</option>
          {/foreach}
        </select>
      </li>
      {/if}
    </ul>
  </fieldset>

  <p class="formAction">
    <input class="submit" type="submit" name="submit" value="{'Save changes'|@translate}">
  </p>
</form>

<script type="text/javascript">
(function () {
    // Affichage dynamique (sans rechargement) des elements lies au moteur de
    // visionneuse selectionne, et de l'etat des champs dependants. Ce script
    // ne contient aucun texte utilisateur : tous les libelles restent geres
    // par le systeme de traduction Piwigo (@translate) dans le HTML ci-dessus.
    function byId(id) { return document.getElementById(id); }

    function updateEngineDisplay() {
        var engine = byId('vfp-viewer-engine').value;

        byId('vfp-summary-fancybox').style.display = (engine === 'fancybox') ? '' : 'none';
        byId('vfp-summary-photoswipe').style.display = (engine === 'photoswipe') ? '' : 'none';

        byId('vfp-source-fancybox').style.display = (engine === 'fancybox') ? '' : 'none';
        byId('vfp-source-photoswipe').style.display = (engine === 'photoswipe') ? '' : 'none';

        var fancyboxOptions = byId('vfp-fancybox-options');
        if (fancyboxOptions) {
            fancyboxOptions.style.display = (engine === 'fancybox') ? '' : 'none';
        }
    }

    function updateLocalInfo(radio) {
        var engine = radio.getAttribute('data-engine');
        var info = byId('vfp-local-info-' + engine);
        if (info) {
            info.style.display = (radio.value === 'local' && radio.checked) ? '' : 'none';
        }
    }

    function updateMaxItemsState() {
        var loadFullAlbum = byId('vfp-load-full-album');
        var maxItems = byId('vfp-max-items-limit');
        if (loadFullAlbum && maxItems) {
            // Volontairement PAS de propriete "disabled" : un champ desactive
            // n'est pas transmis a la soumission du formulaire, ce qui
            // reinitialiserait silencieusement la valeur enregistree. On se
            // contente donc d'un effet visuel.
            if (loadFullAlbum.checked) {
                maxItems.classList.remove('vfp-dimmed');
            } else {
                maxItems.classList.add('vfp-dimmed');
            }
        }
    }

    var engineSelect = byId('vfp-viewer-engine');
    if (engineSelect) {
        engineSelect.addEventListener('change', updateEngineDisplay);
    }

    var sourceRadios = document.querySelectorAll('.vfp-source-radio');
    for (var i = 0; i < sourceRadios.length; i++) {
        sourceRadios[i].addEventListener('change', function () {
            updateLocalInfo(this);
        });
    }

    var loadFullAlbumCheckbox = byId('vfp-load-full-album');
    if (loadFullAlbumCheckbox) {
        loadFullAlbumCheckbox.addEventListener('change', updateMaxItemsState);
    }

    // Etat initial (redondant avec le rendu serveur ci-dessus, conserve par
    // securite si jamais les deux etaient amenes a diverger).
    updateEngineDisplay();
    updateMaxItemsState();
})();
</script>
