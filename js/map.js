async function initMap() {
    await ymaps3.ready;

    const {YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer} = ymaps3;

    const rostovLocation = {
        center: [39.711515, 47.236171],
        zoom: 14
    };

    const map = new YMap(
        document.getElementById('map'),
        {
            location: rostovLocation
        }
    );

    map.addChild(new YMapDefaultSchemeLayer());
    map.addChild(new YMapDefaultFeaturesLayer());
}

initMap();