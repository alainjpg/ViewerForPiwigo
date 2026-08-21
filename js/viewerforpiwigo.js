document.addEventListener("DOMContentLoaded", function () {
    const rawConfig = (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.config) ? VIEWERFORPIWIGO_DATA.config : {};

    const config = {
        enable_autoplay: rawConfig.enable_slideshow !== false,
        autoplay_mode: ["never", "slideshow_button", "always"].indexOf(rawConfig.autoplay_mode) !== -1 ? rawConfig.autoplay_mode : "slideshow_button",
        enable_download: rawConfig.enable_download !== false,
        enable_zoom: rawConfig.enable_zoom !== false,
        enable_fullscreen: rawConfig.enable_fullscreen !== false,
        show_thumb_button: rawConfig.show_thumb_button !== false,
        thumbs_on_start: rawConfig.thumbs_on_start !== false,
        show_mobile_arrows: rawConfig.show_mobile_arrows === true,
        flat_arrows: rawConfig.flat_arrows === true,
        auto_hide_controls: rawConfig.auto_hide_controls === true,
        show_description: rawConfig.show_description === true,
        show_author: rawConfig.show_author === true,
        show_caption: rawConfig.show_caption !== false,
        hide_auto_names: rawConfig.hide_auto_names !== false,
        page_link: rawConfig.page_link !== false && rawConfig.show_page_link !== false,
        open_new_tab: rawConfig.open_new_tab !== false,
		open_from_thumbnails: rawConfig.open_from_thumbnails !== false,
		open_from_picture: rawConfig.open_from_picture !== false,
		open_from_slideshow: rawConfig.open_from_slideshow === true,
		open_from_osm_map: rawConfig.open_from_osm_map !== false,
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
        // Format "YYYYMMDD HHMMSS" avec suffixe optionnel "~N" (ex: doublons
        // exportes par certaines galeries/synchronisations).
        if (/^\d{8} \d{6}(~\d+)?$/.test(text)) return true;

        return false;
    }
    // Longueur approximative au dela de laquelle une description est
    // consideree "longue" et donc visuellement tronquee (voir CSS ligne-clamp)
    // avec un lien "Voir plus" vers la page photo Piwigo.
    const DESCRIPTION_TRUNCATE_THRESHOLD = 200;

    // Delai maximal d'attente de la fin d'une video pendant le diaporama,
    // au cas ou "ended" ne se declenche jamais (filet de securite).
    const VIDEO_MAX_WAIT = 600000;

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // Construit le HTML titre/auteur/description commun aux deux moteurs, en
    // reutilisant les classes .vfp-title/.vfp-description deja
    // presentes dans le CSS du plugin.
    function buildCaptionHtml(title, author, description, pageUrl) {
        let html = "";

        if (title || author) {
            html += '<div class="vfp-title">';
            if (title) html += escapeHtml(title);
            if (author) html += ' <span class="vfp-author">(' + escapeHtml(author) + ')</span>';
            html += '</div>';
        }

        if (description) {
            const isLong = description.length > DESCRIPTION_TRUNCATE_THRESHOLD;
            html += '<div class="vfp-description' + (isLong ? ' vfp-description-clamped' : '') + '">' + escapeHtml(description) + '</div>';
            if (isLong && pageUrl) {
                const seeMoreText = (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.lang && VIEWERFORPIWIGO_DATA.lang.see_more) ? VIEWERFORPIWIGO_DATA.lang.see_more : "See more";
                html += '<a class="vfp-see-more" href="' + pageUrl + '">' + escapeHtml(seeMoreText) + '</a>';
            }
        }

        return html;
    }

	function buildViewerItems() {

		return VIEWERFORPIWIGO_DATA.items.map(item => {

			let caption = config.show_caption ? (item.name || item.comment || "") : "";
			if (config.show_caption && config.hide_auto_names && isAutomaticFilename(caption)) caption = "";

			// Description : uniquement si l'option est activee, et seulement
			// si elle apporte une information distincte du titre deja affiche
			// (evite d'afficher deux fois le meme texte quand le commentaire
			// sert deja de repli pour le titre ci-dessus).
			let description = "";
			if (config.show_description && item.comment && item.comment.trim() && item.comment !== caption) {
				description = item.comment.trim();
			}

			let author = "";
			if (config.show_author && item.author && item.author.trim()) {
				author = item.author.trim();
			}

			const captionHtml = buildCaptionHtml(caption, author, description, item.page_url);

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
					caption: captionHtml,
					plainCaption: caption,
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
					caption: captionHtml,
					plainCaption: caption,
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
				caption: captionHtml,
				plainCaption: caption,
				downloadSrc: item.download_src,
				pageUrl: item.page_url
			};
		});

	}
    function buildToolbarRight(forcePlay) {
        const toolbarRight = [];
        // Le bouton Diaporama demande explicitement un diaporama : les
        // commandes doivent toujours être visibles dans ce cas, quelle que
        // soit l'option "Afficher les commandes du diaporama". Idem si
        // l'autoplay est configure pour demarrer a chaque ouverture.
        if (config.enable_autoplay || forcePlay || config.autoplay_mode === "always") toolbarRight.push("autoplay");
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

	function isViewerAllowed() {
		return !config.mobile_only ||
			window.matchMedia("(max-width: 1024px)").matches;
	}

	if (isViewerAllowed() && config.open_from_thumbnails && thumbnailLinks.length > 0) {        thumbnailLinks.forEach((a, index) => {
            a.addEventListener("click", function (e) {
                e.preventDefault();

                if (
                    config.load_full_album &&
                    typeof VIEWERFORPIWIGO_DATA !== "undefined" &&
                    VIEWERFORPIWIGO_DATA.items &&
                    VIEWERFORPIWIGO_DATA.items.length > 0
                ) {
                    const items = buildViewerItems();

                    const clickedImg = a.querySelector("img");
                    const clickedSrc = clickedImg ? (clickedImg.dataset.src || clickedImg.src) : "";
                    let startIndex = index;

                    // Correspondance primaire : par ID Piwigo (toujours unique,
                    // extrait du href de la miniature). Necessaire notamment
                    // quand plusieurs photos de l'album partagent le meme
                    // prefixe de nom de fichier (ex. import par lot, meme
                    // horodatage de generation de derivee a la seconde pres) :
                    // dans ce cas, une correspondance par nom de fichier seule
                    // retombe systematiquement sur la premiere photo trouvee.
                    const linkId = extractImageIdFromHref(a.href);
                    if (linkId !== null) {
                        const idIdx = items.findIndex(item => item.id === linkId);
                        if (idIdx !== -1) startIndex = idIdx;
                    } else if (clickedSrc) {
                        const filename = clickedSrc.split('/').pop().split('-')[0];
                        const foundIdx = items.findIndex(item => item.src.includes(filename));
                        if (foundIdx !== -1) startIndex = foundIdx;
                    }

                    launchViewer(items, startIndex);
                } else {
                    launchLocalViewer(index);
                }
            });
        });
    }
	function getCurrentImageIndex(items) {
    const currentId = parseInt(VIEWERFORPIWIGO_DATA.current_image_id, 10);

    const index = items.findIndex(item => item.id === currentId);

    return index >= 0 ? index : 0;
}
	const slideshowButtons = document.querySelectorAll(
		"#cmdSlideshow a, a[href*='slideshow=']"
	);

	if (isViewerAllowed() && config.open_from_slideshow && slideshowButtons.length > 0) {
		slideshowButtons.forEach(function (button) {
			button.addEventListener("click", function (e) {
				e.preventDefault();

				if (
					typeof VIEWERFORPIWIGO_DATA === "undefined" ||
					!VIEWERFORPIWIGO_DATA.items ||
					!VIEWERFORPIWIGO_DATA.items.length
				) {
					return;
				}

				const items = buildViewerItems();

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

	if (isViewerAllowed() && config.open_from_picture && pictureImage) {
        pictureImage.style.cursor = "zoom-in";

        pictureImage.addEventListener("click", function (e) {
            e.preventDefault();

            if (!config.load_full_album) {
                // Meme quand on ne charge pas tout l'album, les dimensions reelles
                // de la photo courante sont deja disponibles cote serveur
                // (VIEWERFORPIWIGO_DATA.items contient toujours au moins la photo
                // affichee). On les utilise pour eviter le ratio 4/3 par defaut de
                // PhotoSwipe. Si elles ne sont pas disponibles, on retombe sur
                // l'ancien comportement (deduit du DOM) sans rien casser.
                let serverItem = null;
                if (
                    typeof VIEWERFORPIWIGO_DATA !== "undefined" &&
                    VIEWERFORPIWIGO_DATA.items &&
                    VIEWERFORPIWIGO_DATA.items.length
                ) {
                    const serverItems = buildViewerItems();
                    const currentId = parseInt(VIEWERFORPIWIGO_DATA.current_image_id, 10);
                    serverItem = serverItems.find(item => item.id === currentId) || serverItems[0] || null;
                }

                if (serverItem) {
                    launchViewer([serverItem], 0);
                    return;
                }

                let caption = config.show_caption ? (pictureImage.alt || "") : "";

                if (config.show_caption && config.hide_auto_names && isAutomaticFilename(caption)) {
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
                typeof VIEWERFORPIWIGO_DATA === "undefined" ||
                !VIEWERFORPIWIGO_DATA.items ||
                !VIEWERFORPIWIGO_DATA.items.length
            ) {
                return;
            }

            const items = buildViewerItems();

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

    let fancyboxVideoWaitTimer = null;
    let fancyboxWaitingVideoEl = null;
    let fancyboxVideoEndedHandler = null;

    function fancyboxClearVideoWait() {
        if (fancyboxVideoWaitTimer) {
            clearTimeout(fancyboxVideoWaitTimer);
            fancyboxVideoWaitTimer = null;
        }
        if (fancyboxWaitingVideoEl && fancyboxVideoEndedHandler) {
            fancyboxWaitingVideoEl.removeEventListener("ended", fancyboxVideoEndedHandler);
        }
        fancyboxWaitingVideoEl = null;
        fancyboxVideoEndedHandler = null;
    }

    // Sur une video HTML5, on met le diaporama natif Fancybox en pause et on
    // attend la fin reelle avant d'avancer (avec filet de securite) ; sur une
    // video embarquee (pas d'API commune fiable pour detecter sa fin), on
    // reste en pause pour une reprise manuelle.
    //
    // Cause reelle des echecs precedents, tracee dans le code source de
    // Fancybox 6.1.14 (dist/fancybox/fancybox.js + dist/carousel/carousel.js) :
    // le plugin "Autoplay" vit dans le registre de plugins du CAROUSEL
    // (carousel.js : getPlugins:function(){return H}), pas dans celui de
    // l'instance Fancybox (dont le getPlugins() ne contient que "Hash").
    // D'ou l'acces via getCarousel().getPlugins().Autoplay, jamais
    // fancyboxRef.getPlugins() ni fancyboxRef.plugins directement.
    // Autres points verifies dans le meme code source :
    // - pause()/resume() est le bon couple : pause() ne desactive pas le
    //   plugin (isEnabled() reste true), il suspend juste le minuteur.
    //   stop()/start() desactiverait completement le plugin ;
    // - tant qu'on ne desactive jamais le plugin, il reprogramme lui-meme
    //   son prochain declenchement a chaque changement de slide (il ecoute
    //   "change" en interne) : inutile d'intervenir pour les slides normales ;
    // - il n'y a pas de methode next() sur l'instance Fancybox elle-meme,
    //   uniquement sur l'instance Carousel (getCarousel().next()).
    function fancyboxHandleSlideChange(fancyboxRef) {
        fancyboxClearVideoWait();

        const carousel = fancyboxRef.getCarousel ? fancyboxRef.getCarousel() : null;
        const plugins = carousel && carousel.getPlugins ? carousel.getPlugins() : null;
        const autoplay = plugins ? plugins.Autoplay : null;
        if (!autoplay || !autoplay.isEnabled()) return;

        const slide = fancyboxRef.getSlide ? fancyboxRef.getSlide() : null;
        const el = slide && slide.el;
        const video = el ? el.querySelector("video") : null;
        const iframe = el ? el.querySelector("iframe") : null;

        if (!video && !iframe) return;

        autoplay.pause();

        if (iframe) return;

        const advance = () => {
            fancyboxClearVideoWait();
            if (carousel) carousel.next();

            // Si la nouvelle slide est elle-meme une video, l'appel a
            // carousel.next() ci-dessus a deja declenche une nouvelle
            // execution de fancyboxHandleSlideChange (via "Carousel.change")
            // qui l'a correctement remise en pause avec sa propre attente.
            // Un resume() ici relancerait le minuteur fixe du plugin natif
            // par-dessus cette pause (la video suivante serait alors coupee
            // apres le delai normal au lieu d'attendre sa fin reelle).
            const newSlide = fancyboxRef.getSlide ? fancyboxRef.getSlide() : null;
            const newEl = newSlide && newSlide.el;
            const newSlideIsVideo = newEl && (newEl.querySelector("video") || newEl.querySelector("iframe"));

            if (!newSlideIsVideo) {
                autoplay.resume();
            }
        };

        fancyboxWaitingVideoEl = video;
        fancyboxVideoEndedHandler = advance;
        video.addEventListener("ended", fancyboxVideoEndedHandler);

        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
                fancyboxClearVideoWait();
                // Lecture bloquee : reste en pause (comme pour une video embarquee).
            });
        }

        fancyboxVideoWaitTimer = setTimeout(advance, VIDEO_MAX_WAIT);
    }

    function launchFancybox(items, startIndex, forcePlay) {
        if (typeof Fancybox === "undefined") return;

        fancyboxClearVideoWait();

        const shouldAutoStart = config.autoplay_mode === "always" || (config.autoplay_mode === "slideshow_button" && !!forcePlay);

        const fancyboxMainClasses = [];
        if (config.show_mobile_arrows) fancyboxMainClasses.push("vfp-mobile-arrows");
        if (config.flat_arrows) fancyboxMainClasses.push("vfp-flat-arrows");

        const timeoutVal = parseInt(rawConfig.slideshow_timeout || 3000, 10);
        Fancybox.show(items, {
            startIndex: startIndex,
            animated: true,
            dragToClose: true,
            mainClass: fancyboxMainClasses.join(" "),
            idle: config.auto_hide_controls ? 3500 : false,
            on: {
                "ready Carousel.change Carousel.autoplay:start": fancyboxHandleSlideChange
            },
            Carousel: {
			    
				Autoplay: {
					autoStart: shouldAutoStart,
					timeout: timeoutVal
				},

				// "Afficher le bouton des miniatures" (show_thumb_button) est gere
				// separement via le bouton de la Toolbar ci-dessous ; showOnStart
				// ne controle que l'etat initial du carrousel de miniatures, sans
				// desactiver le plugin ni son bouton (API native Fancybox 6).
				Thumbs: {
					showOnStart: config.thumbs_on_start
				},

				Toolbar: {
                    display: {
                        left: ["counter"],
                        middle: [],
                        right: buildToolbarRight(forcePlay)
                    },
                    items: {
                        pageLink: {
							tpl: `<button class="f-button" title="${(typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.lang && VIEWERFORPIWIGO_DATA.lang.page_link) ? VIEWERFORPIWIGO_DATA.lang.page_link : "Ouvrir la page de la photo"}" type="button">
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
    // | Moteur PhotoSwipe                                                     |
    // |                                                                       |
    // | Les videos (YouTube/Vimeo/Dailymotion/HTML5) sont affichees via des   |
    // | slides "html" natives de PhotoSwipe 5 (voir dataSource plus bas).     |
    // +-----------------------------------------------------------------------+
    let pswpInstance = null;
    let pswpAutoplayTimer = null;
    let pswpAutoplayBtnEl = null;
    let pswpAutoplayActive = false;
    let pswpWaitingVideoEl = null;
    let pswpVideoEndedHandler = null;

    // Icones du bouton diaporama (play / pause). Fonction custom car
    // PhotoSwipe 5 ne fournit aucun autoplay natif.
    const PSWP_ICON_PLAY  = '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="M10 7v18l15-9z" fill="var(--pswp-icon-color, #fff)"/></svg>';
    const PSWP_ICON_PAUSE = '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="M9 7h5v18H9zM18 7h5v18h-5z" fill="var(--pswp-icon-color, #fff)"/></svg>';

    function pswpSetAutoplayIcon(playing) {
        if (!pswpAutoplayBtnEl) return;
        pswpAutoplayBtnEl.innerHTML = playing ? PSWP_ICON_PAUSE : PSWP_ICON_PLAY;
        pswpAutoplayBtnEl.classList.toggle("fbv-playing", playing);
    }

    // content.element peut etre directement notre <iframe>/<video> (notre
    // HTML n'a qu'une seule balise racine), ou un conteneur qui l'englobe
    // selon le contexte : on gere les deux cas.
    function pswpFindVideoEl(el) {
        if (!el) return { video: null, iframe: null };
        if (el.tagName === "VIDEO") return { video: el, iframe: null };
        if (el.tagName === "IFRAME") return { video: null, iframe: el };
        return {
            video: el.querySelector ? el.querySelector("video") : null,
            iframe: el.querySelector ? el.querySelector("iframe") : null
        };
    }

    function pswpClearVideoWait() {
        if (pswpWaitingVideoEl && pswpVideoEndedHandler) {
            pswpWaitingVideoEl.removeEventListener("ended", pswpVideoEndedHandler);
        }
        pswpWaitingVideoEl = null;
        pswpVideoEndedHandler = null;
    }

    function pswpAdvance() {
        if (pswpAutoplayTimer) {
            clearTimeout(pswpAutoplayTimer);
            pswpAutoplayTimer = null;
        }
        pswpClearVideoWait();
        if (pswpInstance) pswpInstance.next();
    }

    // Programme la prochaine avancee du diaporama en tenant compte du
    // contenu de la slide courante : delai fixe pour une image, attente de
    // la fin reelle pour une video HTML5 (avec filet de securite), pause
    // (reprise manuelle) pour une video embarquee (YouTube/Vimeo/Dailymotion,
    // pas d'API commune fiable pour detecter leur fin).
    function pswpScheduleNext() {
        if (pswpAutoplayTimer) {
            clearTimeout(pswpAutoplayTimer);
            pswpAutoplayTimer = null;
        }
        pswpClearVideoWait();

        if (!pswpInstance) return;

        const slide = pswpInstance.currSlide;
        const data = slide && slide.data;
        const el = slide && slide.content && slide.content.element;

        if (data && data.isVideo && el) {
            const { video, iframe } = pswpFindVideoEl(el);

            if (video) {
                pswpWaitingVideoEl = video;
                pswpVideoEndedHandler = () => { pswpAdvance(); };
                video.addEventListener("ended", pswpVideoEndedHandler);

                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(() => {
                        // Lecture bloquee par le navigateur : inutile d'attendre
                        // une fin qui ne surviendra pas. Comme pour une video
                        // embarquee ci-dessous, on ne programme rien pour cette
                        // slide mais le diaporama reste actif (reprise automatique
                        // a la prochaine navigation, pas besoin de rappuyer sur
                        // Lecture).
                        pswpClearVideoWait();
                    });
                }

                pswpAutoplayTimer = setTimeout(pswpAdvance, VIDEO_MAX_WAIT);
                return;
            }

            if (iframe) {
                // Comme sur Fancybox : le diaporama reste actif en arriere-plan
                // (pas d'arret complet), simplement aucun minuteur n'est
                // programme pour cette slide precise. Des que le visiteur
                // navigue manuellement, la reprise est automatique.
                return;
            }
        }

        const timeoutVal = parseInt(rawConfig.slideshow_timeout || 3000, 10);
        pswpAutoplayTimer = setTimeout(pswpAdvance, timeoutVal);
    }

    function pswpStartAutoplay() {
        if (!pswpInstance || pswpAutoplayActive) return;
        pswpAutoplayActive = true;
        pswpSetAutoplayIcon(true);
        pswpScheduleNext();
    }

    function pswpStopAutoplay() {
        pswpAutoplayActive = false;
        if (pswpAutoplayTimer) {
            clearTimeout(pswpAutoplayTimer);
            pswpAutoplayTimer = null;
        }
        pswpClearVideoWait();
        pswpSetAutoplayIcon(false);
    }

    function launchPhotoSwipe(items, startIndex, forcePlay) {
        if (typeof PhotoSwipe === "undefined") return;

        if (pswpInstance) {
            pswpInstance.destroy();
            pswpInstance = null;
        }
        if (pswpAutoplayTimer) {
            clearTimeout(pswpAutoplayTimer);
            pswpAutoplayTimer = null;
        }
        pswpClearVideoWait();
        pswpAutoplayActive = false;
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
                    alt: item.plainCaption || item.caption || "",
                    caption: item.caption || "",
                    pageUrl: item.pageUrl,
                    isVideo: true
                };
            }

            return {
                src: item.src,
                width: item.width || 1600,
                height: item.height || 1200,
                alt: item.plainCaption || item.caption || "",
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
            mainClass: config.show_mobile_arrows ? "vfp-mobile-arrows" : "",
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
                        el.innerHTML = text;
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
                    title: (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.lang && VIEWERFORPIWIGO_DATA.lang.page_link) ? VIEWERFORPIWIGO_DATA.lang.page_link : "Ouvrir la page de la photo",
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
            if ((config.enable_autoplay || forcePlay || config.autoplay_mode === "always") && dataSource.length > 1) {
                pswpInstance.ui.registerElement({
                    name: "fbv-autoplay",
                    order: 7,
                    isButton: true,
                    title: (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.lang && VIEWERFORPIWIGO_DATA.lang.autoplay) ? VIEWERFORPIWIGO_DATA.lang.autoplay : "Start / Stop slideshow",
                    html: PSWP_ICON_PLAY,
                    onInit: (el) => {
                        pswpAutoplayBtnEl = el;
                        // Reflete l'etat reel si l'autoplay a deja ete demarre
                        // (ouverture forcee via le bouton Diaporama) avant que ce bouton n'existe.
                        pswpSetAutoplayIcon(pswpAutoplayActive);
                    },
                    onClick: () => {
                        if (pswpAutoplayActive) {
                            pswpStopAutoplay();
                        } else {
                            pswpStartAutoplay();
                        }
                    }
                });
            }
        });

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

        pswpInstance.on("change", () => {
            if (pswpAutoplayActive) pswpScheduleNext();
        });

        pswpInstance.on("destroy", () => {
            if (pswpAutoplayTimer) {
                clearTimeout(pswpAutoplayTimer);
                pswpAutoplayTimer = null;
            }
            pswpClearVideoWait();
            pswpAutoplayActive = false;
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

        const shouldAutoStart = config.autoplay_mode === "always" || (config.autoplay_mode === "slideshow_button" && !!forcePlay);
        if (shouldAutoStart && dataSource.length > 1) {
            pswpInstance.on("afterInit", () => {
                pswpStartAutoplay();
            });
        }

        pswpInstance.init();
    }

    function launchLocalViewer(startIndex) {
        // Comme pour picture.php : si les donnees serveur sont disponibles pour
        // une miniature (memes quand load_full_album est desactive, Piwigo les
        // transmet deja pour les photos visibles sur la page), on les utilise
        // pour recuperer les vraies dimensions (evite le ratio 4/3 par defaut
        // de PhotoSwipe). Sinon on retombe sur le comportement precedent
        // (deduit du DOM), sans rien casser.
        const serverItems = (
            typeof VIEWERFORPIWIGO_DATA !== "undefined" &&
            VIEWERFORPIWIGO_DATA.items &&
            VIEWERFORPIWIGO_DATA.items.length
        ) ? buildViewerItems() : [];

        const localItems = Array.from(thumbnailLinks).map(a => {
            const img = a.querySelector("img");
            if (!img) return null;
            const thumb = img.dataset.src || img.currentSrc || img.src;
            let caption = config.show_caption ? (img.alt || "").trim() : "";
            if (config.show_caption && config.hide_auto_names && isAutomaticFilename(caption)) caption = "";

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
                    // La legende serveur respecte deja show_caption/
                    // hide_auto_names : elle prime toujours sur le texte brut
                    // du DOM.
                    return Object.assign({}, matched, {
                        caption: matched.caption
                    });
                }
                return Object.assign({}, matched, {
                    src: getLargeImage(thumb) || matched.src,
                    caption: matched.caption
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

    // Ouverture depuis les popups de miniatures du plugin OpenStreetMap
    // (piwigo-openstreetmap), si installe et si l'option est activee.
    // Ces popups sont injectees dynamiquement par Leaflet au clic sur un
    // marqueur (jamais presentes au chargement de la page) : une delegation
    // d'evenements sur le document est donc necessaire, contrairement au
    // scan ponctuel utilise pour les miniatures classiques de l'album.
    // Structure de popup confirmee via le code source du plugin OSM
    // (include/functions_map.php, fonction osm_get_js(), partagee par
    // toutes ses cartes) : <div class="leaflet-popup-content">...<a href=
    // "picture.php?/ID/..."><img ...></a>...</div> — la classe
    // "leaflet-popup-content" vient de Leaflet lui-meme (stable), pas du
    // plugin OSM (dont les id="thumb-N" sont indexes, donc plus fragiles).
    if (isViewerAllowed() && config.open_from_osm_map) {
        document.addEventListener("click", function (e) {
            const link = e.target.closest(".leaflet-popup-content a");
            if (!link) return;

            const img = link.querySelector("img");
            const linkId = extractImageIdFromHref(link.href);

            // Ni ID extractible ni image : probablement pas une popup photo
            // (ex. popup GPX du meme plugin) — on ne s'en mele pas.
            if (linkId === null && !img) return;

            e.preventDefault();

            let items = null;
            let startIndex = 0;

            if (
                linkId !== null &&
                typeof VIEWERFORPIWIGO_DATA !== "undefined" &&
                VIEWERFORPIWIGO_DATA.items &&
                VIEWERFORPIWIGO_DATA.items.length
            ) {
                const serverItems = buildViewerItems();
                const idx = serverItems.findIndex(item => item.id === linkId);
                if (idx !== -1) {
                    items = serverItems;
                    startIndex = idx;
                }
            }

            if (!items) {
                // Repli : photo absente des donnees deja chargees pour cette
                // page (cas frequent d'un marqueur pointant vers une photo
                // d'un sous-album). Item minimal construit directement
                // depuis le contenu de la popup, meme principe que le repli
                // de launchLocalViewer ci-dessus.
                const thumbSrc = img ? (img.dataset.src || img.src) : "";
                items = [{
                    src: getLargeImage(thumbSrc) || thumbSrc,
                    caption: "",
                    downloadSrc: getOriginalImage(thumbSrc),
                    pageUrl: link.href
                }];
            }

            launchViewer(items, startIndex);
        });
    }
});
