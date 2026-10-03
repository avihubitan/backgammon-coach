// Order matters: the start time first (for start-up timing), then crash reporting, so
// start-up errors are reported too, then the app.
import './src/services/startTime';
import './src/services/crash';
import 'expo-router/entry';
