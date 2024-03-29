require([
    "dojo/_base/kernel",
    "dojo/request/script",
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
function (dojo, script, declare, connect, arr, lang, event, ioQuery, locale, esri) {
    var Widget = declare("social.twitter", null, {
        constructor: function (options) {
            var _self = this;
            this.options = {
                filterUsers: [],
                filterWords: [],
                autopage: true,
                maxpage: 6,
                limit: 100,
                title: '',
                id: 'twitter',
                searchTerm: '',
                symbolUrl: '',
                symbolHeight: 22.5,
                symbolWidth: 18.75,
                popupHeight: 200,
                popupWidth: 290,
                result_type: 'recent'
            };
            declare.safeMixin(this.options, options);
            if (this.options.map === null) {
                throw 'Reference to esri.Map object required';
            }
            this.baseurl = location.protocol + "//search.twitter.com/search.json";
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
                        "name": "created_at",
                        "type": "esriFieldTypeDate",
                        "alias": "Created"
                    }, {
                        "name": "id",
                        "type": "esriFieldTypeString",
                        "alias": "id",
                        "length": 100
                    }, {
                        "name": "from_user",
                        "type": "esriFieldTypeString",
                        "alias": "User",
                        "length": 100
                    }, {
                        "name": "location",
                        "type": "esriFieldTypeString",
                        "alias": "Location",
                        "length": 1073741822
                    }, {
                        "name": "place",
                        "type": "esriFieldTypeString",
                        "alias": "Place",
                        "length": 100
                    }, {
                        "name": "text",
                        "type": "esriFieldTypeString",
                        "alias": "Text",
                        "length": 1073741822
                    }, {
                        "name": "profile_image_url",
                        "type": "esriFieldTypeString",
                        "alias": "ProfileImage",
                        "length": 255
                    }],
                    "globalIdField": "id",
                    "displayField": "from_user"
                },
                featureSet: {
                    "features": [],
                    "geometryType": "esriGeometryPoint"
                }
            };
            this.infoTemplate = new esri.InfoTemplate();
            this.infoTemplate.setTitle(function (graphic) {
                return _self.config.title;
            });
            this.infoTemplate.setContent(function (graphic) {
                return _self.getWindowContent(graphic, _self);
            });
            script.get(location.protocol + '//platform.twitter.com/widgets.js', {}).then(function () {}, function (err) {
                console.log(err.toString());
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
        getStats: function () {
            var x = this.stats;
            x.total = this.stats.geoPoints + this.stats.noGeo + this.stats.geoNames;
            return x;
        },
        parseURL: function (text) {
            return text.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function (url) {
                return '<a target="_blank" href="' + url + '">' + url + '</a>';
            });
        },
        parseUsername: function (text) {
            return text.replace(/[@]+[A-Za-z0-9-_]+/g, function (u) {
                var username = u.replace("@", "");
                return '<a target="_blank" href="' + location.protocol + '//twitter.com/' + username + '">' + u + '</a>';
            });
        },
        parseHashtag: function (text) {
            return text.replace(/[#]+[A-Za-z0-9-_]+/g, function (t) {
                var tag = t.replace("#", "%23");
                return '<a target="_blank" href="' + location.protocol + '//search.twitter.com/search?q=' + tag + '">' + t + '</a>';
            });
        },
        getPoints: function () {
            return this.dataPoints;
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
            // remove existing tweets
            if (this.options.map.infoWindow.isShowing) {
                this.options.map.infoWindow.hide();
            }
            if (this.featureLayer.graphics.length > 0) {
                this.featureLayer.applyEdits(null, null, this.featureLayer.graphics);
            }
            // clear stats and points
            this.stats = {
                geoPoints: 0,
                noGeo: 0,
                geoNames: 0
            };
            this.dataPoints = [];
            this.geocoded_ids = {};
            this.onClear();
        },
        show: function () {
            this.featureLayer.setVisibility(true);
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
        getExtent: function () {
            return esri.graphicsExtent(this.featureLayer.graphics);
        },
        // Format Date Object
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
        getRadius: function () {
            var map = this.options.map;
            var extent = map.extent;
            this.maxRadius = 932;
            var radius = Math.min(this.maxRadius, Math.ceil(esri.geometry.getLength(new esri.geometry.Point(extent.xmin, extent.ymin, map.spatialReference), new esri.geometry.Point(extent.xmax, extent.ymin, map.spatialReference)) * 3.281 / 5280 / 2));
            radius = Math.round(radius, 0);
            var geoPoint = esri.geometry.webMercatorToGeographic(extent.getCenter());
            return {
                radius: radius,
                center: geoPoint,
                units: "mi"
            };
        },
        getWindowContent: function (graphic, _self) {
            var date = new Date(graphic.attributes.created_at);
            var linkedText = _self.parseURL(graphic.attributes.text);
            linkedText = _self.parseUsername(linkedText);
            linkedText = _self.parseHashtag(linkedText);
            // define content for the tweet pop-up window.
            var html = '';
            html += '<div class="twContent">';
            if (graphic.attributes.profile_image_url) {
                var imageURL;
                if (location.protocol === "https:") {
                    imageURL = graphic.attributes.profile_image_url_https;
                } else {
                    imageURL = graphic.attributes.profile_image_url;
                }
                html += '<a tabindex="0" class="twImage" href="' + location.protocol + '//twitter.com/' + graphic.attributes.from_user + '/statuses/' + graphic.attributes.id_str + '" target="_blank"><img class="shadow" src="' + imageURL + '" width="40" height="40"></a>';
            }
            html += '<div class="followButton"><iframe allowtransparency="true" frameborder="0" scrolling="no" src="//platform.twitter.com/widgets/follow_button.html?screen_name=' + graphic.attributes.from_user + '&lang=' + locale + '&show_count=false&show_screen_name=false" style="width:60px; height:20px;"></iframe></div>';
            html += '<h3 class="twUsername">' + graphic.attributes.from_user_name + '</h3>';
            html += '<div class="twUser"><a target="_blank" href="' + location.protocol + '//twitter.com/' + graphic.attributes.from_user + '">&#64;' + graphic.attributes.from_user + '</a></div>';
            html += '<div class="clear"></div>';
            html += '<div class="tweet">' + linkedText + '</div>';
            if (graphic.attributes.created_at) {
                html += '<div class="twDate"><a target="_blank" href="' + location.protocol + '//twitter.com/' + graphic.attributes.from_user + '/statuses/' + graphic.attributes.id_str + '">' + this.formatDate(date) + '</a></div>';
            }
            var tmp = dojo.locale.split('-');
            var locale = 'en';
            if (tmp[0]) {
                locale = tmp[0];
            }
            html += '<div class="actions">';
            html += '<a title="" class="reply" href="https://twitter.com/intent/tweet?in_reply_to=' + graphic.attributes.id_str + '&lang=' + locale + '"></a> ';
            html += '<a title="" class="retweet" href="https://twitter.com/intent/retweet?tweet_id=' + graphic.attributes.id_str + '&lang=' + locale + '"></a> ';
            html += '<a title="" class="favorite" href="https://twitter.com/intent/favorite?tweet_id=' + graphic.attributes.id_str + '&lang=' + locale + '"></a> ';
            html += '</div>';
            html += '</div>';
            return html;
        },
        constructQuery: function (searchValue) {
            var radius = this.getRadius();
            var search = lang.trim(searchValue);
            if (search.length === 0) {
                search = "";
            }
            var locale = false;
            var localeTmp = dojo.locale.split('-');
            if (localeTmp[0]) {
                locale = localeTmp[0];
            }
            this.query = {
                q: search,
                rpp: this.options.limit,
                result_type: this.options.result_type,
                geocode: radius.center.y + "," + radius.center.x + "," + radius.radius + radius.units,
                page: 1
            };
            if (locale) {
                this.query.locale = locale;
            }
            // start Twitter API call of several pages
            this.pageCount = 1;
            this.sendRequest(this.baseurl + "?" + ioQuery.objectToQuery(this.query));
        },
        sendRequest: function (url) {
            // get the results from twitter for each page
            var deferred = esri.request({
                url: url,
                handleAs: "json",
                timeout: 10000,
                callbackParamName: "callback",
                preventCache: true,
                load: lang.hitch(this, function (data) {
                    if (data.results.length > 0) {
                        this.mapResults(data);
                        // display results for multiple pages
                        if ((this.options.autopage) && (this.options.maxpage > this.pageCount) && (data.next_page !== undefined) && (this.query)) {
                            this.pageCount++;
                            this.query.page++;
                            this.query.max_id = data.max_id;
                            this.sendRequest(this.baseurl + "?" + ioQuery.objectToQuery(this.query));
                        } else {
                            this.onUpdateEnd();
                        }
                    } else {
                        // No results found, try another search term
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
            var k = j.results;
            arr.forEach(k, lang.hitch(this, function (result) {
                result.smType = this.options.id;
                result.filterType = 2;
                result.filterContent = 'https://twitter.com/#!/' + result.from_user_id_str + '/status/' + result.id_str;
                result.filterAuthor = result.from_user_id;
                // eliminate Tweets which we have on the map
                if (this.geocoded_ids[result.id]) {
                    return;
                }
                // filter variable
                var filter = false,
                    i;
                // check for filterd user
                if (_self.options.filterUsers && _self.options.filterUsers.length) {
                    for (i = 0; i < _self.options.filterUsers.length; i++) {
                        if (_self.options.filterUsers[i].toString() === result.from_user_id.toString()) {
                            filter = true;
                            break;
                        }
                    }
                }
                // check if contains bad word
                if (!filter && _self.options.filterWords && _self.options.filterWords.length) {
                    for (i = 0; i < _self.options.filterWords.length; i++) {
                        if (_self.findWordInText(_self.options.filterWords[i], result.text)) {
                            filter = true;
                            break;
                        }
                    }
                }
                // if this feature needs to be filtered
                if (filter) {
                    return;
                }
                this.geocoded_ids[result.id] = true;
                var geoPoint = null;
                if (result.geo) {
                    var g = result.geo.coordinates;
                    geoPoint = new esri.geometry.Point(parseFloat(g[1]), parseFloat(g[0]));
                } else {
                    var n = result.location;
                    if (n) {
                        var c, d, e, f;
                        // try some different parsings for result.location
                        if (n.indexOf("iPhone:") > -1) {
                            n = n.slice(7);
                            f = n.split(",");
                            geoPoint = new esri.geometry.Point(parseFloat(f[1]), parseFloat(f[0]));
                        } else if (n.indexOf("�T") > -1) {
                            n = n.slice(3);
                            e = n.split(",");
                            geoPoint = new esri.geometry.Point(parseFloat(e[1]), parseFloat(e[0]));
                        } else if (n.indexOf("T") === 1) {
                            n = n.slice(3);
                            e = n.split(",");
                            geoPoint = new esri.geometry.Point(parseFloat(e[1]), parseFloat(e[0]));
                        } else if (n.indexOf("Pre:") > -1) {
                            n = n.slice(4);
                            d = n.split(",");
                            geoPoint = new esri.geometry.Point(parseFloat(d[1]), parseFloat(d[0]));
                        } else if (n.split(",").length === 2) {
                            c = n.split(",");
                            if (c.length === 2 && parseFloat(c[1]) && parseFloat(c[0])) {
                                geoPoint = new esri.geometry.Point(parseFloat(c[1]), parseFloat(c[0]));
                            } else {
                                // location cannot be interpreted by this geocoder
                                this.stats.geoNames++;
                                return;
                            }
                        } else {
                            // location cannot be interpreted by this geocoder
                            this.stats.geoNames++;
                            return;
                        }
                    } else {
                        // location cannot be interpreted by this geocoder
                        this.stats.geoNames++;
                        return;
                    }
                }
                if (geoPoint) {
                    // last check to make sure we parsed it right
                    if (isNaN(geoPoint.x) || isNaN(geoPoint.y) || (parseInt(geoPoint.x, 10) === 0 && parseInt(geoPoint.y, 10) === 0)) {
                        //discard bad geopoints
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
        onUpdate: function () {},
        onUpdateEnd: function () {
            this.query = null;
        },
        onClear: function () {},
        onError: function (info) {
            this.onUpdateEnd();
        }
    });
    return Widget;
});