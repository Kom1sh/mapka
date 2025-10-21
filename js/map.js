document.addEventListener('DOMContentLoaded', function() {
    // Функция initMap будет вызвана автоматически после загрузки API
});

// Выносим функцию в глобальную область видимости
async function initMap() {
    await ymaps3.ready;

    const {YMap, YMapDefaultSchemeLayer} = ymaps3;

    const map = new YMap(
        document.getElementById('map'),
        {
            location: {
                center: [37.588144, 55.733842], // Москва
                zoom: 10
            }
        }
    );

    map.addChild(new YMapDefaultSchemeLayer());
}