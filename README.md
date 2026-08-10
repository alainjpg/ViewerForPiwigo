# ViewerForPiwigo

A Piwigo plugin providing a modern lightbox viewer based on **Fancybox** or **PhotoSwipe**.

The viewer can be configured for different uses: slideshow, album thumbnails, or the main photo.

**Author:** AJPG

## Features

- Choose between Fancybox and PhotoSwipe.
- Open the viewer from the slideshow button, album thumbnails or the main photo.
- Navigate through an entire album.
- Optionally load all album photos through the Piwigo API.
- Limit the number of photos loaded.
- Optionally enable the viewer only on mobile and tablet devices.
- Choose the image size used by the viewer.
- Load the viewer library locally or from a CDN.
- Support compatible video content.

## Fancybox

This plugin currently uses **Fancybox 6.1.14**.

Fancybox is subject to its own licensing terms and may require a commercial license depending on the intended use.

The Fancybox library is not included with the plugin.

### CDN

Fancybox can be loaded from the official jsDelivr CDN.

### Local mode

If local mode is selected, download Fancybox 6 yourself and copy:

`fancybox.css`

and

`fancybox.umd.js`

to:

`plugins/ViewerForPiwigo/vendor/fancybox/`

Fancybox files are not redistributed with the plugin.

## PhotoSwipe

This plugin currently uses **PhotoSwipe 5.4.4**, released under the **MIT License**.

The PhotoSwipe library is included with the plugin and is used locally by default.

The included files are located in:

`plugins/ViewerForPiwigo/vendor/photoswipe/`

### CDN

PhotoSwipe can alternatively be loaded from the official jsDelivr CDN.

### Local mode

The required PhotoSwipe files are already included with the plugin:

`photoswipe.css`
`photoswipe.umd.min.js`

No additional download is required when using local mode.

## Video

ViewerForPiwigo is compatible with video content provided by the following Piwigo plugins:

- **VideoJS**
- **Embedded Videos**

Both Fancybox and PhotoSwipe can display supported HTML5 video and embedded video content such as YouTube, Vimeo and Dailymotion.

Playback depends on the selected viewer, the video format, browser support and the way the video is provided by Piwigo.

The plugin does not convert or re-encode video files.

## Installation

1. Install the plugin from the Piwigo administration panel, or copy it to the `plugins` directory.
2. Activate the plugin.
3. Open the plugin configuration.
4. Select Fancybox or PhotoSwipe.
5. Choose the library source.
6. Adjust the viewer options.

PhotoSwipe is ready to use locally immediately after installation.

Fancybox can be loaded from the CDN or configured manually in local mode.

## Requirements

- Piwigo 15 or later
- A modern web browser

## Third-party libraries

This plugin uses:

- Fancybox — when selected
- PhotoSwipe — when selected

Each library is distributed under its own license and terms of use.

## License

ViewerForPiwigo is distributed under its own license.

Third-party libraries are not covered by the plugin's license. Their respective licenses and terms of use apply.
