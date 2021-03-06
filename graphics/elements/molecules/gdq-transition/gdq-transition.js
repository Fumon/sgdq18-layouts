(function () {
	'use strict';

	const HOME_POSITION = {x: 0, y: 0};
	const HERO_HOLD_TIME = 1.5;
	const GENERIC_HOLD_TIME = 0.5;
	const MEDIA_READY_STATES = {
		HAVE_NOTHING: 0,
		HAVE_METADATA: 1,
		HAVE_CURRENT_DATA: 2,
		HAVE_FUTURE_DATA: 3,
		HAVE_ENOUGH_DATA: 4
	};

	const currentLayoutRep = nodecg.Replicant('gdq:currentLayout');

	CustomEase.create('ModifiedPower2EaseInOut', 'M0,0 C0.66,0 0.339,1 1,1');

	/**
	 * @customElement
	 * @polymer
	 */
	class GdqTransition extends Polymer.Element {
		static get is() {
			return 'gdq-transition';
		}

		static get properties() {
			return {
				masterTimeline: {
					type: TimelineLite,
					readOnly: true,
					value() {
						return new TimelineLite({autoRemoveChildren: true});
					}
				}
			};
		}

		ready() {
			super.ready();

			const videos = Array.from(this.shadowRoot.querySelectorAll('video'));
			const videoLoadPromises = videos.map(this.waitForVideoToLoad);
			Promise.all(videoLoadPromises).then(() => this.init());
			this._$videos = videos;

			if (window.__SCREENSHOT_TESTING__) {
				TweenLite.set(this, {opacity: 1});
			} else {
				currentLayoutRep.once('change', newVal => {
					if (newVal.toLowerCase() === 'break') {
						this.fromClosedToPartial().progress(1);
					} else {
						this.fromClosedToOpen().progress(1);
					}
					TweenLite.set(this, {opacity: 1});
				});
			}
		}

		init() {
			if (this._initialized) {
				throw new Error('already initialized');
			}
			this._initialized = true;
			this.dispatchEvent(new CustomEvent('initialized'));

			if (window.__SCREENSHOT_TESTING__) {
				this._$videos.forEach(video => {
					video.currentTime = video.duration;
				});
			}

			// Hide all videos to start.
			this.hideVideos(...this._$videos);

			nodecg.listenFor('compositingOBS:transitioning', data => {
				console.log('compositingOBS:transitioning |', data);
				if (!data || !data.fromScene || !data.toScene) {
					return;
				}

				if (data.name !== 'Blank Stinger') {
					return;
				}

				let animationTimeline;
				if (data.fromScene === 'Break') {
					if (data.toScene === 'Break') {
						animationTimeline = this.genericBoth();
					} else if (gdqUtils.isGameScene(data.toScene)) {
						animationTimeline = this.heroExit();
					} else if (data.toScene === 'Interview' || data.toScene === 'Countdown' || data.toScene === 'Advertisements') {
						animationTimeline = this.genericExit();
					}
				} else if (gdqUtils.isGameScene(data.fromScene)) {
					if (data.toScene === 'Break') {
						animationTimeline = this.heroEnter();
					} else if (gdqUtils.isGameScene(data.toScene)) {
						animationTimeline = this.genericNone();
					} else if (data.toScene === 'Interview' || data.toScene === 'Countdown' || data.toScene === 'Advertisements') {
						animationTimeline = this.genericNone();
					}
				} else if (data.fromScene === 'Interview') {
					if (data.toScene === 'Break') {
						this.genericEnter();
					} else if (gdqUtils.isGameScene(data.toScene)) {
						animationTimeline = this.genericNone();
					} else if (data.toScene === 'Interview' || data.toScene === 'Countdown' || data.toScene === 'Advertisements') {
						animationTimeline = this.genericNone();
					}
				} else if (data.fromScene === 'Countdown') {
					if (data.toScene === 'Break') {
						animationTimeline = this.heroEnter();
					} else if (gdqUtils.isGameScene(data.toScene)) {
						animationTimeline = this.genericNone();
					} else if (data.toScene === 'Interview' || data.toScene === 'Countdown' || data.toScene === 'Advertisements') {
						animationTimeline = this.genericNone();
					}
				} else if (data.fromScene === 'Advertisements') {
					if (data.toScene === 'Break') {
						this.genericEnter();
					} else if (gdqUtils.isGameScene(data.toScene)) {
						animationTimeline = this.genericNone();
					} else if (data.toScene === 'Interview' || data.toScene === 'Countdown' || data.toScene === 'Advertisements') {
						animationTimeline = this.genericNone();
					}
				} else if (data.fromScene === 'Technical Difficulties') {
					if (data.toScene === 'Break') {
						animationTimeline = this.genericNone();
					} else if (gdqUtils.isGameScene(data.toScene)) {
						animationTimeline = this.genericNone();
					} else if (data.toScene === 'Interview' || data.toScene === 'Countdown' || data.toScene === 'Advertisements') {
						animationTimeline = this.genericNone();
					}
				}

				if (animationTimeline) {
					this.masterTimeline.clear();
					this.masterTimeline.add(animationTimeline);
				}
			});
			console.log('listening for transition events...');
		}

		genericNone() {
			console.log('genericNone');
			return this.genericBase({startPartial: false, endPartial: false});
		}

		genericEnter() {
			console.log('genericEnter');
			return this.genericBase({startPartial: false, endPartial: true});
		}

		genericExit() {
			console.log('genericExit');
			return this.genericBase({startPartial: true, endPartial: false});
		}

		genericBoth() {
			console.log('genericBoth');
			return this.genericBase({startPartial: true, endPartial: true});
		}

		genericBase({startPartial, endPartial}) {
			const tl = new TimelineLite({
				callbackScope: this,
				onStart() {
					this.hideVideos(
						this.$['bottomTrapAnimation-enter'],
						this.$['bottomTrapAnimation-exit'],
						this.$.bottomRectAnimation,
						this.$.topTrapAnimation,
						this.$.topRectAnimation
					);
					nodecg.playSound('transition-general');
				}
			});

			const closingAnim = startPartial ? this.fromPartialToClosed() : this.fromOpenToClosed();
			closingAnim.call(() => {
				this.playVideos(this.$.genericAnimation);
			}, null, null, 'frontRects');

			tl.add(closingAnim);
			tl.add(endPartial ? this.fromClosedToPartial() : this.fromClosedToOpen(), `+=${GENERIC_HOLD_TIME}`);
			return tl;
		}

		heroEnter() {
			console.log('heroEnter');
			const videos = [
				this.$['bottomTrapAnimation-enter'],
				this.$.bottomRectAnimation,
				this.$.topTrapAnimation,
				this.$.topRectAnimation
			];

			const tl = new TimelineLite({
				callbackScope: this,
				onStart() {
					this.playVideos(...videos);
					nodecg.playSound('transition-hero-enter');
				}
			});

			tl.add(this.fromOpenToClosed());
			tl.add(this.fromClosedToPartial({fadeOutVideos: true}), `+=${HERO_HOLD_TIME}`);
			return tl;
		}

		heroExit() {
			console.log('heroExit');
			const videos = [
				this.$['bottomTrapAnimation-exit'],
				this.$.bottomRectAnimation,
				this.$.topTrapAnimation,
				this.$.topRectAnimation
			];

			const tl = new TimelineLite({
				callbackScope: this,
				onStart() {
					this.playVideos(...videos);
					nodecg.playSound('transition-hero-exit');
				}
			});

			tl.add(this.fromPartialToClosed());
			tl.add(this.fromClosedToOpen({fadeOutVideos: true}), `+=${HERO_HOLD_TIME}`);
			return tl;
		}

		fromOpenToClosed() {
			const tl = new TimelineLite();
			tl.add(this.closeGeometry());
			return tl;
		}

		fromClosedToOpen({fadeOutVideos} = {}) {
			return this.openGeometry({
				bottomFrontRect: {x: 26, y: 413},
				topFrontRect: {x: -10, y: -418},
				bottomFrontTrapezoid: {x: -667, y: 488},
				topFrontTrapezoid: {x: 14, y: -521},
				bottomBackRect: {x: 0, y: 421},
				topBackRect: {x: -10, y: -437},
				bottomBackTrapezoid: {x: -666, y: 510},
				topBackTrapezoid: {x: 0, y: -543},
				fadeOutVideos,
				fadeOutAll: true
			});
		}

		fromPartialToClosed() {
			const tl = new TimelineLite();

			tl.to([
				this.$.topFrameContent,
				this.$.bottomFrameContent
			], 0.333, {
				opacity: 0,
				ease: Sine.easeInOut
			}, 0);

			tl.add(this.closeGeometry(), 0);

			return tl;
		}

		fromClosedToPartial({fadeOutVideos} = {}) {
			const tl = new TimelineLite();

			tl.add(this.openGeometry({
				bottomFrontRect: {x: 26, y: 321},
				topFrontRect: {x: -10, y: -349},
				bottomFrontTrapezoid: {x: -503, y: 364},
				topFrontTrapezoid: {x: 8, y: -417},
				bottomBackRect: {x: 0, y: 323},
				topBackRect: {x: 0, y: -351},
				bottomBackTrapezoid: {x: -490, y: 374},
				topBackTrapezoid: {x: 0, y: -426},
				fadeOutVideos
			}));

			tl.to([
				this.$.topFrameContent,
				this.$.bottomFrameContent
			], 0.333, {
				opacity: 1,
				ease: Sine.easeInOut
			});

			return tl;
		}

		openGeometry({
			bottomFrontRect,
			topFrontRect,
			bottomFrontTrapezoid,
			topFrontTrapezoid,
			bottomBackRect,
			topBackRect,
			bottomBackTrapezoid,
			topBackTrapezoid,
			fadeOutVideos,
			fadeOutAll
		}) {
			const tl = new TimelineLite();

			tl.addLabel('start', 0.03);
			tl.addLabel('frontRects', 'start');
			tl.addLabel('frontTraps', 'start+=0.1');
			tl.addLabel('backRects', 'start+=0.1667');
			tl.addLabel('backTraps', 'start+=0.2334');

			// Front rects.
			tl.to(this.$.bottomFrontRect, 0.2167, {
				...bottomFrontRect,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontRects');
			tl.to(this.$.topFrontRect, 0.2167, {
				...topFrontRect,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontRects');

			// Front traps.
			tl.to(this.$.bottomFrontTrapezoid, 0.2667, {
				...bottomFrontTrapezoid,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontTraps');
			tl.to(this.$.topFrontTrapezoid, 0.2667, {
				...topFrontTrapezoid,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontTraps');

			// Back rects.
			tl.to(this.$.bottomBackRect, 0.2334, {
				...bottomBackRect,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backRects');
			tl.to(this.$.topBackRect, 0.2334, {
				...topBackRect,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backRects');

			// Back traps.
			tl.to(this.$.bottomBackTrapezoid, 0.2334, {
				...bottomBackTrapezoid,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backTraps');
			tl.to(this.$.topBackTrapezoid, 0.2334, {
				...topBackTrapezoid,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backTraps');

			if (fadeOutVideos) {
				tl.to(this._$videos, 0.25, {
					opacity: 0,
					ease: Sine.easeInOut,
					callbackScope: this,
					onComplete() {
						console.log('hide all videos');
						this.hideVideos(...this._$videos);
					}
				}, tl.duration() / 2);
			}
			if (fadeOutAll) {
				tl.to(this, 0.25, {
					opacity: 0,
					ease: Sine.easeInOut
				});
			}

			return tl;
		}

		closeGeometry() {
			const tl = new TimelineLite();

			tl.addLabel('start', 0.03);
			tl.addLabel('backTraps', 'start');
			tl.addLabel('backRects', 'start+=0.0667');
			tl.addLabel('frontTraps', 'start+=0.1334');
			tl.addLabel('frontRects', 'start+=0.2334');

			tl.set(this, {opacity: 1}, 'start');

			// Back traps.
			tl.to(this.$.bottomBackTrapezoid, 0.2334, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backTraps');
			tl.to(this.$.topBackTrapezoid, 0.2334, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backTraps');

			// Back rects.
			tl.to(this.$.bottomBackRect, 0.2334, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backRects');
			tl.to(this.$.topBackRect, 0.2334, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backRects');

			// Front traps.
			tl.to(this.$.bottomFrontTrapezoid, 0.2667, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontTraps');
			tl.to(this.$.topFrontTrapezoid, 0.2667, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontTraps');

			// Front rects.
			tl.to(this.$.bottomFrontRect, 0.2167, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontRects');
			tl.to(this.$.topFrontRect, 0.2167, {
				...HOME_POSITION,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontRects');

			return tl;
		}

		waitForInit() {
			return new Promise(resolve => {
				if (this._initialized) {
					return resolve();
				}

				this.addEventListener('initialized', () => {
					resolve();
				}, {once: true, passive: true});
			});
		}

		waitForVideoToLoad(videoElem) {
			return new Promise(resolve => {
				if (videoElem.readyState >= MEDIA_READY_STATES.HAVE_ENOUGH_DATA) {
					return resolve();
				}

				videoElem.addEventListener('canplaythrough', () => {
					resolve();
				}, {once: true, passive: true});
			});
		}

		playVideos(...videoElems) {
			if (window.__SCREENSHOT_TESTING__) {
				return;
			}

			this.showVideos(...videoElems);
			videoElems.forEach(videoElem => {
				videoElem.play().then(() => {
					console.log('started playing', videoElem.id);
				}).catch(() => {
					console.error('failed to play', videoElem.id);
				});
			});
		}

		showVideos(...videoElems) {
			if (window.__SCREENSHOT_TESTING__) {
				return;
			}

			videoElems.forEach(videoElem => {
				videoElem.style.display = '';
				videoElem.style.opacity = '';
			});
		}

		hideVideos(...videoElems) {
			if (window.__SCREENSHOT_TESTING__) {
				return;
			}

			videoElems.forEach(videoElem => {
				videoElem.pause();
				videoElem.currentTime = 0;
				requestAnimationFrame(() => {
					videoElem.style.display = 'none';
					videoElem.style.opacity = '0';
				});
			});
		}
	}

	customElements.define(GdqTransition.is, GdqTransition);
})();
