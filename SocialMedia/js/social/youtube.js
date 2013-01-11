require([
    "dojo/_base/declare",
    "dojo/_base/connect",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/_base/event",
    "dojo/io-query",
    "dojo/date/locale",
    "esri", // We're not directly using anything defined in esri.js but geometry, locator and utils are not AMD. So, the only way to get reference to esri object is through esri module (ie. esri/main)
    "esri/geometry",
    "esri/utils"
],
function (declare, connect, arr, lang, event, ioQuery, locale, esri) {
    var Widget = declare("social.youtube", null, {
        constructor: function (options) {
            var _self = this;
            this.options = {
                filterUsers: [],
                filterWords: [],
                autopage: true,
                maxpage: 6,
                limit: 50,
                title: '',
                id: 'youtube',
                searchTerm: '',
                symbolUrl: '',
                symbolHeight: 22.5,
                symbolWidth: 18.75,
                popupHeight: 200,
                popupWidth: 290,
                key: '',
                range: 'all_time'
            };
            declare.safeMixin(this.options, options);
            if (this.options.map === null) {
                throw 'Reference to esri.Map object required';
            }
            this.baseurl = location.protocol + "//gdata.youtube.com/feeds/api/videos";
            this.featureCollection = {
                layerDefinition: {
                    "geometryType": "esriGeometryPoint",
                    "drawingInfo": {
                        "renderer": {
                            "type": "simple",
                            "symbol": {
                                "type": "esriPMS",
                                "url": this.options.symbolUrl,
                                "contentType": "image/" + this.options.symbolUrl.substring(this.options.symbolUrl.lastIndexOf(".") + 1),
                                "width": this.options.symbolWidth,
                                "height": this.options.symbolHeight
                            }
                        }
                    },
                    "fields": [{
                        "name": "OBJECTID",
                        "type": "esriFieldTypeOID"
                    }, {
                        "name": "smType",
                        "type": "esriFieldTypeString",
                        "alias": "smType",
                        "length": 100
                    }, {
                        "name": "published",
                        "type": "esriFieldTypeDate",
                        "alias": "Created"
                    }, {
                        "name": "updated",
                        "type": "esriFieldTypeDate",
                        "alias": "Updated"
                    }, {
                        "name": "id",
                        "type": "esriFieldTypeString",
                        "alias": "id",
                        "length": 100
                    }, {
                        "name": "description",
                        "type": "esriFieldTypeString",
                        "alias": "description",
                        "length": 500
                    }, {
                        "name": "author",
                        "type": "esriFieldTypeString",
                        "alias": "Author",
                        "length": 100
                    }, {
                        "name": "thumbnail",
                        "type": "esriFieldTypeString",
                        "alias": "Thumbnail",
                        "length": 100
                    }, {
                        "name": "location",
                        "type": "esriFieldTypeString",
                        "alias": "Location",
                        "length": 1073741822
                    }, {
                        "name": "src",
                        "type": "esriFieldTypeString",
                        "alias": "Source",
                        "length": 100
                    }, {
                        "name": "title",
                        "type": "esriFieldTypeString",
                        "alias": "Title",
                        "length": 1073741822
                    }],
                    "globalIdField": "id",
                    "displayField": "title"
                },
                featureSet: {
                    "features": [],
                    "geometryType": "esriGeometryPoint"
                }
            };
            this.infoTemplate = new esri.InfoTemplate();
            this.infoTemplate.setTitle(function (graphic) {
                return _self.options.title;
            });
            this.infoTemplate.setContent(function (graphic) {
                return _self.getWindowContent(graphic, _self);
            });
            this.featureLayer = new esri.layers.FeatureLayer(this.featureCollection, {
                id: this.options.id,
                outFields: ["*"],
                infoTemplate: this.infoTemplate,
                visible: true
            });
            this.options.map.addLayer(this.featureLayer);
            connect.connect(this.featureLayer, "onClick", lang.hitch(this, function (evt) {
                event.stop(evt);
                var query = new esri.tasks.Query();
                query.geometry = this.pointToExtent(this.options.map, evt.mapPoint, this.options.symbolWidth);
                var deferred = this.featureLayer.selectFeatures(query, esri.layers.FeatureLayer.SELECTION_NEW);
                this.options.map.infoWindow.setFeatures([deferred]);
                this.options.map.infoWindow.show(evt.mapPoint);
                this.options.map.infoWindow.resize(this.options.popupWidth, this.options.popupHeight);
            }));
            this.stats = {
                geoPoints: 0,
                geoNames: 0,
                noGeo: 0
            };
            this.dataPoints = [];
            this.deferreds = [];
            this.geocoded_ids = {};
            this.loaded = true;
        },
        update: function (options) {
            declare.safeMixin(this.options, options);
            this.constructQuery(this.options.searchTerm);
        },
        pointToExtent: function (map, point, toleranceInPixel) {
            var pixelWidth = map.extent.getWidth() / map.width;
            var toleraceInMapCoords = toleranceInPixel * pixelWidth;
            return new esri.geometry.Extent(point.x - toleraceInMapCoords, point.y - toleraceInMapCoords, point.x + toleraceInMapCoords, point.y + toleraceInMapCoords, map.spatialReference);
        },
        show: function () {
            this.featureLayer.setVisibility(true);
        },
        formatDate: function (dateObj) {
            if (dateObj) {
                return locale.format(dateObj, {
                    datePattern: "h:mma",
                    selector: "date"
                }).toLowerCase() + ' &middot; ' + locale.format(dateObj, {
                    datePattern: "d MMM yy",
                    selector: "date"
                });
            }
        },
        hide: function () {
            this.featureLayer.setVisibility(false);
        },
        setVisibility: function (val) {
            if (val) {
                this.show();
            } else {
                this.hide();
            }
        },
        clear: function () {
            // cancel any outstanding requests
            this.query = null;
            arr.forEach(this.deferreds, function (def) {
                def.cancel();
            });
            if (this.deferreds) {
                this.deferreds.length = 0;
            }
            // remove existing videos
            if (this.options.map.infoWindow.isShowing) {
                this.options.map.infoWindow.hide();
            }
            if (this.featureLayer.graphics.length > 0) {
                this.featureLayer.applyEdits(null, null, this.featureLayer.graphics);
            }
            // clear data and stats
            this.stats = {
                geoPoints: 0,
                noGeo: 0,
                geoNames: 0
            };
            this.dataPoints = [];
            this.geocoded_ids = {};
            this.onClear();
        },
        getStats: function () {
            var x = this.stats;
            x.total = this.stats.geoPoints + this.stats.noGeo + this.stats.geoNames;
            return x;
        },
        // Parse Links
        parseURL: function (text) {
            return text.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function (url) {
                return '<a target="_blank" href="' + url + '">' + url + '</a>';
            });
        },
        getPoints: function () {
            return this.dataPoints;
        },
        getExtent: function () {
            return esri.graphicsExtent(this.featureLayer.graphics);
        },
        getRadius: function () {
            var map = this.options.map;
            var extent = map.extent;
            this.maxRadius = 621;
            var radius = Math.min(this.maxRadius, Math.ceil(esri.geometry.getLength(new esri.geometry.Point(extent.xmin, extent.ymin, map.spatialReference), new esri.geometry.Point(extent.xmax, extent.ymin, map.spatialReference)) * 3.281 / 5280 / 2));
            radius = Math.round(radius, 0);
            var geoPoint = esri.geometry.webMercatorToGeographic(map.extent.getCenter());
            return {
                radius: radius,
                center: geoPoint,
                units: "mi"
            };
        },
        getWindowContent: function (graphic, _self) {
            var mdy = graphic.attributes.published.$t.substring(0, 10);
            var time = graphic.attributes.published.$t.substring(11, 19);
            var date = locale.parse(mdy + '-' + time, {
                selector: "date",
                datePattern: "y-M-d-H:m:s"
            });
            var linkedText = _self.parseURL(graphic.attributes.media$group.media$description.$t);
            var videoWidth = 250;
            var videoHeight = 188;
            if (graphic.attributes.media$group.yt$aspectRatio) {
                videoHeight = 140;
            }
            var html = '';
            html += '<div class="ytContent">';
            html += '<div class="video" style="width:' + videoWidth + 'px;height:' + videoHeight + 'px;">';
            html += '<iframe width="' + videoWidth + '" height="' + videoHeight + '" src="' + location.protocol + '//www.youtube.com/embed/' + graphic.attributes.media$group.yt$videoid.$t + '?wmode=opaque" frameborder="0" allowfullscreen></iframe>';
            html += '</div>';
            html += '<h3 class="title">' + graphic.attributes.title.$t + '</h3>';
            html += '<div class="username"><a tabindex="0" href="' + location.protocol + '//www.youtube.com/user/' + graphic.attributes.author[0].name.$t + '" target="_blank">' + graphic.attributes.author[0].name.$t + '</a></div>';
            html += '<div class="content">' + linkedText + '</div>';
            html += '<div class="date">' + this.formatDate(date) + '</div>';
            html += '</div>';
            return html;
        },
        constructQuery: function (searchValue) {
            var radius = this.getRadius();
            var search = lang.trim(searchValue);
            if (search.length === 0) {
                search = "";
            }
            var range = this.options.range;
            this.query = {
                "q": search,
                "max-results": this.options.limit,
                "v": 2,
                "location": radius.center.y + "," + radius.center.x,
                "location-radius": radius.radius + radius.units,
                "time": range,
                "start-index": 1,
                "alt": "json"
            };
            if (this.options.key) {
                this.query.key = this.options.key;
            }
            // make the actual YouTube API call
            this.pageCount = 1;
            this.sendRequest(this.baseurl + "?" + ioQuery.objectToQuery(this.query));
        },
        sendRequest: function (url) {
            // get the results from YouTube for each page
            var deferred = esri.request({
                url: url,
                timeout: 10000,
                handleAs: "json",
                preventCache: true,
                callbackParamName: "callback",
                load: lang.hitch(this, function (data) {
                    if (data.feed.entry) {
                        if (data.feed.entry.length > 0) {
                            this.mapResults(data);
                            // display results from multiple pages
                            if ((this.options.autopage) && (this.options.maxpage > this.pageCount) && (data.feed.entry.length >= this.options.limit) && (this.query)) {
                                this.pageCount++;
                                this.query["start-index"] += this.options.limit;
                                this.sendRequest(this.baseurl + "?" + ioQuery.objectToQuery(this.query));
                            } else {
                                this.onUpdateEnd();
                            }
                        } else {
                            // No results found, try another search term
                            this.onUpdateEnd();
                        }
                    } else {
                        this.onUpdateEnd();
                    }
                }),
                error: lang.hitch(this, function (e) {
                    if (deferred.canceled) {
                        console.log('Search Cancelled');
                    } else {
                        console.log('Search error' + ": " + e.message);
                    }
                    this.onError(e);
                })
            });
            this.deferreds.push(deferred);
        },
        unbindDef: function (dfd) {
            // if deferred has already finished, remove from deferreds array
            var index = arr.indexOf(this.deferreds, dfd);
            if (index === -1) {
                return; // did not find
            }
            this.deferreds.splice(index, 1);
            if (!this.deferreds.length) {
                return 2; // indicates we received results from all expected deferreds
            }
            return 1; // found and removed
        },
        findWordInText: function (word, text) {
            if (word && text) {
                // text
                var searchString = text.toLowerCase();
                // word
                var badWord = ' ' + word.toLowerCase() + ' ';
                // IF FOUND
                if (searchString.indexOf(badWord) > -1) {
                    return true;
                }
            }
            return false;
        },
        mapResults: function (j) {
            var _self = this;
            if (j.error) {
                console.log('Search error' + ": " + j.error);
                this.onError(j.error);
                return;
            }
            var b = [];
            var k = j.feed.entry;
            arr.forEach(k, lang.hitch(this, function (result) {
                result.smType = this.options.id;
                result.filterType = 3;
                result.filterContent = result.link[0].href;
                result.filterAuthor = result.author[0].yt$userId.$t;
                // eliminate video ids which we already have on the map
                if (this.geocoded_ids[result.id.$t]) {
                    return;
                }
                // filter variable
                var filter = false,
                    i;
                // check for filterd user
                if (_self.options.filterUsers && _self.options.filterUsers.length) {
                    for (i = 0; i < _self.options.filterUsers.length; i++) {
                        if (_self.options.filterUsers[i].toString() === result.author[0].yt$userId.$t.toString()) {
                            filter = true;
                            break;
                        }
                    }
                }
                // check if contains bad word
                if (!filter && _self.options.filterWords && _self.options.filterWords.length) {
                    for (i = 0; i < _self.options.filterWords.length; i++) {
                        if (_self.findWordInText(_self.options.filterWords[i], result.title.$t)) {
                            filter = true;
                            break;
                        }
                        if (_self.findWordInText(_self.options.filterWords[i], result.media$group.media$description.$t)) {
                            filter = true;
                            break;
                        }
                    }
                }
                // if this feature needs to be filtered
                if (filter) {
                    return;
                }
                this.geocoded_ids[result.id.$t] = true;
                var geoPoint = null;
                if (result.georss$where) {
                    if (result.georss$where.gml$Point) {
                        if (result.georss$where.gml$Point.gml$pos) {
                            var g = result.georss$where.gml$Point.gml$pos.$t.split(' ');
                            geoPoint = new esri.geometry.Point(parseFloat(g[1]), parseFloat(g[0]));
                        }
                    }
                }
                if (geoPoint) {
                    if (isNaN(geoPoint.x) || isNaN(geoPoint.y)) {
                        this.stats.noGeo++;
                    } else {
                        // convert the Point to WebMercator projection
                        var a = new esri.geometry.geographicToWebMercator(geoPoint);
                        // make the Point into a Graphic
                        var graphic = new esri.Graphic(a);
                        graphic.setAttributes(result);
                        b.push(graphic);
                        this.dataPoints.push({
                            geometry: {
                                x: a.x,
                                y: a.y
                            },
                            symbol: esri.symbol.PictureMarkerSymbol(this.featureCollection.layerDefinition.drawingInfo.renderer.symbol),
                            attributes: result
                        });
                        this.stats.geoPoints++;
                    }
                } else {
                    this.stats.noGeo++;
                }
            }));
            this.featureLayer.applyEdits(b, null, null);
            this.onUpdate();
        },
        onClear: function () {},
        onUpdate: function () {},
        onUpdateEnd: function () {
            this.query = null;
        },
        onError: function (info) {
            this.onUpdateEnd();
        }
    });
    return Widget;
});