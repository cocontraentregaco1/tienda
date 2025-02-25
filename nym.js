export default {
  async fetch(request, env, ctx) {
    // Variables de entorno (configuradas como secret y binding)
    const ADMIN_JWT_SECRET = env.ADMIN_JWT_SECRET;
    const R2_BASE_URL = env.R2_BASE_URL;
    const OPENAI_API_KEY = env.OPENAI_API_KEY;
    const TTS_API_KEY = env.TTS_API_KEY;
    // DB y PRODUCTS_KV están disponibles en env.DB y env.PRODUCTS_KV

    // ---------------------
    // Funciones de ayuda para JWT
    // ---------------------
    function base64UrlDecode(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) { str += '='; }
      return atob(str);
    }
    
    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (const b of bytes) {
        binary += String.fromCharCode(b);
      }
      return btoa(binary);
    }
    
    function arrayBufferToBase64Url(buffer) {
      return arrayBufferToBase64(buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    
    async function verifyJWT(token, secret) {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error("Token inválido");
      const [headerB64, payloadB64, signatureB64] = parts;
      const header = JSON.parse(base64UrlDecode(headerB64));
      if (header.alg !== "HS256") throw new Error("Algoritmo no soportado");
      const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
      // Corrección en el endpoint /admin/login (generación JWT)
// ... código previo
const key = await crypto.subtle.importKey(
    "raw", 
    new TextEncoder().encode(ADMIN_JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" }, // Parámetro algoritmo agregado
    false, // extractable
    ["sign"] // keyUsages
); // Paréntesis cerrado correctamente

const signature = await crypto.subtle.sign(
    "HMAC",
    key, // Usamos la variable key
    new TextEncoder().encode(`${headerB64}.${payloadB64}`) // data
);
// ... resto del código
      const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
      const computedSignatureB64 = arrayBufferToBase64Url(signatureBuffer);
      if (computedSignatureB64 !== signatureB64) {
        throw new Error("Firma inválida");
      }
      const payload = JSON.parse(base64UrlDecode(payloadB64));
      return payload;
    }
    
    try {
      const url = new URL(request.url);
      
      // Agregar después de los endpoints /admin/*
// =====================================================
// ENDPOINTS DE PAGOS
// =====================================================
if (url.pathname === '/crear-factura' && request.method === 'POST') {
  const { monto } = await request.json();
  
  // Integración con LNBITS
  const lnbitsResponse = await fetch('https://legend.lnbits.com/api/v1/payments', {
    method: 'POST',
    headers: {
      'X-Api-Key': env.LNBITS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      out: false,
      amount: monto,
      memo: "Pago Contraentrega"
    })
  });
  
  const lnbitsData = await lnbitsResponse.json();
  return new Response(JSON.stringify(lnbitsData), {
    headers: { 'Content-Type': 'application/json' }
  });
}

if (url.pathname === '/verificar-pago' && request.method === 'POST') {
  const { payment_hash } = await request.json();
  
  const verifyResponse = await fetch(`https://legend.lnbits.com/api/v1/payments/${payment_hash}`, {
    headers: { 'X-Api-Key': env.LNBITS_API_KEY }
  });
  
  return new Response(verifyResponse.body, {
    headers: { 'Content-Type': 'application/json' }
  });
}
      
      // =====================================================
      // 1. ENDPOINT CHAT: POST /chat
      // =====================================================
      if (url.pathname === '/chat' && request.method === 'POST') {
        try {
          const { message } = await request.json();
          const companyInfo = `Contraentrega es una empresa especializada en la compra y venta en línea en Armenia Quindío, Colombia. Ofrecemos servicios de logística, mensajería y asesoría personalizada para facilitar la interacción entre compradores y vendedores. Nuestro compromiso es brindar un servicio seguro, rápido y confiable, impulsando el crecimiento económico en la región.`;
          const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [
                { role: "system", content: `Eres un asistente AI experto en Contraentrega. ${companyInfo}` },
                { role: "user", content: message }
              ]
            })
          });
          const apiResult = await apiResponse.json();
          const reply = apiResult.choices &&
                        apiResult.choices[0] &&
                        apiResult.choices[0].message &&
                        apiResult.choices[0].message.content
                        ? apiResult.choices[0].message.content.trim()
                        : "Lo siento, no pude obtener una respuesta.";
          return new Response(JSON.stringify({ reply }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ reply: "Error al procesar el mensaje: " + err.toString() }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // =====================================================
      // 2. ENDPOINT TTS: POST /tts
      // =====================================================
      if (url.pathname === '/tts' && request.method === 'POST') {
        try {
          const { text } = await request.json();
          const ttsResponse = await fetch('https://api.yourttsprovider.com/v1/synthesize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TTS_API_KEY}`
            },
            body: JSON.stringify({
              text: text,
              voice: 'es-ES-Standard-A',
              format: 'mp3'
            })
          });
          const audioArrayBuffer = await ttsResponse.arrayBuffer();
          return new Response(audioArrayBuffer, {
            headers: { 'Content-Type': 'audio/mpeg' }
          });
        } catch (err) {
          return new Response('Error en TTS: ' + err.toString(), { status: 500 });
        }
      }
      
      // =====================================================
      // 3. API DE PRODUCTOS
      // - GET /api/products para listar todos los productos  
      // - GET /api/products/[productid] para un producto individual
      // =====================================================
      if (url.pathname === '/api/products' && request.method === 'GET') {
        let products = await env.PRODUCTS_KV.get("all_products", { type: "json" });
        if (!products) {
          const result = await env.DB.prepare("SELECT * FROM products").all();
          if (!result || !result.results) {
            return new Response(JSON.stringify({ error: "No se encontraron productos" }), {
              status: 404,
              headers: { "Content-Type": "application/json" }
            });
          }
          products = result.results;
          await env.PRODUCTS_KV.put("all_products", JSON.stringify(products));
        }
        // Agregar URL de imagen y mostrar stock
        products = products.map(product => ({
          ...product,
          imageUrl: R2_BASE_URL + product.image
        }));
        return new Response(JSON.stringify(products), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      if (url.pathname.startsWith('/api/products/')) {
        const parts = url.pathname.split('/');
        const productIdClean = parts[parts.length - 1]; // Ej.: "campoalegrecali"
        const productId = "@" + productIdClean;
        let product = await env.PRODUCTS_KV.get(productId, { type: "json" });
        if (!product) {
          const result = await env.DB.prepare("SELECT * FROM products WHERE id = ?")
                                   .bind(productId)
                                   .first();
          if (!result) {
            return new Response(JSON.stringify({ error: "Producto no encontrado" }), {
              status: 404,
              headers: { "Content-Type": "application/json" }
            });
          }
          product = result;
          await env.PRODUCTS_KV.put(productId, JSON.stringify(product));
        }
        product.imageUrl = R2_BASE_URL + product.image;
        return new Response(JSON.stringify(product), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // =====================================================
      // 4. PÁGINA DE PRODUCTO INDIVIDUAL (HTML)
      // - Ruta: /tiendadonjavier/[productid]
      // =====================================================
      if (url.pathname.startsWith('/tiendadonjavier/')) {
        const parts = url.pathname.split('/');
        const productIdClean = parts[2];
        const productId = "@" + productIdClean;
        let product = await env.PRODUCTS_KV.get(productId, { type: "json" });
        if (!product) {
          const result = await env.DB.prepare("SELECT * FROM products WHERE id = ?")
                                   .bind(productId)
                                   .first();
          if (!result) {
            return new Response("Producto no encontrado", { status: 404 });
          }
          product = result;
          await env.PRODUCTS_KV.put(productId, JSON.stringify(product));
        }
        const imageUrl = R2_BASE_URL + product.image;
        const productPageHTML = `
          <!DOCTYPE html>
          <html lang="es">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${product.name} - Contraentrega</title>
              <style>
                  body { font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; }
                  .product-container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); text-align: center; }
                  img { max-width: 100%; height: auto; }
                  .back-link { margin-top: 20px; display: inline-block; text-decoration: none; color: blue; }
                  
              </style>
          </head>
          <body>
              <div class="product-container">
                  <h1>${product.name}</h1>
                  <img src="${imageUrl}" alt="${product.name}" />
                  <p><strong>ID:</strong> ${product.id}</p>
                  <p><strong>Precio:</strong> $${parseInt(product.price).toLocaleString()} COP</p>
                  <p><strong>Stock:</strong> ${product.stock}</p>
                  <a class="back-link" href="/">Volver a la tienda</a>
              </div>
          </body>
          </html>
        `;
        return new Response(productPageHTML, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      // =====================================================
      // 5. OPERACIONES ADMINISTRATIVAS VIA INLINE (actualización)
      // Se reutilizan los endpoints /admin/update, etc., definidos a continuación.
      // =====================================================
      // (En este ejemplo, los endpoints para agregar, actualizar y eliminar se definen en la sección 7)
      
      // =====================================================
      // 6. PÁGINA PRINCIPAL CON INVENTARIO EDITABLE INLINE
      // La página se genera en función de si el usuario está autenticado como admin.
      let isAdmin = false;
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          await verifyJWT(authHeader.substring("Bearer ".length), ADMIN_JWT_SECRET);
          isAdmin = true;
        } catch (e) {
          isAdmin = false;
        }
      }
      
      // ... (todo el código previo de los endpoints /chat, /tts, /api/products, etc.)

// =====================================================
// 7. ENDPOINTS ADMINISTRATIVOS (agregar, actualizar, eliminar)
// =====================================================

// Agregar Producto: POST /admin/add
if (url.pathname === '/admin/add' && request.method === 'POST') {
  try {
    const data = await request.json();
    await env.DB.prepare("INSERT INTO products (id, name, price, stock, image) VALUES (?, ?, ?, ?, ?)")
      .bind(data.id, data.name, data.price, data.stock, data.image)
      .run();
    await env.PRODUCTS_KV.delete("all_products");
    await env.PRODUCTS_KV.put(data.id, JSON.stringify(data));
    return new Response(JSON.stringify({ success: true, message: "Producto agregado exitosamente" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Actualizar Producto: POST /admin/update
if (url.pathname === '/admin/update' && request.method === 'POST') {
  try {
    const data = await request.json();
    await env.DB.prepare("UPDATE products SET name = ?, price = ?, stock = ?, image = ? WHERE id = ?")
      .bind(data.name, data.price, data.stock, data.image, data.id)
      .run();
    await env.PRODUCTS_KV.delete("all_products");
    await env.PRODUCTS_KV.put(data.id, JSON.stringify(data));
    return new Response(JSON.stringify({ success: true, message: "Producto actualizado exitosamente" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Eliminar Producto: POST /admin/delete
if (url.pathname === '/admin/delete' && request.method === 'POST') {
  try {
    const data = await request.json();
    await env.DB.prepare("DELETE FROM products WHERE id = ?")
      .bind(data.id)
      .run();
    await env.PRODUCTS_KV.delete("all_products");
    await env.PRODUCTS_KV.delete(data.id);
    return new Response(JSON.stringify({ success: true, message: "Producto eliminado exitosamente" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Dentro del bloque try, antes de la página HTML
// =====================================================
// 9. ENDPOINTS DE AUTENTICACIÓN ADMIN
// =====================================================
if (url.pathname === '/admin/login' && request.method === 'POST') {
  const { username, password, cf_captcha } = await request.json();
  
  // 1. Validar CAPTCHA de Cloudflare Turnstile
  const captchaResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET,
      response: cf_captcha
    })
  });
  const captchaData = await captchaResult.json();
  if (!captchaData.success) return new Response('CAPTCHA inválido', { status: 401 });

  // 2. Validar credenciales (ejemplo básico, ajustar según tu configuración)
  if (username === env.ADMIN_USER && password === env.ADMIN_PASSWORD) {
    // Generar JWT
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { 
      sub: "admin",
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hora
    };
    
    const headerB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const signature = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey( // Paréntesis correctamente cerrados
        "raw", 
        new TextEncoder().encode(ADMIN_JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" }, // Algoritmo
        false, // extractable
        ["sign"] // keyUsages
    ), 
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
);
    
    const token = `${headerB64}.${payloadB64}.${arrayBufferToBase64Url(signature)}`;
    
    return new Response(JSON.stringify({ token }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response('Credenciales inválidas', { status: 401 });
}

if (url.pathname === '/admin/me' && request.method === 'GET') {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return new Response('No autorizado', { status: 401 });
    
    const token = authHeader.split(' ')[1];
    const payload = await verifyJWT(token, ADMIN_JWT_SECRET);
    return new Response(JSON.stringify(payload), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (e) {
    return new Response('Token inválido', { status: 401 });
  }
}

// =====================================================
// 8. PÁGINA HTML PRINCIPAL (debe ser el ÚLTIMO return)
// =====================================================
const htmlContent = `
       <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Worldwide Logistics Services.">
    <meta name="keywords" content="armenia quindio, compra, venta, clasificados, productos, Colombia, Contraentrega">
    <meta name="robots" content="index, follow">
    <meta name="author" content="Contraentrega">
    <meta property="og:title" content="@armeniaquindio - Compra y venta en Armenia Quindío">
    <meta property="og:description" content="Compra y venta en Armenia Quindío, Colombia. Publica tus productos en Contraentrega.">
    <meta property="og:image" content="URL-de-tu-imagen">
    <meta property="og:url" content="https://www.contraentregaco.com">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="@armeniaquindio - Compra y venta en Armenia Quindío">
    <meta name="twitter:description" content="Compra y venta en Armenia Quindío, Colombia. Publica tus productos en Contraentrega.">
    <meta name="twitter:image" content="URL-de-tu-imagen">
    <meta name="twitter:url" content="https://www.contraentregaco.com">
    <meta name="google-site-verification" content="your-verification-code" />
    <!-- Facebook Pixel (opcional) -->
    <script>
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', 'your-pixel-id');
        fbq('track', 'PageView');
    </script>
    <noscript>
        <img height="1" width="1" style="display:none"
        src="https://www.facebook.com/tr?id=your-pixel-id&ev=PageView&noscript=1"/>
    </noscript>
    <title>@armeniaquindio - Compra y venta en Armenia Quindío</title>
    <!-- Schema.org -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "https://www.contraentregaco.com",
      "name": "@armeniaquindio",
      "description": "Compra y venta en Armenia Quindío, Colombia. Publica tus productos en Contraentrega.",
      "publisher": {
          "@type": "Organization",
          "name": "Contraentrega Armenia Quindío"
      }
    }
    </script>
    <!-- Favicon -->
    <link rel="icon" href="URL-del-favicon" type="image/png">
    <!-- Google Analytics (opcional) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_TRACKING_ID"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'YOUR_TRACKING_ID');
    </script>
    <style>
      /* Estilos generales */
      body {
          font-family: Arial, sans-serif;
          background-color: #f1f1f1;
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          text-align: center;
      }
      .container {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          width: 90%;
          max-width: 600px;
          padding: 20px;
          overflow-y: auto;
          max-height: 80vh;
          margin: 20px;
      }
      h1, h2 { color: #333; margin-bottom: 10px; }
      p { color: #666; margin-bottom: 20px; }
      .buttons a, .buttons button {
          display: block;
          background-color: #000;
          color: white;
          padding: 10px;
          margin: 5px 0;
          text-decoration: none;
          border: none;
          border-radius: 5px;
          font-size: 1em;
          transition: background-color 0.3s;
          cursor: pointer;
      }
      .buttons a:hover, .buttons button:hover { background-color: #333; }
      .footer { font-size: 0.9em; color: #777; margin-top: 20px; }
      form { margin-top: 20px; text-align: left; margin-bottom: 20px; }
      input[type="text"], input[type="number"], textarea, select {
          width: 100%; padding: 10px; margin: 10px 0;
          border: 1px solid #ccc; border-radius: 5px;
      }
      button { width: 100%; margin: 5px 0; }
      table { width: 100%; margin-top: 30px; border-collapse: collapse; }
      th, td { padding: 10px; text-align: left; border: 1px solid #ccc; }
      th { background-color: #f4f4f4; }
      td { background-color: #fafafa; }
      .total { font-size: 1.5em; font-weight: bold; margin: 20px 0; color: #333; }
      .search-container { margin: 20px 0; }
      .search-container input {
          width: 100%; padding: 10px;
          border: 1px solid #ccc; border-radius: 5px;
      }
      .radio-group {
          display: flex; gap: 10px; margin: 10px 0;
      }
      .radio-group label {
          display: flex; align-items: center; gap: 5px;
      }
      /* Modal para imagen */
      .modal {
          display: none;
          position: fixed;
          z-index: 1000;
          left: 0; top: 0;
          width: 100%; height: 100%;
          overflow: auto;
          background-color: rgba(0,0,0,0.7);
          padding-top: 60px;
      }
      .modal-content {
          margin: auto;
          display: block;
          width: 80%;
          max-width: 700px;
      }
      .close {
          position: absolute;
          top: 30px; right: 35px;
          color: #f1f1f1;
          font-size: 40px;
          font-weight: bold;
          transition: 0.3s;
      }
      .close:hover, .close:focus {
          color: #bbb;
          text-decoration: none;
          cursor: pointer;
      }
      @media screen and (max-width: 700px) {
          .modal-content { width: 100%; }
      }
      /* Estilos para el Chatbot AI */
      #chatbot-btn {
          display: block;
          background-color: #000;
          color: #fff;
          border: none;
          padding: 10px 15px;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 10px;
          width: 100%;
      }
      #chatbot {
          display: none;
          background-color: #fff;
          border: 1px solid #ccc;
          border-radius: 5px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          margin-top: 10px;
          padding: 10px;
          text-align: left;
          width: 100%;
          max-width: 600px;
      }
      #chatbot-header {
          background-color: #000;
          color: #fff;
          padding: 10px;
          border-top-left-radius: 5px;
          border-top-right-radius: 5px;
      }
      #chatbot-messages {
          height: 300px;
          overflow-y: auto;
          margin: 10px 0;
          padding: 10px;
          background-color: #f9f9f9;
          border: 1px solid #ccc;
          border-radius: 3px;
      }
      #chatbot-input {
          display: block;
          padding: 10px;
          border-top: 1px solid #ccc;
      }
      #chatbot-input input {
          width: 100%;
          padding: 10px;
          font-size: 16px;
          margin-bottom: 10px;
          box-sizing: border-box;
      }
      #chatbot-input button {
          width: 100%;
          background-color: #000;
          color: #fff;
          border: none;
          padding: 10px;
          cursor: pointer;
          font-size: 16px;
      }
      /* Estilos para el panel de Llamada */
      #call-btn {
          display: block;
          background-color: #000000;
          color: #fff;
          border: none;
          padding: 10px 15px;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 10px;
          width: 100%;
      }
      #call-panel {
          display: none;
          background-color: #fff;
          border: 1px solid #ccc;
          border-radius: 5px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          margin-top: 10px;
          padding: 10px;
          text-align: left;
          width: 100%;
          max-width: 600px;
      }
      #call-header {
          background-color: #000000;
          color: #fff;
          padding: 10px;
          border-top-left-radius: 5px;
          border-top-right-radius: 5px;
      }
      #call-messages {
          height: 200px;
          overflow-y: auto;
          margin: 10px 0;
          padding: 10px;
          background-color: #f9f9f9;
          border: 1px solid #ccc;
          border-radius: 3px;
      }
      #call-controls button {
          display: block;
          width: 100%;
          padding: 10px;
          margin: 5px 0;
          border: none;
          background-color: #000000;
          color: #fff;
          cursor: pointer;
          font-size: 16px;
          border-radius: 5px;
      }
      /* Agregar al final de la sección de estilos */
#admin-controls {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #ddd;
}

#admin-login input {
  display: block;
  margin: 5px 0;
  padding: 8px;
  width: 100%;
}

.admin-btn {
  display: none;
  background: #dc3545;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 5px;
}

#chatbot, #call-panel {
  border: 1px solid #ccc;
  border-radius: 8px;
  margin-top: 10px;
  padding: 10px;
}
    </style>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  </head>
  <body>
    <div class="container">
      <header>
          <h1>Contraentrega</h1>
          <p>Socio ID: @montebellocali</p>
          <p>Dirección: Corregimiemto Montebello Cali, Valle del Cauca, Colombia</p>
          <p>Horarios: Lunes a Viernes | 08:00 - 18:00</p>
      </header>
      <!-- Botones de contacto -->
      <div class="buttons">
          <a href="tel:+573215340988" id="llamar-btn">Llamar</a>
          <a href="https://wa.me/573215340988" target="_blank" id="mensaje-btn">Whatsapp</a>
          <!-- Botón del Chatbot AI -->
          <button id="chatbot-btn">Chat IA</button>
          <!-- Botón para Llamar Asistente -->
          <button id="call-btn">Llamar IA</button>
      </div>
      <!-- Panel del Chatbot AI -->
      <div id="chatbot">
          <div id="chatbot-header">
              Chatbot AI <span id="chatbot-close" style="float:right; cursor:pointer;">&times;</span>
          </div>
          <div id="chatbot-messages"></div>
          <div id="chatbot-input">
              <input type="text" id="chatbot-user-input" placeholder="Escribe un mensaje...">
              <button id="chatbot-send">Enviar</button>
          </div>
      </div>
      <!-- Panel de Llamada Asistente -->
      <div id="call-panel">
          <div id="call-header">
              Llamada Asistente <span id="call-close" style="float:right; cursor:pointer;">&times;</span>
          </div>
          <div id="call-messages"></div>
          <div id="call-controls">
              <button id="start-call">Iniciar Llamada</button>
              <button id="stop-call" style="display:none;">Finalizar Llamada</button>
          </div>
      </div>
      <section>
          <!-- Buscador -->
          <div class="search-container">
              <input type="text" id="search-input" placeholder="Buscar socios por nombre, categorías o información...">
          </div>
          
          <div class="cf-turnstile" data-sitekey="TU_SITE_KEY_AQUI"></div>
          
          <!-- Agregar antes del footer -->
<div id="admin-controls" style="margin: 20px 0;">
  <button onclick="toggleAdminLogin()">Acceso Administrador</button>
  <div id="admin-login" style="display: none; margin-top: 10px;">
  <input type="text" id="admin-user" placeholder="Usuario">
  <input type="password" id="admin-pass" placeholder="Contraseña">
  
  <!-- AGREGA ESTE WIDGET TURNSTILE -->
  <div class="cf-turnstile" 
       data-sitekey="tu-site-key" 
       data-callback="onTurnstileSuccess"
       style="margin: 10px 0;">
  </div>
  
  <button onclick="adminLogin()">Ingresar</button>
</div>

          <!-- Socios (Inventario) -->
          <section>
              <h2>Socios</h2>
              <table border="1">
                  <thead>
                      <tr>
                          <th>Imagen</th>
                          <th>Nombre</th>
                          <th>Contacto</th>
                          <th>Ajustar Cantidad</th>
                          <th>Precio Unitario</th>
                          <th>Disponibilidad</th>
                      </tr>
                  </thead>
                  <tbody id="inventario">
                      <!-- Los socios se cargarán dinámicamente -->
                  </tbody>
              </table>
          </section>
          <!-- Checkout -->
          <section>
              <h2>Checkout</h2>
              <h3>Selecciona el método de entrega</h3>
              <div class="radio-group">
                  <label>
                      <input type="radio" name="delivery-method" value="pickup" checked> Recoger en el punto
                  </label>
                  <label>
                      <input type="radio" name="delivery-method" value="delivery"> Servicio a domicilio
                  </label>
              </div>
              <div class="total">
                  Total a pagar: <span id="total-pagar">$0 COP</span>
              </div>
              <h3>Método de pago</h3>
              <div class="buttons">
                  <button type="button" id="connect-nostr">Conectar con Nostr Wallet Connect</button>
                  <button type="button" id="pay-lightning">Pagar con Lightning</button>
              </div>
              <form id="checkout-form" style="display: none;">
                  <h3>Información de envío</h3>
                  <input type="text" name="name" placeholder="Nombre completo" required>
                  <input type="email" name="email" placeholder="Correo electrónico" required>
                  <input type="text" name="address" placeholder="Dirección de envío" required>
                  <input type="text" name="city" placeholder="Ciudad" required>
                  <input type="text" name="state" placeholder="Departamento" required>
                  <input type="text" name="zip" placeholder="Código postal" required>
                  <select name="shipping-method" required>
                      <option value="" disabled selected>Selecciona un método de envío</option>
                      <option value="standard">Envío estándar (5-7 días)</option>
                      <option value="express">Envío express (1-2 días)</option>
                  </select>
              </form>
          </section>
          
          <!-- Añadir después del header principal -->
<div id="admin-login" style="display: none; margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
    <h3>Acceso Administrativo</h3>
    <form id="admin-login-form">
        <input type="text" id="admin-user" placeholder="Usuario" required>
        <input type="password" id="admin-pass" placeholder="Contraseña" required>
        <div class="cf-turnstile" data-sitekey="tu-site-key"></div>
        <button type="submit">Ingresar</button>
    </form>
</div>

<div id="admin-panel" style="display: none;">
    <h3>Acciones Administrativas</h3>
    <button onclick="showAddProductForm()">➕ Nuevo Producto</button>
    
    <div id="add-product-form" style="display: none; margin-top: 20px;">
        <input type="text" id="new-product-id" placeholder="ID del producto">
        <input type="text" id="new-product-name" placeholder="Nombre">
        <input type="number" id="new-product-price" placeholder="Precio">
        <input type="number" id="new-product-stock" placeholder="Stock">
        <input type="text" id="new-product-image" placeholder="Imagen (nombre archivo)">
        <button onclick="addProduct()">Guardar Producto</button>
    </div>
</div>

          <!-- Footer -->
          <footer class="footer">
              <p>&copy; 2025 Contraentrega - Todos los derechos reservados</p>
              <p>
                  <a href="https://app.contraentregaco.com/pages/calivalle" class="clickable">Políticas de la empresa</a> | 
                  <a href="https://www.contraentregaco.com/exchange" class="clickable">Recargar saldo lightning con COP</a>
              </p>
          </footer>
      </section>
      <!-- Modal para mostrar la imagen en grande -->
      <div id="image-modal" class="modal">
          <span class="close">&times;</span>
          <img class="modal-content" id="modal-image">
      </div>
    </div>
    <script>
            // Si el usuario es admin, se espera que el token JWT se almacene en localStorage (por ejemplo, tras login)
            window.isAdmin = ${isAdmin};

            async function cargarInventario() {
                try {
                    const response = await fetch('/api/products');
                    if (!response.ok) throw new Error('Error al obtener los productos');
                    const productos = await response.json();
                    const tbody = document.getElementById("inventario").querySelector("tbody");
                    tbody.innerHTML = "";
                    productos.forEach(producto => {
                        const productIdClean = producto.id.replace('@','');
                        const productoUrl = "https://campoalegrecali.contraentregaco.com/tiendadonjavier/" + productIdClean;
                        const fila = document.createElement("tr");
                        // Imagen
                        const celdaImagen = document.createElement("td");
                        celdaImagen.innerHTML = '<a href="#" class="ver-imagen" data-imagen="' + producto.imageUrl + '">ver</a>';
                        fila.appendChild(celdaImagen);
                        // ID
                        const celdaId = document.createElement("td");
                        celdaId.innerHTML = '<a href="' + productoUrl + '" target="_blank">' + producto.id + '</a>';
                        fila.appendChild(celdaId);
                        // Nombre (editable si admin)
                        const celdaNombre = document.createElement("td");
                        celdaNombre.textContent = producto.name;
                        if(window.isAdmin) { celdaNombre.contentEditable = true; }
                        fila.appendChild(celdaNombre);
                        // Ajustar Cantidad para compra (se mantiene)
                        const celdaCantidad = document.createElement("td");
                        celdaCantidad.innerHTML = '<button class="adjust-quantity" data-product="' + producto.id + '" data-action="decrease">-</button>' +
                                                  '<span id="cantidad-' + producto.id + '">0</span>' +
                                                  '<button class="adjust-quantity" data-product="' + producto.id + '" data-action="increase">+</button>';
                        fila.appendChild(celdaCantidad);
                        // Precio (editable)
                        const celdaPrecio = document.createElement("td");
                        celdaPrecio.textContent = '$' + parseInt(producto.price).toLocaleString() + ' COP';
                        if(window.isAdmin) { celdaPrecio.contentEditable = true; }
                        fila.appendChild(celdaPrecio);
                        // Stock (editable)
                        const celdaStock = document.createElement("td");
                        celdaStock.textContent = producto.stock;
                        if(window.isAdmin) { celdaStock.contentEditable = true; }
                        fila.appendChild(celdaStock);
                        // Acciones (solo para admin)
                        if(window.isAdmin) {
                          const celdaAcciones = document.createElement("td");
                          const btnEditar = document.createElement("button");
                          btnEditar.textContent = "Editar";
                          btnEditar.addEventListener("click", async function(){
                            const nuevoNombre = celdaNombre.textContent.trim();
                            const nuevoPrecioStr = celdaPrecio.textContent.replace(/[^0-9]/g, "");
                            const nuevoPrecio = parseInt(nuevoPrecioStr);
                            const nuevoStockStr = celdaStock.textContent.replace(/[^0-9]/g, "");
                            const nuevoStock = parseInt(nuevoStockStr);
                            const data = {
                              id: producto.id,
                              name: nuevoNombre,
                              price: nuevoPrecio,
                              stock: nuevoStock,
                              image: producto.imageUrl.replace("${R2_BASE_URL}", "")
                            };
                            const token = localStorage.getItem("adminToken") || "";
                            const res = await fetch('/admin/update', {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json', 
                                'Authorization': 'Bearer ' + token
                              },
                              body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            alert(result.message || result.error);
                            cargarInventario();
                          });
                          celdaAcciones.appendChild(btnEditar);
                          fila.appendChild(celdaAcciones);
                        }
                        tbody.appendChild(fila);
                    });
                    asignarEventosBotones();
                } catch (err) {
                    console.error(err);
                }
            }

            function asignarEventosBotones() {
                document.querySelectorAll(".adjust-quantity").forEach(button => {
                    button.addEventListener("click", (event) => {
                        const productId = event.target.dataset.product;
                        const action = event.target.dataset.action;
                        const cantidadElem = document.getElementById('cantidad-' + productId);
                        let current = parseInt(cantidadElem.innerText) || 0;
                        if (action === "increase") current++;
                        else if (action === "decrease" && current > 0) current--;
                        cantidadElem.innerText = current;
                    });
                });
            }
            
            // Resto del código existente para inventario y checkout
      let cart = {}; 
      let totalQuantity = 0; 
      let totalAmount = 0;
      const dominioPrincipal = "contraentregaco.com";
      const productosAPI = [
          {
              id: "@campoalegrecali",
              nombre: "3215970535",
              precio: 10000,
              disponible: true,
              imagen: "https://via.placeholder.com/300",
              url: "https://" + "campoalegrecali" + "." + dominioPrincipal
          },
          {
              id: "@ejemplo1",
              nombre: "Contacto Ejemplo 1",
              precio: 12000,
              disponible: true,
              imagen: "https://via.placeholder.com/300",
              url: "https://" + "ejemplo1" + "." + dominioPrincipal
          },
          {
              id: "@ejemplo2",
              nombre: "Contacto Ejemplo 2",
              precio: 15000,
              disponible: true,
              imagen: "https://via.placeholder.com/300",
              url: "https://" + "ejemplo2" + "." + dominioPrincipal
          }
      ];
      
      function calcularTotal() {
          totalAmount = 0;
          productosAPI.forEach(producto => {
              if (cart[producto.id]) {
                  totalAmount += producto.precio * cart[producto.id];
              }
          });
          document.getElementById('total-pagar').innerText = '$' + totalAmount.toLocaleString() + ' COP';
      }
      
      function validarFormulario() {
          const form = document.getElementById('checkout-form');
          const inputs = form.querySelectorAll('input, select');
          let valido = true;
          inputs.forEach(input => {
              if (!input.value.trim()) {
                  valido = false;
                  input.style.border = '1px solid red';
              } else {
                  input.style.border = '1px solid #ccc';
              }
          });
          return valido;
      }
      
      function pagarConLightning() {
          if (document.querySelector('input[name="delivery-method"]:checked').value === 'delivery' && !validarFormulario()) {
              alert('Por favor, completa todos los campos del formulario de envío.');
              return;
          }
          const total = totalAmount;
          fetch('https://<YOUR_LNBITS_INSTANCE>/api/v1/payments', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Api-Key': 'YOUR_LNBITS_API_KEY'
              },
              body: JSON.stringify({
                  out: false,
                  amount: total,
                  memo: 'Pago desde @bodegascali'
              })
          })
          .then(response => response.json())
          .then(data => {
              if (data.payment_request) {
                  alert('Escanea este código QR para pagar: ' + data.payment_request);
                  if (nostrPubkey) {
                      signAndPublishPaymentEvent(data.payment_request);
                  }
              } else {
                  alert('Error al generar la factura Lightning.');
              }
          })
          .catch(error => {
              console.error('Error:', error);
              alert('Error al conectar con el servidor de pagos.');
          });
      }
      
      // Corrección en connectNostrWallet() (cliente)
async function connectNostrWallet() {
  if (window.nostr) { // Verificar existencia primero
    try {
      nostrPubkey = await window.nostr.getPublicKey();
      alert("Conectado con Nostr Wallet. Tu clave pública: " + nostrPubkey);
    } catch (error) {
      console.error(error);
      alert("Error conectando con Nostr Wallet.");
    }
  } else {
    alert("Nostr Wallet no encontrada. Instala una extensión compatible.");
    // Opcional: Redirigir a tutorial de instalación
  }
}
      
      async function signAndPublishPaymentEvent(invoice) {
          const event = {
              kind: 30000,
              pubkey: nostrPubkey,
              created_at: Math.floor(Date.now() / 1000),
              tags: [['payment', invoice]],
              content: 'Pago realizado a través de Lightning Network'
          };
          if (window.nostr && window.nostr.signEvent && window.nostr.publish) {
              try {
                  const signedEvent = await window.nostr.signEvent(event);
                  await window.nostr.publish(signedEvent);
                  alert('Evento de pago publicado en Nostr.');
              } catch (err) {
                  console.error('Error al firmar/publicar el evento:', err);
                  alert('Error al publicar el evento en Nostr.');
              }
          } else {
              console.log('No se pudieron firmar/publicar eventos con Nostr.');
          }
      }
      
      function filtrarProductos(query) {
          const tbody = document.getElementById("inventario");
          const filas = tbody.getElementsByTagName("tr");
          for (let fila of filas) {
              const nombre = fila.getElementsByTagName("td")[1].innerText.toLowerCase();
              const contacto = fila.getElementsByTagName("td")[2].innerText.toLowerCase();
              if (nombre.includes(query) || contacto.includes(query)) {
                  fila.style.display = "";
              } else {
                  fila.style.display = "none";
              }
          }
      }
      
      // Agregar cerca de las funciones de pago existentes
let nostrPubkey = null;

async function connectNostrWallet() {
  if (window.nostr) {
    try {
      nostrPubkey = await window.nostr.getPublicKey();
      alert('Conectado: ' + nostrPubkey);
    } catch (error) {
      alert('Error conectando billetera');
    }
  } else {
    alert('Instala una extensión Nostr (ej. Alby)');
  }
}

async function pagarConLightning() {
  const response = await fetch('/crear-factura', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ monto: totalAmount })
  });
  
  if(response.ok) {
    const { payment_request } = await response.json();
    alert('Escanea este QR: ' + payment_request);
  } else {
    alert('Error generando factura');
  }
}

// Agregar después de las funciones de pago
function toggleAdminLogin() {
  const loginDiv = document.getElementById('admin-login');
  loginDiv.style.display = loginDiv.style.display === 'none' ? 'block' : 'none';
}

async function adminLogin() {
  const response = await fetch('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('admin-user').value,
      password: document.getElementById('admin-pass').value,
      cf_captcha: document.querySelector('.cf-turnstile').value
    })
  });
  
  if (response.ok) {
    const { token } = await response.json();
    localStorage.setItem('admin-token', token);
    enableAdminFeatures();
  }
}

function enableAdminFeatures() {
  // Hacer campos editables
  document.querySelectorAll('.editable').forEach(el => {
    el.contentEditable = true;
  });
  
  // Mostrar botones de admin
  document.querySelectorAll('.admin-btn').forEach(btn => {
    btn.style.display = 'inline-block';
  });
  
  // Actualizar inventario
  cargarInventario();
}
      
      function cargarInventario() {
  const tbody = document.getElementById("inventario");
  tbody.innerHTML = "";
  // URL base fija para la tienda
  const tiendaBaseUrl = "https://campoalegrecali.contraentregaco.com/tiendadonjavier";
  
  productosAPI.forEach(producto => {
    // Eliminamos el carácter "@" del id para la URL final
    const productoIdClean = producto.id.replace('@', '');
    // Construimos la URL completa para el producto
    const productoUrl = tiendaBaseUrl + "/" + productoIdClean;
    
    const fila = document.createElement("tr");
    fila.innerHTML = 
      '<td><a href="#" class="ver-imagen" data-imagen="' + producto.imagen + '">ver</a></td>' +
      '<td><a href="' + productoUrl + '" target="_blank">' + producto.id + '</a></td>' +
      '<td>' + producto.nombre + '</td>' +
      '<td>' +
          '<button class="adjust-quantity" data-product="' + producto.id + '" data-action="decrease">-</button>' +
          '<span id="cantidad-' + producto.id + '">0</span>' +
          '<button class="adjust-quantity" data-product="' + producto.id + '" data-action="increase">+</button>' +
      '</td>' +
      '<td>$' + producto.precio.toLocaleString() + ' COP</td>' +
      '<td>' + (producto.disponible ? "Disponible" : "Agotado") + '</td>';
      
    tbody.appendChild(fila);
  });
  asignarEventosBotones();
}
      
      function asignarEventosBotones() {
          document.querySelectorAll(".adjust-quantity").forEach(button => {
              button.addEventListener("click", (event) => {
                  const productId = event.target.dataset.product;
                  const action = event.target.dataset.action;
                  if (!cart[productId]) {
                      cart[productId] = 0;
                  }
                  if (action === "increase") {
                      cart[productId]++;
                      totalQuantity++;
                  } else if (action === "decrease" && cart[productId] > 0) {
                      cart[productId]--;
                      totalQuantity--;
                  }
                  document.getElementById('cantidad-' + productId).innerText = cart[productId];
                  calcularTotal();
              });
          });
      }
      
      document.getElementById('search-input').addEventListener('input', (event) => {
          const query = event.target.value.toLowerCase();
          filtrarProductos(query);
      });
      
      document.querySelectorAll('input[name="delivery-method"]').forEach(radio => {
          radio.addEventListener('change', (event) => {
              const form = document.getElementById('checkout-form');
              form.style.display = event.target.value === 'delivery' ? 'block' : 'none';
          });
      });
      
      document.getElementById('pay-lightning').addEventListener('click', pagarConLightning);
      document.getElementById('connect-nostr').addEventListener('click', connectNostrWallet);
      
      document.addEventListener('click', function(e) {
          if (e.target && e.target.classList.contains('ver-imagen')) {
              e.preventDefault();
              const imageUrl = e.target.getAttribute('data-imagen');
              const modal = document.getElementById('image-modal');
              const modalImg = document.getElementById('modal-image');
              modal.style.display = "block";
              modalImg.src = imageUrl;
          }
      });
      
      document.getElementById('image-modal').addEventListener('click', function(e) {
          if (e.target.classList.contains('close') || e.target.id === 'image-modal') {
              this.style.display = "none";
          }
      });
      
      cargarInventario();
      
      // Agregar después de la función cargarInventario()
// Toggle Chatbot
document.getElementById('chatbot-btn').addEventListener('click', function() {
  const chatbot = document.getElementById('chatbot');
  chatbot.style.display = chatbot.style.display === 'none' ? 'block' : 'none';
});

// Toggle Llamada
document.getElementById('call-btn').addEventListener('click', function() {
  const panel = document.getElementById('call-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});
      
      // Funcionalidad del Chatbot AI
      document.getElementById('chatbot-btn').addEventListener('click', function() {
          var chatbot = document.getElementById('chatbot');
          chatbot.style.display = (chatbot.style.display === 'none' || chatbot.style.display === '') ? 'block' : 'none';
      });
      
      document.getElementById('chatbot-close').addEventListener('click', function() {
          document.getElementById('chatbot').style.display = 'none';
      });
      
      document.getElementById('chatbot-send').addEventListener('click', function() {
          var input = document.getElementById('chatbot-user-input');
          var message = input.value.trim();
          if (!message) return;
          var messagesContainer = document.getElementById('chatbot-messages');
          var userMessageDiv = document.createElement('div');
          userMessageDiv.textContent = 'Tú: ' + message;
          messagesContainer.appendChild(userMessageDiv);
          input.value = '';
          fetch('/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: message })
          })
          .then(response => response.json())
          .then(data => {
              var replyDiv = document.createElement('div');
              replyDiv.textContent = 'Chatbot: ' + data.reply;
              messagesContainer.appendChild(replyDiv);
          })
          .catch(err => {
              console.error(err);
              var errorDiv = document.createElement('div');
              errorDiv.textContent = 'Chatbot: Error al procesar el mensaje.';
              messagesContainer.appendChild(errorDiv);
          });
      });
      
      // Funcionalidad de Llamada Asistente usando Web Speech API y TTS premium
      document.getElementById('call-btn').addEventListener('click', function() {
          var callPanel = document.getElementById('call-panel');
          callPanel.style.display = (callPanel.style.display === 'none' || callPanel.style.display === '') ? 'block' : 'none';
      });
      
      document.getElementById('call-close').addEventListener('click', function() {
          document.getElementById('call-panel').style.display = 'none';
      });
      
      var recognition;
      if ('webkitSpeechRecognition' in window) {
         recognition = new webkitSpeechRecognition();
      } else if ('SpeechRecognition' in window) {
         recognition = new SpeechRecognition();
      }
      
      if (recognition) {
         recognition.continuous = false;
         recognition.lang = 'es-ES';
         recognition.interimResults = false;
         recognition.maxAlternatives = 1;
      
         recognition.onresult = function(event) {
            var transcript = event.results[0][0].transcript;
            var callMessages = document.getElementById('call-messages');
            var userMsg = document.createElement('div');
            userMsg.textContent = 'Tú: ' + transcript;
            callMessages.appendChild(userMsg);
            // Enviar el mensaje al endpoint /chat
            fetch('/chat', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ message: transcript })
            })
            .then(response => response.json())
            .then(data => {
                var replyMsg = document.createElement('div');
                replyMsg.textContent = 'Asistente: ' + data.reply;
                callMessages.appendChild(replyMsg);
                // Usar el endpoint /tts para obtener audio de alta calidad (TTS premium)
                fetch('/tts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: data.reply })
                })
                .then(response => response.blob())
                .then(blob => {
                   var audioUrl = URL.createObjectURL(blob);
                   var audio = new Audio(audioUrl);
                   audio.play();
                })
                .catch(err => {
                   console.error('Error en TTS:', err);
                   // Fallback: Web Speech Synthesis
                   var utterance = new SpeechSynthesisUtterance(data.reply);
                   utterance.lang = 'es-ES';
                   window.speechSynthesis.speak(utterance);
                });
            })
            .catch(err => {
                console.error(err);
                var errorMsg = document.createElement('div');
                errorMsg.textContent = 'Asistente: Error al procesar el mensaje.';
                callMessages.appendChild(errorMsg);
            });
         };
      
         recognition.onerror = function(event) {
            console.error('Error de reconocimiento de voz:', event.error);
         };
      } else {
         document.getElementById('call-btn').style.display = 'none';
      }
      
      document.getElementById('start-call').addEventListener('click', function() {
         if (recognition) {
             recognition.start();
             document.getElementById('start-call').style.display = 'none';
             document.getElementById('stop-call').style.display = 'block';
         }
      });
      
      document.getElementById('stop-call').addEventListener('click', function() {
         if (recognition) {
             recognition.stop();
             document.getElementById('stop-call').style.display = 'none';
             document.getElementById('start-call').style.display = 'block';
         }

            document.addEventListener('click', function(e) {
                if (e.target && e.target.classList.contains('ver-imagen')) {
                    e.preventDefault();
                    const imageUrl = e.target.getAttribute('data-imagen');
                    window.open(imageUrl, '_blank');
                }
            });

            cargarInventario();
            
            // Manejo de Login Admin
document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const response = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('admin-user').value,
            password: document.getElementById('admin-pass').value,
            cf_captcha: document.querySelector('[name=cf-turnstile-response]').value
        })
    });
    
    if (response.ok) {
        const { token } = await response.json();
        localStorage.setItem('admin-jwt', token);
        checkAdminStatus();
    } else {
        alert('Error de autenticación');
    }
});

// Verificar estado admin al cargar
async function checkAdminStatus() {
    const token = localStorage.getItem('admin-jwt');
    if (!token) return;
    
    try {
        const response = await fetch('/admin/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (response.ok) {
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            enableAdminFeatures();
        }
    } catch (err) {
        console.error('Error verificando admin:', err);
    }
}

function enableAdminFeatures() {
    // Hacer campos editables
    document.querySelectorAll('#inventario td:not(:first-child)').forEach(td => {
        td.contentEditable = true;
    });
    
    // Añadir botones de eliminar
    document.querySelectorAll('#inventario tr').forEach(row => {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.style.background = 'red';
        deleteBtn.onclick = () => deleteProduct(row.dataset.productId);
        row.appendChild(deleteBtn);
    });
}

async function deleteProduct(productId) {
    if (!confirm('¿Eliminar producto permanentemente?')) return;
    
    const response = await fetch('/admin/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('admin-jwt')
        },
        body: JSON.stringify({ id: productId })
    });
    
    if (response.ok) {
        cargarInventario();
    }
}

function showAddProductForm() {
    document.getElementById('add-product-form').style.display = 'block';
}

async function addProduct() {
    const newProduct = {
        id: '@' + document.getElementById('new-product-id').value,
        name: document.getElementById('new-product-name').value,
        price: document.getElementById('new-product-price').value,
        stock: document.getElementById('new-product-stock').value,
        image: document.getElementById('new-product-image').value
    };
    
    const response = await fetch('/admin/add', {
        method: 'POST',
        headers: { 
  'Content-Type': 'application/json', 
  'Authorization': 'Bearer ' + localStorage.getItem('admin-jwt')
},
        body: JSON.stringify(newProduct)
    });
    
    if (response.ok) {
        cargarInventario();
        document.getElementById('add-product-form').style.display = 'none';
    }
}

// Inicializar
checkAdminStatus();
          </script>
        </body>
        </html>
      `;
      return new Response(htmlContent, { headers: { 'Content-Type': 'text/html' }});

    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }
}; // Cierre final 