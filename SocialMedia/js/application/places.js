// create places item
function createPlacesListItem(i) {
    // default vars //
    var html = '';
    // list html
    html += '<li data-index="' + i + '" class="layer sharedItem placesClick">';
    html += configOptions.bookmarks[i].name.replace(/[\-_]/g, " ");
    html += '</li>';
    // insert list item
    var node = dojo.byId('placesList');
    if (node) {
        dojo.place(html, node, "last");
    }
}

// zoom to location: zooms map to location point
function zoomToLocation(x, y, IPAccuracy) {
    var lod = 16;
    // set point
    var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(x, y));
    // zoom and center
    map.centerAndZoom(pt, lod);
}

// geolocation error
function geoLocateMapError(error) {
    alertDialog(error.toString());
}

// geolocate function: sets map location to users location
function geoLocateMap(position) {
    if (position) {
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;
        var IPAccuracy = position.coords.accuracy;
        zoomToLocation(longitude, latitude, IPAccuracy);
    }
}

// configure places
function placesOnClick() {
    // places click
    dojo.query(document).delegate("#placesList .placesClick", "onclick,keyup", function (event) {
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
            objIndex = dojo.query(this).attr('data-index');
            if (objIndex !== -1) {
                // create extent
                var newExtent = new esri.geometry.Extent(configOptions.bookmarks[objIndex].extent);
                // set extent
                map.setExtent(newExtent);
                hideAllMenus();
            }
        }
    });
    // places click
    dojo.query(document).delegate("#placesButton", "onclick,keyup", function (event) {
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
            toggleMenus('places');
        }
    });
}

// configure places
function configurePlaces() {
    // if places
    if (configOptions.showPlaces) {
        if (configOptions.bookmarks && configOptions.bookmarks.length > 0) {
            // insert places button
            var node = dojo.byId('placesCon');
            if (node) {
                node.innerHTML = '<span tabindex="0" id="placesButton" class="barButton" data-menu="places" title="' + i18n.viewer.places.placesTitle + '"><span class="barIcon placesMenuIcon"></span>' + i18n.viewer.places.places + '</span>';
            }
            // create list
            node = dojo.byId('placesMenu');
            if (node) {
                node.innerHTML = '<div class="menuClose"><div class="closeButton closeMenu"></div>' + i18n.viewer.places.menuTitle + '<div class="clear"></div></div><ul class="zebraStripes" id="placesList"></ul>';
            }
            // if share object
            for (i = 0; i < configOptions.bookmarks.length; i++) {
                createPlacesListItem(i);
            }
            // set on clicks
            placesOnClick();
            zebraStripe(dojo.query('#placesList li.layer'));
        } else {
            configOptions.showPlaces = false;
        }
    }
}