const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  routeId: {
    type: String,
    required: true,
    unique: true
  },
  state: {
    type: String,
    required: true,
    enum: ['IL', 'WI', 'MO', 'ND', 'IN']
  },
  startPoint: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  endPoint: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  waypoints: [{
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    description: String
  }],
  restrictions: [{
    type: String,
    description: String,
    location: String
  }],
  distance: {
    value: Number,
    unit: String
  },
  originalText: String,
  parseAccuracy: {
    type: Number,
    min: 0,
    max: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

routeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Route', routeSchema);
