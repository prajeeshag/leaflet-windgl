
const L = globalThis.L as typeof import('leaflet');

export interface TimeSliderOptions extends L.ControlOptions {
    ticks: string[];
    initialPos?: number;
    tickLabelColor?: string; // New property for tick label color
    onChange?: (value: number) => void;
    playDuration?: number; // Duration of the play in seconds
}

export class TimeSlider extends L.Control {
    private _container!: HTMLElement;
    private _slider!: HTMLElement;
    private _thumb!: HTMLElement;
    private _ticks: string[];
    private _thumbPos: number;
    private _onChange: (value: number) => void; // Normalized value
    private _tickLabelColor: string;
    private _playButton!: HTMLElement;
    private _animationId: number | null = null;
    private _playDuration: number; // Total duration of the play in seconds

    constructor(options: TimeSliderOptions) {
        super(options);
        this._ticks = options.ticks;
        this._thumbPos = options.initialPos ?? 0;
        this._onChange = options.onChange ?? (() => { });
        this._tickLabelColor = options.tickLabelColor ?? '#000'; // Default to black
        this._playDuration = options.playDuration ?? 60; // Default to 60 seconds
    }

    onAdd(map: L.Map) {
        this._container = L.DomUtil.create('div', 'leaflet-timeslider');
        this._container.style.position = 'relative';
        this._container.style.padding = '20px 10px 10px 10px';
        this._container.style.userSelect = 'none';

        const updateContainerWidth = () => {
            const mapContainer = map.getContainer();
            const mapWidth = mapContainer.offsetWidth;
            var widthPercentage = 0.50;
            if (mapWidth < 768) {
                widthPercentage = 0.80; // For smaller screens like tablets
            } else if (mapWidth < 1200) {
                widthPercentage = 0.65; // For medium screens
            }
            const containerWidth = mapWidth * widthPercentage;
            this._container.style.width = `${containerWidth}px`;
            this._container.style.left = `${(mapWidth - containerWidth) / 2}px`;
        };

        // Initial width setup
        updateContainerWidth();

        // Update width on map resize
        map.on('resize', updateContainerWidth);

        // Play button
        this._createPlayButton();

        // Slider line
        this.createSliderLine();

        // Tick marks and labels
        this._createTicks();

        // Thumb (round button)
        this.createThumb();

        this._updateThumbPosition();

        // Drag logic
        let dragging = false;
        let sliderRect: DOMRect;

        const onPointerDown = (e: PointerEvent) => {
            dragging = true;
            sliderRect = this._slider.getBoundingClientRect();
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            e.preventDefault();
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!dragging) return;
            const x = e.clientX - sliderRect.left;
            const thumbPos = Math.max(0, Math.min(1, x / sliderRect.width));
            this.setThumbPos(thumbPos);
        };

        const onPointerUp = () => {
            dragging = false;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        };

        this._thumb.addEventListener('pointerdown', onPointerDown);

        // Click on slider to move thumb
        this._slider.addEventListener('pointerdown', (e: PointerEvent) => {
            sliderRect = this._slider.getBoundingClientRect();
            const x = e.clientX - sliderRect.left;
            const thumbPos = Math.max(0, Math.min(1, x / sliderRect.width));
            this.setThumbPos(thumbPos);
        });

        // Prevent map dragging when interacting with slider
        L.DomEvent.disableClickPropagation(this._container);
        L.DomEvent.disableScrollPropagation(this._container);

        return this._container;
    }

    private createThumb() {
        this._thumb = L.DomUtil.create('div', 'lts-thumb', this._slider);
        this._thumb.style.position = 'absolute';
        this._thumb.style.top = '-8px';
        this._thumb.style.left = '0';
        this._thumb.style.width = '20px';
        this._thumb.style.height = '20px';
        this._thumb.style.background = '#1976d2';
        this._thumb.style.borderRadius = '50%';
        this._thumb.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
        this._thumb.style.cursor = 'pointer';
        this._thumb.style.transition = 'left 0.15s';
    }

    private _createTicks() {
        const ticksContainer = L.DomUtil.create('div', 'lts-ticks', this._container);
        ticksContainer.style.position = 'absolute';
        ticksContainer.style.left = '50px'; // Adjust for play button
        ticksContainer.style.right = '20px';
        ticksContainer.style.top = '0';
        ticksContainer.style.height = '30px';
        ticksContainer.style.display = 'flex';
        ticksContainer.style.justifyContent = 'space-between';

        this._ticks.forEach((label, i) => {
            const tick = L.DomUtil.create('div', 'lts-tick', ticksContainer);
            tick.style.display = 'flex';
            tick.style.flexDirection = 'column';
            tick.style.alignItems = 'center';
            tick.style.width = '1px';

            const tickLabel = L.DomUtil.create('div', 'lts-tick-label', tick);
            tickLabel.innerText = label;
            tickLabel.style.fontSize = '12px';
            tickLabel.style.marginBottom = '4px';
            tickLabel.style.whiteSpace = 'nowrap';
            tickLabel.style.color = this._tickLabelColor; // Apply tick label color

            const tickMark = L.DomUtil.create('div', 'lts-tick-mark', tick);
            tickMark.style.width = '2px';
            tickMark.style.height = '8px';
            tickMark.style.background = '#888';
            tickMark.style.borderRadius = '1px';
        });
    }

    private createSliderLine() {
        this._slider = L.DomUtil.create('div', 'lts-slider', this._container);
        this._slider.style.position = 'relative';
        this._slider.style.height = '4px';
        this._slider.style.background = '#ccc';
        this._slider.style.margin = '20px 10px 10px 40px'; // Adjust margin to account for play button
        this._slider.style.borderRadius = '2px';
    }

    private _createPlayButton() {
        this._playButton = L.DomUtil.create('button', 'lts-play-button', this._container);
        this._playButton.innerText = '▶'; // Play icon
        this._playButton.style.position = 'absolute';
        this._playButton.style.left = '5px';
        // this._playButton.style.top = '20px';
        this._playButton.style.margin = '20px 0px 10px 0px'; // Adjust margin to account for play button
        this._playButton.style.transform = 'translateY(-50%)';
        this._playButton.style.width = '30px';
        this._playButton.style.height = '30px';
        this._playButton.style.border = 'none';
        this._playButton.style.borderRadius = '50%';
        this._playButton.style.background = '#1976d2';
        this._playButton.style.color = '#fff';
        this._playButton.style.cursor = 'pointer';
        this._playButton.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
        this._playButton.addEventListener('click', this._togglePlay.bind(this));
    }

    private _updateThumbPosition() {
        const percent = this._thumbPos
        this._thumb.style.left = `calc(${percent * 100}% - 10px)`;
    }

    private _togglePlay() {
        if (this._animationId) {
            this._stopPlaying();
        } else {
            this._startPlaying();
        }
    }

    private _startPlaying() {
        var lastTimestamp = performance.now();
        const animate = () => {
            const timestamp = performance.now();
            const currPos = this.getThumbPos();
            const delta = (timestamp - lastTimestamp) / (1000. * this._playDuration);
            const nextPos = Math.min(currPos + delta, 1.0);
            this.setThumbPos(nextPos);
            this._animationId = requestAnimationFrame(animate);
            lastTimestamp = timestamp;
            if (nextPos >= 1.0) {
                this._stopPlaying();
            }
        };
        this._animationId = requestAnimationFrame(animate);
        this._playButton.innerText = '⏸'; // Pause icon
    }

    private _stopPlaying() {
        if (this._animationId) {
            console.log('Stopping animation');
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
            this._playButton.innerText = '▶'; // Play icon
        }
    }

    setThumbPos(pos: number) {
        this._thumbPos = Math.max(0, Math.min(pos, 1.0));
        this._updateThumbPosition();
        this._onChange(this._thumbPos);
    }

    getThumbPos() {
        return this._thumbPos;
    }
}
