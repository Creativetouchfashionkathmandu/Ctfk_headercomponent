<?php
/**
 * Plugin Name: CTFK Header
 * Description: Dynamic WooCommerce header with mobile menu, search overlay and basket popup. Use shortcode [ctfk_header].
 * Version:     1.1.3
 * Author:      Utsav Manandhar
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Text Domain: ctfk-header
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'CTFKH_VERSION', '1.1.3' );
define( 'CTFKH_PATH',    plugin_dir_path( __FILE__ ) );
define( 'CTFKH_URL',     plugin_dir_url( __FILE__ ) );

add_action( 'wp_enqueue_scripts', 'ctfkh_register_assets' );
function ctfkh_register_assets() {
    wp_enqueue_style(  'ctfkh-fa',     'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css', array(), '6.5.0' );
    wp_enqueue_style(  'ctfkh-style',  CTFKH_URL . 'assets/css/header.css', array( 'ctfkh-fa' ), CTFKH_VERSION );
    wp_enqueue_script( 'ctfkh-script', CTFKH_URL . 'assets/js/header.js',   array( 'jquery' ),  CTFKH_VERSION, true );

    // BUG 1 FIX: Pass all required data to JS via wp_localize_script.
    // Without this, ctfkData is undefined in JS and all AJAX calls use wrong URLs.
    $cart_url = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' );
    wp_localize_script( 'ctfkh-script', 'ctfkData', array(
        'ajaxUrl' => admin_url( 'admin-ajax.php' ),
        'wcAjax'  => home_url( '/?wc-ajax=' ),
        'cartUrl' => $cart_url,
        // BUG 2 FIX: Pass a proper nonce for ctfkh_update_cart AJAX handler.
        // The old JS scraped the cart page HTML to steal a WC nonce — fragile and wrong.
        'nonce'   => wp_create_nonce( 'ctfkh_update_cart' ),
    ) );
}

add_shortcode( 'ctfk_header', 'ctfkh_shortcode' );
function ctfkh_shortcode( $atts ) {
    if ( ! function_exists( 'WC' ) ) {
        return '<p>WooCommerce is required for the header component.</p>';
    }

    $atts = shortcode_atts( array(
        'logo_main'     => 'CREATIVE TOUCH',
        'logo_sub'      => 'FASHION KATHMANDU',
        'menu_location' => 'primary',
        'cart_url'      => '',
    ), $atts, 'ctfk_header' );

    $logo_url    = ctfkh_get_logo_url();
    $home_url    = home_url( '/' );
    $account_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : wp_login_url();
    $cart_url    = ! empty( $atts['cart_url'] ) ? $atts['cart_url'] : ( function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' ) );
    $cart_count  = ( WC()->cart ) ? (int) WC()->cart->get_cart_contents_count() : 0;
    $cart_total  = ( WC()->cart ) ? wp_strip_all_tags( WC()->cart->get_cart_total() ) : '';
    $menu_items  = ctfkh_get_menu_items( $atts['menu_location'] );

    ob_start();
    ?>
    <header class="mobile-header">
        <div class="menu-icon" id="menuIconBtn">
            <i class="fa-solid fa-bars"></i>
        </div>

        <div class="desktop-nav">
            <?php foreach ( $menu_items as $item ) : ?>
                <a href="<?php echo esc_url( $item['url'] ); ?>"><?php echo esc_html( $item['title'] ); ?></a>
            <?php endforeach; ?>
        </div>

        <div class="logo">
            <a href="<?php echo esc_url( $home_url ); ?>" style="display:flex;align-items:center;gap:6px;text-decoration:none;">
                <?php if ( $logo_url ) : ?>
                    <img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>" style="max-height: 50px; width: auto;">
                <?php endif; ?>
                <div class="logo-text">
                    <span class="logo-main"><?php echo esc_html( $atts['logo_main'] ); ?></span>
                    <span class="logo-sub"><?php echo esc_html( $atts['logo_sub'] ); ?></span>
                </div>
            </a>
        </div>

        <div class="header-icons">
            <button class="search-icon-btn" id="searchIconBtn" aria-label="Search" type="button">
                <i class="fa-solid fa-magnifying-glass"></i>
            </button>

            <a href="<?php echo esc_url( $account_url ); ?>" class="profile-icon" aria-label="My account">
                <i class="fa-regular fa-user"></i>
            </a>

            <div class="elementor-element elementor-element-68666c4">
                <div class="elementor-menu-cart__wrapper">
                    <div class="elementor-menu-cart__toggle_wrapper">
                        <div class="elementor-menu-cart__toggle elementor-button-wrapper">
                            <a id="elementor-menu-cart__toggle_button" href="#" class="elementor-menu-cart__toggle_button elementor-button elementor-size-sm" aria-expanded="false">
                                <?php if ( $cart_total ) : ?>
                                    <span class="elementor-button-text">
                                        <span class="woocommerce-Price-amount"><?php echo wp_kses_post( $cart_total ); ?></span>
                                    </span>
                                <?php endif; ?>
                                <span class="elementor-button-icon">
                                    <span class="elementor-button-icon-qty" data-counter="<?php echo esc_attr( $cart_count ); ?>" id="cartCount"><?php echo esc_html( $cart_count ); ?></span>
                                    <svg class="e-font-icon-svg e-eicon-cart-medium" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"><path d="M740 854C740 883 763 906 792 906S844 883 844 854 820 802 792 802 740 825 740 854ZM217 156H958C977 156 992 173 989 191L957 452C950 509 901 552 843 552H297L303 581C311 625 350 656 395 656H875C892 656 906 670 906 687S892 719 875 719H394C320 719 255 666 241 593L141 94H42C25 94 10 80 10 62S25 31 42 31H167C182 31 195 42 198 56L217 156ZM230 219L284 490H843C869 490 891 470 895 444L923 219H230ZM677 854C677 791 728 740 792 740S906 791 906 854 855 969 792 969 677 918 677 854ZM260 854C260 791 312 740 375 740S490 791 490 854 438 969 375 969 260 918 260 854ZM323 854C323 883 346 906 375 906S427 883 427 854 404 802 375 802 323 825 323 854Z"/></svg>
                                    <span class="elementor-screen-only">Basket</span>
                                </span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div class="search-overlay" id="searchOverlay">
        <div class="search-overlay-inner">
            <form role="search" method="get" action="<?php echo esc_url( $home_url ); ?>" class="search-overlay-form">
                <input type="hidden" name="post_type" value="product">
                <input type="search" class="search-overlay-input" id="searchOverlayInput" name="s" placeholder="Search" autocomplete="off">
                <button type="submit" class="search-overlay-submit" aria-label="Search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </button>
            </form>
            <button class="search-overlay-close" id="searchOverlayClose" aria-label="Close search" type="button">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    </div>

    <div id="mobileMenu" class="mobile-menu" style="left: -300px;">
        <span class="close-menu" id="closeMenuBtn"><span>&#x2715;</span></span>
        <?php foreach ( $menu_items as $item ) : ?>
            <a href="<?php echo esc_url( $item['url'] ); ?>">
                <i class="<?php echo esc_attr( ctfkh_menu_icon( $item['title'] ) ); ?>"></i>
                <?php echo esc_html( $item['title'] ); ?>
            </a>
        <?php endforeach; ?>
    </div>

    <div id="basketPopupOverlay" class="basket-popup-overlay" style="display: none;">
        <div class="basket-popup">
            <span class="close-popup-icon" id="closePopupBtn"><i class="fa-solid fa-xmark"></i></span>
            <h3><i class="fa-solid fa-cart-shopping"></i> Your Basket</h3>
            <div id="popupCartItems" class="popup-cart-items">
                <div class="loading-spinner">Loading your items...</div>
            </div>
            <div id="popupCartTotal" class="popup-total"></div>
            <!-- BUG 3 FIX: This button was completely missing from the PHP shortcode output.
                 JS grabbed it on load and immediately crashed with a null error,
                 silently killing ALL cart functionality below this line. -->
            <button id="updateCartBtn" class="update-cart-btn" style="display: none;">Update Cart</button>
            <div class="popup-buttons">
                <button id="continueShoppingBtn">Continue shopping</button>
                <button id="viewBasketBtn" class="view-basket-btn">View basket</button>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

function ctfkh_get_logo_url() {
    $id = get_theme_mod( 'custom_logo' );
    if ( $id ) {
        $src = wp_get_attachment_image_src( $id, 'full' );
        if ( ! empty( $src[0] ) ) return $src[0];
    }
    return '';
}

function ctfkh_get_menu_items( $location = 'primary' ) {
    $locations = get_nav_menu_locations();
    $menu_id   = isset( $locations[ $location ] ) ? $locations[ $location ] : 0;

    $defaults = array(
        array( 'title' => 'Shop',       'url' => home_url( '/shop/' ) ),
        array( 'title' => 'Collection', 'url' => home_url( '/collections/' ) ),
        array( 'title' => 'Wholesale',  'url' => home_url( '/wholesale/' ) ),
        array( 'title' => 'Our story',  'url' => home_url( '/our-story/' ) ),
        array( 'title' => 'FAQ',        'url' => home_url( '/faq/' ) ),
        array( 'title' => 'Blog',       'url' => home_url( '/blog/' ) ),
        array( 'title' => 'Contact',    'url' => home_url( '/contact/' ) ),
    );

    if ( ! $menu_id ) return $defaults;
    $items = wp_get_nav_menu_items( $menu_id );
    if ( empty( $items ) ) return $defaults;

    $result = array();
    foreach ( $items as $item ) {
        if ( (int) $item->menu_item_parent !== 0 ) continue;
        $result[] = array( 'title' => $item->title, 'url' => $item->url );
    }
    return $result;
}

function ctfkh_menu_icon( $title ) {
    $map = array(
        'shop'       => 'fa-solid fa-cart-shopping',
        'collection' => 'fa-solid fa-table-list',
        'wholesale'  => 'fa-solid fa-layer-group',
        'our story'  => 'fa-solid fa-users',
        'our-story'  => 'fa-solid fa-users',
        'faq'        => 'fa-solid fa-circle-question',
        'blog'       => 'fa-solid fa-newspaper',
        'contact'    => 'fa-solid fa-envelope',
    );
    $key = strtolower( trim( $title ) );
    return isset( $map[ $key ] ) ? $map[ $key ] : 'fa-solid fa-circle';
}

// =========================================================
// AJAX HANDLER — update cart quantity or remove item
// =========================================================
add_action( 'wp_ajax_ctfkh_update_cart',        'ctfkh_update_cart_ajax' );
add_action( 'wp_ajax_nopriv_ctfkh_update_cart', 'ctfkh_update_cart_ajax' );

function ctfkh_update_cart_ajax() {
    // Verify the nonce passed from JS (ctfkData.nonce)
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), 'ctfkh_update_cart' ) ) {
        wp_send_json_error( 'Security check failed', 403 );
    }

    if ( ! isset( $_POST['cart_item_key'] ) || ! isset( $_POST['qty'] ) || ! WC()->cart ) {
        wp_send_json_error( 'Invalid data', 400 );
    }

    $cart_item_key = sanitize_text_field( wp_unslash( $_POST['cart_item_key'] ) );
    $qty           = (int) $_POST['qty'];

    if ( $qty <= 0 ) {
        WC()->cart->remove_cart_item( $cart_item_key );
    } else {
        WC()->cart->set_quantity( $cart_item_key, $qty, true );
    }

    WC()->cart->calculate_totals();

    if ( WC()->session ) {
        WC()->session->set_customer_session_cookie( true );
        WC()->session->save_data();
    }

    // Return updated counts so JS can update the badge without a second AJAX call
    wp_send_json_success( array(
        'cart_count' => (int) WC()->cart->get_cart_contents_count(),
        'cart_total' => wp_strip_all_tags( WC()->cart->get_cart_total() ),
    ) );
}
