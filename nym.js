addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const SHEET_ID = 'TU_SHEET_ID'
const API_KEY = 'TU_API_KEY'
const SHEET_NAME = 'Productos'
const SHEETS_API = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORMSPREE_ID'
const MAPS_LOCATION = 'https://maps.google.com/?q=3.4842,-76.5445'
const MAPS_IMAGE = 'https://maps.googleapis.com/maps/api/staticmap?center=3.4842,-76.5445&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C3.4842,-76.5445'

async function fetchProductsFromSheets() {
  try {
    const response = await fetch(SHEETS_API)
    const data = await response.json()
    const [headers, ...rows] = data.values
    return rows.map(row => {
      const product = {}
      headers.forEach((header, index) => {
        product[header.toLowerCase()] = row[index] || ''
      })
      return {
        id: parseInt(product.id) || 0,
        sku: product.sku,
        name: product.name,
        price: parseInt(product.price) || 0,
        inventory: parseInt(product.inventory) || 0,
        image: product.image || 'https://via.placeholder.com/300'
      }
    })
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error)
    return [
      {
        id: 1,
        sku: "PROD001",
        name: "Producto Ejemplo 1",
        price: 15000,
        inventory: 50,
        image: "https://via.placeholder.com/300"
      },
      {
        id: 2,
        sku: "PROD002",
        name: "Producto Ejemplo 2",
        price: 25000,
        inventory: 30,
        image: "https://via.placeholder.com/300"
      }
    ]
  }
}

async function saveOrderToSheets(order) {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    })
    return await response.json()
  } catch (error) {
    console.error('Error saving order:', error)
    return { success: false, error: error.message }
  }
}

async function handleRequest(request) {
  const url = new URL(request.url)

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = await generateHTML()
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  if (url.pathname === '/recargar.html') {
    const html = generateRechargeHTML()
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  if (url.pathname === '/acuerdo.html') {
    const html = generateLegalAgreementHTML()
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  if (url.pathname === '/api/products') {
    const products = await fetchProductsFromSheets()
    return new Response(JSON.stringify(products), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (url.pathname === '/api/orders' && request.method === 'POST') {
    try {
      const order = await request.json()
      const result = await saveOrderToSheets(order)
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400 })
    }
  }

  return new Response('Not Found', { status: 404 })
}

function generateLegalAgreementHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acuerdo Legal - Contraentrega CO</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
    .container { background: white; max-width: 800px; padding: 30px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); margin: 20px auto; }
    h1 { color: #2c3e50; text-align: center; }
    h2 { color: #2c3e50; margin-top: 25px; }
    p, li { line-height: 1.6; color: #333; }
    .back-button { 
      display: inline-block; 
      background: #2c3e50; 
      color: white; 
      padding: 10px 15px; 
      border-radius: 5px; 
      text-decoration: none; 
      margin-top: 20px; 
    }
    .back-button:hover { background: #1a252f; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Acuerdo de Términos y Condiciones</h1>
    
    <h2>1. Términos Generales</h2>
    <p>Al utilizar nuestros servicios, usted acepta cumplir con estos términos y condiciones.</p>
    
    <h2>2. Política de Pagos</h2>
    <p>Aceptamos pagos en efectivo (COP) y a través de la red Lightning. Los precios están en pesos colombianos (COP).</p>
    
    <h2>3. Entregas</h2>
    <p>Ofrecemos recogida en nuestro punto físico y entregas a domicilio con costo adicional.</p>
    
    <h2>4. Devoluciones</h2>
    <p>Las devoluciones se manejan caso por caso. Contacte a nuestro servicio al cliente.</p>
    
    <h2>5. Privacidad</h2>
    <p>Respetamos su privacidad. La información personal solo se usará para procesar su pedido.</p>
    
    <h2>6. Limitación de Responsabilidad</h2>
    <p>No nos hacemos responsables por daños indirectos resultantes del uso de nuestros servicios.</p>
    
    <a href="/" class="back-button">Volver a la tienda</a>
  </div>
</body>
</html>`
}

function generateRechargeHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recarga Lightning | Contraentrega CO</title>
  <style>
    :root {
      --primary: #f0b90b;
      --secondary: #1e2026;
      --dark: #0b0e11;
      --light: #f8f9fa;
      --success: #02c076;
      --danger: #f6465d;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    body {
      background-color: var(--secondary);
      color: var(--light);
      line-height: 1.6;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 1px solid #2b3139;
    }
    .logo {
      font-weight: bold;
      font-size: 1.5rem;
      color: var(--primary);
    }
    .back-btn {
      margin-right: 15px;
      color: var(--primary);
      text-decoration: none;
      font-size: 1.2rem;
    }
    .card {
      background-color: var(--dark);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .card-title {
      font-size: 1.1rem;
      margin-bottom: 15px;
      color: var(--primary);
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-size: 0.9rem;
      color: #848e9c;
    }
    input, select {
      width: 100%;
      padding: 12px 15px;
      background-color: #2b3139;
      border: 1px solid #2b3139;
      border-radius: 4px;
      color: var(--light);
      font-size: 1rem;
      transition: all 0.3s;
    }
    input:focus {
      border-color: var(--primary);
      outline: none;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      background-color: var(--primary);
      color: var(--dark);
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn:hover {
      background-color: #e0ac08;
    }
    .btn:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
    }
    .timer {
      text-align: center;
      font-size: 1.5rem;
      margin: 20px 0;
      color: var(--primary);
    }
    .payment-details {
      margin-top: 25px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #2b3139;
    }
    .detail-label {
      color: #848e9c;
    }
    .detail-value {
      font-weight: 500;
    }
    .qr-container {
      text-align: center;
      margin: 20px 0;
    }
    .qr-code {
      width: 180px;
      height: 180px;
      margin: 0 auto;
      background-color: white;
      padding: 10px;
    }
    .whatsapp-btn {
      display: block;
      text-align: center;
      margin-top: 20px;
      padding: 12px;
      background-color: #25D366;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .status-pending {
      background-color: rgba(240, 185, 11, 0.2);
      color: var(--primary);
    }
    .alert {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 0.9rem;
    }
    .alert-warning {
      background-color: rgba(240, 185, 11, 0.1);
      border-left: 3px solid var(--primary);
      color: var(--primary);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="/" class="back-btn">←</a>
      <div class="logo">Contraentrega CO</div>
    </div>

    <div class="alert alert-warning">
      ⚡ Recarga instantánea de saldo Lightning con +5% de comisión
    </div>

    <div class="card" id="formSection">
      <div class="card-title">Recargar Saldo Lightning</div>
      
      <div class="form-group">
        <label for="lightningAddress">Dirección Lightning</label>
        <input type="text" id="lightningAddress" placeholder="lnbc1p... o usuario@nodeln.com" required>
      </div>
      
      <div class="form-group">
        <label for="amount">Cantidad en COP a recibir (sin comisión)</label>
        <input type="number" id="amount" min="20000" step="1000" placeholder="Ej: 50000" required>
      </div>
      
      <div class="form-group">
        <label for="email">Correo electrónico</label>
        <input type="email" id="email" placeholder="tu@email.com" required>
      </div>
      
      <button class="btn" onclick="createOrder()">Crear Orden de Recarga</button>
    </div>

    <div class="card" id="paymentSection" style="display: none;">
      <div class="card-title">Pagar Recarga</div>
      
      <div class="timer" id="countdown">01:00</div>
      <div class="status-badge status-pending">PENDIENTE</div>
      
      <div class="payment-details">
        <div class="detail-row">
          <span class="detail-label">Recibirás:</span>
          <span class="detail-value" id="receiveAmount">0 sats</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Comisión (5%):</span>
          <span class="detail-value" id="feeAmount">0 COP</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total a pagar:</span>
          <span class="detail-value" id="totalAmount">0 COP</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Referencia:</span>
          <span class="detail-value" id="referenceCode">RECH-123456</span>
        </div>
      </div>
      
      <div class="qr-container">
        <div class="qr-code" id="qrCode"></div>
        <p>Escanea el código QR para pagar</p>
      </div>
      
      <div class="payment-details">
        <div class="detail-row">
          <span class="detail-label">Banco:</span>
          <span class="detail-value">Bancolombia</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Tipo de cuenta:</span>
          <span class="detail-value">Ahorros</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Número:</span>
          <span class="detail-value">123-456789-00</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Titular:</span>
          <span class="detail-value">Contraentrega CO</span>
        </div>
      </div>
      
      <p style="margin-top: 20px; font-size: 0.9rem; color: #848e9c;">
        ⚠️ Debes realizar el pago exacto en los próximos <strong>60 segundos</strong>.
        Incluye la referencia en la transferencia.
      </p>
      
      <a href="https://wa.me/573215340988?text=Hola%20quiero%20confirmar%20mi%20recarga%20con%20referencia%20" id="whatsappLink" class="whatsapp-btn">
        Confirmar pago por WhatsApp
      </a>
    </div>
  </div>

  <script>
    let countdownInterval;
    const exchangeRate = 1500; // 1 SAT = 1.5 COP (ejemplo)
    
    function createOrder() {
      const lightningAddress = document.getElementById('lightningAddress').value;
      const amount = document.getElementById('amount').value;
      const email = document.getElementById('email').value;
      
      if (!lightningAddress || !amount || !email) {
        alert('Por favor completa todos los campos');
        return;
      }
      
      // Calcular montos
      const amountNum = parseFloat(amount);
      const fee = amountNum * 0.05; // 5% de comisión
      const total = amountNum + fee;
      const sats = Math.floor(amountNum / (exchangeRate / 1000));
      
      // Generar referencia
      const reference = 'RECH-' + Date.now().toString().slice(-6);
      
      // Mostrar sección de pago
      document.getElementById('formSection').style.display = 'none';
      document.getElementById('paymentSection').style.display = 'block';
      
      // Actualizar detalles
      document.getElementById('receiveAmount').textContent = sats.toLocaleString() + ' sats';
      document.getElementById('feeAmount').textContent = fee.toLocaleString() + ' COP';
      document.getElementById('totalAmount').textContent = total.toLocaleString() + ' COP';
      document.getElementById('referenceCode').textContent = reference;
      
      // Actualizar enlace de WhatsApp
      const whatsappLink = document.getElementById('whatsappLink');
      whatsappLink.href = \`https://wa.me/573215340988?text=Hola%20quiero%20confirmar%20mi%20recarga%20con%20referencia%20\${reference}\`;
      
      // Generar QR (simulado)
      const qrCode = document.getElementById('qrCode');
      qrCode.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + 
        encodeURIComponent(\`Banco:Bancolombia\nCuenta:123-456789-00\nMonto:\${total}\nReferencia:\${reference}\`) + 
        '" alt="QR Code">';
      
      // Iniciar temporizador
      startCountdown(60);
    }
    
    function startCountdown(seconds) {
      let remaining = seconds;
      updateCountdownDisplay(remaining);
      
      countdownInterval = setInterval(() => {
        remaining--;
        updateCountdownDisplay(remaining);
        
        if (remaining <= 0) {
          clearInterval(countdownInterval);
          alert('El tiempo para realizar el pago ha expirado. Por favor crea una nueva orden.');
          document.getElementById('formSection').style.display = 'block';
          document.getElementById('paymentSection').style.display = 'none';
        }
      }, 1000);
    }
    
    function updateCountdownDisplay(seconds) {
      const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      document.getElementById('countdown').textContent = \`\${mins}:\${secs}\`;
    }
    
    // Tipo de cambio aproximado (simulado)
    function updateExchangeRate() {
      // En una implementación real, esto vendría de una API
      const rate = (1500 + Math.random() * 100 - 50).toFixed(2);
      document.getElementById('exchangeRate').textContent = \`1 SAT = \${rate} COP\`;
    }
    
    // Actualizar tipo de cambio cada 30 segundos
    updateExchangeRate();
    setInterval(updateExchangeRate, 30000);
  </script>
</body>
</html>`
}

async function generateHTML() {
  const products = await fetchProductsFromSheets()
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contraentrega CO</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f8f9fa; }
    .container { background: white; width: 90%; max-width: 1200px; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); margin: 20px auto; }
    .table-container { overflow-x: auto; margin: 20px 0; }
    .product-table { width: 100%; border-collapse: collapse; }
    .product-table th, .product-table td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
    .product-table th { background: #2c3e50; color: white; }
    .quantity-controls { display: flex; align-items: center; gap: 8px; }
    .checkout-section { background: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 8px; }
    .search-container { margin: 15px 0; }
    #searchInput { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 25px; }
    .delivery-form input { width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px; }
    .payment-instructions { background: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .contact-buttons { display: flex; gap: 10px; margin-top: 10px; }
    .contact-buttons a { text-decoration: none; color: white; padding: 10px 20px; border-radius: 5px; flex: 1; text-align: center; }
    .success-message { background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin-top: 15px; display: none; }
    .cop-details { background: #d4edda; padding: 20px; margin: 15px 0; border-radius: 8px; border: 1px solid #155724; display: none; }
    .cop-details strong { color: #155724; }
    footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; }
    .datetime { text-align: center; margin: 10px 0; font-size: 0.9em; color: #666; }
    .clickable { color: #007bff; cursor: pointer; text-decoration: underline; }
    .clickable:hover { color: #0056b3; }
    .loading-spinner {
      display: none;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top: 4px solid #3498db;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 10px auto;
    }
    .error-message {
      display: none;
      background: #f8d7da;
      color: #721c24;
      padding: 10px;
      border-radius: 5px;
      margin-top: 15px;
    }
    .location-info { 
      text-align: center; 
      margin: 10px 0; 
      font-size: 1.1em;
    }
    .recharge-button { 
      background: #007bff; 
      color: white; 
      padding: 8px 15px; 
      border-radius: 5px; 
      text-decoration: none; 
      display: inline-block; 
      margin: 5px; 
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Contraentrega CO</h1>
      <div class="location-info">
        <a href="${MAPS_LOCATION}" target="_blank" class="clickable">📍 Punto Contraentrega: El Mirador sector los tanques, Montebello, Cali</a>
        <span class="clickable" onclick="openImageModal('${MAPS_IMAGE}')">📷 (ver imagen)</span>
      </div>
      <div class="datetime" id="currentDateTime"></div>
      <div class="contact-buttons">
        <a href="https://wa.me/573215340988" style="background: #25D366;">WhatsApp</a>
        <a href="tel:+573215340988" style="background: #34B7F1;">Llamar</a>
      </div>
    </header>

    <div class="checkout-section">
      <div id="orderSummary"></div>
      <div class="delivery-options">
        <label><input type="radio" name="delivery" value="pickup" checked onclick="toggleAddressField()"> Recoger en punto</label>
        <label><input type="radio" name="delivery" value="delivery" onclick="toggleAddressField()"> Domicilio (+$5.000 COP)</label>
      </div>
      <form id="deliveryForm" class="delivery-form">
        <input type="text" id="name" name="name" placeholder="Nombre completo" required>
        <input type="tel" id="phone" name="phone" placeholder="Teléfono" required>
        <input type="email" id="email" name="email" placeholder="Correo electrónico" required>
        <div id="addressField" style="display: none;">
          <input type="text" id="address" name="address" placeholder="Dirección completa" required>
        </div>
        <div style="margin-top: 15px; text-align: center;">
          <button type="button" onclick="handlePaymentCOP()" style="background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">Pagar con COP</button>
          <button type="button" onclick="handlePaymentLightning()" style="background: #FFD700; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">Pagar con Lightning</button>
          <div id="loadingSpinner" class="loading-spinner"></div>
        </div>
      </form>
      <div id="successMessage" class="success-message">¡Pedido realizado con éxito! Nos comunicaremos contigo pronto.</div>
      <div id="errorMessage" class="error-message"></div>
      <div id="paymentInstructions" class="payment-instructions" style="display: none;">
        <h3>Instrucciones para pago Lightning</h3>
        <p>✅ Total a pagar: <strong id="totalCOP"></strong> COP</p>
        <p>🔗 Dirección Lightning: <strong>contraentregaco@coinos.io</strong></p>
        <p>📝 Referencia de pago: <strong id="orderRef"></strong></p>
        <div id="qrCode" style="margin: 15px 0;"></div>
        <p>Escanea el código QR o copia la dirección manualmente</p>
      </div>
      <div id="copPaymentDetails" class="cop-details">
        <h3>Detalles de Pago con COP</h3>
        <p>✅ Total a pagar: <strong id="copTotal"></strong> COP</p>
        <p>📝 Número de pedido: <strong id="copOrderRef"></strong></p>
        <p>💰 Por favor prepara el monto exacto en efectivo</p>
        <p>📦 Tu pedido será procesado inmediatamente</p>
      </div>
    </div>

    <div class="search-container">
      <input type="text" id="searchInput" placeholder="Buscar productos...">
    </div>

    <div class="table-container">
      <table class="product-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Cantidad</th>
            <th>Inventario</th>
          </tr>
        </thead>
        <tbody id="productsBody">
          ${products.map(product => `
            <tr>
              <td><span class="clickable" onclick="showDescriptionModal(${product.id}, '${product.sku}')">${product.sku}</span></td>
              <td><span class="clickable" onclick="openImageModal('${product.image}')">${product.name}</span></td>
              <td>$${product.price.toLocaleString()}</td>
              <td>
                <div class="quantity-controls">
                  <button onclick="adjustQuantity(${product.id}, -1)" style="padding: 5px 10px; cursor: pointer;">-</button>
                  <span>0</span>
                  <button onclick="adjustQuantity(${product.id}, 1)" style="padding: 5px 10px; cursor: pointer;">+</button>
                </div>
              </td>
              <td>${product.inventory}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <footer>
      <div>
        <a href="/acuerdo.html" style="color: #007bff;">Acuerdo de Términos</a>
        <a href="/recargar.html" class="recharge-button">Recargar Saldo Lightning</a>
      </div>
      <p>Contraentrega © Todos los derechos reservados</p>
      <div class="datetime" id="currentDateTimeFooter"></div>
    </footer>
  </div>

  <script>
    let cart = {}
    let currentOrderId = ''
    const products = ${JSON.stringify(products)}

    function renderProducts() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase()
      const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.sku.toLowerCase().includes(searchTerm)
      )
      
      document.getElementById('productsBody').innerHTML = filteredProducts.map(product => \`
        <tr>
          <td><span class="clickable" onclick="showDescriptionModal(\${product.id}, '\${product.sku}')">\${product.sku}</span></td>
          <td><span class="clickable" onclick="openImageModal('\${product.image}')">\${product.name}</span></td>
          <td>$\${product.price.toLocaleString()}</td>
          <td>
            <div class="quantity-controls">
              <button onclick="adjustQuantity(\${product.id}, -1)" style="padding: 5px 10px; cursor: pointer;">-</button>
              <span>\${cart[product.id] || 0}</span>
              <button onclick="adjustQuantity(\${product.id}, 1)" style="padding: 5px 10px; cursor: pointer;">+</button>
            </div>
          </td>
          <td>\${product.inventory}</td>
        </tr>
      \`).join('')
    }

    function adjustQuantity(id, delta) {
      const product = products.find(p => p.id === id)
      if(!product) return
      cart[id] = Math.max(0, Math.min((cart[id] || 0) + delta, product.inventory))
      renderProducts()
      updateSummary()
    }

    function updateSummary() {
      let total = 0
      let deliveryFee = document.querySelector('input[name="delivery"]:checked').value === 'delivery' ? 5000 : 0
      let html = '<h3>Resumen del Pedido</h3><div class="order-items">'
      
      Object.entries(cart).forEach(([id, qty]) => {
        if(qty > 0) {
          const product = products.find(p => p.id == id)
          if(product) {
            const subtotal = product.price * qty
            total += subtotal
            html += \`
              <div style="margin: 10px 0; padding: 5px; border-bottom: 1px solid #eee;">
                <b>\${product.name}</b><br>
                Cantidad: \${qty}<br>
                Subtotal: $\${subtotal.toLocaleString()} COP
              </div>\`
          }
        }
      })
      
      if(deliveryFee > 0) {
        html += \`<div style="color: #dc3545;">Costo domicilio: $\${deliveryFee.toLocaleString()} COP</div>\`
      }
      
      html += \`</div><div class="total-summary" style="margin-top:15px;font-size:1.2em;">
        <strong>Total: $\${(total + deliveryFee).toLocaleString()} COP</strong>
      </div>\`
      
      document.getElementById('orderSummary').innerHTML = html
    }

    function calculateTotal() {
      const deliveryFee = document.querySelector('input[name="delivery"]:checked').value === 'delivery' ? 5000 : 0
      const subtotal = Object.entries(cart).reduce((total, [id, qty]) => {
        const product = products.find(p => p.id == id)
        return total + (product ? product.price * qty : 0)
      }, 0)
      return subtotal + deliveryFee
    }

    function toggleAddressField() {
      const addressField = document.getElementById('addressField')
      if(document.querySelector('input[name="delivery"]:checked').value === 'delivery') {
        addressField.style.display = 'block'
      } else {
        addressField.style.display = 'none'
      }
      updateSummary()
    }

    async function handlePaymentCOP() {
      await submitForm(false)
    }

    async function handlePaymentLightning() {
      await submitForm(true)
    }

    async function submitForm(isLightning) {
      const form = document.getElementById('deliveryForm')
      if(!form.checkValidity()) {
        form.reportValidity()
        return
      }

      if(document.querySelector('input[name="delivery"]:checked').value === 'delivery' && 
        !document.getElementById('address').value) {
        alert('Por favor ingresa una dirección para el domicilio')
        return
      }

      const spinner = document.getElementById('loadingSpinner')
      const errorMsg = document.getElementById('errorMessage')
      spinner.style.display = 'block'
      errorMsg.style.display = 'none'
      document.querySelectorAll('#deliveryForm button').forEach(btn => {
        btn.disabled = true
      })

      currentOrderId = 'ORD-' + Date.now().toString().slice(-6)
      const formData = new FormData(form)
      const total = calculateTotal()

      const order = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        address: document.querySelector('input[name="delivery"]:checked').value === 'delivery' ? formData.get('address') : 'Recoger en punto',
        items: {...cart},
        total: total,
        status: 'nuevo',
        date: new Date().toISOString(),
        paymentMethod: isLightning ? 'Lightning' : 'COP',
        deliveryFee: document.querySelector('input[name="delivery"]:checked').value === 'delivery' ? 5000 : 0,
        orderId: currentOrderId
      }

      try {
        const formspreeResponse = await fetch('${FORMSPREE_ENDPOINT}', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: new URLSearchParams({
            '_replyto': order.email,
            '_subject': \`Nuevo pedido \${order.orderId}\`,
            'name': order.name,
            'phone': order.phone,
            'email': order.email,
            'address': order.address,
            'paymentMethod': order.paymentMethod,
            'total': \`$\${order.total.toLocaleString()} COP\`,
            'deliveryFee': \`$\${order.deliveryFee.toLocaleString()} COP\`,
            'items': JSON.stringify(Object.entries(order.items).map(([id, qty]) => {
              const product = products.find(p => p.id == id)
              return {
                nombre: product.name,
                cantidad: qty,
                precio: product.price,
                subtotal: product.price * qty
              }
            })),
            'orderId': order.orderId
          })
        })

        if (!formspreeResponse.ok) {
          throw new Error('Error al enviar a Formspree')
        }

        const apiResponse = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        })

        if (!apiResponse.ok) {
          throw new Error('Error al guardar en nuestra base de datos')
        }

        if(isLightning) {
          document.getElementById('totalCOP').textContent = total.toLocaleString()
          document.getElementById('orderRef').textContent = currentOrderId
          document.getElementById('paymentInstructions').style.display = 'block'
        } else {
          document.getElementById('copTotal').textContent = total.toLocaleString()
          document.getElementById('copOrderRef').textContent = currentOrderId
          document.getElementById('copPaymentDetails').style.display = 'block'
        }
        
        document.getElementById('successMessage').style.display = 'block'
        cart = {}
        renderProducts()
        updateSummary()
        
        setTimeout(() => {
          document.getElementById('successMessage').style.display = 'none'
        }, 5000)
      } catch (error) {
        console.error('Error enviando pedido:', error)
        errorMsg.textContent = 'Error al enviar el pedido: ' + error.message
        errorMsg.style.display = 'block'
      } finally {
        spinner.style.display = 'none'
        document.querySelectorAll('#deliveryForm button').forEach(btn => {
          btn.disabled = false
        })
      }
    }

    function openImageModal(imgSrc) {
      const modal = document.createElement('div')
      modal.style.position = 'fixed'
      modal.style.zIndex = '1000'
      modal.style.left = '0'
      modal.style.top = '0'
      modal.style.width = '100%'
      modal.style.height = '100%'
      modal.style.backgroundColor = 'rgba(0,0,0,0.9)'
      modal.onclick = () => document.body.removeChild(modal)
      
      const img = document.createElement('img')
      img.src = imgSrc
      img.style.margin = '5% auto'
      img.style.display = 'block'
      img.style.width = '80%'
      img.style.maxWidth = '700px'
      
      modal.appendChild(img)
      document.body.appendChild(modal)
    }

    function showDescriptionModal(productId, productName) {
      const modal = document.createElement('div')
      modal.style.position = 'fixed'
      modal.style.zIndex = '1000'
      modal.style.left = '0'
      modal.style.top = '0'
      modal.style.width = '100%'
      modal.style.height = '100%'
      modal.style.backgroundColor = 'rgba(0,0,0,0.9)'
      
      const content = document.createElement('div')
      content.style.backgroundColor = '#fefefe'
      content.style.margin = '10% auto'
      content.style.padding = '20px'
      content.style.border = '1px solid #888'
      content.style.width = '80%'
      content.style.maxWidth = '600px'
      content.style.borderRadius = '10px'
      
      const close = document.createElement('span')
      close.innerHTML = '&times;'
      close.style.color = '#aaa'
      close.style.float = 'right'
      close.style.fontSize = '28px'
      close.style.fontWeight = 'bold'
      close.style.cursor = 'pointer'
      close.onclick = () => document.body.removeChild(modal)
      
      const title = document.createElement('h3')
      title.id = 'descTitle'
      title.textContent = \`Descripción de \${productName}\`
      
      const text = document.createElement('div')
      text.className = 'desc-text'
      text.textContent = 'Descripción no disponible'
      
      content.appendChild(close)
      content.appendChild(title)
      content.appendChild(text)
      modal.appendChild(content)
      document.body.appendChild(modal)
    }

    function updateDateTime() {
      const now = new Date()
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      }
      const dateTimeStr = now.toLocaleDateString('es-ES', options)
      document.getElementById('currentDateTime').textContent = dateTimeStr
      document.getElementById('currentDateTimeFooter').textContent = dateTimeStr
    }

    document.addEventListener('DOMContentLoaded', () => {
      renderProducts()
      updateDateTime()
      setInterval(updateDateTime, 1000)
      toggleAddressField()
      document.getElementById('searchInput').addEventListener('input', renderProducts)
    })
  </script>
</body>
</html>`
}