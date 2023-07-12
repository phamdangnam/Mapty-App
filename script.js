'use strict';

// prettier-ignore

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #workouts = [];
  // 2nd parameter is the zoom level
  #map;
  #mapEvent;

  constructor() {
    this._getPosition();

    // Loading workouts
    this._getLocalStorage();

    // Adding event handlers
    inputType.addEventListener('change', this._toggleElevationField);
    // An event handler function has the this keyword pointing to the DOM element that it is attached to
    // In this case without .bind(this) this will be the form object
    form.addEventListener('submit', this._newWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // We use .bind(this) because else this keyword in _loadMap will be undefined
        // this._loadMap is being treated as a regular function call in which case the this keyword is automatically undefined
        this._loadMap.bind(this),
        function () {
          alert("Can't locate your position");
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    this.#map = L.map('map').setView([latitude, longitude], 13);
    // Layout the tile, can change the link to have diff themes
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handing clicks on map
    // Without .bind(this) the this keyword will point to #map causing errors
    this.#map.on('click', this._showForm.bind(this));

    /* We place this here to make sure this code is only excuted after
    the map is loaded */
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    // Showing the user the input form
    form.classList.remove('hidden');
    // Placing the cursor on input distance
    inputDistance.focus();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    const distance = inputDistance.value;
    const duration = inputDuration.value;
    const cadence = inputCadence.value;
    const elevationGain = inputElevation.value;

    // Verifying inputs (not allowing negative numbers and numbers like 2')
    if (
      distance <= 0 ||
      duration <= 0 ||
      (inputType.value === 'running' && cadence <= 0) ||
      (inputType.value === 'cycling' && elevationGain <= 0) ||
      (inputType.value === 'running' && !/^\d+$/.test(cadence)) ||
      (inputType.value === 'cycling' && !/^\d+$/.test(elevationGain)) ||
      !/^\d+$/.test(distance) ||
      !/^\d+$/.test(duration)
    ) {
      this._clearFields();
      alert('Inputs have to be positive numbers.');
      return;
    }

    const coords = this.#mapEvent.latlng;
    let workout;
    if (inputType.value === 'running') {
      workout = new Running(
        coords,
        inputDistance.value,
        inputDuration.value,
        inputCadence.value
      );
    } else {
      workout = new Cycling(
        coords,
        inputDistance.value,
        inputDuration.value,
        inputElevation.value
      );
    }
    this.#workouts.push(workout);

    // Render new workout on map
    this._renderWorkoutMarker(workout);
    // Render new workout on the list
    this._renderWorkout(workout);
    this._hideForm();

    // Saving the workouts to local storage
    this._setLocalStorage();
  }

  _renderWorkout(workout) {
    containerWorkouts.insertAdjacentHTML(
      'afterbegin',
      `<li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${this._generateWorkoutMessage(workout)}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.icon}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${
            workout.type === 'running'
              ? workout.pace.toFixed(1)
              : workout.speed.toFixed(1)
          }</span>
          <span class="workout__unit">${
            workout.type === 'running' ? 'MIN/KM' : 'KM/H'
          }</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🦶🏼' : '⛰'
          }</span>
          <span class="workout__value">${
            workout.type === 'running' ? workout.cadence : workout.elevationGain
          }</span>
          <span class="workout__unit">${
            workout.type === 'running' ? 'SPM' : 'M'
          }</span>
        </div>
      </li>`
    );
  }

  _renderWorkoutMarker(workout) {
    let message = this._generateWorkoutMessage(workout);

    // Generating a popup on the map
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(message, {
        maxWidth: 250,
        minWidth: 100,
        autoClose: false, // Preventing the popups closing when another one is opened
        closeOnClick: false, // Preventing the popups closing on clicks
        className: `${workout.type}-popup`,
      })
      .openPopup();
  }

  _hideForm() {
    this._clearFields();
    form.classList.add('hidden');
  }

  _clearFields() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#map.setView(workout.coords, 13);
  }

  _generateWorkoutMessage(workout) {
    return `${workout.icon} ${workout.type
      .charAt(0)
      .toUpperCase()}${workout.type.slice(1)} on ${workout.date}`;
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
      /* This will throw an error since we're trying to render
      markers when the map is not yet loaded */
      // this._renderWorkoutMarker(workout);
    });
  }
}

const app = new App();

class Workout {
  date = '';
  id = Date.now().toString().slice(-10);
  months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this._formatDate();
  }

  _formatDate() {
    let cur = new Date();
    let monthInWord = this.months[cur.getMonth()];
    this.date = `${monthInWord} ${cur.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  icon = '🏃‍♂️';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  icon = '🚴‍♀️';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}
