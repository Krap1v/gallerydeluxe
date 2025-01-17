'use strict';

import * as params from '@params';
import { Pig } from './pig';
import { newSwiper } from './helpers';

var debug = 0 ? console.log.bind(console, '[gallery-deluxe]') : function () {};

let GalleryDeluxe = {
	init: async function () {
		// One gallery per page (for now).
		const galleryId = 'gallerydeluxe';
		const dataAttributeName = 'data-gd-image-data-url';
		const container = document.getElementById(galleryId);
		if (!container) {
			throw new Error(`No element with id ${galleryId} found.`);
		}
		const dataUrl = container.getAttribute(dataAttributeName);
		if (!dataUrl) {
			throw new Error(`No ${dataAttributeName} attribute found.`);
		}

		// The image opened in the lightbox.
		let activeImage;

		// Lightbox setup.
		const modal = document.getElementById('gd-modal');
		const modalClose = document.getElementById('gd-modal-close');

		const preventDefault = function (e) {
			// For iphone.
			e.preventDefault();
		};

		const closeModal = (e) => {
			if (e) {
				e.preventDefault();
			}

			modal.removeEventListener('touchmove', preventDefault);

			// Hide the modal.
			modal.style.display = 'none';
			// Enable scrolling.
			document.body.style.overflow = 'auto';
		};

		modalClose.addEventListener('click', function () {
			closeModal();
		});

		const swipe = function (direction) {
			debug('swipe', direction);
			switch (direction) {
				case 'left':
					activeImage = activeImage.prev;
					openActiveImage();
					break;
				case 'right':
					activeImage = activeImage.next;
					openActiveImage();
					break;
				default:
					closeModal();
					break;
			}
		};

		// Add some basic swipe logic.
		newSwiper(modal, function (direction) {
			swipe(direction);
		});

		document.addEventListener('keydown', function (e) {
			switch (e.key) {
				case 'ArrowLeft':
					swipe('left');
					break;
				case 'ArrowRight':
					swipe('right');
					break;
				case 'Escape':
					closeModal(e);
					break;
			}
		});

		const openActiveImage = () => {
			modal.addEventListener('touchmove', preventDefault);

			const classLoaded = 'gd-modal-loaded';
			const classThumbnail = 'gd-modal-thumbnail';
			// Prevent scrolling of the background.
			document.body.style.overflow = 'hidden';
			let oldEls = modal.querySelectorAll('.gd-modal-content');
			let oldElsRemoved = false;

			// Delay the removal of the old elements to make sure we
			// have a image on screen before we remove the old one,
			// even on slower connections.
			const removeOldEls = () => {
				if (oldElsRemoved) {
					return;
				}
				oldElsRemoved = true;
				oldEls.forEach((element) => {
					element.remove();
				});
			};

			if (activeImage) {
				let modal = document.getElementById('gd-modal');

				if (params.enable_exif) {
					let exif = document.getElementById('gd-modal-exif');
					const onTimeOutClass = 'gd-modal-exif-ontimeout';
					exif.classList.remove(onTimeOutClass);
					let child = exif.lastElementChild;
					while (child) {
						exif.removeChild(child);
						child = exif.lastElementChild;
					}
					let dl = document.createElement('dl');
					exif.appendChild(dl);

					const addTag = (tag, value) => {
						let dt = document.createElement('dt');
						dt.innerText = camelToTitle(tag);
						dl.appendChild(dt);
						let dd = document.createElement('dd');
						dd.innerText = value;
						dl.appendChild(dd);
					};

					let date = new Date(activeImage.exif.Date);
					var dateString = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
					addTag('Date', dateString);
					let tags = activeImage.exif.Tags;
					for (const tag in tags) {
						addTag(tag, tags[tag]);
					}

					setTimeout(() => {
						exif.classList.add(onTimeOutClass);
					}, 1000);
				}

				let thumbnail = new Image();
				thumbnail.classList.add('gd-modal-content');
				thumbnail.width = activeImage.width;
				thumbnail.height = activeImage.height;
				thumbnail.style.aspectRatio = activeImage.width / activeImage.height;

				const fullImage = thumbnail.cloneNode(false);

				thumbnail.classList.add(classThumbnail);

				fullImage.src = activeImage.full;
				thumbnail.src = activeImage['20'];

				thumbnail.onload = function () {
					if (thumbnail) {
						modal.appendChild(thumbnail);
						removeOldEls();
					}
				};

				fullImage.onload = function () {
					if (fullImage) {
						modal.appendChild(fullImage);
						fullImage.classList.add(classLoaded);
						if (thumbnail) {
							thumbnail.classList.add(classLoaded);
						}
						removeOldEls();
					}
				};

				modal.style.display = 'block';
			}

			setTimeout(function () {
				removeOldEls();
			}, 1000);
		};

		// Load the gallery.
		let images = await (await fetch(dataUrl)).json();

		if (params.shuffle) {
			// Shuffle them to make it more interesting.
			images = images
				.map((value) => ({ value, sort: Math.random() }))
				.sort((a, b) => a.sort - b.sort)
				.map(({ value }) => value);
		} else if (params.reverse) {
			images = images.reverse();
		}

		let imagesMap = new Map();
		let imageData = [];
		for (let i = 0; i < images.length; i++) {
			let image = images[i];
			image.prev = images[(i + images.length - 1) % images.length];
			image.next = images[(i + 1) % images.length];
			imageData.push({ filename: image.name, aspectRatio: image.width / image.height, image: image });
			imagesMap.set(image.name, image);
		}

		var options = {
			onClickHandler: function (filename) {
				debug('onClickHandler', filename);
				activeImage = imagesMap.get(filename);
				if (activeImage) {
					openActiveImage();
				}
			},
			containerId: galleryId,
			classPrefix: 'gd',
			spaceBetweenImages: 1,
			urlForSize: function (filename, size) {
				return imagesMap.get(filename)[size];
			},
			styleForElement: function (filename) {
				let image = imagesMap.get(filename);
				if (!image || image.colors.size < 1) {
					return '';
				}
				let colors = image.colors;
				let first = colors[0];
				let second = '#ccc';
				// Some images have only one dominant color.
				if (colors.length > 1) {
					second = colors[1];
				}

				return ` background: linear-gradient(15deg, ${first}, ${second});`;
			},
		};

		new Pig(imageData, options).enable();
	},
};

function camelToTitle(text) {
	return text.replace(/([A-Z])/g, ' $1').replace(/^./, function (str) {
		return str.toUpperCase();
	});
}

export default GalleryDeluxe;
