import React from 'react';
import ReactDOM from 'react-dom/client';
import InvoicePrint from './InvoicePrint';
import './print.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <InvoicePrint />
  </React.StrictMode>
);
