document.addEventListener("DOMContentLoaded", function () {
    const rawConfig = (typeof FANCYBOX_VIEWER_DATA !== "undefined" && FANCYBOX_VIEWER_DATA.config) ? FANCYBOX_VIEWER_DATA.config : {};

    const config = {
        enable_autoplay: rawConfig.enable_slideshow !== false,
        enable_download: rawConfig.enable_download !== false,
        enable_zoom: rawConfig.enable_zoom !== false,
        enable_fullscreen: rawConfig.enable_fullscreen !== false,
        show_thumb_button: rawConfig.show_thumb_button !== false,
        page_link: rawConfig.page_link !== false && rawConfig.show_page_link !== false,
        open_new_tab: rawConfig.open_new_tab !== false,
		open_from_thumbnails: rawConfig.open_from_thumbnails !== false,
		open_from_picture: rawConfig.open_from_picture !== false,
		open_from_slideshow: rawConfig.open_from_slideshow === true,
		load_full_album: rawConfig.load_full_album !== false,
		mobile_only: rawConfig.mobile_only === true,
		// --- Choix du moteur de visionneuse (0.0.3, experimental) ---
		viewer_engine: rawConfig.viewer_engine === "photoswipe" ? "photoswipe" : "fancybox",
    };

    function getLargeImage(src) {
        if (!src) return "";
        if (src.includes("_data/i/")) {
            src = src.replace("_data/i/", "i.php?/");
        }
        return src.replace(/-[^-\/]+(\.[^.]+)$/i, "-xl$1");
    }

	function getOriginalImage(src) {
		if (!src) return "";
		
		// 1. Supprime proprement les routeurs virtuels de Piwigo en garantissant la présence d'un seul slash
		src = src.replace(/\/_data\/i\//i, "/");
		src = src.replace(/\/i\.php\?\//i, "/");
		
		// 2. Retire les suffixes de redimensionnement de Piwigo (ex: -sq, -th, -xl)
		return src.replace(/-[^-\/]+(\.[^.]+)$/i, "$1");
	}

	// Extrait l'ID Piwigo directement depuis le lien d'une miniature (formats
	// courants : ?image_id=123, ?/123, ou URL "jolie" /123-titre/). Fonctionne
	// aussi bien pour les photos que pour les videos, contrairement a une
	// correspondance par nom de fichier (la vignette d'une video est une image
	// "poster" dont le nom ne correspond jamais au fichier video reel).
	function extractImageIdFromHref(href) {
		if (!href) return null;
		let m = href.match(/[?&]image_id=(\d+)/);
		if (m) return parseInt(m[1], 10);
		m = href.match(/\?\/(\d+)(?:[\/?]|$)/);
		if (m) return parseInt(m[1], 10);
		m = href.match(/\/(\d+)-[^\/?#]*\/?(?:[?#]|$)/);
		if (m) return parseInt(m[1], 10);
		return null;
	}

    function isAutomaticFilename(text) {
        if (!text) return false;
        text = text.trim().replace(/\.[^.]+$/, "");

        if (/^(IMG|DSC|CIMG|PICT|PXL|GOPR|DJI|MVI|VID|SAM|MVIMG|OLYMP|PAN|PANA|FUJI|NIKON|SONY)([ _-]?[A-Z0-9]+)*$/i.test(text)) return true;
        if (/^PXL[ _-]?\d{8}[ _-]?\d{6}.*$/i.test(text)) return true;
        if (/^Resized[ _-]?\d{8}[ _-]?\d{6}(\(\d+\))?$/i.test(text)) return true;
        if (/^IMG[ _-]?\d{8}[ _-]?WA\d+$/i.test(text)) return true;
        if (/^Screenshot.*$/i.test(text)) return true;
        if (/^[\d\s()_-]+$/.test(text)) return true;
        if (/^Capture d[’']écran.*$/i.test(text)) return true;
        if (/^\d{8,}[ _-][a-f0-9]{6,}$/i.test(text)) return true;
        if (/^[\d _-]+$/.test(text)) return true;

        return false;
    }
	function buildFancyboxItems() {

		return FANCYBOX_VIEWER_DATA.items.map(item => {

			let caption = item.name || item.comment || "";
			if (isAutomaticFilename(caption)) caption = "";

			// Embedded Videos
			if (item.video_type) {

				let src = item.video_url;

				switch (item.video_type) {

					case "youtube":
						src = "https://www.youtube-nocookie.com/embed/" +
							  item.video_id +
							  "?autoplay=1";
						break;

					case "vimeo":
						src = "https://player.vimeo.com/video/" +
							  item.video_id;
						break;

					case "dailymotion":
						src = "https://www.dailymotion.com/embed/video/" +
							  item.video_id;
						break;
				}

				return {
					id: item.id,
					isVideo: true,
					thumbSrc: item.src,
					src: src,
					type: "iframe",
					caption: caption,
					pageUrl: item.page_url
				};
			}

			// Vidéos HTML5 (VideoJS)
			if (/\.(mp4|webm|ogg)$/i.test(item.file)) {
				return {
					id: item.id,
					isVideo: true,
					thumbSrc: item.src,
					src: item.download_src,
					type: "html5video",
					caption: caption,
					downloadSrc: item.download_src,
					pageUrl: item.page_url
				};
			}

			// Images
			return {
				id: item.id,
				file: item.file,
				src: item.src,
				width: item.width || 0,
				height: item.height || 0,
				caption: caption,
				downloadSrc: item.download_src,
				pageUrl: item.page_url
			};
		});

	}
    function buildToolbarRight(forcePlay) {
        const toolbarRight = [];
        // Le bouton Diaporama demande explicitement un diaporama : les
        // commandes doivent toujours être visibles dans ce cas, quelle que
        // soit l'option "Afficher les commandes du diaporama".
        if (config.enable_autoplay || forcePlay) toolbarRight.push("autoplay");
        if (config.enable_zoom) {
            toolbarRight.push("zoomIn");
            toolbarRight.push("zoomOut");
            toolbarRight.push("toggle1to1");
        }
        if (config.show_thumb_button) toolbarRight.push("thumbs");
        if (config.enable_download) toolbarRight.push("download");
        if (config.page_link) toolbarRight.push("pageLink");
        if (config.enable_fullscreen) toolbarRight.push("fullscreen");
        toolbarRight.push("close");
        return toolbarRight;
    }

	const thumbnailLinks = document.querySelectorAll("#thumbnails a, .thumbnails a");

	function isFancyboxAllowed() {
		return !config.mobile_only ||
			window.matchMedia("(max-width: 1024px)").matches;
	}

	if (isFancyboxAllowed() && config.open_from_thumbnails && thumbnailLinks.length > 0) {        thumbnailLinks.forEach((a, index) => {
            a.addEventListener("click", function (e) {
                e.preventDefault();

                if (
                    config.load_full_album &&
                    typeof FANCYBOX_VIEWER_DATA !== "undefined" &&
                    FANCYBOX_VIEWER_DATA.items &&
                    FANCYBOX_VIEWER_DATA.items.length > 0
                ) {
                    const items = buildFancyboxItems();

                    const clickedImg = a.querySelector("img");
                    const clickedSrc = clickedImg ? (clickedImg.dataset.src || clickedImg.src) : "";
                    let startIndex = index;

                    if (clickedSrc) {
                        const filename = clickedSrc.split('/').pop().split('-')[0];
                        const foundIdx = items.findIndex(item => item.src.includes(filename));
                        if (foundIdx !== -1) startIndex = foundIdx;
                    }

                    launchViewer(items, startIndex);
                } else {
                    launchLocalFancybox(index);
                }
            });
        });
    }
	function getCurrentImageIndex(items) {
    const currentId = parseInt(FANCYBOX_VIEWER_DATA.current_image_id, 10);

    const index = items.findIndex(item => item.id === currentId);

    return index >= 0 ? index : 0;
}
	const slideshowButtons = document.querySelectorAll(
		"#cmdSlideshow a, a[href*='slideshow=']"
	);

	if (isFancyboxAllowed() && config.open_from_slideshow && slideshowButtons.length > 0) {
		slideshowButtons.forEach(function (button) {
			button.addEventListener("click", function (e) {
				e.preventDefault();

				if (
					typeof FANCYBOX_VIEWER_DATA === "undefined" ||
					!FANCYBOX_VIEWER_DATA.items ||
					!FANCYBOX_VIEWER_DATA.items.length
				) {
					return;
				}

				const items = buildFancyboxItems();

				const startIndex = getCurrentImageIndex(items);

				// Le clic sur le bouton Diaporama signifie que l'utilisateur
				// demande explicitement un diaporama : l'autoplay doit démarrer
				// et les commandes du diaporama doivent être visibles, même si
				// l'option "Afficher les commandes du diaporama" est désactivée
				// (celle-ci ne concerne que les ouvertures normales).
				launchViewer(items, startIndex, true);
			});
		});
	}
    const pictureImage = document.getElementById("theMainImage");

	if (isFancyboxAllowed() && config.open_from_picture && pictureImage) {
        pictureImage.style.cursor = "zoom-in";

        pictureImage.addEventListener("click", function (e) {
            e.preventDefault();

            if (!config.load_full_album) {
                // Meme quand on ne charge pas tout l'album, les dimensions reelles
                // de la photo courante sont deja disponibles cote serveur
                // (FANCYBOX_VIEWER_DATA.items contient toujours au moins la photo
                // affichee). On les utilise pour eviter le ratio 4/3 par defaut de
                // PhotoSwipe. Si elles ne sont pas disponibles, on retombe sur
                // l'ancien comportement (deduit du DOM) sans rien casser.
                let serverItem = null;
                if (
                    typeof FANCYBOX_VIEWER_DATA !== "undefined" &&
                    FANCYBOX_VIEWER_DATA.items &&
                    FANCYBOX_VIEWER_DATA.items.length
                ) {
                    const serverItems = buildFancyboxItems();
                    const currentId = parseInt(FANCYBOX_VIEWER_DATA.current_image_id, 10);
                    serverItem = serverItems.find(item => item.id === currentId) || serverItems[0] || null;
                }

                if (serverItem) {
                    launchViewer([serverItem], 0);
                    return;
                }

                let caption = pictureImage.alt || "";

                if (isAutomaticFilename(caption)) {
                    caption = "";
                }

                launchViewer([{
                    src: getLargeImage(pictureImage.src),
                    caption: caption,
                    downloadSrc: getOriginalImage(pictureImage.src),
                    pageUrl: window.location.href
                }], 0);

                return;
            }

            if (
                typeof FANCYBOX_VIEWER_DATA === "undefined" ||
                !FANCYBOX_VIEWER_DATA.items ||
                !FANCYBOX_VIEWER_DATA.items.length
            ) {
                return;
            }

            const items = buildFancyboxItems();

			const startIndex = getCurrentImageIndex(items);

			launchViewer(items, startIndex);
        });
    }

    // +-----------------------------------------------------------------------+
    // | Dispatcher : selectionne le moteur configure dans l'admin             |
    // +-----------------------------------------------------------------------+
    function launchViewer(items, startIndex, forcePlay) {
        if (config.viewer_engine === "photoswipe") {
            launchPhotoSwipe(items, startIndex, !!forcePlay);
        } else {
            launchFancybox(items, startIndex, !!forcePlay);
        }
    }

    function launchFancybox(items, startIndex, forcePlay) {
        if (typeof Fancybox === "undefined") return;

        const timeoutVal = parseInt(rawConfig.slideshow_timeout || 3000, 10);
        Fancybox.show(items, {
            startIndex: startIndex,
            animated: true,
            dragToClose: true,
            Carousel: {
			    
				Autoplay: {
					autoStart: !!forcePlay,
					timeout: timeoutVal
				},

				Toolbar: {
                    display: {
                        left: ["counter"],
                        middle: [],
                        right: buildToolbarRight(forcePlay)
                    },
                    items: {
                        pageLink: {
							tpl: `<button class="f-button" title="${(typeof FANCYBOX_VIEWER_DATA !== "undefined" && FANCYBOX_VIEWER_DATA.lang && FANCYBOX_VIEWER_DATA.lang.page_link) ? FANCYBOX_VIEWER_DATA.lang.page_link : "Ouvrir la page de la photo"}" type="button">
								<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="vertical-align: middle;">
									<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
									<path d="M12 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
									<circle cx="12" cy="7.5" r="1" fill="currentColor"/>
								</svg>
							</button>`,
                            click: function (toolbar) {
                                const instance = toolbar.instance || (typeof Fancybox !== "undefined" ? Fancybox.getInstance() : null);
                                if (!instance) return;
                                
                                const slide = instance.getSlide();
                                const url = slide?.pageUrl || slide?.data?.pageUrl || slide?.opts?.pageUrl;

                                if (url) {
                                    if (config.open_new_tab) {
                                        window.open(url, "_blank");
                                    } else {
                                        window.location.href = url;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    // +-----------------------------------------------------------------------+
    // | Moteur PhotoSwipe (0.0.3, experimental)                               |
    // |                                                                       |
    // | Limitation connue : les videos (YouTube/Vimeo/Dailymotion/HTML5) ne   |
    // | sont pas supportees par ce moteur pour l'instant ; elles sont         |
    // | retirees de la liste plutot que d'afficher une vignette cassee. Un    |
    // | clic sur une video ouvre alors simplement sa page Piwigo.             |
    // +-----------------------------------------------------------------------+
    let pswpInstance = null;
    let pswpAutoplayTimer = null;
    let pswpAutoplayBtnEl = null;

    // Icones du bouton diaporama (play / pause). Fonction custom car
    // PhotoSwipe 5 ne fournit aucun autoplay natif.
    const PSWP_ICON_PLAY  = '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="M10 7v18l15-9z" fill="var(--pswp-icon-color, #fff)"/></svg>';
    const PSWP_ICON_PAUSE = '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="M9 7h5v18H9zM18 7h5v18h-5z" fill="var(--pswp-icon-color, #fff)"/></svg>';

    function pswpSetAutoplayIcon(playing) {
        if (!pswpAutoplayBtnEl) return;
        pswpAutoplayBtnEl.innerHTML = playing ? PSWP_ICON_PAUSE : PSWP_ICON_PLAY;
        pswpAutoplayBtnEl.classList.toggle("fbv-playing", playing);
    }

    function pswpStartAutoplay() {
        if (!pswpInstance || pswpAutoplayTimer) return;
        const timeoutVal = parseInt(rawConfig.slideshow_timeout || 3000, 10);
        pswpAutoplayTimer = setInterval(() => {
            pswpInstance.next();
        }, timeoutVal);
        pswpSetAutoplayIcon(true);
    }

    function pswpStopAutoplay() {
        if (pswpAutoplayTimer) {
            clearInterval(pswpAutoplayTimer);
            pswpAutoplayTimer = null;
        }
        pswpSetAutoplayIcon(false);
    }

    function launchPhotoSwipe(items, startIndex, forcePlay) {
        if (typeof PhotoSwipe === "undefined") return;

        if (pswpInstance) {
            pswpInstance.destroy();
            pswpInstance = null;
        }
        if (pswpAutoplayTimer) {
            clearInterval(pswpAutoplayTimer);
            pswpAutoplayTimer = null;
        }
        pswpAutoplayBtnEl = null;

        if (!items.length) return;

        let pswpStartIndex = startIndex >= 0 && startIndex < items.length ? startIndex : 0;

        // PhotoSwipe 5 supporte nativement les slides "html" (voir data-sources
        // de la doc officielle : { html: '...' } au lieu de { src: '...' }).
        // On s'en sert pour la video HTML5, YouTube, Vimeo et Dailymotion,
        // au lieu de rediriger vers la page Piwigo comme avant.
        const dataSource = items.map((item, idx) => {
            if (item.isVideo) {
                const isIframeVideo = item.type !== "html5video";
                // PhotoSwipe précharge la/les slide(s) voisine(s) pour un swipe
                // fluide : si l'URL de la slide contient déjà "autoplay=1"
                // (cas YouTube), la vidéo se met à jouer en arrière-plan avant
                // même que l'utilisateur ne l'affiche. On retire ce paramètre
                // des slides non actives et on ne le réinjecte que lorsque la
                // slide devient réellement active (voir contentActivate ci-dessous).
                // Exception : la slide sur laquelle on ouvre directement la
                // visionneuse recoit l'autoplay tout de suite (meme "geste
                // utilisateur" que le clic d'ouverture), certains navigateurs
                // n'autorisant la lecture automatique avec son que dans ce cas.
                const isInitialSlide = idx === pswpStartIndex;
                const silentSrc = isIframeVideo ? item.src.replace(/[?&]autoplay=1/, "") : item.src;
                const initialSrc = isIframeVideo && isInitialSlide ? item.src : silentSrc;

                const videoHtml = item.type === "html5video"
                    ? '<video controls playsinline' + (isInitialSlide ? ' autoplay' : '') + ' style="max-width:100%;max-height:100%;width:100%;height:100%;background:#000" src="' + initialSrc + '"></video>'
                    : '<iframe data-fbv-autoplay-src="' + item.src + '" src="' + initialSrc + '" style="width:100%;height:100%;border:0;background:#000" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';

                return {
                    html: videoHtml,
                    width: item.width || 1280,
                    height: item.height || 720,
                    alt: item.caption || "",
                    caption: item.caption || "",
                    pageUrl: item.pageUrl,
                    isVideo: true
                };
            }

            return {
                src: item.src,
                width: item.width || 1600,
                height: item.height || 1200,
                alt: item.caption || "",
                caption: item.caption || "",
                downloadSrc: item.downloadSrc,
                pageUrl: item.pageUrl
            };
        });


        pswpInstance = new PhotoSwipe({
            dataSource: dataSource,
            index: pswpStartIndex,
            loop: true,
            wheelToZoom: true,
            // Bouton zoom natif de PhotoSwipe, piloté par l'option d'admin
            // "Bouton Zoom" (pas besoin d'un bouton personnalisé : PhotoSwipe
            // fournit déjà ce bouton nativement).
            zoom: config.enable_zoom,
            bgOpacity: 0.9,
            showHideAnimationType: "zoom",
            paddingFn: () => ({ top: 30, bottom: 30, left: 0, right: 0 })
        });

        pswpInstance.on("uiRegister", function () {

            // Legende (titre)
            pswpInstance.ui.registerElement({
                name: "fbv-caption",
                order: 9,
                isButton: false,
                appendTo: "root",
                onInit: (el) => {
                    el.style.cssText = "position:absolute;left:0;right:0;bottom:0;padding:10px 16px;text-align:center;color:#fff;background:rgba(0,0,0,.4);font-size:14px;";
                    pswpInstance.on("change", () => {
                        const data = pswpInstance.currSlide && pswpInstance.currSlide.data;
                        const text = data && data.caption ? data.caption : "";
                        el.textContent = text;
                        el.style.display = text ? "block" : "none";
                    });
                }
            });

            // Bouton "page photo"
            if (config.page_link) {
                pswpInstance.ui.registerElement({
                    name: "fbv-page-link",
                    order: 8,
                    isButton: true,
                    tagName: "a",
                    title: (typeof FANCYBOX_VIEWER_DATA !== "undefined" && FANCYBOX_VIEWER_DATA.lang && FANCYBOX_VIEWER_DATA.lang.page_link) ? FANCYBOX_VIEWER_DATA.lang.page_link : "Ouvrir la page de la photo",
                    html: {
                        isCustomSVG: true,
                        inner: '<circle cx="16" cy="16" r="10" fill="none" stroke="var(--pswp-icon-color, #fff)" stroke-width="2"/><path d="M16 14v8" fill="none" stroke="var(--pswp-icon-color, #fff)" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="10" r="1.5" fill="var(--pswp-icon-color, #fff)"/>',
                        outlineID: "fbv-icn-page-link"
                    },
                    onInit: (el) => {
                        el.setAttribute("target", config.open_new_tab ? "_blank" : "_self");
                        pswpInstance.on("change", () => {
                            const data = pswpInstance.currSlide && pswpInstance.currSlide.data;
                            if (data && data.pageUrl) {
                                el.href = data.pageUrl;
                                el.style.display = "";
                            } else {
                                el.style.display = "none";
                            }
                        });
                    }
                });
            }

            // Bouton telechargement de l'original
            if (config.enable_download) {
                pswpInstance.ui.registerElement({
                    name: "fbv-download",
                    order: 8,
                    isButton: true,
                    tagName: "a",
                    title: "Download",
                    html: {
                        isCustomSVG: true,
                        inner: '<path d="M16 6v12" fill="none" stroke="var(--pswp-icon-color, #fff)" stroke-width="2" stroke-linecap="round"/><path d="M9 16l7 7 7-7" fill="none" stroke="var(--pswp-icon-color, #fff)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 26h20" fill="none" stroke="var(--pswp-icon-color, #fff)" stroke-width="2" stroke-linecap="round"/>',
                        outlineID: "fbv-icn-download"
                    },
                    onInit: (el) => {
                        el.setAttribute("download", "");
                        pswpInstance.on("change", () => {
                            const data = pswpInstance.currSlide && pswpInstance.currSlide.data;
                            if (data && data.downloadSrc) {
                                el.href = data.downloadSrc;
                                el.style.display = "";
                            } else {
                                el.style.display = "none";
                            }
                        });
                    }
                });
            }

            // Plein ecran (API navigateur native, PhotoSwipe n'a pas de bouton integre)
            if (config.enable_fullscreen && document.documentElement.requestFullscreen) {
                pswpInstance.ui.registerElement({
                    name: "fbv-fullscreen",
                    order: 15,
                    isButton: true,
                    title: "Fullscreen",
                    html: {
                        isCustomSVG: true,
                        inner: '<path d="M6 13V6h7M26 13V6h-7M6 19v7h7M26 19v7h-7" fill="none" stroke="var(--pswp-icon-color, #fff)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
                        outlineID: "fbv-icn-fullscreen"
                    },
                    onClick: () => {
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                        } else if (pswpInstance.element) {
                            pswpInstance.element.requestFullscreen();
                        }
                    }
                });
            }

            // Diaporama / autoplay (PhotoSwipe n'a pas d'autoplay natif : minuteur maison)
            if ((config.enable_autoplay || forcePlay) && dataSource.length > 1) {
                pswpInstance.ui.registerElement({
                    name: "fbv-autoplay",
                    order: 7,
                    isButton: true,
                    title: (typeof FANCYBOX_VIEWER_DATA !== "undefined" && FANCYBOX_VIEWER_DATA.lang && FANCYBOX_VIEWER_DATA.lang.autoplay) ? FANCYBOX_VIEWER_DATA.lang.autoplay : "Start / Stop slideshow",
                    html: PSWP_ICON_PLAY,
                    onInit: (el) => {
                        pswpAutoplayBtnEl = el;
                        // Reflete l'etat reel si l'autoplay a deja ete demarre
                        // (ouverture forcee via le bouton Diaporama) avant que ce bouton n'existe.
                        pswpSetAutoplayIcon(!!pswpAutoplayTimer);
                    },
                    onClick: () => {
                        if (pswpAutoplayTimer) {
                            pswpStopAutoplay();
                        } else {
                            pswpStartAutoplay();
                        }
                    }
                });
            }
        });

        // Cycle de vie video : ne joue que lorsque la slide est reellement
        // active, et coupe systematiquement le son en la quittant (que ce
        // soit par swipe, fleche, ou fermeture de la visionneuse).
        // content.element (fourni par les evenements ci-dessous) peut etre
        // directement notre <iframe>/<video> (notre HTML n'a qu'une seule
        // balise racine), ou un conteneur qui l'englobe selon le contexte :
        // on gere les deux cas.
        function pswpFindVideoEl(el) {
            if (!el) return { video: null, iframe: null };
            if (el.tagName === "VIDEO") return { video: el, iframe: null };
            if (el.tagName === "IFRAME") return { video: null, iframe: el };
            return {
                video: el.querySelector ? el.querySelector("video") : null,
                iframe: el.querySelector ? el.querySelector("iframe") : null
            };
        }

        pswpInstance.on("contentActivate", ({ content }) => {
            if (!content || !content.data || !content.data.isVideo || !content.element) return;
            const { video, iframe } = pswpFindVideoEl(content.element);
            if (video) {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(() => { /* lecture auto refusee par le navigateur : l'utilisateur cliquera sur lecture */ });
                }
                return;
            }
            if (iframe) {
                const autoplaySrc = iframe.getAttribute("data-fbv-autoplay-src");
                if (autoplaySrc && iframe.src !== autoplaySrc) {
                    iframe.src = autoplaySrc;
                }
            }
        });

        pswpInstance.on("contentDeactivate", ({ content }) => {
            if (!content || !content.data || !content.data.isVideo || !content.element) return;
            const { video, iframe } = pswpFindVideoEl(content.element);
            if (video) {
                try { video.pause(); } catch (e) { /* noop */ }
                return;
            }
            if (iframe) {
                iframe.src = "about:blank";
            }
        });

        pswpInstance.on("contentRemove", ({ content }) => {
            if (!content || !content.data || !content.data.isVideo || !content.element) return;
            const { video } = pswpFindVideoEl(content.element);
            if (video) {
                try { video.pause(); } catch (e) { /* noop */ }
            }
        });

        pswpInstance.on("destroy", () => {
            if (pswpAutoplayTimer) {
                clearInterval(pswpAutoplayTimer);
                pswpAutoplayTimer = null;
            }
            pswpAutoplayBtnEl = null;

            // Filet de securite : coupe toute video/iframe encore active si la
            // visionneuse est fermee sans passer par contentDeactivate.
            document.querySelectorAll(".pswp video").forEach(v => {
                try { v.pause(); } catch (e) { /* noop */ }
            });
            document.querySelectorAll(".pswp iframe").forEach(f => {
                f.src = "about:blank";
            });
        });

        if (forcePlay && dataSource.length > 1) {
            pswpInstance.on("afterInit", () => {
                pswpStartAutoplay();
            });
        }

        pswpInstance.init();
    }

    function launchLocalFancybox(startIndex) {
        // Comme pour picture.php : si les donnees serveur sont disponibles pour
        // une miniature (memes quand load_full_album est desactive, Piwigo les
        // transmet deja pour les photos visibles sur la page), on les utilise
        // pour recuperer les vraies dimensions (evite le ratio 4/3 par defaut
        // de PhotoSwipe). Sinon on retombe sur le comportement precedent
        // (deduit du DOM), sans rien casser.
        const serverItems = (
            typeof FANCYBOX_VIEWER_DATA !== "undefined" &&
            FANCYBOX_VIEWER_DATA.items &&
            FANCYBOX_VIEWER_DATA.items.length
        ) ? buildFancyboxItems() : [];

        const localItems = Array.from(thumbnailLinks).map(a => {
            const img = a.querySelector("img");
            if (!img) return null;
            const thumb = img.dataset.src || img.currentSrc || img.src;
            let caption = (img.alt || "").trim();
            if (isAutomaticFilename(caption)) caption = "";

            let matched = null;
            if (serverItems.length) {
                const linkId = extractImageIdFromHref(a.href);
                if (linkId !== null) {
                    matched = serverItems.find(item => item.id === linkId) || null;
                }
            }
            if (!matched && serverItems.length && thumb) {
                const filename = thumb.split('/').pop().split('-')[0];
                matched = serverItems.find(item => item.src && item.src.includes(filename));
            }

            if (matched) {
                if (matched.isVideo) {
                    // Pour une video, on conserve integralement les donnees
                    // serveur (src = URL video/iframe reelle) : ne surtout pas
                    // la remplacer par l'image "poster" affichee dans le DOM.
                    return Object.assign({}, matched, {
                        caption: caption || matched.caption
                    });
                }
                return Object.assign({}, matched, {
                    src: getLargeImage(thumb) || matched.src,
                    caption: caption || matched.caption
                });
            }

            return {
                src: getLargeImage(thumb),
                caption: caption,
                downloadSrc: getOriginalImage(thumb),
                pageUrl: a.href
            };
        }).filter(Boolean);

        launchViewer(localItems, startIndex);
    }
});
