import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom'; import App from './App.jsx'; import {clearSession} from './api'; import './styles.css';

const navigation = performance.getEntriesByType('navigation')[0];
if (navigation?.type === 'reload') clearSession();

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
