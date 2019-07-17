$('.icr-main-sub-navigation--mobile-dropdown').click(function() {
    $(this).toggleClass("arrowToogle");
    $('.icr-main-sub-navigation--mobile ul').toggleClass("menuHide");
});

$('a.smooth-scroll').click(function(){
    $('html, body').animate({
        scrollTop: $( $(this).attr('href') ).offset().top
    }, 1000);
    return false;
});