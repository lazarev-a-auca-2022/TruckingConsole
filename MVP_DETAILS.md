# Tech Task for an mvp for a truck permit app

**Date:** June 28, 2025

## Overview

This document outlines the technical specification for the MVP of a trucking permit management application. The app will process and visualize state-specific trucking permits, converting raw permit data into navigable routes compatible with Google Maps and Garmin navigators.

## Objectives

- Enable users to upload and parse state-specific permit documents.
- Convert permit route descriptions into actionable navigation points.
- Support route visualization in Google Maps with key waypoints.
- Provide a basic interface for route planning across multiple states.
- Minimize manual effort in interpreting permit route details.

## Functional Requirements

### Input Processing

- Support upload of PDF, image, and text files containing permit data.
- Parse state-specific route descriptions (e.g., Illinois, Wisconsin formats).
- Extract key data: start/end points, waypoints, distances, and restrictions.

### Route Conversion

- Convert parsed data into a list of GPS coordinates or addresses.
- Generate a Google Maps-compatible URL with all waypoints.
- Export routes in a Garmin-compatible format (e.g., GPX).

### User Interface

- Simple upload interface for permit documents.
- Display parsed route details (text and map view).
- Button to open route in Google Maps.
- Export option for Garmin devices.
- Support for multiple state permits in a single session.

### Supported States

- Initial MVP to support at least 5 states (e.g., Illinois, Wisconsin, Missouri, North Dakota, Indiana).
- Expand to all 48 contiguous U.S. states in future iterations.

## Non-Functional Requirements

- **Processing time:** Parse and convert routes within 10 seconds.
- **Compatibility:** Web and mobile platforms (iOS/Android).
- **Reliability:** 99% accuracy in parsing standard permit formats.
- **Security:** Encrypted file uploads and data storage.

## Technical Architecture

- **Frontend:** React.js for web, React Native for mobile.
- **Backend:** Node.js with Express for API.
- **Parsing Engine:** Custom NLP module to interpret permit text.
- **Mapping Service:** Google Maps API for route visualization.
- **Database:** MongoDB for storing parsed route data.
- **Export:** GPX library for Garmin compatibility.

## Development Milestones

- Setup environment, design UI mockups.
- Develop parsing engine for 5 states.
- Integrate Google Maps API and export functionality.
- Testing and bug fixing.
- Deployment

## Risks and Mitigation

### Risk: Inconsistent permit formats across states
- **Mitigation:** Build a flexible parsing engine with manual override option.

### Risk: API rate limits
- **Mitigation:** Implement caching and optimize API calls.

## Assumptions

- Users have internet access for map integration.
- Permit documents follow a semi-structured format.
- Initial focus is on contiguous U.S. states.