import { registerRootComponent } from 'expo';
// Installs the localStorage shim BEFORE any core module touches storage
import './src/services/storage';
import App from './App';

registerRootComponent(App);
