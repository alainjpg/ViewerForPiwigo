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
		open_hint_mode: ["never", "corner_permanent", "corner_fade", "toolbar"].indexOf(rawConfig.open_hint_mode) !== -1 ? rawConfig.open_hint_mode : "never",
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

	// Extrait l'ID Piwigo depuis le lien d'une miniature (formats courants :
	// ?image_id=123, ?/123, ou URL « jolie » /123-titre/). Fonctionne aussi
	// pour les vidéos, contrairement à une correspondance par nom de fichier
	// (la vignette d'une vidéo est une image « poster » sans rapport avec le
	// nom du fichier vidéo réel).
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
        // Format « YYYYMMDD HHMMSS » avec suffixe optionnel « ~N » (doublons
        // exportés par certaines galeries/synchronisations).
        if (/^\d{8} \d{6}(~\d+)?$/.test(text)) return true;

        return false;
    }
    // Longueur au-delà de laquelle une description est jugée « longue » et
    // tronquée visuellement (CSS line-clamp), avec un lien « Voir plus »
    // vers la page photo Piwigo.
    const DESCRIPTION_TRUNCATE_THRESHOLD = 200;

    // Délai maximal d'attente de la fin d'une vidéo pendant le diaporama,
    // au cas où « ended » ne se déclenche jamais (filet de sécurité).
    const VIDEO_MAX_WAIT = 600000;

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // Piwigo autorise un sous-ensemble de HTML (gras, italique, lien, saut de
    // ligne...) dans le titre/la description/l'auteur d'une photo, entre
    // dans son admin. On l'interprete plutot que de tout echapper, tout en
    // filtrant les balises et attributs non autorises (protection contre un
    // <script>, des attributs onclick/onerror, ou un lien javascript:).
    const RICH_TEXT_ALLOWED_TAGS = { b: 1, strong: 1, i: 1, em: 1, u: 1, br: 1, a: 1, span: 1, small: 1, sup: 1, sub: 1 };
    const RICH_TEXT_ALLOWED_ATTRS = { a: ["href", "title", "target", "rel"] };

    function sanitizeRichTextNode(node) {
        Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 1) {
                sanitizeRichTextNode(child);
                const tag = child.tagName.toLowerCase();
                if (!RICH_TEXT_ALLOWED_TAGS[tag]) {
                    while (child.firstChild) node.insertBefore(child.firstChild, child);
                    node.removeChild(child);
                    return;
                }
                const allowedAttrs = RICH_TEXT_ALLOWED_ATTRS[tag] || [];
                Array.from(child.attributes).forEach(attr => {
                    if (allowedAttrs.indexOf(attr.name) === -1) {
                        child.removeAttribute(attr.name);
                    } else if (attr.name === "href" && !/^(https?:|mailto:|tel:|\/|#)/i.test(attr.value.trim())) {
                        child.removeAttribute("href");
                    }
                });
            } else if (child.nodeType !== 3) {
                node.removeChild(child);
            }
        });
    }

    function sanitizeRichText(str) {
        if (!str) return "";
        const div = document.createElement("div");
        div.innerHTML = str;
        sanitizeRichTextNode(div);
        return div.innerHTML;
    }

    // Construit le HTML titre/auteur/description commun aux deux moteurs,
    // en réutilisant les classes .vfp-title/.vfp-description déjà
    // présentes dans le CSS du plugin.
    function buildCaptionHtml(title, author, description, pageUrl) {
        let html = "";

        if (title || author) {
            html += '<div class="vfp-title">';
            if (title) html += sanitizeRichText(title);
            if (author) html += ' <span class="vfp-author">(' + sanitizeRichText(author) + ')</span>';
            html += '</div>';
        }

        if (description) {
            const isLong = description.length > DESCRIPTION_TRUNCATE_THRESHOLD;
            html += '<div class="vfp-description' + (isLong ? ' vfp-description-clamped' : '') + '">' + sanitizeRichText(description) + '</div>';
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

			// Description affichée seulement si l'option est active et
			// distincte du titre déjà affiché (évite un doublon quand le
			// commentaire sert déjà de repli pour le titre).
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

			// PDF : Piwigo genere automatiquement un apercu de la 1ere page
			// (utilise comme thumbSrc/miniature), le vrai fichier reste
			// accessible via download_src. Fancybox reconnait nativement
			// type "pdf" (meme traitement interne que ses iframes).
			if (/\.pdf$/i.test(item.file)) {
				return {
					id: item.id,
					isPdf: true,
					thumbSrc: item.src,
					src: item.download_src,
					width: item.width || 0,
					height: item.height || 0,
					type: "pdf",
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
        // commandes restent toujours visibles dans ce cas, quelle que soit
        // l'option « Afficher les commandes… ». Idem si l'autoplay est
        // configuré pour démarrer à chaque ouverture.
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

                    // Correspondance primaire par ID Piwigo (extrait du href),
                    // plus fiable qu'un nom de fichier : nécessaire quand
                    // plusieurs photos partagent le même préfixe (import par
                    // lot, même horodatage de dérivée à la seconde près),
                    // sinon la correspondance retombe toujours sur la
                    // première photo.
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

				// Le clic sur le bouton Diaporama demande explicitement un
				// diaporama : l'autoplay démarre et les commandes restent
				// visibles, même si l'option « Afficher les commandes… » est
				// désactivée (qui ne concerne que les ouvertures normales).
				launchViewer(items, startIndex, true);
			});
		});
	}
    const pictureImage = document.getElementById("theMainImage");

	if (isViewerAllowed() && config.open_from_picture && pictureImage) {
        pictureImage.style.cursor = "zoom-in";

        function openMainImage(e) {
            e.preventDefault();

            if (!config.load_full_album) {
                // Même sans charger tout l'album, les dimensions réelles de
                // la photo courante sont déjà disponibles côté serveur
                // (VIEWERFORPIWIGO_DATA.items contient au moins la photo
                // affichée) : on les utilise pour éviter le ratio 4/3 par
                // défaut de PhotoSwipe, avec repli sur le comportement
                // précédent si absentes.
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
        }

        pictureImage.addEventListener("click", openMainImage);

        if (config.open_hint_mode !== "never") {
            const hintSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 9 4 4 9 4"></polyline><polyline points="20 9 20 4 15 4"></polyline><polyline points="4 15 4 20 9 20"></polyline><polyline points="20 15 20 20 15 20"></polyline></svg>';

            if (config.open_hint_mode === "toolbar") {
                // #imageToolBar est une convention du coeur Piwigo
                // (themes/default/template/picture.tpl), presente dans de
                // nombreux themes ; #navigationButtons est utilise par
                // Bootstrap Darkroom. Un theme tres personnalise pourrait
                // n'avoir ni l'un ni l'autre : on verifie plutot que de
                // supposer, et on ne fait rien silencieusement sinon.
                const toolbar = document.getElementById("imageToolBar") || document.getElementById("navigationButtons");
                if (toolbar) {
                    const hint = document.createElement("button");
                    hint.type = "button";
                    hint.className = "vfp-open-hint vfp-open-hint--toolbar";
                    hint.innerHTML = hintSvg;
                    hint.addEventListener("click", openMainImage);

                    // Un <button> comme enfant direct d'un <ul>/<ol> est HTML
                    // invalide et les regles CSS du theme ciblant ses <li>
                    // (repartition flex, espacement...) ne s'appliqueraient
                    // jamais a un element etranger : on l'enveloppe dans un
                    // <li> pour rester structurellement conforme.
                    if (toolbar.tagName === "UL" || toolbar.tagName === "OL") {
                        const li = document.createElement("li");
                        li.appendChild(hint);
                        toolbar.appendChild(li);
                    } else {
                        toolbar.appendChild(hint);
                    }
                }
            } else {
                const hint = document.createElement("button");
                hint.type = "button";
                hint.className = "vfp-open-hint vfp-open-hint--corner";
                if (config.open_hint_mode === "corner_fade") {
                    hint.className += " vfp-open-hint--fade";
                }
                hint.innerHTML = hintSvg;
                document.body.appendChild(hint);

                // Position calculée en JS plutôt qu'en CSS relatif à un
                // conteneur : un wrapper autour de #theMainImage a déjà
                // cassé la mise en page sur certains thèmes (dimensionnement
                // propre au thème non hérité par le conteneur ajouté). Ici,
                // le DOM autour de l'image reste intact.
                function positionHint() {
                    const rect = pictureImage.getBoundingClientRect();
                    hint.style.top = (rect.top + window.scrollY + 8) + "px";
                    hint.style.left = (rect.right + window.scrollX - 40) + "px";
                }
                positionHint();
                window.addEventListener("resize", positionHint);
                window.addEventListener("orientationchange", positionHint);
                window.addEventListener("load", positionHint);

                if (config.open_hint_mode === "corner_fade") {
                    const showHint = () => hint.classList.add("vfp-open-hint--visible");
                    const hideHint = () => hint.classList.remove("vfp-open-hint--visible");
                    pictureImage.addEventListener("mouseenter", showHint);
                    pictureImage.addEventListener("mouseleave", hideHint);
                    hint.addEventListener("mouseenter", showHint);
                    hint.addEventListener("mouseleave", hideHint);

                    // Apparition breve au chargement (ordinateur et tactile),
                    // puis le survol reprend le relais sur ordinateur.
                    showHint();
                    setTimeout(hideHint, 3500);
                }

                hint.addEventListener("click", openMainImage);
            }
        }
    }

    // +-----------------------------------------------------------------------+
    // | Dispatcher : sélectionne le moteur configuré dans l'admin             |
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

    // Vidéo HTML5 : diaporama Fancybox mis en pause, attente de la fin
    // réelle avant d'avancer (avec filet de sécurité). Vidéo embarquée (pas
    // d'API commune fiable pour détecter sa fin) : reste en pause, reprise
    // manuelle.
    //
    // Le plugin Autoplay vit dans le registre de plugins du Carousel, pas de
    // Fancybox (son getPlugins() ne contient que Hash) : d'où
    // getCarousel().getPlugins().Autoplay, jamais fancyboxRef.getPlugins()
    // ni fancyboxRef.plugins. pause()/resume() est le bon couple (isEnabled()
    // reste true, seul le minuteur est suspendu) ; stop()/start()
    // désactiverait le plugin. Le plugin se reprogramme lui-même via son
    // écoute de « change » interne : inutile d'intervenir sur les slides
    // normales. Pas de next() sur l'instance Fancybox, uniquement sur
    // Carousel.
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

            // Si la nouvelle slide est elle-même une vidéo, carousel.next()
            // ci-dessus a déjà redéclenché fancyboxHandleSlideChange (via
            // « Carousel.change »), qui l'a remise en pause avec sa propre
            // attente. Un resume() ici relancerait le minuteur fixe
            // par-dessus, coupant la vidéo suivante avant sa fin réelle.
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
                // Lecture bloquée : reste en pause (comme pour une vidéo embarquée).
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
            l10n: (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.fancybox_l10n) ? VIEWERFORPIWIGO_DATA.fancybox_l10n : {},
            on: {
                "ready Carousel.change Carousel.autoplay:start": fancyboxHandleSlideChange
            },
            Carousel: {
			    
				Autoplay: {
					autoStart: shouldAutoStart,
					timeout: timeoutVal
				},

				// « Afficher le bouton des miniatures » est géré séparément
				// via le bouton Toolbar ci-dessous ; showOnStart ne contrôle
				// que l'état initial du carrousel, sans désactiver le plugin
				// (API native Fancybox 6).
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
    // | Les vidéos (YouTube/Vimeo/Dailymotion/HTML5) sont affichées via des   |
    // | slides "html" natives de PhotoSwipe 5 (voir dataSource plus bas).     |
    // +-----------------------------------------------------------------------+
    let pswpInstance = null;
    let pswpAutoplayTimer = null;
    let pswpAutoplayBtnEl = null;
    let pswpAutoplayActive = false;
    let pswpWaitingVideoEl = null;
    let pswpVideoEndedHandler = null;

    // Icônes du bouton diaporama (play / pause) : fonction maison, PhotoSwipe
    // 5 n'a pas d'autoplay natif.
    const PSWP_ICON_PLAY  = '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="M10 7v18l15-9z" fill="var(--pswp-icon-color, #fff)"/></svg>';
    const PSWP_ICON_PAUSE = '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="M9 7h5v18H9zM18 7h5v18h-5z" fill="var(--pswp-icon-color, #fff)"/></svg>';

    function pswpSetAutoplayIcon(playing) {
        if (!pswpAutoplayBtnEl) return;
        pswpAutoplayBtnEl.innerHTML = playing ? PSWP_ICON_PAUSE : PSWP_ICON_PLAY;
        pswpAutoplayBtnEl.classList.toggle("fbv-playing", playing);
    }

    // content.element peut être directement notre <iframe>/<video> (une
    // seule balise racine) ou un conteneur l'englobant : on gère les deux
    // cas.
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

    // Programme la prochaine avancée du diaporama selon la slide courante :
    // délai fixe pour une image, attente de la fin réelle pour une vidéo
    // HTML5 (avec filet de sécurité), pause manuelle pour une vidéo
    // embarquée (pas d'API commune fiable pour détecter sa fin).
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
                        // Lecture bloquée par le navigateur : inutile d'attendre
                        // une fin qui ne surviendra pas. Comme pour une vidéo
                        // embarquée ci-dessous, rien n'est programmé pour cette
                        // slide mais le diaporama reste actif (reprise
                        // automatique à la navigation suivante, sans rappuyer
                        // sur Lecture).
                        pswpClearVideoWait();
                    });
                }

                pswpAutoplayTimer = setTimeout(pswpAdvance, VIDEO_MAX_WAIT);
                return;
            }

            if (iframe) {
                // Comme sur Fancybox : le diaporama reste actif en
                // arrière-plan (pas d'arrêt complet), aucun minuteur n'est
                // programmé pour cette slide. La reprise est automatique dès
                // que le visiteur navigue manuellement.
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

        // PhotoSwipe 5 supporte nativement les slides « html » ({ html: '...' }
        // au lieu de { src: '...' }) : utilisé pour la vidéo HTML5, YouTube,
        // Vimeo et Dailymotion, au lieu de rediriger vers la page Piwigo.
        const dataSource = items.map((item, idx) => {
            if (item.isVideo) {
                const isIframeVideo = item.type !== "html5video";
                // PhotoSwipe précharge la slide voisine pour un swipe fluide :
                // si son URL contient déjà « autoplay=1 » (YouTube), le son
                // démarre en arrière-plan avant affichage. On retire ce
                // paramètre des slides non actives, réinjecté seulement à
                // l'activation réelle (voir contentActivate). Exception : la
                // slide d'ouverture directe reçoit l'autoplay immédiatement
                // (même geste utilisateur que le clic), certains navigateurs
                // bloquant l'autoplay avec son hors de ce cas.
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

            if (item.isPdf) {
                const pdfHtml = '<iframe src="' + item.src + '" style="width:100%;height:100%;border:0;background:#fff"></iframe>';
                return {
                    html: pdfHtml,
                    width: item.width || 1600,
                    height: item.height || 1200,
                    alt: item.plainCaption || item.caption || "",
                    caption: item.caption || "",
                    pageUrl: item.pageUrl
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

            // Légende (titre)
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

            // Bouton téléchargement de l'original
            if (config.enable_download) {
                pswpInstance.ui.registerElement({
                    name: "fbv-download",
                    order: 8,
                    isButton: true,
                    tagName: "a",
                    title: (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.fancybox_l10n && VIEWERFORPIWIGO_DATA.fancybox_l10n.DOWNLOAD) || "Download",
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

            // Plein écran (API navigateur native, PhotoSwipe n'a pas de bouton intégré)
            if (config.enable_fullscreen && document.documentElement.requestFullscreen) {
                pswpInstance.ui.registerElement({
                    name: "fbv-fullscreen",
                    order: 15,
                    isButton: true,
                    title: (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.fancybox_l10n && VIEWERFORPIWIGO_DATA.fancybox_l10n.TOGGLE_FULLSCREEN) || "Fullscreen",
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
                        // Reflète l'état réel si l'autoplay a déjà démarré
                        // (ouverture forcée via le bouton Diaporama) avant que ce bouton n'existe.
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

            // Filet de sécurité : coupe toute vidéo/iframe encore active si la
            // visionneuse est fermée sans passer par contentDeactivate.
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

        // PhotoSwipe n'expose aucune option de traduction (contrairement a
        // Fancybox) : ses 4 textes natifs (Previous/Next/Close/Zoom) sont
        // codes en dur dans sa propre definition d'elements UI. On les
        // corrige apres coup, une fois les boutons rendus dans le DOM.
        // Recherche scopee a pswpInstance.element (la racine .pswp propre a
        // CETTE instance, confirmee dans le code source) plutot qu'un
        // document.querySelector global, qui pourrait cibler une instance
        // residuelle differente.
        function patchPswpTitles() {
            const pswpL10n = (typeof VIEWERFORPIWIGO_DATA !== "undefined" && VIEWERFORPIWIGO_DATA.pswp_l10n) ? VIEWERFORPIWIGO_DATA.pswp_l10n : {};
            const root = pswpInstance && pswpInstance.element;
            if (!root) return;
            function patchTitle(selector, text) {
                if (!text) return;
                const el = root.querySelector(selector);
                if (el) {
                    el.setAttribute("title", text);
                    el.setAttribute("aria-label", text);
                }
            }
            patchTitle(".pswp__button--arrow--prev", pswpL10n.PREV);
            patchTitle(".pswp__button--arrow--next", pswpL10n.NEXT);
            patchTitle(".pswp__button--close", pswpL10n.CLOSE);
            patchTitle(".pswp__button--zoom", pswpL10n.ZOOM);
        }
        pswpInstance.on("afterInit", patchPswpTitles);
        pswpInstance.on("change", patchPswpTitles);

        pswpInstance.init();
    }

    function launchLocalViewer(startIndex) {
        // Comme pour picture.php : si les données serveur sont disponibles
        // pour une miniature (même avec load_full_album désactivé, Piwigo
        // les transmet déjà pour les photos visibles sur la page), on les
        // utilise pour les vraies dimensions (évite le ratio 4/3 par défaut).
        // Sinon, repli sur le comportement précédent (déduit du DOM).
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
                if (matched.isVideo || matched.isPdf) {
                    // Pour une vidéo ou un PDF, on conserve les données
                    // serveur (src = URL réelle) sans la remplacer par
                    // l'image « poster »/aperçu du DOM. La légende serveur
                    // respecte déjà show_caption/hide_auto_names : elle
                    // prime toujours sur le texte brut du DOM.
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

    // Ouverture depuis les popups de miniatures du plugin OpenStreetMap, si
    // installé et l'option activée. Ces popups sont injectées par Leaflet au
    // clic sur un marqueur (jamais présentes au chargement) : délégation
    // d'événements nécessaire, contrairement au scan ponctuel des miniatures
    // classiques. Structure confirmée via le code source OSM
    // (functions_map.php, osm_get_js()) : <div class="leaflet-popup-content">
    // ...<a href="picture.php?/ID/...">...</a></div> — la classe
    // "leaflet-popup-content" vient de Leaflet (stable), pas des
    // id="thumb-N" du plugin OSM (plus fragiles).
    if (isViewerAllowed() && config.open_from_osm_map) {
        document.addEventListener("click", function (e) {
            const link = e.target.closest(".leaflet-popup-content a");
            if (!link) return;

            const img = link.querySelector("img");
            const linkId = extractImageIdFromHref(link.href);

            // Ni ID extractible ni image : probablement pas une popup photo
            // (ex. popup GPX du même plugin) — on n'intervient pas.
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
                // Repli : photo absente des données déjà chargées pour cette
                // page (cas fréquent d'un marqueur pointant vers une photo
                // d'un sous-album). Item minimal construit depuis le contenu
                // de la popup, même principe que le repli de
                // launchLocalViewer ci-dessus.
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
