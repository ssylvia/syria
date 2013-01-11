require([
    "dojo/_base/declare",
    "dojo/_base/connect",
    "dojo/number",
    "dojo/_base/array",
    "dojo/_base/Color",
    "dojo/_base/html",
    "esri", // We're not directly using anything defined in esri.js but geometry, locator and utils are not AMD. So, the only way to get reference to esri object is through esri module (ie. esri/main)
    "esri/geometry",
    "esri/utils"
],
function (declare, connect, number, arr, Color, baseHTML, esri) {
    declare("modules.ClusterLayer", [esri.layers.DynamicMapServiceLayer], {
        // constructor
        constructor: function (data, options) {
            var instance = this;
            // set data
            this.data = data;
            // set defaults
            this.config = {
                label: 'Cluster',
                id: 'ClusterLayer',
                useLocalMaximum: true,
                pixelsSquare: 144,
                numRangeBreaks: 5,
                useDynamicRanges: true,
                minDynamicGraphicSize: 24,
                maxDynamicGraphicSize: 54,
                cornerOffset: 15,
                visible: true,
                clusterTextColor: [255, 255, 255],
                clusterTextSize: "12px",
                clusterTextStyle: esri.symbol.Font.STYLE_NORMAL,
                clusterTextVariant: esri.symbol.Font.VARIANT_NORMAL,
                clusterTextWeight: esri.symbol.Font.WEIGHT_NORMAL,
                clusterTextFamily: "Arial, Helvetica, sans-serif",
                staticRanges: [{
                    min: 2,
                    max: 5,
                    width: 24,
                    height: 24,
                    textrgb: [255, 255, 255]
                }, {
                    min: 6,
                    max: 25,
                    width: 39,
                    height: 39,
                    textrgb: [255, 255, 255]
                }, {
                    min: 26,
                    max: 999,
                    width: 54,
                    height: 54,
                    textrgb: [255, 255, 255]
                }],
                clusterImage: '',
                clusterHoverImage: ''
            };
            // mix in config for heatmap.js setting
            declare.safeMixin(this.config, options);
            // break point pattern variable
            this.pattern = [];
            // set visible property
            this.visible = this.config.visible;
            // map
            this._map = options.map;
            // collection
            this.featureCollection = {
                "layerDefinition": null,
                    "featureSet": {
                    "features": [],
                        "geometryType": "esriGeometryPoint"
                }
            };
            this.featureCollection.layerDefinition = {
                "geometryType": "esriGeometryPoint",
                    "objectIdField": "ObjectID",
                    "drawingInfo": {
                    "renderer": {
                        "type": "uniqueValue",
                            "field1": "smType",
                            "defaultLabel": this.config.label,
                            "defaultSymbol": {
                            "type": "esriPMS",
                                "url": this.config.clusterImage,
                                "contentType": "image/" + this.config.clusterImage.substring(this.config.clusterImage.lastIndexOf(".") + 1),
                                "width": this.config.minDynamicGraphicSize,
                                "height": this.config.minDynamicGraphicSize
                        },
                            "uniqueValueInfos": []
                    }
                },
                    "fields": [{
                    "name": "ObjectID",
                        "alias": "ObjectID",
                        "type": "esriFieldTypeOID"
                }, {
                    "name": "smType",
                        "type": "esriFieldTypeString",
                        "alias": "smType",
                        "length": 100
                }]
            };
            // graphics
            this.featureLayer = new esri.layers.FeatureLayer(this.featureCollection, {
                id: this.config.id,
                visible: this.config.visible
            });
            // if loaded
            if (this._map.loaded) {
                // add layer
                this._map.addLayer(this.featureLayer);
            } else {
                // onload
                connect.connect(this._map, "onLoad", function () {
                    // add layer
                    instance._map.addLayer(instance.featureLayer);
                });
            }
            // regrid connect
            connect.connect(this._map, "onZoomEnd", function () {
                instance.regrid();
            });
            // calculate break points
            this.setClusterBreaks();
            // draw
            this.draw();
            // set loaded
            this.loaded = true;
            // cluster hover
            if (this.config.clusterHoverImage) {
                connect.connect(this.featureLayer, "onMouseOver", function (evt) {
                    if (evt.graphic.attributes.parent) {
                        evt.graphic = evt.graphic.attributes.parent;
                    }
                    var symbol = evt.graphic.symbol;
                    if (symbol.url === instance.config.clusterImage) {
                        symbol.url = instance.config.clusterHoverImage;
                        evt.graphic.setSymbol(symbol);
                    }
                });
                connect.connect(this.featureLayer, "onMouseOut", function (evt) {
                    var symbol = evt.graphic.symbol;
                    if (symbol.url === instance.config.clusterHoverImage) {
                        symbol.url = instance.config.clusterImage;
                        evt.graphic.setSymbol(symbol);
                    }
                });
            }
        },
        setOpacity: function (opacity) {
            if (this.opacity !== opacity) {
                this.onOpacityChange(this.opacity = opacity);
            }
        },
        regrid: function () {
            this.setData(this.lastDataset);
        },
        // Set Data
        setData: function (dataPoints) {
            this.lastDataset = dataPoints;
            var clusteredData = {};
            var gridSquaresWide = (parseInt(baseHTML.coords(this._map.id).w, 10)) / (parseInt(this.config.pixelsSquare, 10));
            var gridSquareDivisor = (this._map.extent.xmax - this._map.extent.xmin) / gridSquaresWide;
            clusteredData.gridsquare = gridSquareDivisor;
            arr.forEach(dataPoints, function (geoPoint) {
                var geometry = geoPoint.geometry;
                var geoKey = Math.round(geometry.y / gridSquareDivisor) + "|" + Math.round(geometry.x / gridSquareDivisor);
                if (clusteredData[geoKey]) {
                    clusteredData[geoKey].count += 1;
                    clusteredData[geoKey].avgx += ((geometry.x - clusteredData[geoKey].avgx) / clusteredData[geoKey].count);
                    clusteredData[geoKey].avgy += ((geometry.y - clusteredData[geoKey].avgy) / clusteredData[geoKey].count);
                } else {
                    clusteredData[geoKey] = {
                        count: 1,
                        avgx: geometry.x,
                        avgy: geometry.y,
                        symbol: geoPoint.symbol,
                        attributes: geoPoint.attributes
                    };
                }
            });
            this.data = {
                data: clusteredData,
                noDataValue: [0]
            };
            clusteredData = {};
            this.setClusterBreaks();
            this.draw();
        },
        clear: function () {
            this.featureLayer.clear();
        },
        setVisibility: function (val) {
            this.featureLayer.setVisibility(val);
        },
        show: function () {
            this.featureLayer.show();
            this.visible = true;
        },
        hide: function () {
            this.featureLayer.hide();
            this.visible = false;
        },
        setClusterBreaks: function () {
            // clear thiz
            this.clear();
            // No date
            if (!this.data) {
                return;
            }
            // data
            var data = this.data,
                dataArray = data.data;
            // default variables
            var clusterNums = [];
            var breaks = 0;
            var graphicBreaks = 0;
            var minNum = 0;
            var maxNum = 0;
            var minGraphic = this.config.minDynamicGraphicSize;
            var maxGraphic = this.config.maxDynamicGraphicSize;
            // set pattern for singles with no clusters
            this.pattern[0] = {};
            this.pattern[0].min = 0;
            this.pattern[0].max = 1;
            var key;
            for (key in dataArray) {
                if (dataArray.hasOwnProperty(key)) {
                    var breakCount;
                    // cluster size
                    var count = parseInt(dataArray[key].count, 10);
                    // if dynamic ranges
                    if (this.config.useDynamicRanges) {
                        // set break count
                        breakCount = this.config.numRangeBreaks;
                        if (breakCount < 2) {
                            breakCount = 2;
                        }
                    } else {
                        // set static break count
                        breakCount = this.config.staticRanges.length;
                    }
                    // if cluster
                    if (count && count > 1) {
                        // cluster count array
                        clusterNums.push(count);
                        // cluster min/max
                        minNum = Math.min.apply(Math, clusterNums);
                        maxNum = Math.max.apply(Math, clusterNums);
                        // calculate breaks
                        breaks = Math.ceil((maxNum - minNum) / breakCount);
                        graphicBreaks = Math.ceil((maxGraphic - minGraphic) / (breakCount - 1));
                        // dynamic breaks
                        if (this.config.useDynamicRanges) {
                            // set patterns for clusters
                            for (i = 1; i <= breakCount; i++) {
                                // set common
                                this.pattern[i] = {};
                                this.pattern[i].symbol = {
                                    "type": "esriPMS",
                                        "url": this.config.clusterImage,
                                        "contentType": "image/" + this.config.clusterImage.substring(this.config.clusterImage.lastIndexOf(".") + 1)
                                };
                                // if first
                                if (i === 1) {
                                    this.pattern[i].min = minNum;
                                    this.pattern[i].max = (breaks);
                                    this.pattern[i].symbol.width = minGraphic;
                                    this.pattern[i].symbol.height = minGraphic;
                                }
                                // if last
                                else if (i === breakCount) {
                                    this.pattern[i].min = (breaks * (i - 1)) + 1;
                                    this.pattern[i].max = maxNum;
                                    this.pattern[i].symbol.width = maxGraphic;
                                    this.pattern[i].symbol.height = maxGraphic;
                                }
                                // otherwise
                                else {
                                    this.pattern[i].min = (breaks * (i - 1)) + 1;
                                    this.pattern[i].max = (breaks * i);
                                    this.pattern[i].symbol.width = minGraphic + ((i - 1) * graphicBreaks);
                                    this.pattern[i].symbol.height = minGraphic + ((i - 1) * graphicBreaks);
                                }
                            }
                        }
                        // static breaks
                        else {
                            // for each static breakpoint
                            for (i = 0; i < breakCount; i++) {
                                // breakpoint var
                                this.pattern[i + 1] = {};
                                // set symbol
                                this.pattern[i + 1].symbol = {
                                    "type": "esriPMS",
                                    // image
                                    "url": this.config.clusterImage,
                                    // image type
                                    "contentType": "image/" + this.config.clusterImage.substring(this.config.clusterImage.lastIndexOf(".") + 1),
                                    // width
                                    "width": this.config.staticRanges[i].width,
                                    // height
                                    "height": this.config.staticRanges[i].height
                                };
                                // min and max
                                this.pattern[i + 1].min = this.config.staticRanges[i].min;
                                this.pattern[i + 1].max = this.config.staticRanges[i].max;
                            }
                        }
                    }
                }
            }
        },
        getRange: function () {
            var data = this.data;
            if (!data) {
                return;
            }
            var dataArray = data.data,
                noDataValue = data.noDataValue[0];
            var maxValue = 0;
            var minValue = 0;
            var map = this._map;
            var key;
            for (key in dataArray) {
                if (dataArray.hasOwnProperty(key)) {
                    var val = dataArray[key];
                    if (val !== noDataValue) {
                        var onMapPix;
                        if (!this.config.useLocalMaximum) {
                            if (key.split("|").length === 4) {
                                onMapPix = map.toScreen(esri.geometry.Point(((parseFloat(key.split("|")[0], 10) + parseFloat(key.split("|")[1], 10)) * dataArray.gridsquare / 2), ((parseFloat(key.split("|")[2], 10) + parseFloat(key.split("|")[3], 10)) * dataArray.gridsquare / 2), map.spatialReference));
                            } else if (key.split("|").length === 2) {
                                onMapPix = map.toScreen(esri.geometry.Point(key.split("|")[1] * dataArray.gridsquare / 2, key.split("|")[0] * dataArray.gridsquare / 2), map.spatialReference);
                            }
                            if (onMapPix) {
                                if (val > maxValue) {
                                    maxValue = val;
                                }
                                if (val < minValue) {
                                    minValue = val;
                                }
                            }
                        } else {
                            if (val > maxValue) {
                                maxValue = val;
                            }
                            if (val < minValue) {
                                minValue = val;
                            }
                        }
                    }
                }
            }
            return {
                min: minValue,
                max: maxValue
            };
        },
        // Draw
        draw: function () {
            // clear
            this.clear();
            // if no data, commence zombie apocalypse
            if (!this.data) {
                // die
                return;
            }
            // data var
            var data = this.data,
                dataArray = data.data;
            // Statistics
            var range = this.getRange();
            var minValue = range.min,
                maxValue = range.max;
            if ((minValue === maxValue) && (maxValue === 0)) {
                return;
            }
            var map = this._map;
            var key;
            // Draw
            for (key in dataArray) {
                // if key
                if (dataArray.hasOwnProperty(key) && key.indexOf("|") !== -1) {
                    // extent
                    var gridExtent = new esri.geometry.Extent({
                        "xmin": dataArray.gridsquare * key.split("|")[1] - dataArray.gridsquare / 2,
                            "ymin": dataArray.gridsquare * key.split("|")[0] - dataArray.gridsquare / 2,
                            "xmax": dataArray.gridsquare * key.split("|")[1] + dataArray.gridsquare / 2,
                            "ymax": dataArray.gridsquare * key.split("|")[0] + dataArray.gridsquare / 2,
                            "spatialReference": {
                            "wkid": map.spatialReference.wkid
                        }
                    });
                    // lat/long
                    var centerLNG = dataArray.gridsquare * key.split("|")[1];
                    var centerLAT = dataArray.gridsquare * key.split("|")[0];
                    // calculate square
                    if ((centerLNG + dataArray.gridsquare / 2) - dataArray[key].avgx <= this.config.cornerOffset / this.config.pixelsSquare * dataArray.gridsquare) {
                        dataArray[key].avgx = centerLNG + dataArray.gridsquare * (this.config.pixelsSquare * 0.4) / this.config.pixelsSquare;
                    }
                    if (dataArray[key].avgx - (centerLNG - dataArray.gridsquare / 2) <= this.config.cornerOffset / this.config.pixelsSquare * dataArray.gridsquare) {
                        dataArray[key].avgx = centerLNG - dataArray.gridsquare * (this.config.pixelsSquare * 0.4) / this.config.pixelsSquare;
                    }
                    if ((centerLAT + dataArray.gridsquare / 2) - dataArray[key].avgy <= this.config.cornerOffset / this.config.pixelsSquare * dataArray.gridsquare) {
                        dataArray[key].avgy = centerLAT + dataArray.gridsquare * (this.config.pixelsSquare * 0.4) / this.config.pixelsSquare;
                    }
                    if (dataArray[key].avgy - (centerLAT - dataArray.gridsquare / 2) <= this.config.cornerOffset / this.config.pixelsSquare * dataArray.gridsquare) {
                        dataArray[key].avgy = centerLAT - dataArray.gridsquare * (this.config.pixelsSquare * 0.4) / this.config.pixelsSquare;
                    }
                    // point
                    var onMapPix = new esri.geometry.Point(dataArray[key].avgx, dataArray[key].avgy, map.spatialReference);
                    // point count
                    var pointCount = dataArray[key].count;
                    // symbol
                    var symb;
                    // default text color
                    var textcolor = this.config.clusterTextColor;
                    var breakCount;
                    // if dynamic ranges
                    if (this.config.useDynamicRanges) {
                        // set break count
                        breakCount = this.config.numRangeBreaks;
                        if (breakCount < 2) {
                            breakCount = 2;
                        }
                    } else {
                        // set static break count
                        breakCount = this.config.staticRanges.length;
                    }
                    var graphic;
                    // if 1 point cluster
                    if (pointCount <= this.pattern[0].max) {
                        // set extent
                        dataArray[key].attributes.extent = gridExtent;
                        if (dataArray[key].symbol) {
                            // add symbol
                            this.featureLayer.applyEdits([new esri.Graphic(onMapPix, dataArray[key].symbol, dataArray[key].attributes)], null, null);
                        } else {
                            var symbol = {
                                "type": "esriPMS",
                                // image
                                "url": this.config.singleImage,
                                // image type
                                "contentType": "image/" + this.config.singleImage.substring(this.config.singleImage.lastIndexOf(".") + 1),
                                // width
                                "width": this.config.singleImageWidth,
                                // height
                                "height": this.config.singleImageHeight
                            };
                            graphic = new esri.Graphic(onMapPix, new esri.symbol.PictureMarkerSymbol(symbol, dataArray[key].attributes), {
                                extent: gridExtent
                            });
                            this.featureLayer.applyEdits([graphic], null, null);
                        }
                    } else {
                        // each break
                        for (i = 1; i <= breakCount; i++) {
                            // if point count is less than max
                            if (pointCount <= this.pattern[i].max) {
                                // if text color is set
                                if (this.pattern[i].textrgb) {
                                    // set text color
                                    textcolor = this.pattern[i].textrgb;
                                }
                                // create symbol
                                symb = this.pattern[i].symbol;
                                // end
                                break;
                            }
                        }
                        graphic = new esri.Graphic(onMapPix, new esri.symbol.PictureMarkerSymbol(symb), {
                            extent: gridExtent
                        });
                        // add graphic symbol
                        this.featureLayer.applyEdits([graphic], null, null);
                        // text graphic
                        var textGraphic = new esri.Graphic(onMapPix, new esri.symbol.TextSymbol(number.format(pointCount), new esri.symbol.Font(this.config.clusterTextSize, this.config.clusterTextStyle, this.config.clusterTextVariant, this.config.clusterTextWeight, this.config.clusterTextFamily), new Color(textcolor)).setOffset(0, -4), {
                            extent: gridExtent,
                            parent: graphic
                        });
                        // add graphic text
                        this.featureLayer.applyEdits([textGraphic], null, null);
                    }
                }
            }
            // clear data array
            dataArray = null;
        }
    });
});