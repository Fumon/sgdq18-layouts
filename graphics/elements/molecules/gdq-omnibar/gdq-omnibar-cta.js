/* global AtomChevron */
(function () {
	'use strict';

	const CHEVRON_WIDTH = 25;
	const CHEVRON_HEIGHT = 45;
	const CHEVRON_THICKNESS = 7;
	const EXPAND_DURATION = 0.678;
	const CONTRACT_DURATION = EXPAND_DURATION;
	const EXPAND_EASE = Power3.easeInOut;
	const CONTRACT_EASE = Power3.easeIn;

	/**
	 * @customElement
	 * @polymer
	 */
	class GdqOmnibarCta extends Polymer.Element {
		static get is() {
			return 'gdq-omnibar-cta';
		}

		ready() {
			super.ready();

			Polymer.RenderStatus.beforeNextRender(this, () => {
				const chevrons = this.shadowRoot.querySelectorAll('.chevron');
				const bgChevrons = this.shadowRoot.querySelectorAll('.chevron--bg');

				// The chevrons get confused by our `width: 0px` trick on their parents, so
				// we have to manually re-render them at the correct size here.
				chevrons.forEach(chevron => {
					chevron.render(CHEVRON_WIDTH, CHEVRON_HEIGHT);
				});

				bgChevrons.forEach(bgChevron => {
					const gradient = new SVG.Gradient('linear');
					gradient.from(0, 0).to(0, 1);
					gradient.update(stop => {
						stop.at(0, '#300734');
						stop.at(1, '#090c12');
					});
					bgChevron.svgDoc.add(gradient);
					bgChevron.chevron.fill(gradient.fill());
				});

				this._$chevrons = chevrons;
				this._$bgChevrons = bgChevrons;

				TweenLite.set(this._$chevrons, {scaleY: 0});
			});
		}

		reset() {
			const tl = new TimelineLite();
			tl.set(this._$chevrons, {scaleY: 0});
			tl.set([this.$.leftChevrons, this.$.rightChevrons], {x: 0});
			tl.call(() => {
				this._$chevrons.forEach(chevronElement => {
					const pointArray = AtomChevron.createChevronPointArray({
						width: CHEVRON_THICKNESS,
						height: CHEVRON_HEIGHT, // Doesn't change the height.
						thickness: CHEVRON_THICKNESS // Doesn't change the thickness.
					});
					chevronElement.chevron.plot(pointArray);
				});
			});

			tl.set([this.$.benefitsContent, this.$.donateContent], {clipPath: 'inset(0 50%)'});
			return tl;
		}

		show(displayDuration) {
			const tl = new TimelineLite();

			tl.add(this.reset());

			tl.to(this._$chevrons, 0.334, {
				scaleY: 1,
				ease: Sine.easeInOut
			});

			// Show first line.
			const benefitsContent = this.$.benefitsContent;
			const benefitsContentWidth = benefitsContent.clientWidth;
			tl.addLabel('expand1');
			tl.to(this.$.leftChevrons, EXPAND_DURATION, {
				x: -(benefitsContentWidth / 2),
				ease: EXPAND_EASE
			}, 'expand1');
			tl.to(this.$.rightChevrons, EXPAND_DURATION, {
				x: benefitsContentWidth / 2,
				ease: EXPAND_EASE
			}, 'expand1');
			tl.add(this.tweenClipPath({
				element: benefitsContent,
				start: 50,
				end: 0,
				duration: EXPAND_DURATION,
				ease: EXPAND_EASE
			}), 'expand1');
			this._$chevrons.forEach(chevron => {
				tl.add(this.bendChevron(chevron, EXPAND_DURATION), 'expand1');
			});
			tl.to(this, displayDuration, {}); // Hold for displayDuration.

			// Hide first line.
			tl.addLabel('contract');
			tl.to([this.$.leftChevrons, this.$.rightChevrons], CONTRACT_DURATION, {
				x: 0,
				ease: CONTRACT_EASE
			}, 'contract');
			tl.add(this.tweenClipPath({
				element: benefitsContent,
				start: 0,
				end: 50,
				duration: CONTRACT_DURATION,
				ease: CONTRACT_EASE
			}), 'contract');
			this._$chevrons.forEach(chevron => {
				tl.add(this.straightenChevron(chevron, CONTRACT_DURATION), 'contract');
			});

			// Show second line.
			const donateContent = this.$.donateContent;
			const donateContentWidth = donateContent.clientWidth;
			tl.addLabel('expand2');
			tl.to(this.$.leftChevrons, EXPAND_DURATION, {
				x: -(donateContentWidth / 2),
				ease: Power3.easeOut
			}, 'expand2');
			tl.to(this.$.rightChevrons, EXPAND_DURATION, {
				x: donateContentWidth / 2,
				ease: Power3.easeOut
			}, 'expand2');
			tl.add(this.tweenClipPath({
				element: donateContent,
				start: 50,
				end: 0,
				duration: EXPAND_DURATION,
				ease: Power3.easeOut
			}), 'expand2');
			this._$chevrons.forEach(chevron => {
				tl.add(this.bendChevron(chevron, EXPAND_DURATION), 'expand2');
			});
			tl.to(this, displayDuration, {}); // Hold for displayDuration.

			// Hide second line.
			tl.addLabel('contract2');
			tl.to([this.$.leftChevrons, this.$.rightChevrons], CONTRACT_DURATION, {
				x: 0,
				ease: CONTRACT_EASE
			}, 'contract2');
			tl.add(this.tweenClipPath({
				element: donateContent,
				start: 0,
				end: 50,
				duration: CONTRACT_DURATION,
				ease: CONTRACT_EASE
			}), 'contract2');
			this._$chevrons.forEach(chevron => {
				tl.add(this.straightenChevron(chevron, CONTRACT_DURATION), 'contract2');
			});

			// Exit.
			tl.to(this._$chevrons, 0.334, {
				scaleY: 0,
				ease: Sine.easeInOut,
				callbackScope: this,
				onStart() {
					this.$.lineSelector.selected = '';
				}
			});

			return tl;
		}

		straightenChevron(chevronElement, duration = 1) {
			const tl = new TimelineLite();
			const proxy = {width: CHEVRON_WIDTH};
			tl.to(proxy, duration, {
				width: CHEVRON_THICKNESS,
				ease: Sine.easeInOut,
				autoRound: false,
				onUpdate() {
					const pointArray = AtomChevron.createChevronPointArray({
						width: proxy.width,
						height: CHEVRON_HEIGHT, // Doesn't change the height.
						thickness: CHEVRON_THICKNESS // Doesn't change the thickness.
					});
					chevronElement.chevron.plot(pointArray);
				}
			});
			return tl;
		}

		bendChevron(...args) {
			const tl = this.straightenChevron(...args);
			tl.reverse(0);
			return tl;
		}

		tweenClipPath({element, start, end, duration, ease}) {
			const proxy = {percentage: start};
			return TweenLite.to(proxy, duration, {
				percentage: end,
				ease,
				callbackScope: this,
				onStart() {
					this.$.lineSelector.selected = element.parentNode.id;
				},
				onUpdate() {
					element.style.clipPath = `inset(0 calc(${proxy.percentage}% - 7px)`;
				}
			});
		}
	}

	customElements.define(GdqOmnibarCta.is, GdqOmnibarCta);
})();
