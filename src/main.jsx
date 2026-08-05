import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // <-- ЕСЛИ ЭТОЙ СТРОКИ НЕТ, САЙТ БУДЕТ БЕЛЫМ И УРОДЛИВЫМ!

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)