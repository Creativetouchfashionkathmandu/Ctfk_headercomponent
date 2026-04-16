// Search Overlay
var searchOverlay      = document.getElementById('searchOverlay');
var searchOverlayInput = document.getElementById('searchOverlayInput');
var searchIconBtn      = document.getElementById('searchIconBtn');
var searchOverlayClose = document.getElementById('searchOverlayClose');

searchIconBtn.addEventListener('click', function() {
    searchOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function() { searchOverlayInput.focus(); }, 50);
});
searchOverlayClose.addEventListener('click', function() {
    searchOverlay.classList.remove('open');
    document.body.style.overflow = '';
});
searchOverlay.addEventListener('click', function(e) {
    if (e.target === searchOverlay) { searchOverlay.classList.remove('open'); document.body.style.overflow = ''; }
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { searchOverlay.classList.remove('open'); document.body.style.overflow = ''; }
});

// Mobile Menu
function openMenu()  { document.getElementById('mobileMenu').style.left = '0'; }
function closeMenu() { document.getElementById('mobileMenu').style.left = '-300px'; }

document.getElementById('menuIconBtn').addEventListener('click', openMenu);
document.getElementById('closeMenuBtn').addEventListener('click', closeMenu);

document.addEventListener('click', function(event) {
    var menu     = document.getElementById('mobileMenu');
    var menuIcon = document.getElementById('menuIconBtn');
    if (menu.style.left === '0px' && !menu.contains(event.target) && !menuIcon.contains(event.target)) {
        menu.style.left = '-300px';
    }
});
window.addEventListener('resize', function() {
    var menu = document.getElementById('mobileMenu');
    if (window.innerWidth >= 900) { menu.style.left = ''; }
    else if (menu.style.left !== '0px') { menu.style.left = '-300px'; }
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { document.getElementById('mobileMenu').style.left = '-300px'; closePopup(); }
});

// =========================================================
// Basket Popup
// BUG 1 FIX: Read URLs and nonce from ctfkData (set by wp_localize_script in PHP).
// Previously ctfkData was never defined, so wcAjaxUrl fell back to '/?wc-ajax='
// which breaks on any site installed in a subdirectory.
// BUG 2 FIX: Use ctfkData.nonce + admin-ajax.php for cart updates instead of
// scraping the cart page HTML to steal a WooCommerce nonce.
// =========================================================
var basketIcon     = document.getElementById('elementor-menu-cart__toggle_button');
var cartCountSpan  = document.getElementById('cartCount');
var popupOverlay   = document.getElementById('basketPopupOverlay');
var popupCartItems = document.getElementById('popupCartItems');
var popupCartTotal = document.getElementById('popupCartTotal');
var closePopupBtn  = document.getElementById('closePopupBtn');
var continueBtn    = document.getElementById('continueShoppingBtn');
var viewBasketBtn  = document.getElementById('viewBasketBtn');
// BUG 3 FIX: updateCartBtn now exists in the PHP HTML output. Previously it was
// missing, so this line returned null and every .style/.addEventListener call
// below crashed silently, killing all cart JS.
var updateCartBtn  = document.getElementById('updateCartBtn');

var wcAjaxUrl   = (typeof ctfkData !== 'undefined') ? ctfkData.wcAjax   : '/?wc-ajax=';
var ajaxUrl     = (typeof ctfkData !== 'undefined') ? ctfkData.ajaxUrl  : '/wp-admin/admin-ajax.php';
var cartPageUrl = (typeof ctfkData !== 'undefined') ? ctfkData.cartUrl  : '/cart/';
var ctfkNonce   = (typeof ctfkData !== 'undefined') ? ctfkData.nonce    : '';

var cartData = {};

// Updates BOTH the red badge count AND the €price text in the header icon.
// Call this after any cart change — qty update, add, or remove.
function updateHeaderBadge(fragments) {
    // --- Badge count ---
    if (cartCountSpan) {
        var countFrag = fragments['.elementor-menu-cart__toggle_button span.elementor-button-icon-qty'];
        if (countFrag) {
            var t = document.createElement('div'); t.innerHTML = countFrag;
            var c = t.querySelector('.elementor-button-icon-qty');
            if (c) { var n = c.getAttribute('data-counter') || c.textContent.trim(); cartCountSpan.textContent = n; cartCountSpan.setAttribute('data-counter', n); }
        }
    }
    // --- Price text (€ 45.10) ---
    // Elementor stores the full toggle button HTML as a fragment — parse the price out of it.
    var priceFrag = fragments['.elementor-menu-cart__toggle_button span.elementor-button-text']
                 || fragments['.elementor-menu-cart__toggle_button'];
    if (!priceFrag) {
        // Fallback: look inside the full widget_shopping_cart_content fragment for the subtotal
        var miniCart = fragments['div.widget_shopping_cart_content'];
        if (miniCart) {
            var tmp = document.createElement('div'); tmp.innerHTML = miniCart;
            var sub = tmp.querySelector('.elementor-menu-cart__subtotal .woocommerce-Price-amount');
            if (!sub) sub = tmp.querySelector('.woocommerce-mini-cart__total .woocommerce-Price-amount');
            if (sub) { priceFrag = sub.outerHTML; }
        }
    }
    if (priceFrag) {
        var priceEl = document.querySelector('#elementor-menu-cart__toggle_button .elementor-button-text');
        if (!priceEl) {
            // Create the span if it doesn't exist yet (empty cart on first load)
            priceEl = document.createElement('span');
            priceEl.className = 'elementor-button-text';
            var btn = document.getElementById('elementor-menu-cart__toggle_button');
            if (btn) btn.insertBefore(priceEl, btn.firstChild);
        }
        if (priceEl) {
            var tmp2 = document.createElement('div'); tmp2.innerHTML = priceFrag;
            var amt = tmp2.querySelector('.woocommerce-Price-amount');
            if (amt) {
                priceEl.innerHTML = '<span class="woocommerce-Price-amount">' + amt.innerHTML + '</span>';
            } else {
                priceEl.innerHTML = tmp2.textContent.trim() ? priceFrag : '';
            }
        }
    }
}

function closePopup() {
    popupOverlay.style.display = 'none';
    updateCartBtn.style.display = 'none';
    document.body.style.overflow = '';
}

// BUG 2 FIX: Replaced the fragile "scrape cart page for nonce" approach with a
// direct admin-ajax.php call using the nonce from wp_localize_script.
// One item at a time — cleaner, more reliable, no page-scraping.
function sendCartUpdate(cartItemKey, qty) {
    return new Promise(function(resolve, reject) {
        jQuery.ajax({
            url:    ajaxUrl,
            method: 'POST',
            data: {
                action:        'ctfkh_update_cart',
                nonce:         ctfkNonce,
                cart_item_key: cartItemKey,
                qty:           qty,
            },
            success: function(response) {
                if (response && response.success) {
                    // After qty update, do a fragment refresh to get the new price + count
                    jQuery.get(wcAjaxUrl + 'get_refreshed_fragments', function(fragResponse) {
                        if (fragResponse && fragResponse.fragments) {
                            updateHeaderBadge(fragResponse.fragments);
                        }
                    });
                    resolve(response.data);
                } else {
                    reject('Cart update failed');
                }
            },
            error: reject,
        });
    });
}

function refreshPopup() {
    popupCartItems.innerHTML = '<div class="loading-spinner">Updating your basket...</div>';
    updateCartBtn.disabled = true;
    updateCartBtn.textContent = 'Updating...';
    jQuery.ajax({
        url: wcAjaxUrl + 'get_refreshed_fragments', method: 'GET',
        success: function(response) {
            if (response && response.fragments) {
                var html = response.fragments['div.widget_shopping_cart_content'];
                if (html) {
                    displayCartItems(html);
                    updateHeaderBadge(response.fragments);
                }
            }
            updateCartBtn.style.display = 'none'; updateCartBtn.disabled = false; updateCartBtn.textContent = 'Update Cart';
        },
        error: function() { updateCartBtn.disabled = false; updateCartBtn.textContent = 'Update Cart'; }
    });
}

window.incrementQuantity = function(cartItemKey, productId) {
    var qtySpan = document.getElementById('qty-' + cartItemKey);
    if (!qtySpan) return;
    var newQty = (parseInt(qtySpan.textContent) || 1) + 1;
    qtySpan.textContent = newQty;
    if (!cartData[cartItemKey]) cartData[cartItemKey] = { productId: productId };
    cartData[cartItemKey].newQty = newQty;
    updateCartBtn.style.display = 'block';
};

window.decrementQuantity = function(cartItemKey, productId) {
    var qtySpan = document.getElementById('qty-' + cartItemKey);
    if (!qtySpan) return;
    var currentQty = parseInt(qtySpan.textContent) || 1;
    if (currentQty > 1) {
        var newQty = currentQty - 1;
        qtySpan.textContent = newQty;
        if (!cartData[cartItemKey]) cartData[cartItemKey] = { productId: productId };
        cartData[cartItemKey].newQty = newQty;
        updateCartBtn.style.display = 'block';
    } else {
        if (confirm('Remove this item from your basket?')) {
            updateCartBtn.disabled = true;
            sendCartUpdate(cartItemKey, 0)
                .then(function() { cartData = {}; refreshPopup(); })
                .catch(function() { alert('Failed to remove item.'); updateCartBtn.disabled = false; });
        }
    }
};

updateCartBtn.addEventListener('click', function() {
    var keys = Object.keys(cartData);
    if (!keys.length) { updateCartBtn.style.display = 'none'; return; }
    updateCartBtn.disabled = true;
    updateCartBtn.textContent = 'Updating...';
    // Send all queued quantity changes sequentially then refresh
    var chain = Promise.resolve();
    keys.forEach(function(key) {
        chain = chain.then(function() {
            return sendCartUpdate(key, cartData[key].newQty);
        });
    });
    chain.then(function() { cartData = {}; refreshPopup(); })
         .catch(function(e) { console.error(e); cartData = {}; refreshPopup(); });
});

function displayCartItems(miniCartHtml) {
    var tempDiv   = document.createElement('div');
    tempDiv.innerHTML = miniCartHtml;
    var cartItems = tempDiv.querySelectorAll('.elementor-menu-cart__product');
    var itemsHtml = '';
    if (cartItems.length === 0) {
        itemsHtml = '<p style="text-align:center;padding:20px;">Your basket is empty</p>';
        updateCartBtn.style.display = 'none';
    } else {
        cartItems.forEach(function(item) {
            var imgSrc      = item.querySelector('img') ? item.querySelector('img').src : '';
            var nameEl      = item.querySelector('.product-name a');
            var name        = nameEl ? nameEl.textContent : 'Product';
            var removeLink  = item.querySelector('.elementor_remove_from_cart_button');
            var cartItemKey = removeLink ? (removeLink.getAttribute('data-cart_item_key') || '') : '';
            var productId   = removeLink ? (removeLink.getAttribute('data-product_id')    || '') : '';
            var priceEl     = item.querySelector('.product-price .quantity');
            var price = '', quantity = 1;
            if (priceEl) {
                var match = priceEl.textContent.match(/(\d+)\s*×\s*(.+)/);
                if (match) { quantity = parseInt(match[1]); price = match[2].trim(); } else { price = priceEl.textContent.trim(); }
            }
            itemsHtml += '<div class="cart-item"><img src="' + imgSrc + '" alt="' + name + '"><div class="cart-item-details"><div class="cart-item-name">' + name + '</div><div class="cart-item-price">' + price + '</div><div class="cart-item-quantity"><span>Qty:</span><div class="quantity-controls"><button class="qty-btn minus" onclick="decrementQuantity(\'' + cartItemKey + '\',\'' + productId + '\')">\u2212</button><span class="qty-value" id="qty-' + cartItemKey + '">' + quantity + '</span><button class="qty-btn plus" onclick="incrementQuantity(\'' + cartItemKey + '\',\'' + productId + '\')">+</button></div></div></div></div>';
        });
        var totalEl = tempDiv.querySelector('.elementor-menu-cart__subtotal');
        if (totalEl && popupCartTotal) popupCartTotal.innerHTML = totalEl.innerHTML;
        updateCartBtn.style.display = 'none';
    }
    popupCartItems.innerHTML = itemsHtml;
    cartData = {};
}

function loadCartItems() {
    popupCartItems.innerHTML = '<div class="loading-spinner">Loading your items...</div>';
    updateCartBtn.style.display = 'none';
    jQuery.ajax({
        url: wcAjaxUrl + 'get_refreshed_fragments', method: 'GET',
        success: function(response) {
            if (response && response.fragments) {
                var html = response.fragments['div.widget_shopping_cart_content'];
                if (html) displayCartItems(html);
                else popupCartItems.innerHTML = '<p style="text-align:center;padding:20px;">Your basket is empty</p>';
            }
        },
        error: function() { popupCartItems.innerHTML = '<p style="text-align:center;padding:20px;">Unable to load cart items</p>'; }
    });
}

if (basketIcon) {
    basketIcon.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        loadCartItems();
        popupOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        return false;
    });
}

closePopupBtn.addEventListener('click', closePopup);
continueBtn.addEventListener('click', closePopup);
viewBasketBtn.addEventListener('click', function() { window.location.href = cartPageUrl; closePopup(); });
popupOverlay.addEventListener('click', function(e) { if (e.target === popupOverlay) closePopup(); });

jQuery(document.body).on('added_to_cart removed_from_cart', function() {
    jQuery.get(wcAjaxUrl + 'get_refreshed_fragments', function(response) {
        if (!response || !response.fragments) return;
        updateHeaderBadge(response.fragments);
    });
});
