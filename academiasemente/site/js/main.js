/* ============================================
   ACADEMIA SEMENTE - Main Script
   ============================================ */

(function () {
  'use strict';

  // ---------- DOM refs ----------
  const announceBar = document.getElementById('announceBar');
  const siteHeader = document.getElementById('siteHeader');
  const hamburger = document.getElementById('hamburger');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerClose = document.getElementById('drawerClose');
  const enrollForm = document.getElementById('enrollForm');
  const contactForm = document.getElementById('contactForm');
  const yearEl = document.getElementById('year');
  const cartBtn = document.getElementById('cartBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartClose = document.getElementById('cartClose');
  const cartBody = document.getElementById('cartBody');
  const cartFooter = document.getElementById('cartFooter');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');
  const cartClear = document.getElementById('cartClear');
  const cartCheckout = document.getElementById('cartCheckout');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Header scroll ----------
  let lastScroll = 0;
  let ticking = false;

  function updateHeader() {
    if (!siteHeader) { ticking = false; return; }
    const scrollY = window.scrollY;
    var forceSolid = document.body.classList.contains('page-checkout');
    // Home + enrol: transparent over hero. Checkout: always solid.
    if (forceSolid || scrollY > 40) {
      siteHeader.classList.add('scrolled');
    } else {
      siteHeader.classList.remove('scrolled');
    }
    if (announceBar) {
      if (scrollY > 80 && scrollY > lastScroll) {
        announceBar.classList.add('hidden');
        siteHeader.style.top = '0';
      } else if (scrollY < 40 || !announceBar.classList.contains('hidden')) {
        // Keep header below announce bar whenever it is visible
        if (scrollY < 40) announceBar.classList.remove('hidden');
        if (!announceBar.classList.contains('hidden')) {
          siteHeader.style.top = '';
        }
      }
    }
    lastScroll = scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });

  // Initial state (important on enrol page so header is not stuck scrolled)
  updateHeader();

  // ---------- Mobile drawer ----------
  function openDrawer() {
    mobileDrawer.classList.add('open');
    drawerOverlay.classList.add('open');
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    mobileDrawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      if (mobileDrawer.classList.contains('open')) closeDrawer();
      else openDrawer();
    });
  }
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  document.querySelectorAll('.drawer-nav a').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (mobileDrawer && mobileDrawer.classList.contains('open')) closeDrawer();
      if (cartDrawer && cartDrawer.classList.contains('open')) closeCart();
    }
  });

  // ---------- Open WhatsApp helper ----------
  function openWhatsApp(message) {
    var url = 'https://wa.me/244945574700?text=' + encodeURIComponent(message);
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---------- Course prices (Kz / month) ----------
  var COURSE_PRICES = {
    Online: 10525,
    Presencial: 15225,
    Domiciliar: 100000,
    'Teste de nível': 0,
  };

  function formatEnrollPrice(n) {
    if (n === 0) return (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'Free' : 'Grátis';
    return n.toLocaleString('pt-AO') + ' Kz/mês';
  }

  function updateEnrollPrice() {
    var select = document.getElementById('interest');
    var valueEl = document.getElementById('enrollPriceValue');
    if (!select || !valueEl) return;
    var course = select.value;
    var amount = Object.prototype.hasOwnProperty.call(COURSE_PRICES, course)
      ? COURSE_PRICES[course]
      : null;
    valueEl.textContent = amount == null ? '—' : formatEnrollPrice(amount);
  }

  // ---------- Pre-select course from ?course= ----------
  (function preselectCourse() {
    var select = document.getElementById('interest');
    if (!select) return;
    var params = new URLSearchParams(window.location.search);
    var course = params.get('course');
    if (course) select.value = course;
    select.addEventListener('change', updateEnrollPrice);
    updateEnrollPrice();
  })();

  // ---------- Contact form → WhatsApp ----------
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameEl = document.getElementById('c-name');
      var phoneEl = document.getElementById('c-phone');
      var interestEl = document.getElementById('c-interest');
      var messageEl = document.getElementById('c-message');
      var name = nameEl ? nameEl.value.trim() : '';
      var phone = phoneEl ? phoneEl.value.trim() : '';
      var interest = interestEl ? interestEl.value : '';
      var message = messageEl ? messageEl.value.trim() : '';
      var text = 'Olá! Sou *' + name + '*.\n';
      text += 'Telefone: ' + phone + '\n';
      text += 'Assunto: ' + interest + '\n';
      if (message) text += '\nMensagem: ' + message;
      openWhatsApp(text);
    });
  }

  // ---------- Enrollment form → Admin API ----------
  if (enrollForm) {
    enrollForm.addEventListener('submit', function (e) {
      e.preventDefault();
      function val(id) {
        var el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
      }
      var errEl = document.getElementById('enrollError');
      var submitBtn = document.getElementById('enrollSubmitBtn');
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = '';
      }

      var name = val('name');
      var payload = {
        name: name,
        age: val('age'),
        marital: val('marital'),
        email: val('email'),
        phone: val('phone'),
        address: val('address'),
        province: val('province'),
        municipality: val('municipality'),
        course: val('interest'),
        level: val('level'),
        schedule: val('schedule'),
        payment_method: val('payment_method'),
        motivation: val('motivation'),
        difficulties: val('difficulties'),
        experience: val('experience'),
        topics: val('topics'),
        notes: val('message'),
      };

      var apiBase = (window.ACADEMIA_CONFIG && window.ACADEMIA_CONFIG.WORKER_URL) || '';
      apiBase = apiBase.replace(/\/$/, '');
      if (!apiBase) {
        if (errEl) {
          errEl.textContent = 'Serviço indisponível. Tente mais tarde ou contacte no WhatsApp.';
          errEl.hidden = false;
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      fetch(apiBase + '/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = {};
            try {
              data = text ? JSON.parse(text) : {};
            } catch (err) {
              data = { error: text || 'Erro do servidor' };
            }
            if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
            return data;
          });
        })
        .then(function () {
          showEnrollSuccess(name);
          enrollForm.reset();
          updateEnrollPrice();
        })
        .catch(function (err) {
          if (errEl) {
            errEl.textContent =
              err.message ||
              'Não foi possível enviar a inscrição. Verifique a ligação ou contacte no WhatsApp.';
            errEl.hidden = false;
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  function showEnrollSuccess(name) {
    var form = document.getElementById('enrollForm');
    var success = document.getElementById('enrollSuccess');
    var nameEl = document.getElementById('successName');
    var header = document.querySelector('#formulario .section-header');
    if (nameEl) nameEl.textContent = name || '';
    if (form) form.hidden = true;
    if (header) header.hidden = true;
    if (success) {
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- CART ----------
  // currentLang must exist before any updateCartUI() call (translations may still be pending)
  var currentLang = 'pt';
  let cart = JSON.parse(localStorage.getItem('as_cart') || '[]');

  function saveCart() {
    localStorage.setItem('as_cart', JSON.stringify(cart));
  }

  function formatPrice(n) {
    return n.toLocaleString('pt-AO') + ' Kz';
  }

  function getCartQty() {
    return cart.reduce(function (s, i) { return s + i.qty; }, 0);
  }

  function getCartTotal() {
    return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  }

  function getCartEmptyLabel() {
    try {
      if (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].cartEmpty) {
        return translations[currentLang].cartEmpty;
      }
    } catch (e) { /* ignore */ }
    return 'O seu carrinho está vazio.';
  }

  function updateCartUI() {
    var qty = getCartQty();
    if (cartCount) {
      cartCount.textContent = qty;
      cartCount.classList.toggle('visible', qty > 0);
    }
    if (!cartBody) return;

    if (cart.length === 0) {
      cartBody.innerHTML = '<p class="cart-empty">' + getCartEmptyLabel() + '</p>';
      if (cartFooter) {
        cartFooter.hidden = true;
        cartFooter.setAttribute('hidden', '');
      }
      if (cartTotal) cartTotal.textContent = formatPrice(0);
      return;
    }

    if (cartFooter) { cartFooter.hidden = false; cartFooter.removeAttribute('hidden'); }
    if (cartTotal) cartTotal.textContent = formatPrice(getCartTotal());

    cartBody.innerHTML = cart.map(function (item) {
      var label = (currentLang === 'en' && item.nameEn) ? item.nameEn : item.name;
      return '<div class="cart-item" data-id="' + item.id + '">' +
        '<div class="cart-item-info">' +
          '<div class="cart-item-name">' + label + '</div>' +
          '<div class="cart-item-price">' + formatPrice(item.price) + '</div>' +
          '<div class="cart-item-actions">' +
            '<button type="button" class="qty-btn qty-minus" data-id="' + item.id + '" aria-label="Diminuir">−</button>' +
            '<span class="qty-value">' + item.qty + '</span>' +
            '<button type="button" class="qty-btn qty-plus" data-id="' + item.id + '" aria-label="Aumentar">+</button>' +
            '<button type="button" class="cart-item-remove" data-id="' + item.id + '" aria-label="Remover">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    if (document.getElementById('checkoutItems')) renderCheckoutPage();
  }

  function addToCart(id, name, price, nameEn) {
    var existing = cart.find(function (i) { return i.id === id; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id: id, name: name, price: Number(price), qty: 1, nameEn: nameEn || name });
    }
    saveCart();
    updateCartUI();
    openCart();
  }

  function changeQty(id, delta) {
    var item = cart.find(function (i) { return i.id === id; });
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(function (i) { return i.id !== id; });
    saveCart();
    updateCartUI();
  }

  function removeItem(id) {
    cart = cart.filter(function (i) { return i.id !== id; });
    saveCart();
    updateCartUI();
  }

  function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
  }

  function openCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.add('open');
    if (cartOverlay) cartOverlay.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-open');
  }

  function closeCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('open');
    if (cartOverlay) cartOverlay.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-open');
  }

  if (cartBtn) cartBtn.addEventListener('click', openCart);
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  function goToCheckout() {
    if (cart.length === 0) return;
    closeCart();
    window.location.href = 'checkout.html';
  }

  var PRODUCT_IMAGES = {
    caderno: 'assets/products/caderno.jpg',
    polo: 'assets/products/polo-front.jpg',
    canetas: 'assets/products/canetas.jpg',
    manual: 'assets/products/manual.jpg'
  };

  function renderCheckoutPage() {
    var emptyEl = document.getElementById('checkoutEmpty');
    var gridEl = document.getElementById('checkoutGrid');
    var itemsEl = document.getElementById('checkoutItems');
    var totalEl = document.getElementById('checkoutTotal');
    if (!emptyEl || !gridEl || !itemsEl) return;

    if (cart.length === 0) {
      emptyEl.hidden = false;
      gridEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    gridEl.hidden = false;
    if (totalEl) totalEl.textContent = formatPrice(getCartTotal());

    itemsEl.innerHTML = cart.map(function (item) {
      var label = (currentLang === 'en' && item.nameEn) ? item.nameEn : item.name;
      var img = PRODUCT_IMAGES[item.id] || '';
      var line = formatPrice(item.price * item.qty);
      return '<div class="checkout-item" data-id="' + item.id + '">' +
        (img ? '<div class="checkout-item-img"><img src="' + img + '" alt="" loading="lazy"></div>' : '') +
        '<div class="checkout-item-info">' +
          '<div class="checkout-item-name">' + label + '</div>' +
          '<div class="checkout-item-meta">' + formatPrice(item.price) + ' × ' + item.qty + '</div>' +
        '</div>' +
        '<div class="checkout-item-line">' + line + '</div>' +
        '<div class="checkout-item-actions">' +
          '<button type="button" class="qty-btn qty-minus" data-id="' + item.id + '" aria-label="Diminuir">−</button>' +
          '<span class="qty-value">' + item.qty + '</span>' +
          '<button type="button" class="qty-btn qty-plus" data-id="' + item.id + '" aria-label="Aumentar">+</button>' +
          '<button type="button" class="cart-item-remove" data-id="' + item.id + '" aria-label="Remover">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // Hook qty changes on checkout page
  var checkoutItemsEl = document.getElementById('checkoutItems');
  if (checkoutItemsEl) {
    checkoutItemsEl.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var minus = t.closest('.qty-minus');
      if (minus) {
        e.preventDefault();
        changeQty(minus.getAttribute('data-id'), -1);
        renderCheckoutPage();
        return;
      }
      var plus = t.closest('.qty-plus');
      if (plus) {
        e.preventDefault();
        changeQty(plus.getAttribute('data-id'), 1);
        renderCheckoutPage();
        return;
      }
      var remove = t.closest('.cart-item-remove');
      if (remove) {
        e.preventDefault();
        removeItem(remove.getAttribute('data-id'));
        renderCheckoutPage();
      }
    });
  }

  var checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (cart.length === 0) return;
      var errEl = document.getElementById('checkoutError');
      var submitBtn = document.getElementById('checkoutSubmitBtn');
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = '';
      }

      var name = document.getElementById('co-name').value.trim();
      var phone = document.getElementById('co-phone').value.trim();
      var address = document.getElementById('co-address').value.trim();
      var province = document.getElementById('co-province').value;
      var municipality = document.getElementById('co-municipality').value.trim();
      var notesEl = document.getElementById('co-notes');
      var notes = notesEl ? notesEl.value.trim() : '';
      var paymentEl = document.getElementById('co-payment');
      var payment_method = paymentEl ? paymentEl.value : '';

      var orderItems = cart.map(function (item) {
        return {
          id: item.id,
          name: item.name,
          nameEn: item.nameEn,
          price: item.price,
          qty: item.qty,
        };
      });
      var orderTotal = getCartTotal();

      var apiBase = (window.ACADEMIA_CONFIG && window.ACADEMIA_CONFIG.WORKER_URL) || '';
      apiBase = apiBase.replace(/\/$/, '');
      if (!apiBase) {
        if (errEl) {
          errEl.textContent = 'Serviço indisponível. Tente mais tarde ou contacte no WhatsApp.';
          errEl.hidden = false;
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      fetch(apiBase + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          phone: phone,
          address: address,
          province: province,
          municipality: municipality,
          notes: notes,
          payment_method: payment_method,
          items: orderItems,
        }),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = {};
            try {
              data = text ? JSON.parse(text) : {};
            } catch (err) {
              data = { error: text || 'Erro do servidor' };
            }
            if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
            return data;
          });
        })
        .then(function () {
          clearCart();
          showOrderSuccess(name, orderItems, orderTotal);
        })
        .catch(function (err) {
          if (errEl) {
            errEl.textContent =
              err.message ||
              'Não foi possível enviar a encomenda. Verifique a ligação ou contacte no WhatsApp.';
            errEl.hidden = false;
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  function showOrderSuccess(name, items, total) {
    var grid = document.getElementById('checkoutGrid');
    var empty = document.getElementById('checkoutEmpty');
    var success = document.getElementById('orderSuccess');
    var nameEl = document.getElementById('orderSuccessName');
    var summaryEl = document.getElementById('orderSuccessSummary');
    var header = document.querySelector('#checkout .section-header');
    var form = document.getElementById('checkoutForm');
    if (nameEl) nameEl.textContent = name || '';
    if (summaryEl && items && items.length) {
      var lines = items.map(function (item) {
        var label = (currentLang === 'en' && item.nameEn) ? item.nameEn : item.name;
        return '<div class="order-success-line"><span>' + label + ' × ' + item.qty + '</span><span>' + formatPrice(item.price * item.qty) + '</span></div>';
      }).join('');
      lines += '<div class="order-success-line order-success-line--total"><span>' + (currentLang === 'en' ? 'Total' : 'Total') + '</span><strong>' + formatPrice(total) + '</strong></div>';
      summaryEl.innerHTML = lines;
    }
    if (grid) {
      grid.hidden = true;
      grid.setAttribute('hidden', '');
    }
    if (empty) {
      empty.hidden = true;
      empty.setAttribute('hidden', '');
    }
    if (header) {
      header.hidden = true;
      header.setAttribute('hidden', '');
    }
    if (form) form.setAttribute('hidden', '');
    if (success) {
      success.hidden = false;
      success.removeAttribute('hidden');
      // Replace view: jump to success as the main content
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, 0);
      }
      setTimeout(function () {
        success.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  if (document.body.classList.contains('page-checkout')) {
    renderCheckoutPage();
  }

  // Delegate all cart actions from the drawer (survives re-renders, works on SVG taps)
  if (cartDrawer) {
    cartDrawer.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      if (t.closest('#cartClear') || t.closest('.cart-clear')) {
        e.preventDefault();
        clearCart();
        return;
      }
      if (t.closest('#cartCheckout')) {
        e.preventDefault();
        goToCheckout();
        return;
      }
      var minus = t.closest('.qty-minus');
      if (minus) {
        e.preventDefault();
        changeQty(minus.getAttribute('data-id'), -1);
        return;
      }
      var plus = t.closest('.qty-plus');
      if (plus) {
        e.preventDefault();
        changeQty(plus.getAttribute('data-id'), 1);
        return;
      }
      var remove = t.closest('.cart-item-remove');
      if (remove) {
        e.preventDefault();
        removeItem(remove.getAttribute('data-id'));
        return;
      }
    });
  }

  document.querySelectorAll('.add-to-cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.product-card');
      if (!card) return;
      addToCart(card.dataset.id, card.dataset.name, card.dataset.price, card.dataset.nameEn);
    });
  });

  // Swipe right to close cart - ignore when starting on a button/link
  var touchStartX = 0;
  var touchCurrentX = 0;
  var isSwiping = false;
  var swipeArmed = false;

  if (cartDrawer) {
    cartDrawer.addEventListener('touchstart', function (e) {
      var el = e.target;
      if (el && el.closest && el.closest('button, a, input, select, textarea, .qty-btn, .cart-item-remove, .cart-clear, #cartCheckout, #cartClear, #cartClose')) {
        isSwiping = false;
        swipeArmed = false;
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchCurrentX = touchStartX;
      isSwiping = true;
      swipeArmed = false;
    }, { passive: true });

    cartDrawer.addEventListener('touchmove', function (e) {
      if (!isSwiping) return;
      touchCurrentX = e.touches[0].clientX;
      var diff = touchCurrentX - touchStartX;
      // Only start visual swipe after a threshold so taps still register as clicks
      if (diff > 12) {
        swipeArmed = true;
        cartDrawer.style.transform = 'translateX(' + diff + 'px)';
      }
    }, { passive: true });

    cartDrawer.addEventListener('touchend', function () {
      if (!isSwiping) return;
      isSwiping = false;
      var diff = touchCurrentX - touchStartX;
      cartDrawer.style.transform = '';
      if (swipeArmed && diff > 80) closeCart();
      touchStartX = 0;
      touchCurrentX = 0;
      swipeArmed = false;
    });
  }

  updateCartUI();


  // ---------- Product image slider (polo) ----------
  function initProductSliders() {
    document.querySelectorAll('[data-slider]').forEach(function (slider) {
      var track = slider.querySelector('.slider-track');
      var dots = slider.querySelectorAll('.slider-dot');
      var prev = slider.querySelector('.slider-prev');
      var next = slider.querySelector('.slider-next');
      var index = 0;
      var count = track ? track.querySelectorAll('img').length : 0;
      if (!track || count < 2) return;

      function goTo(i) {
        index = (i + count) % count;
        track.style.transform = 'translateX(' + (-index * 50) + '%)';
        dots.forEach(function (d, di) {
          d.classList.toggle('active', di === index);
        });
      }

      if (prev) prev.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        goTo(index - 1);
      });
      if (next) next.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        goTo(index + 1);
      });
      dots.forEach(function (dot) {
        dot.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          goTo(Number(dot.getAttribute('data-slide')) || 0);
        });
      });

      // Touch swipe
      var startX = 0;
      var currentX = 0;
      var dragging = false;

      slider.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
        currentX = startX;
        dragging = true;
      }, { passive: true });

      slider.addEventListener('touchmove', function (e) {
        if (!dragging) return;
        currentX = e.touches[0].clientX;
      }, { passive: true });

      slider.addEventListener('touchend', function () {
        if (!dragging) return;
        dragging = false;
        var diff = currentX - startX;
        if (diff < -40) goTo(index + 1);
        else if (diff > 40) goTo(index - 1);
      });

      // Mouse drag (desktop)
      var mouseDown = false;
      slider.addEventListener('mousedown', function (e) {
        if (e.target.closest('button')) return;
        mouseDown = true;
        startX = e.clientX;
        currentX = startX;
      });
      window.addEventListener('mousemove', function (e) {
        if (!mouseDown) return;
        currentX = e.clientX;
      });
      window.addEventListener('mouseup', function () {
        if (!mouseDown) return;
        mouseDown = false;
        var diff = currentX - startX;
        if (diff < -40) goTo(index + 1);
        else if (diff > 40) goTo(index - 1);
      });
    });
  }
  initProductSliders();

  // ---------- Language ----------
  var translations = {
    pt: {
      announce: 'Inscrições abertas',
      announceAccent: 'Teste de nível gratuito',
      tagline: 'Cultivando conhecimento',
      navHome: 'Início',
      navAbout: 'Sobre',
      navCourses: 'Cursos',
      navProducts: 'Produtos',
      navContact: 'Contacto',
      navEnroll: 'Inscrição',
      navAccount: 'Entrar',
      heroEyebrow: 'Formação em Inglês · Angola',
      heroTitle: 'Aprenda inglês<br>para a vida real',
      heroSubtitle: 'Metodologia exclusiva que transforma o português que você já fala em inglês fluente, em até 12 meses.',
      heroCta: 'Ver cursos',
      heroCta2: 'Falar no WhatsApp',
      scroll: 'Scroll',
      aboutEyebrow: 'A Academia',
      aboutTitle: 'Toda grande conquista<br>começa por uma semente',
      aboutP1: 'A Academia Semente nasceu da necessidade de preencher as lacunas no ensino de inglês em Angola e das dificuldades que falantes de português enfrentam ao aprender esta língua.',
      aboutP2: 'Utilizamos uma metodologia exclusiva, uma reformulação ideológica que funciona como ponte mental, para que o aluno consiga reproduzir tudo o que fala em português para inglês por meio de padrões e passe a pensar apenas em inglês.',
      aboutP3: 'Foco em empregabilidade e vida real: o mercado não quer aluno que tira 20 na prova e trava na entrevista.',
      statStudents: 'Alunos formados',
      statCenters: 'Centros em Angola',
      statMonths: 'Meses para fluência',
      statAI: 'IA de apoio',
      missionTitle: 'Missão',
      missionText: 'Formar angolanos comunicativos, empregáveis e confiantes em inglês, em até 12 meses, usando tecnologia e prática real.',
      visionTitle: 'Visão',
      visionText: 'Ser o centro de inglês de referência em Angola que forma líderes bilingues, conectando angolanos a oportunidades globais.',
      coursesEyebrow: 'Modalidades',
      coursesTitle: 'Escolha o formato<br>que se adapta a si',
      coursesDesc: 'Aulas presenciais, online ou ao domicílio. Todas com a mesma metodologia exclusiva e acompanhamento individual.',
      onlineTitle: 'Online',
      onlineTag: 'Flexível',
      presencialTitle: 'Presencial',
      presencialTag: 'Híbrido',
      domiciliarTitle: 'Domiciliar',
      domiciliarTag: 'Premium',
      perMonth: '/mês',
      popular: 'Mais escolhido',
      onlineF1: 'Aulas individualizadas',
      onlineF2: 'Estude a qualquer hora e em qualquer lugar',
      onlineF3: 'Método por etapas para evolução garantida',
      onlineF4: 'IA de apoio 24 horas',
      onlineF5: 'Feedback mensal em vídeo',
      presencialF1: 'Aulas diretas e interativas',
      presencialF2: 'Ambiente de aprendizagem focado',
      presencialF3: '3 dias presenciais + 2 online',
      presencialF4: 'Eventos reais (English Day, debates)',
      presencialF5: 'Comunidade WhatsApp só em inglês',
      domiciliarF1: 'Atenção 100% focada no aluno',
      domiciliarF2: 'Professor desloca-se até si',
      domiciliarF3: 'Horário completamente flexível',
      domiciliarF4: 'Plano de estudos personalizado',
      domiciliarF5: 'Acompanhamento intensivo',
      enrollBtn: 'Inscrever-me',
      schedulesTitle: 'Horários disponíveis',
      morning: 'Manhã',
      afternoon: 'Tarde',
      freeTest: 'Teste de nível gratuito · Sem compromisso',
      productsEyebrow: 'Loja',
      productsTitle: 'Materiais e produtos<br>oficiais',
      productsDesc: 'Leve a Academia Semente consigo. Materiais pensados para acelerar a sua evolução.',
      prod1Title: 'Caderno de Padrões',
      prod1Desc: 'Caderno exclusivo com os padrões da metodologia Semente para prática diária.',
      prod2Title: 'Polo Oficial',
      prod2Desc: 'Polo premium de manga comprida com o logotipo Academia Semente. Acabamento profissional.',
      prod3Title: 'Kit Canetas Semente',
      prod3Desc: 'Conjunto de 3 canetas premium com a marca Academia Semente.',
      prod4Title: 'Manual do Aluno',
      prod4Desc: 'Guia completo da metodologia Semente com exercícios e padrões avançados.',
      buyBtn: 'Adicionar',
      diffEyebrow: 'Porquê nós',
      diffTitle: 'O que nos torna<br>diferentes',
      diff1Title: 'Metodologia exclusiva',
      diff1Text: 'Ponte mental que permite pensar directamente em inglês a partir do português.',
      diff2Title: 'Foco em empregabilidade',
      diff2Text: 'Entrevistas, e-mails corporativos e atendimento ao cliente, inglês para o mercado.',
      diff3Title: 'Tecnologia + humano',
      diff3Text: 'IA 24h para prática + professor como coach de comunicação.',
      diff4Title: 'Ambiente sem julgamento',
      diff4Text: 'Sala onde errar é normal. Quebramos o medo de falar.',
      enrollHeroEyebrow: 'Inscrição · Academia Semente',
      enrollHeroTitle: 'Dê o primeiro passo<br>para a fluência',
      enrollHeroSubtitle: 'Preencha o formulário abaixo e envie a sua inscrição via WhatsApp. Confirmamos a vaga e o teste de nível gratuito.',
      enrollHeroCta: 'Preencher inscrição',
      enrollEyebrow: 'Inscrição',
      enrollTitle: 'Inscreva-se agora',
      enrollDesc: 'Preencha o formulário completo. Receberá a confirmação e, em seguida, a referência de pagamento e o acompanhamento da equipa.',
      contactEyebrow: 'Contacto',
      contactTitle: 'Fale connosco',
      contactDesc: 'Envie-nos uma mensagem. Respondemos rapidamente via WhatsApp. Para se inscrever num curso, use a página de inscrição.',
      locationLabel: 'Localização',
      phoneLabel: 'WhatsApp',
      emailLabel: 'Email',
      socialLabel: 'Redes sociais',
      formName: 'Nome completo',
      formNamePh: 'O seu nome',
      formAge: 'Idade',
      formAgePh: 'Ex.: 22',
      formMarital: 'Estado civil',
      formMaritalPh: 'Seleccione',
      formEmail: 'E-mail',
      formEmailPh: 'nome@email.com',
      formPhone: 'Telefone / WhatsApp',
      formPhonePh: '+244 ...',
      formInterest: 'Assunto',
      formMessage: 'Mensagem',
      formMessagePh: 'Como podemos ajudar?',
      formSubmit: 'Enviar via WhatsApp',
      formCourse: 'Curso em que se inscreve',
      formAddress: 'Morada / Localização',
      formAddressPh: 'Rua, bairro, número',
      formProvince: 'Província',
      formProvincePh: 'Seleccione a província',
      formMunicipality: 'Município',
      formMunicipalityPh: 'Ex.: Belas, Viana, Cacuaco',
      formLevel: 'Nível do estudante',
      formLevelPh: 'Seleccione o nível',
      formSchedule: 'Horários disponíveis',
      formSchedulePh: 'Seleccione o horário',
      formPriceLabel: 'Valor mensal',
      formSectionPayment: 'Pagamento',
      formPayment: 'Método de pagamento preferido',
      formPaymentPh: 'Seleccione',
      formPaymentHint: 'A equipa enviará os dados de pagamento (referência ou IBAN) conforme a sua escolha.',
      optPayRef: 'Referência Multicaixa',
      optPayIban: 'Transferência IBAN',
      optPayExpress: 'Multicaixa Express',
      formSectionPersonal: 'Dados pessoais',
      formSectionCourse: 'Curso e horário',
      formSectionEnglish: 'Sobre o seu inglês',
      formMotivation: 'O que lhe motivou a aprender inglês?',
      formMotivationPh: 'Descreva de forma breve a sua motivação',
      formDifficulties: 'Tem dificuldades na língua inglesa? Quais?',
      formDifficultiesPh: 'Ex.: falar, ouvir, gramática, vocabulário...',
      formExperience: 'Já estudou a língua inglesa em algum lugar? Como foi a experiência?',
      formExperiencePh: 'Onde estudou e como foi (ou indique se nunca estudou)',
      formTopics: 'Que temas acha melhor estudarmos primeiro para falar inglês já?',
      formTopicsPh: 'Ex.: apresentações, viagens, trabalho, conversação diária...',
      formNotes: 'Notas (opcional)',
      formNotesPh: 'Outras informações relevantes',
      formEnrollSubmit: 'Enviar inscrição',
      formHint: 'Após enviar, a inscrição fica na área da equipa. Contactamo-lo por telefone, e-mail ou WhatsApp com os próximos passos de pagamento.',
      successEyebrow: 'Inscrição recebida',
      successTitle: 'Obrigado,',
      successText: 'A sua inscrição foi registada com sucesso. Em breve enviaremos a <strong>referência de pagamento</strong> e o recibo por WhatsApp ou e-mail.',
      successStep1: 'Confirmamos os seus dados e a modalidade do curso',
      successStep2: 'Enviamos a referência Multicaixa / instruções de pagamento',
      successStep3: 'Após o pagamento, confirmamos a vaga e o teste de nível',
      successWhatsApp: 'Falar no WhatsApp',
      successHome: 'Voltar ao início',
      successHint: 'Guarde o seu contacto activo — a equipa Academia Semente responderá em breve.',
      optOnline: 'Curso Online',
      optPresencial: 'Curso Presencial',
      optDomiciliar: 'Curso Domiciliar',
      optLevelTest: 'Teste de nível gratuito',
      optMorning: '08h - 10h · Manhã',
      optAfternoon: '14h - 16h · Tarde',
      optFlexible: 'Flexível / a combinar',
      optSingle: 'Solteiro/a',
      optMarried: 'Casado/a',
      optUnion: 'União de facto',
      optDivorced: 'Divorciado/a',
      optWidowed: 'Viúvo/a',
      optPreferNot: 'Prefiro não dizer',
      optBeginner: 'Iniciante',
      optElementary: 'Elementar',
      optPreInt: 'Pré-intermédio',
      optIntermediate: 'Intermédio',
      optAdvanced: 'Avançado',
      optLevelUnknown: 'Não sei / quero teste de nível',
      optGeneral: 'Informações gerais',
      optCourses: 'Cursos',
      optProducts: 'Produtos / Materiais',
      optPartner: 'Parcerias',
      optOther: 'Outro',
      footerTag: 'Cultivando conhecimento, formando futuros.',
      rights: 'Todos os direitos reservados.',
      cartTitle: 'Carrinho',
      cartEmpty: 'O seu carrinho está vazio.',
      cartTotal: 'Total',
      cartClear: 'Limpar tudo',
      cartCheckout: 'Finalizar compra',
      checkoutEyebrow: 'Encomenda',
      checkoutTitle: 'Checkout',
      checkoutDesc: 'Confirme os produtos e os dados de entrega. Após confirmar, verá o próximo passo de pagamento.',
      checkoutEmpty: 'O seu carrinho está vazio.',
      checkoutBackShop: 'Ver produtos',
      checkoutSummary: 'Resumo da encomenda',
      checkoutContinue: 'Continuar a comprar',
      checkoutDelivery: 'Dados de entrega',
      checkoutNotesPh: 'Instruções de entrega ou outras informações',
      checkoutSubmit: 'Confirmar encomenda',
      checkoutHint: 'Após confirmar, a encomenda fica na área da equipa. Contactamo-lo por telefone ou WhatsApp com os próximos passos de pagamento.',
      orderSuccessEyebrow: 'Encomenda recebida',
      orderSuccessTitle: 'Obrigado,',
      orderSuccessText: 'A sua encomenda foi registada com sucesso. Em breve enviaremos a <strong>referência de pagamento</strong> e o recibo por WhatsApp ou e-mail.',
      orderSuccessStep1: 'Confirmamos os produtos e os dados de entrega',
      orderSuccessStep2: 'Enviamos a referência Multicaixa / instruções de pagamento',
      orderSuccessStep3: 'Após o pagamento, preparamos e enviamos a sua encomenda',
      orderSuccessShop: 'Continuar a comprar',
      orderSuccessHint: 'Guarde o seu contacto activo — a equipa Academia Semente responderá em breve.'
    },
    en: {
      announce: 'Enrolments open',
      announceAccent: 'Free level test',
      tagline: 'Cultivating knowledge',
      navHome: 'Home',
      navAbout: 'About',
      navCourses: 'Courses',
      navProducts: 'Products',
      navContact: 'Contact',
      navEnroll: 'Enrol',
      navAccount: 'Sign in',
      heroEyebrow: 'English Training · Angola',
      heroTitle: 'Learn English<br>for real life',
      heroSubtitle: 'Exclusive methodology that turns the Portuguese you already speak into fluent English, in up to 12 months.',
      heroCta: 'View courses',
      heroCta2: 'Chat on WhatsApp',
      scroll: 'Scroll',
      aboutEyebrow: 'The Academy',
      aboutTitle: 'Every great achievement<br>begins with a seed',
      aboutP1: 'Academia Semente was born to fill the gaps in English teaching in Angola and the difficulties Portuguese speakers face when learning this language.',
      aboutP2: 'We use an exclusive methodology, an ideological reformulation that works as a mental bridge, so students can transfer everything they say in Portuguese into English through patterns and start thinking only in English.',
      aboutP3: 'Focus on employability and real life: the market does not want students who score 20 on tests but freeze in interviews.',
      statStudents: 'Students trained',
      statCenters: 'Centres in Angola',
      statMonths: 'Months to fluency',
      statAI: 'AI support',
      missionTitle: 'Mission',
      missionText: 'Train communicative, employable and confident Angolans in English within 12 months, using technology and real practice.',
      visionTitle: 'Vision',
      visionText: 'To be the reference English centre in Angola that forms bilingual leaders, connecting Angolans to global opportunities.',
      coursesEyebrow: 'Formats',
      coursesTitle: 'Choose the format<br>that fits you',
      coursesDesc: 'In-person, online or home classes. All with the same exclusive methodology and individual support.',
      onlineTitle: 'Online',
      onlineTag: 'Flexible',
      presencialTitle: 'In-person',
      presencialTag: 'Hybrid',
      domiciliarTitle: 'Home',
      domiciliarTag: 'Premium',
      perMonth: '/month',
      popular: 'Most popular',
      onlineF1: 'Individual classes',
      onlineF2: 'Study anytime, anywhere',
      onlineF3: 'Step-by-step method for guaranteed progress',
      onlineF4: '24-hour AI support',
      onlineF5: 'Monthly video feedback',
      presencialF1: 'Direct and interactive classes',
      presencialF2: 'Focused learning environment',
      presencialF3: '3 in-person days + 2 online',
      presencialF4: 'Real events (English Day, debates)',
      presencialF5: 'WhatsApp community in English only',
      domiciliarF1: '100% focused attention on the student',
      domiciliarF2: 'Teacher comes to you',
      domiciliarF3: 'Fully flexible schedule',
      domiciliarF4: 'Personalised study plan',
      domiciliarF5: 'Intensive follow-up',
      enrollBtn: 'Enrol now',
      schedulesTitle: 'Available schedules',
      morning: 'Morning',
      afternoon: 'Afternoon',
      freeTest: 'Free level test · No commitment',
      productsEyebrow: 'Shop',
      productsTitle: 'Official materials<br>& products',
      productsDesc: 'Take Academia Semente with you. Materials designed to accelerate your progress.',
      prod1Title: 'Patterns Notebook',
      prod1Desc: 'Exclusive notebook with Semente methodology patterns for daily practice.',
      prod2Title: 'Official Polo',
      prod2Desc: 'Premium long-sleeve polo with the Academia Semente logo. Professional finish.',
      prod3Title: 'Semente Pen Kit',
      prod3Desc: 'Set of 3 premium pens with the Academia Semente brand.',
      prod4Title: 'Student Manual',
      prod4Desc: 'Complete guide to the Semente methodology with exercises and advanced patterns.',
      buyBtn: 'Add',
      diffEyebrow: 'Why us',
      diffTitle: 'What makes us<br>different',
      diff1Title: 'Exclusive methodology',
      diff1Text: 'Mental bridge that allows thinking directly in English from Portuguese.',
      diff2Title: 'Employability focus',
      diff2Text: 'Interviews, corporate emails and customer service, English for the market.',
      diff3Title: 'Technology + human',
      diff3Text: '24h AI for practice + teacher as communication coach.',
      diff4Title: 'Judgement-free space',
      diff4Text: 'A room where mistakes are normal. We break the fear of speaking.',
      enrollHeroEyebrow: 'Enrolment · Academia Semente',
      enrollHeroTitle: 'Take the first step<br>toward fluency',
      enrollHeroSubtitle: 'Fill in the form below and send your enrolment via WhatsApp. We confirm your place and the free level test.',
      enrollHeroCta: 'Fill in enrolment',
      enrollEyebrow: 'Enrolment',
      enrollTitle: 'Enrol now',
      enrollDesc: 'Fill in the full form. You will receive confirmation, then the payment reference and follow-up from the team.',
      contactEyebrow: 'Contact',
      contactTitle: 'Get in touch',
      contactDesc: 'Send us a message. We reply quickly via WhatsApp. To enrol in a course, use the enrolment page.',
      locationLabel: 'Location',
      phoneLabel: 'WhatsApp',
      emailLabel: 'Email',
      socialLabel: 'Social media',
      formName: 'Full name',
      formNamePh: 'Your name',
      formAge: 'Age',
      formAgePh: 'e.g. 22',
      formMarital: 'Marital status',
      formMaritalPh: 'Select',
      formEmail: 'Email',
      formEmailPh: 'name@email.com',
      formPhone: 'Phone / WhatsApp',
      formPhonePh: '+244 ...',
      formInterest: 'Subject',
      formMessage: 'Message',
      formMessagePh: 'How can we help?',
      formSubmit: 'Send via WhatsApp',
      formCourse: 'Course you are enrolling in',
      formAddress: 'Address / location',
      formAddressPh: 'Street, neighbourhood, number',
      formProvince: 'Province',
      formProvincePh: 'Select province',
      formMunicipality: 'Municipality',
      formMunicipalityPh: 'e.g. Belas, Viana, Cacuaco',
      formLevel: 'Student level',
      formLevelPh: 'Select level',
      formSchedule: 'Available schedules',
      formSchedulePh: 'Select schedule',
      formPriceLabel: 'Monthly fee',
      formSectionPayment: 'Payment',
      formPayment: 'Preferred payment method',
      formPaymentPh: 'Select',
      formPaymentHint: 'The team will send payment details (reference or IBAN) according to your choice.',
      optPayRef: 'Multicaixa reference',
      optPayIban: 'IBAN transfer',
      optPayExpress: 'Multicaixa Express',
      formSectionPersonal: 'Personal details',
      formSectionCourse: 'Course and schedule',
      formSectionEnglish: 'About your English',
      formMotivation: 'What motivated you to learn English?',
      formMotivationPh: 'Briefly describe your motivation',
      formDifficulties: 'Do you have difficulties with English? Which ones?',
      formDifficultiesPh: 'e.g. speaking, listening, grammar, vocabulary...',
      formExperience: 'Have you studied English somewhere before? How was the experience?',
      formExperiencePh: 'Where you studied and how it went (or say if never)',
      formTopics: 'Which topics should we study first so you can speak English sooner?',
      formTopicsPh: 'e.g. introductions, travel, work, daily conversation...',
      formNotes: 'Notes (optional)',
      formNotesPh: 'Any other relevant information',
      formEnrollSubmit: 'Submit enrolment',
      formHint: 'After submitting, your enrolment is saved for the team. We will contact you by phone, email or WhatsApp with payment next steps.',
      successEyebrow: 'Enrolment received',
      successTitle: 'Thank you,',
      successText: 'Your enrolment was registered successfully. We will soon send the <strong>payment reference</strong> and receipt by WhatsApp or email.',
      successStep1: 'We confirm your details and course format',
      successStep2: 'We send the Multicaixa reference / payment instructions',
      successStep3: 'After payment, we confirm your place and the level test',
      successWhatsApp: 'Chat on WhatsApp',
      successHome: 'Back to home',
      successHint: 'Keep your contact available — the Academia Semente team will reply soon.',
      optOnline: 'Online Course',
      optPresencial: 'In-person Course',
      optDomiciliar: 'Home Course',
      optLevelTest: 'Free level test',
      optMorning: '08h - 10h · Morning',
      optAfternoon: '14h - 16h · Afternoon',
      optFlexible: 'Flexible / to arrange',
      optSingle: 'Single',
      optMarried: 'Married',
      optUnion: 'Civil partnership',
      optDivorced: 'Divorced',
      optWidowed: 'Widowed',
      optPreferNot: 'Prefer not to say',
      optBeginner: 'Beginner',
      optElementary: 'Elementary',
      optPreInt: 'Pre-intermediate',
      optIntermediate: 'Intermediate',
      optAdvanced: 'Advanced',
      optLevelUnknown: 'Not sure / want a level test',
      optGeneral: 'General information',
      optCourses: 'Courses',
      optProducts: 'Products / Materials',
      optPartner: 'Partnerships',
      optOther: 'Other',
      footerTag: 'Cultivating knowledge, forming futures.',
      rights: 'All rights reserved.',
      cartTitle: 'Cart',
      cartEmpty: 'Your cart is empty.',
      cartTotal: 'Total',
      cartClear: 'Clear all',
      cartCheckout: 'Checkout',
      checkoutEyebrow: 'Order',
      checkoutTitle: 'Checkout',
      checkoutDesc: 'Confirm your products and delivery details. After confirming, you will see the next payment step.',
      checkoutEmpty: 'Your cart is empty.',
      checkoutBackShop: 'View products',
      checkoutSummary: 'Order summary',
      checkoutContinue: 'Continue shopping',
      checkoutDelivery: 'Delivery details',
      checkoutNotesPh: 'Delivery instructions or other notes',
      checkoutSubmit: 'Confirm order',
      checkoutHint: 'After confirming, the order is saved for the team. We will contact you by phone or WhatsApp with payment next steps.',
      orderSuccessEyebrow: 'Order received',
      orderSuccessTitle: 'Thank you,',
      orderSuccessText: 'Your order was registered successfully. We will soon send the <strong>payment reference</strong> and receipt by WhatsApp or email.',
      orderSuccessStep1: 'We confirm the products and delivery details',
      orderSuccessStep2: 'We send the Multicaixa reference / payment instructions',
      orderSuccessStep3: 'After payment, we prepare and ship your order',
      orderSuccessShop: 'Continue shopping',
      orderSuccessHint: 'Keep your contact available — the Academia Semente team will reply soon.'
    }
  };

  function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    var t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (t[key] !== undefined) el.innerHTML = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (t[key] !== undefined) el.placeholder = t[key];
    });
    document.querySelectorAll('select option[data-i18n]').forEach(function (opt) {
      var key = opt.getAttribute('data-i18n');
      if (t[key] !== undefined) opt.textContent = t[key];
    });
    updateCartUI();
    if (typeof renderCheckoutPage === 'function') renderCheckoutPage();
  }

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { setLanguage(btn.dataset.lang); });
  });


  // ---------- Site CMS (API) ----------
  var siteData = null;
  var cfg = window.ACADEMIA_CONFIG || {};
  var SITE_API = (cfg.WORKER_URL || '').replace(/\/$/, '') + '/api/site';

  function formatKz(n) {
    return Number(n).toLocaleString('pt-AO');
  }

  function applySiteContent(site) {
    if (!site) return;
    siteData = site;

    // Merge CMS texts into translations
    function mergeLang(lang, map) {
      if (!translations[lang]) return;
      Object.keys(map).forEach(function (k) {
        if (map[k] != null && map[k] !== '') translations[lang][k] = map[k];
      });
    }

    if (site.announce) {
      mergeLang('pt', { announce: site.announce.text_pt, announceAccent: site.announce.accent_pt });
      mergeLang('en', { announce: site.announce.text_en, announceAccent: site.announce.accent_en });
    }
    if (site.hero) {
      var h = site.hero;
      mergeLang('pt', {
        heroEyebrow: h.eyebrow_pt, heroTitle: h.title_pt, heroSubtitle: h.subtitle_pt,
        heroCta: h.cta_pt, heroCta2: h.cta2_pt
      });
      mergeLang('en', {
        heroEyebrow: h.eyebrow_en, heroTitle: h.title_en, heroSubtitle: h.subtitle_en,
        heroCta: h.cta_en, heroCta2: h.cta2_en
      });
      if (h.image_url) {
        var heroBg = document.querySelector('.hero-bg');
        if (heroBg) heroBg.style.backgroundImage = 'url(' + h.image_url + ')';
      }
    }
    if (site.about) {
      var a = site.about;
      mergeLang('pt', {
        aboutEyebrow: a.eyebrow_pt, aboutTitle: a.title_pt, aboutP1: a.p1_pt, aboutP2: a.p2_pt, aboutP3: a.p3_pt,
        missionTitle: a.mission_title_pt, missionText: a.mission_pt, visionTitle: a.vision_title_pt, visionText: a.vision_pt,
        statStudents: a.stat_students_label_pt, statCenters: a.stat_centers_label_pt, statMonths: a.stat_months_label_pt, statAI: a.stat_ai_label_pt
      });
      mergeLang('en', {
        aboutEyebrow: a.eyebrow_en, aboutTitle: a.title_en, aboutP1: a.p1_en, aboutP2: a.p2_en, aboutP3: a.p3_en,
        missionTitle: a.mission_title_en, missionText: a.mission_en, visionTitle: a.vision_title_en, visionText: a.vision_en,
        statStudents: a.stat_students_label_en, statCenters: a.stat_centers_label_en, statMonths: a.stat_months_label_en, statAI: a.stat_ai_label_en
      });
      // stat values (numbers)
      var statNums = document.querySelectorAll('.stat-value');
      if (statNums[0] && a.stat_students) statNums[0].textContent = a.stat_students;
      if (statNums[1] && a.stat_centers) statNums[1].textContent = a.stat_centers;
      if (statNums[2] && a.stat_months) statNums[2].textContent = a.stat_months;
      if (statNums[3] && a.stat_ai) statNums[3].textContent = a.stat_ai;
      if (a.image_url) {
        var sobreBg = document.querySelector('.sobre-bg, .about-bg');
        if (sobreBg) sobreBg.style.backgroundImage = 'url(' + a.image_url + ')';
      }
    }
    if (site.courses) {
      var c = site.courses;
      mergeLang('pt', {
        coursesEyebrow: c.eyebrow_pt, coursesTitle: c.title_pt, coursesDesc: c.desc_pt,
        popular: c.popular_pt, enrollBtn: c.enroll_btn_pt, freeTest: c.free_test_pt,
        schedulesTitle: c.schedules_title_pt, perMonth: c.per_month_pt || '/mês'
      });
      mergeLang('en', {
        coursesEyebrow: c.eyebrow_en, coursesTitle: c.title_en, coursesDesc: c.desc_en,
        popular: c.popular_en, enrollBtn: c.enroll_btn_en, freeTest: c.free_test_en,
        schedulesTitle: c.schedules_title_en, perMonth: c.per_month_en || '/month'
      });
      // Update COURSE_PRICES and price cards
      (c.modalities || []).forEach(function (m) {
        if (m.id && m.price_kz != null) COURSE_PRICES[m.id] = Number(m.price_kz);
        var card = document.querySelector('.price-card [data-course="' + m.id + '"]');
        if (!card) card = document.querySelector('.enroll-btn[data-course="' + m.id + '"]');
        var article = card ? card.closest('.price-card') : null;
        if (!article) {
          // try by order
          return;
        }
        var valEl = article.querySelector('.price-amount .value');
        if (valEl && m.price_kz != null) valEl.textContent = formatKz(m.price_kz);
        if (m.icon_url) {
          var icon = article.querySelector('.price-icon img');
          if (icon) icon.src = m.icon_url;
        }
        var featList = article.querySelectorAll('.price-features li');
        var feats = (currentLang === 'en' ? m.features_en : m.features_pt) || m.features_pt || [];
        feats.forEach(function (f, i) {
          if (featList[i]) featList[i].textContent = f;
        });
        // store features for lang switch
        article.dataset.featuresPt = JSON.stringify(m.features_pt || []);
        article.dataset.featuresEn = JSON.stringify(m.features_en || []);
        if (m.title_pt) {
          var h3 = article.querySelector('.price-header h3');
          if (h3) {
            h3.setAttribute('data-i18n', '');
            h3.dataset.titlePt = m.title_pt;
            h3.dataset.titleEn = m.title_en || m.title_pt;
            h3.textContent = currentLang === 'en' ? (m.title_en || m.title_pt) : m.title_pt;
          }
        }
      });
      // Also map by index if data-course matching fails
      var cards = document.querySelectorAll('.price-card');
      (c.modalities || []).forEach(function (m, i) {
        var article = cards[i];
        if (!article) return;
        var valEl = article.querySelector('.price-amount .value');
        if (valEl && m.price_kz != null) valEl.textContent = formatKz(m.price_kz);
        if (m.icon_url) {
          var icon = article.querySelector('.price-icon img');
          if (icon) icon.src = m.icon_url;
        }
        var featList = article.querySelectorAll('.price-features li');
        var feats = m.features_pt || [];
        feats.forEach(function (f, fi) {
          if (featList[fi]) {
            featList[fi].textContent = f;
            featList[fi].dataset.featPt = (m.features_pt || [])[fi] || f;
            featList[fi].dataset.featEn = (m.features_en || [])[fi] || f;
          }
        });
        article.dataset.modId = m.id;
        var enroll = article.querySelector('.enroll-btn');
        if (enroll && m.id) {
          enroll.dataset.course = m.id;
          enroll.href = 'inscricao.html?course=' + encodeURIComponent(m.id);
        }
      });
      if (typeof updateEnrollPrice === 'function') updateEnrollPrice();
    }
    if (site.products) {
      var pr = site.products;
      mergeLang('pt', { productsEyebrow: pr.eyebrow_pt, productsTitle: pr.title_pt, productsDesc: pr.desc_pt, buyBtn: pr.buy_btn_pt });
      mergeLang('en', { productsEyebrow: pr.eyebrow_en, productsTitle: pr.title_en, productsDesc: pr.desc_en, buyBtn: pr.buy_btn_en });
      (pr.items || []).forEach(function (item, i) {
        var card = document.querySelector('.product-card[data-id="' + item.id + '"]');
        if (!card) {
          var all = document.querySelectorAll('.product-card');
          card = all[i];
        }
        if (!card) return;
        if (item.id) card.dataset.id = item.id;
        if (item.name_pt) card.dataset.name = item.name_pt;
        if (item.name_en) card.dataset.nameEn = item.name_en;
        if (item.price_kz != null) card.dataset.price = String(item.price_kz);
        var h3 = card.querySelector('h3');
        if (h3 && item.name_pt) {
          h3.textContent = currentLang === 'en' ? (item.name_en || item.name_pt) : item.name_pt;
          h3.dataset.namePt = item.name_pt;
          h3.dataset.nameEn = item.name_en || item.name_pt;
        }
        var desc = card.querySelector('.product-info p');
        if (desc && item.desc_pt) {
          desc.textContent = currentLang === 'en' ? (item.desc_en || item.desc_pt) : item.desc_pt;
          desc.dataset.descPt = item.desc_pt;
          desc.dataset.descEn = item.desc_en || item.desc_pt;
        }
        var priceEl = card.querySelector('.product-price .price');
        if (priceEl && item.price_kz != null) priceEl.textContent = formatKz(item.price_kz) + ' Kz';
        if (item.image_url) {
          var img = card.querySelector('.product-image img');
          if (img) img.src = item.image_url;
          PRODUCT_IMAGES[item.id] = item.image_url;
        }
      });
    }
    if (site.diff) {
      var d = site.diff;
      mergeLang('pt', { diffEyebrow: d.eyebrow_pt, diffTitle: d.title_pt });
      mergeLang('en', { diffEyebrow: d.eyebrow_en, diffTitle: d.title_en });
      if (d.image_url) {
        var diffBg = document.querySelector('.diferenciais-bg');
        if (diffBg) diffBg.style.backgroundImage = 'url(' + d.image_url + ')';
      }
      var diffItems = document.querySelectorAll('.diff-item');
      (d.items || []).forEach(function (it, i) {
        var el = diffItems[i];
        if (!el) return;
        var t = el.querySelector('h3');
        var p = el.querySelector('p');
        if (t && it.title_pt) {
          t.textContent = currentLang === 'en' ? (it.title_en || it.title_pt) : it.title_pt;
          t.dataset.titlePt = it.title_pt;
          t.dataset.titleEn = it.title_en || it.title_pt;
        }
        if (p && it.text_pt) {
          p.textContent = currentLang === 'en' ? (it.text_en || it.text_pt) : it.text_pt;
          p.dataset.textPt = it.text_pt;
          p.dataset.textEn = it.text_en || it.text_pt;
        }
        if (it.icon_url) {
          var icon = el.querySelector('.diff-icon img');
          if (icon) icon.src = it.icon_url;
        }
      });
    }
    if (site.contact) {
      var ct = site.contact;
      mergeLang('pt', { contactEyebrow: ct.eyebrow_pt, contactTitle: ct.title_pt, contactDesc: ct.desc_pt });
      mergeLang('en', { contactEyebrow: ct.eyebrow_en, contactTitle: ct.title_en, contactDesc: ct.desc_en });
      if (ct.whatsapp) {
        document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
          var text = a.href.indexOf('text=') >= 0 ? a.href.split('text=')[1] : '';
          a.href = 'https://wa.me/' + ct.whatsapp + (text ? '?text=' + text : '');
        });
      }
      if (ct.email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
          a.href = 'mailto:' + ct.email;
          if (a.textContent.indexOf('@') >= 0) a.textContent = ct.email;
        });
      }
      if (ct.image_url) {
        var contactBg = document.querySelector('.contact-bg, .contacto-bg');
        if (contactBg) contactBg.style.backgroundImage = 'url(' + ct.image_url + ')';
      }
    }

    // Re-apply current language
    setLanguage(currentLang);
  }

  function loadSiteContent() {
    if (!SITE_API || SITE_API === '/api/site') return;
    fetch(SITE_API)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.site) applySiteContent(data.site);
      })
      .catch(function () { /* keep hardcoded defaults */ });
  }

  // Patch setLanguage to also refresh CMS-driven dynamic fields
  var _setLanguage = setLanguage;
  setLanguage = function (lang) {
    _setLanguage(lang);
    document.querySelectorAll('.price-features li[data-feat-pt]').forEach(function (li) {
      li.textContent = lang === 'en' ? (li.dataset.featEn || li.dataset.featPt) : li.dataset.featPt;
    });
    document.querySelectorAll('.product-card h3[data-name-pt]').forEach(function (h) {
      h.textContent = lang === 'en' ? (h.dataset.nameEn || h.dataset.namePt) : h.dataset.namePt;
    });
    document.querySelectorAll('.product-info p[data-desc-pt]').forEach(function (p) {
      p.textContent = lang === 'en' ? (p.dataset.descEn || p.dataset.descPt) : p.dataset.descPt;
    });
    document.querySelectorAll('.diff-item h3[data-title-pt]').forEach(function (h) {
      h.textContent = lang === 'en' ? (h.dataset.titleEn || h.dataset.titlePt) : h.dataset.titlePt;
    });
    document.querySelectorAll('.diff-item p[data-text-pt]').forEach(function (p) {
      p.textContent = lang === 'en' ? (p.dataset.textEn || p.dataset.textPt) : p.dataset.textPt;
    });
  };

  loadSiteContent();

  setLanguage('pt');

})();
