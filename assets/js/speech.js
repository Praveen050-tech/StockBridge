/**
 * Sollu - Speech Recognition Controller
 * Handles Web Speech API (webkitSpeechRecognition) with live interim results
 * Supports ta-IN (Tamil), hi-IN (Hindi), and en-IN (English)
 */

class SolluSpeechRecognizer {
    constructor(options = {}) {
        this.lang = options.lang || 'ta-IN';
        this.onInterimResult = options.onInterimResult || (() => {});
        this.onFinalResult = options.onFinalResult || (() => {});
        this.onStatusChange = options.onStatusChange || (() => {});
        this.onError = options.onError || (() => {});

        this.recognition = null;
        this.isRecording = false;
        this.finalTranscript = '';

        this.init();
    }

    isSupported() {
        return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    }

    init() {
        if (!this.isSupported()) {
            console.warn('Web Speech API is not supported in this browser.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang = this.lang;

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.onStatusChange({
                isRecording: true,
                message: this.getListeningText(this.lang)
            });
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcriptPiece = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.finalTranscript += (this.finalTranscript.length > 0 ? ' ' : '') + transcriptPiece.trim();
                    this.onFinalResult(this.finalTranscript);
                } else {
                    interimTranscript += transcriptPiece;
                }
            }
            this.onInterimResult({
                finalText: this.finalTranscript,
                interimText: interimTranscript
            });
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            let userMessage = 'Microphone error: ' + event.error;
            if (event.error === 'not-allowed') {
                userMessage = 'Microphone permission denied. Please allow microphone access.';
            } else if (event.error === 'no-speech') {
                userMessage = 'No speech detected. Please speak closer to the mic.';
            } else if (event.error === 'network') {
                userMessage = 'Speech recognition network error. Check your connection or type manually.';
            }
            this.onError({ error: event.error, message: userMessage });
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.onStatusChange({
                isRecording: false,
                message: 'Tap mic to speak'
            });
        };
    }

    setLanguage(langCode) {
        this.lang = langCode;
        if (this.recognition) {
            const wasRecording = this.isRecording;
            if (wasRecording) {
                this.stop();
            }
            this.recognition.lang = this.lang;
            if (wasRecording) {
                this.start();
            }
        }
    }

    setFinalTranscript(text) {
        this.finalTranscript = text ? text.trim() : '';
    }

    start() {
        if (!this.recognition) {
            this.init();
        }
        if (!this.recognition) {
            this.onError({
                error: 'unsupported',
                message: 'Your browser does not support Speech Recognition. Please type your order directly.'
            });
            return;
        }

        try {
            this.recognition.start();
        } catch (e) {
            console.warn('Speech recognition already started or busy:', e);
        }
    }

    stop() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    toggle() {
        if (this.isRecording) {
            this.stop();
        } else {
            this.start();
        }
    }

    getListeningText(lang) {
        switch (lang) {
            case 'ta-IN':
                return 'கேட்கிறேன்... பேசுங்கள் (Listening...)';
            case 'hi-IN':
                return 'सुन रहा हूँ... बोलिए (Listening...)';
            default:
                return 'Listening... Speak your order';
        }
    }
}
