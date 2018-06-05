(function () {
	'use strict';

	const lowerthirdTimeRemaining = nodecg.Replicant('interview:lowerthirdTimeRemaining');
	const questionShowing = nodecg.Replicant('interview:questionShowing');
	const questionSortMap = nodecg.Replicant('interview:questionSortMap');
	const questionTimeRemaining = nodecg.Replicant('interview:questionTimeRemaining');
	const streamingOBSTransitioning = nodecg.Replicant('streamingOBS:transitioning');
	const programScene = nodecg.Replicant('streamingOBS:programScene');
	const streamingOBSStatus = nodecg.Replicant('streamingOBS:websocket');

	/**
	 * @customElement
	 * @polymer
	 * @appliesMixin Polymer.MutableData
	 * @appliesMixin Polymer.SCDataBindingHelpers
	 */
	class DashInterview extends Polymer.SCDataBindingHelpers(Polymer.MutableData(Polymer.Element)) {
		static get is() {
			return 'dash-interview';
		}

		static get properties() {
			return {
				lowerthirdShowing: {
					type: Boolean,
					reflectToAttribute: true
				},
				lowerthirdTimeRemaining: {
					type: Number
				},
				questionShowing: {
					type: Boolean,
					reflectToAttribute: true
				},
				questionTimeRemaining: {
					type: Boolean
				},
				_programSceneName: {
					type: String,
					value: ''
				},
				_markingTopQuestionAsDone: {
					type: Boolean,
					value: false
				},
				_sendingTransitionCommand: {
					type: Boolean,
					value: false
				},
				_errorToastText: String,
				_successToastText: String,
				_transitioning: Boolean,
				_disconnectedFromOBS: Boolean,
				_transitionToBreakDisabled: {
					type: Boolean,
					computed: '_computeTransitionToBreakDisabled(_sendingTransitionCommand, _transitioning, _disconnectedFromOBS, _programSceneName)'
				}
			};
		}

		ready() {
			super.ready();

			lowerthirdTimeRemaining.on('change', newVal => {
				this.lowerthirdTimeRemaining = newVal;
			});

			questionTimeRemaining.on('change', newVal => {
				this.questionTimeRemaining = newVal;
			});

			streamingOBSTransitioning.on('change', newVal => {
				this._transitioning = newVal;
			});

			programScene.on('change', newVal => {
				this._programSceneName = newVal ? newVal.name : '';
			});

			streamingOBSStatus.on('change', newVal => {
				this._disconnectedFromOBS = Boolean(!newVal || newVal.status !== 'connected');
			});

			this.addEventListener('error-toast', event => {
				this.showErrorToast(event.detail.text);
			});
		}

		showSuccessToast(text) {
			this._successToastText = text;
			this.$.successToast.show();
		}

		showErrorToast(text) {
			this._errorToastText = text;
			this.$.errorToast.show();
		}

		showLowerthird() {
			this.$.lowerthirdControls.autoLowerthird();
		}

		hideLowerthird() {
			this.$.lowerthirdControls.hideLowerthird();
		}

		showQuestion() {
			this._markingTopQuestionAsDone = true;
			nodecg.sendMessage('pulseInterviewQuestion', questionSortMap.value[0], error => {
				this._markingTopQuestionAsDone = false;
				if (error) {
					this.showErrorToast('Failed to load next interview question.');
					nodecg.log.error(error);
				}
			});
		}

		hideQuestion() {
			questionShowing.value = false;
			this._markingTopQuestionAsDone = false;
		}

		openInterviewTransitionConfirmation() {
			this.$.interviewTransitionConfirmation.open();
		}

		transitionToInterview() {
			return this.transitionToScene('Interview');
		}

		transitionToBreak() {
			return this.transitionToScene('Break');
		}

		async transitionToScene(sceneName, transitionName = 'Blank Stinger') {
			this._sendingTransitionCommand = true;

			try {
				await nodecg.sendMessage('streamingOBS:transition', {
					name: transitionName,
					sceneName
				});
				this.showSuccessToast(`Successfully started transition to "${sceneName}".`);
			} catch (error) {
				let errorString = error;
				if (error.message) {
					errorString = error.message;
				} else if (error.error) {
					errorString = error.error;
				}
				this.showErrorToast('Failed to transition: ' + errorString);
			}

			this._sendingTransitionCommand = false;
		}

		_computeTransitionToBreakDisabled(_sendingTransitionCommand, _transitioning, _disconnectedFromOBS, _programSceneName) {
			return _sendingTransitionCommand ||
				_transitioning ||
				_disconnectedFromOBS ||
				_programSceneName === 'Break';
		}

		_any(...args) {
			return args.find(arg => Boolean(arg));
		}
	}

	customElements.define(DashInterview.is, DashInterview);
})();