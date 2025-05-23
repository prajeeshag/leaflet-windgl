
const L = globalThis.L as typeof import('leaflet');

export interface TimeSliderOptions extends L.ControlOptions {
    ticks: string[];
    initialIndex?: number;
    tickLabelColor?: string; // New property for tick label color
    onChange?: (index: number) => void;
}

export class TimeSlider extends L.Control {
    private _container!: HTMLElement;
    private _slider!: HTMLElement;
    private _thumb!: HTMLElement;
    private _ticks: string[];
    private _currentIndex: number;
    private _onChange?: (value: number) => void; // Normalized value
    private _tickLabelColor: string;
    private _playButton!: HTMLElement;
    private _isPlaying: boolean = false;
    private _playIntervalId?: number;

    constructor(options: TimeSliderOptions) {
        super(options);
        this._ticks = options.ticks;
        this._currentIndex = options.initialIndex ?? 0;
        this._onChange = options.onChange;
        this._tickLabelColor = options.tickLabelColor ?? '#000'; // Default to black
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

        // Slider line
        this._slider = L.DomUtil.create('div', 'lts-slider', this._container);
        this._slider.style.position = 'relative';
        this._slider.style.height = '4px';
        this._slider.style.background = '#ccc';
        this._slider.style.margin = '20px 10px 10px 40px'; // Adjust margin to account for play button
        this._slider.style.borderRadius = '2px';

        // Tick marks and labels
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

        // Thumb (round button)
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
            const percent = Math.max(0, Math.min(1, x / sliderRect.width));
            this._currentIndex = percent * (this._ticks.length - 1);
            this._updateThumbPosition();
            this._onChange?.(percent);
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
            const percent = Math.max(0, Math.min(1, x / sliderRect.width));
            this._currentIndex = percent * (this._ticks.length - 1);
            this._updateThumbPosition();
            this._onChange?.(percent);
        });

        // Prevent map dragging when interacting with slider
        L.DomEvent.disableClickPropagation(this._container);
        L.DomEvent.disableScrollPropagation(this._container);

        return this._container;
    }

    private _updateThumbPosition() {
        const percent = this._currentIndex / (this._ticks.length - 1);
        this._thumb.style.left = `calc(${percent * 100}% - 10px)`;
    }

    private _togglePlay() {
        if (this._isPlaying) {
            this._stopPlaying();
        } else {
            this._startPlaying();
        }
    }

    private _startPlaying() {
        this._isPlaying = true;
        this._playButton.innerText = '⏸'; // Pause icon
        const step = 0.01; // Smooth step increment
        const interval = 50; // Interval in ms
        this._playIntervalId = window.setInterval(() => {
            const percent = this._currentIndex / (this._ticks.length - 1);
            const nextPercent = percent + step;
            if (nextPercent >= 1) {
                this._stopPlaying();
                return;
            }
            this._currentIndex = nextPercent * (this._ticks.length - 1);
            this._updateThumbPosition();
            this._onChange?.(nextPercent);
        }, interval);
    }

    private _stopPlaying() {
        this._isPlaying = false;
        this._playButton.innerText = '▶'; // Play icon
        if (this._playIntervalId) {
            clearInterval(this._playIntervalId);
            this._playIntervalId = undefined;
        }
    }

    setIndex(idx: number) {
        if (idx < 0 || idx >= this._ticks.length) return;
        this._currentIndex = idx;
        this._updateThumbPosition();
        this._onChange?.(this._currentIndex / (this._ticks.length - 1));
    }

    getIndex() {
        return this._currentIndex;
    }
}

// Usage example (in your main code):
// const slider = new TimeSlider({
//   position: 'bottomleft',
//   ticks: ['00:00', '06:00', '12:00', '18:00', '24:00'],
//   onChange: idx => { console.log('Selected:', idx); }
// });
// map.addControl(slider);