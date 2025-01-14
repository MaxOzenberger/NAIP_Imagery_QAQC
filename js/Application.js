/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from './apl/SignIn.js';
import ViewLoading from './apl/ViewLoading.js';

class Application extends AppBase {

  // PORTAL //
  portal;

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // STARTUP DIALOG //
        this.initializeStartupDialog();

        // VIEW SHAREABLE URL PARAMETERS //
        this.initializeViewShareable({view});

        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {

          // HIDE APP LOADER //
          document.getElementById('app-loader').toggleAttribute('hidden', true);
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {

    const signInContainer = document.getElementById('sign-in-container');
    if (signInContainer) {
      const signIn = new SignIn({container: signInContainer, portal: this.portal});
    }

  }

  /**
   *
   * @param view
   */
  configView({view}) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/core/reactiveUtils',
          'esri/widgets/Popup',
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/Compass',
          'esri/widgets/Legend',
          'esri/widgets/LayerList',
          'esri/widgets/BasemapLayerList',
          'esri/widgets/TableList'
        ], (reactiveUtils, Popup, Home, Search, Compass, Legend,
            LayerList, BasemapLayerList, TableList) => {

          // VIEW AND POPUP //
          view.set({
            constraints: {
              snapToZoom: false,
              //minScale: 500000,
              maxScale: 24000
            },
            ui: {components: []},
            popup: new Popup({
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: false,
                breakpoint: false,
                position: "top-right"
              }
            })
          });

          const compass = new Compass({view: view});
          view.ui.add(compass, {position: 'top-left'});
          reactiveUtils.watch(() => view.rotation, rotation => {
            compass.set({visible: (rotation > 0)});
          }, {initial: true});

          // SEARCH //
          // const search = new Search({view: view});
          // view.ui.add(search, {position: 'top-left', index: 0});

          // HOME //
          // const home = new Home({view});
          // view.ui.add(home, {position: 'top-left', index: 1});

          /*
           // BASEMAP LAYER LIST //
           const basemapReferenceLayerList = new BasemapLayerList({
           container: 'basemap-reference-layers-container',
           view: view,
           visibleElements: {
           referenceLayers: true,
           baseLayers: false,
           errors: true,
           statusIndicators: true
           }
           });

           // LAYER LIST //
           const layerList = new LayerList({
           container: 'layers-container',
           view: view,
           visibleElements: {
           errors: true,
           statusIndicators: true
           }
           });

           // BASEMAP LAYER LIST //
           const basemapBaseLayerList = new BasemapLayerList({
           container: 'basemap-base-layers-container',
           view: view,
           visibleElements: {
           referenceLayers: false,
           baseLayers: true,
           errors: true,
           statusIndicators: true
           }
           });

           // TABLE LIST //
           const tableList = new TableList({
           container: 'tables-container',
           map: view.map,
           visibleElements: {
           errors: true, statusIndicators: true
           }
           });
           */

          // LEGEND //
          // const legend = new Legend({
          //   container: 'legend-container',
          //   view: view  //basemapLegendVisible: true
          // });
          //view.ui.add(legend, {position: 'bottom-left', index: 0});

          // VIEW LOADING INDICATOR //
          const viewLoading = new ViewLoading({view: view});
          view.ui.add(viewLoading, 'bottom-right');

          // MAP SCALE //
          const scaleFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 0, maximumFractionDigits: 0});
          const scaleLabel = document.createElement('calcite-chip');
          scaleLabel.setAttribute('scale', 's');
          scaleLabel.setAttribute('icon', 'switch');
          scaleLabel.setAttribute('title', 'map scale');
          view.ui.add(scaleLabel, 'bottom-left');
          reactiveUtils.watch(() => view.scale, scale => {
            scaleLabel.innerHTML = `1: ${ scaleFormatter.format(scale) }`;
          }, {initial: true});

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView({view}).then(() => {
        //THIS NEEDS TO BE CONFIG'D
        const naipImageryLayer = view.map.layers.find(layer => layer.title === "NAIP_NewMexico_Imagery_FY2024");
        naipImageryLayer.load().then(() => {
          naipImageryLayer.set({outFields: ['*']});

          this.initializeImageInspectionView({view, naipImageryLayer});
          this.initializeFootprintsLayer({view, naipImageryLayer});
          this.initializeNAIPLayer({view, naipImageryLayer});
          this.initializeImageDetails({view, naipImageryLayer});

          this.addEventListener('image-selected', ({}) => {
            resolve();
          }, {once: true});

        }).catch(reject);
      }).catch(reject);
    });
  }

  /**
   *
   * @param view
   * @param naipImageryLayer
   */
  initializeFootprintsLayer({view, naipImageryLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/rest/support/Query',
      'esri/layers/FeatureLayer',
      'esri/layers/GraphicsLayer',
      'esri/geometry/geometryEngine',
      'esri/geometry/support/geodesicUtils',
      'esri/geometry/support/webMercatorUtils',
      'esri/geometry/Polygon',
      'esri/geometry/Polyline'
    ], (reactiveUtils, Query, FeatureLayer, GraphicsLayer, geometryEngine, geodesicUtils, webMercatorUtils, Polygon, Polyline) => {
      const rasterOidPages = document.getElementById('raster-oid-pages');

      const fields = [
        ...naipImageryLayer.fields,
        {name: 'rasterId', alias: 'Raster OID', type: "string"}
      ];

      const naipFootprintsLayer = view.map.layers.find(layer => layer.title === "Test_NAIP_Footprints");
      naipFootprintsLayer.load().then(() => {
        naipFootprintsLayer.set({outFields: ['*']});
      });
/*       naipFootprintsLayer.queryFeatures().then((result) => {
        if (result.features.length > 0) {
          console.log(result.features[0].attributes);
        } else {
          console.log("No features found in naipFootprintsLayer.");
        }
      }); */
      /* const footprintsLayer = new FeatureLayer({
        title: 'Test_NAIP_Footprints',
        fields: fields,
        dateFieldsTimeZone: "UTC",
        objectIdField: naipImageryLayer.objectIdField,
        geometryType: "polygon",
        spatialReference: naipImageryLayer.spatialReference,
        source: [],
        popupTemplate: naipImageryLayer.popupTemplate,
        popupEnabled: false,
        labelsVisible: true,
        labelingInfo: [
          {
            labelExpressionInfo: {
              expression: "Concatenate([$feature.rasterId,$feature.QQNAME],' | ')"
            },
            symbol: {
              type: 'text',
              color: '#fefefe',
              haloColor: '#424242',
              haloSize: "1px",
              font: {size: 13}
            }
          }
        ],
        renderer: {
          type: 'simple',
          symbol: {
            type: 'simple-fill',
            color: 'transparent',
            outline: {color: '#00755F', width: 1.5}
          }
        }
      });
      view.map.add(footprintsLayer); */

      const vertexSymbol = (txt) => {
        return {
          type: 'text',
          color: 'lime',
          haloColor: 'darkgreen',
          haloSize: 1.0,
          text: txt,
          xoffset: -11.0,
          font: {size: 11}
        };
      };
      const vertexLayer = new GraphicsLayer({title: 'Vertex'});
      view.map.add(vertexLayer);

      const _toPolyline = polygon => {
        return new Polyline({
          spatialReference: polygon.spatialReference,
          paths: [...polygon.rings]
        });
      };
      

      /**
       *
       *
       * @private
       */
      const _filterImage = () => {
        console.log("here")

        const rasterID = _rasterObjectIDs[rasterOidPages.startItem - 1];

        const rastersQuery = new Query();
        rastersQuery.set({
          objectIds: [rasterID],
          outFields: naipImageryLayer.outFields,
          returnGeometry: true
        });
        naipImageryLayer.queryRasters(rastersQuery).then(({features}) => {
          console.log(features);
          if (features.length) {

            const [feature] = features;
            const {OBJECTID: rasterId, Name} = feature.attributes;
            feature.attributes.rasterId = rasterId;

            const zoomExtent = feature.geometry.extent.clone().expand(1.2);
            view.goTo({target: zoomExtent}).then(() => {

              naipFootprintsLayer.featureEffect = {
                filter: {where: `(Name = '${ Name }')`},
                excludedEffect: "grayscale(50%) opacity(50%)"
              };

              naipImageryLayer.set({
                mosaicRule: {
                  method: 'lock-raster',
                  lockRasterIds: [rasterId]
                }
              });

              const polygonLine = _toPolyline(webMercatorUtils.webMercatorToGeographic(feature.geometry));
              const extentLine = _toPolyline(webMercatorUtils.webMercatorToGeographic(Polygon.fromExtent(feature.geometry.extent)));

              // WE SHOULD ONLY HAVE 4 INTERSECTIONS //
              let intersections = geometryEngine.intersectLinesToPoints(polygonLine, extentLine);
              console.assert(intersections.length === 4, intersections);
              // SORT BY LOWEST LON //
              intersections.sort((a, b) => a.x - b.x);
              // ONLY KEEP TWO MOST WESTWARD POINTS //
              intersections.splice(2);
              // SORT BY HIGHEST LAT //
              intersections.sort((a, b) => b.y - a.y);
              // FIRST = NW CORNER | SECOND = SW CORNER //
              const [first, second] = intersections;
              // GET AZIMUTH //
              const {azimuth: rasterAzimuth} = geodesicUtils.geodesicDistance(first, second);

              const showVertex = true;
              if (showVertex) {
                const labels = ['NW', 'SW'];
                vertexLayer.removeAll();
                [first, second].forEach((intersection, idx) => {
                  vertexLayer.add({
                    geometry: intersection,
                    symbol: vertexSymbol(`${ labels[idx] } : ${ intersection.y.toFixed(2) }`)
                  });
                });
              }

              naipFootprintsLayer.applyEdits({addFeatures: [feature]}).then(({addFeatureResults}) => {
                const objectIds = addFeatureResults.map(result => result.objectId);
                
                naipFootprintsLayer.queryFeatures({objectIds, returnGeometry: true}).then(({features}) => {
                  const [newFeature] = features;
                  this.dispatchEvent(new CustomEvent('image-selected', {detail: {feature: newFeature, rasterId, rasterAzimuth, zoomExtent}}));
                });
              });
            });
          }
        });

      };

      /*const _filterImage = () => {

       const feature = _latestFeatures[rasterOidPages.startItem];
       const name = feature.attributes.Name;
       nameInput.setAttribute('value', name);

       const zoomExtent = feature.geometry.extent.clone().expand(1.2);
       view.goTo({target: zoomExtent}).then(() => {

       footprintsLayer.featureEffect = {
       filter: {
       where: `(Name = '${ name }')`
       },
       excludedEffect: "grayscale(50%) opacity(50%)"
       };

       naipImageryLayer.set({
       definitionExpression: footprintsLayer.featureEffect.filter.where
       });

       this.dispatchEvent(new CustomEvent('image-selected', {detail: {name}}));
       });

       };*/

      rasterOidPages.addEventListener('calcitePaginationChange', () => {
        _filterImage();
      });

      const rasterRandomBtn = document.getElementById('raster-random-btn');
      const rasterNextBtn = document.getElementById('raster-next-btn');

      let _rasterObjectIDs = null;

      const _setRandomImage = () => {
        const start = 1 + Math.floor(Math.random() * (_rasterObjectIDs.length - 1));
        rasterOidPages.setAttribute('start-item', String(start));
        _filterImage();
      };
      const _setNextImage = () => {
        const nextImage = (rasterOidPages.startItem + 1);
        if (nextImage < _rasterObjectIDs.length) {
          rasterOidPages.setAttribute('start-item', String(nextImage));
          _filterImage();
        }
      };

      this.addEventListener('raster-ids', ({detail: {rasterObjectIDs}}) => {

        _rasterObjectIDs = rasterObjectIDs;
        rasterOidPages.setAttribute('total-items', _rasterObjectIDs.length);

        _setRandomImage();

        requestAnimationFrame(() => {
          rasterRandomBtn.toggleAttribute('disabled', !_rasterObjectIDs.length);
          rasterNextBtn.toggleAttribute('disabled', !_rasterObjectIDs.length);
        });
      });

      rasterRandomBtn.addEventListener('click', () => {
        _setRandomImage();
      });
      rasterNextBtn.addEventListener('click', () => {
        _setNextImage();
      });

      /*
       let _latestFeatures = null;
       this.addEventListener('raster-ids', ({detail: {rasterFeatures: addFeatures}}) => {
       footprintsLayer.queryFeatures().then(({features: deleteFeatures}) => {
       footprintsLayer.applyEdits({addFeatures, deleteFeatures}).then(() => {
       footprintsLayer.queryFeatures().then(({features}) => {
       _latestFeatures = features;

       rasterOidPages.setAttribute('total-items', _latestFeatures.length);
       rasterOidPages.setAttribute('start-item', '1');

       requestAnimationFrame(() => {
       _filterImage();
       });

       });
       });
       });
       });*/

    });
  }

  /**
   *
   *    DOQQ
   *    OBJECTID
   *    Defect_Type
   *      Clouds
   *      Color/Tone
   *      None
   *      Quality - Contractual
   *      Quality - Non Contractual
   *      Restricted Area No Imagery
   *      Unchecked
   *    ST
   *
   * @param view
   * @param naipImageryLayer
   */
  initializeNAIPLayer({view, naipImageryLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/rest/support/Query'
    ], (reactiveUtils, Query) => {

      //const categoryOptions = document.getElementById('category-options');
      const statesOptions = document.getElementById('states-options');
      const yearOptions = document.getElementById('year-options');

      const countFormatter = new Intl.NumberFormat('default', {});
      const filterCountLabel = document.getElementById('filter-count-label');

      let _filter = null;

      const _getRasterInfos = () => {

        if (_filter) {
          /*const rastersQuery = new Query();
           rastersQuery.set({
           where: _filter,
           outFields: naipImageryLayer.outFields,
           returnGeometry: true
           });
           naipImageryLayer.queryRasters(rastersQuery).then((rastersFS) => {
           const {features} = rastersFS;
           if (features.length) {
           this.dispatchEvent(new CustomEvent('raster-ids', {detail: {rasterFeatures: features}}));
           } else {
           this.dispatchEvent(new CustomEvent('raster-ids', {detail: {rasterFeatures: []}}));
           }
           });*/
          console.log("here")
          /* const rastersQuery = new Query();
          rastersQuery.set({
            where: _filter,
            outFields: naipImageryLayer.outFields,
            returnGeometry: true
          }); */
          naipImageryLayer.queryObjectIds().then((rasterObjectIDs) => {

            // RESULTS COUNT //
            filterCountLabel.innerHTML = `${ countFormatter.format(rasterObjectIDs.length) } images`;

            if (rasterObjectIDs.length) {
              this.dispatchEvent(new CustomEvent('raster-ids', {detail: {rasterObjectIDs}}));
            } else {
              this.dispatchEvent(new CustomEvent('raster-ids', {detail: {rasterObjectIDs: []}}));
            }
            console.log("done")

          });
        } else {
          this.dispatchEvent(new CustomEvent('raster-ids', {detail: {rasterObjectIDs: []}}));
        }
      };

      const _updateImageryFilter = () => {

        //const categories = categoryOptions.selectedItems.map(item => Number(item.value));
        const years = yearOptions.selectedItems.map(item => Number(item.value));
        const states = statesOptions.selectedItems.map(item => item.value);

        const filters = ['(Category = 1)'];
        //categories.length && filters.push(`(Category IN (${ categories.join(',') }))`);
        years.length && filters.push(`(Year IN (${ years.join(',') }))`);
        states.length && filters.push(`(State IN ('${ states.join("','") }'))`);

        _filter = filters.length ? filters.join(' AND ') : null;

        _getRasterInfos();
      };

      const rasterQuery = new Query();
      rasterQuery.set({
        where: 'OBJECTID BETWEEN 1 AND 10',
        outFields: ['*']
      });
      naipImageryLayer.queryRasters(rasterQuery).then((rasterFS) => {
      //naipImageryLayer.queryRasterCount().then(function(result){
        //console.log(result);
        // CATEGORY //
        // categoryOptions.addEventListener('calciteComboboxChange', () => {
        //   _updateImageryFilter();
        // });

        //const resolutions = new Set(rasterFS.features.map(f => f.attributes.Res));
        //console.info(Array.from(resolutions.values()).sort());
        //
        // resolutions: 0.3, 0.5, 0.6, 1.0, null
        //

        // YEAR //
        //console.log(rasterFS.features[0].attributes);
        //const years = new Set(rasterFS.features.map(f => f.attributes.Year));
        //const yearLabels = Array.from(years.values()).sort();
        const yearLabels = ["2024"];
        const yearItems = yearLabels.map((year, yearIdx) => {

          const yearItem = document.createElement('calcite-combobox-item');
          yearItem.setAttribute('value', year);
          yearItem.setAttribute('text-label', year);
          yearItem.toggleAttribute('selected', (yearIdx >= (yearLabels.length - 1)));

          return yearItem;
        });
        yearOptions.replaceChildren(...yearItems);
        yearOptions.addEventListener('calciteComboboxChange', () => {
          _updateImageryFilter();
        });

        // STATE //
        const defaultStates = ['NM'];
        //const states = new Set(rasterFS.features.map(f => f.attributes.State));
        //const stateLabels = Array.from(states.values()).sort();
        const stateLabels = ["NM"];
        const stateItems = stateLabels.map((state, stateIdx) => {

          const stateItem = document.createElement('calcite-combobox-item');
          stateItem.setAttribute('value', state);
          stateItem.setAttribute('text-label', state);
          stateItem.toggleAttribute('selected', defaultStates.includes(state));

          return stateItem;
        });
        statesOptions.replaceChildren(...stateItems);
        statesOptions.addEventListener('calciteComboboxChange', () => {
          _updateImageryFilter();
        });

        // INITIAL FILTER //
        requestAnimationFrame(() => {
          _updateImageryFilter();
        });

      });

    });
  }

  /**
   *
   * @param view
   * @param naipImageryLayer
   */
  initializeImageDetails({view, naipImageryLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/widgets/Feature',
      'esri/support/popupUtils'
    ], (reactiveUtils, Feature, popupUtils) => {

      const details = new Feature({
        container: 'details-container'
      });

      const properties = new Feature({
        container: 'properties-container'
      });

      const popupTemplate = popupUtils.createPopupTemplate({
        title: 'NAIP Image',
        displayField: "QQNAME",
        fields: naipImageryLayer.fields
      }, {});

      this.addEventListener('image-selected', ({detail: {feature}}) => {
        details.set({graphic: feature});

        properties.set({
          graphic: {
            geometry: feature.geometry,
            attributes: feature.attributes,
            popupTemplate: popupTemplate,
            defaultPopupTemplateEnabled: true
          }
        });

      });

    });
  }

  /**
   *
   * @param view
   * @param naipImageryLayer
   */
  initializeImageInspectionView({view, naipImageryLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/core/Handles',
      'esri/geometry/Point',
      'esri/Graphic',
      'esri/layers/GraphicsLayer',
      'esri/layers/support/rasterFunctionUtils',
      'esri/Map',
      'esri/views/MapView',
      'esri/widgets/Swipe'
    ], (reactiveUtils, Handles, Point, Graphic, GraphicsLayer, rasterFunctionUtils, EsriMap, MapView, Swipe) => {

      const displayTooltip = document.getElementById('display-tooltip');

      const referenceLayer = view.map.basemap.referenceLayers.at(0);
      const naipImageryLayerClone = naipImageryLayer.clone();

      //const {serviceRasterInfo: {bandInfos}} = naipImageryLayerClone;
      //console.info(bandInfos);

      const _rasterFunctionFilter = rfInfo => {
        const isNone = rfInfo.name.startsWith('None');
        const isRaw = rfInfo.name.endsWith('Raw');
        return !isNone;
        //return !(isNone || isRaw);
      };

      const {rasterFunctionInfos} = naipImageryLayerClone;
      const validRasterFunctions = rasterFunctionInfos.filter(_rasterFunctionFilter);

      // green and shortwave infrared
      // validRasterFunctions.push({
      //   name: 'Normalized Difference Snow Index (NDSI)',
      //   description: 'Designed to use MODIS (band 4 and band 6) and Landsat TM (band 2 and band 5) for identification of snow cover while ignoring cloud cover.'
      // });

      // bandIndexes: "(b1 - b0) / (b1 + b0)"

      const ndsiRF = rasterFunctionUtils.bandArithmeticNDSI({
        greenBandId: 1,
        swirBandId: 3
      });

      const ndsiStretch = rasterFunctionUtils.stretchMinMax({
        dynamicRangeAdjustment: true,
        raster: ndsiRF
      });

      // const ndsiMask = rasterFunctionUtils.mask({
      //   includedRanges: [[0.0, 1.0]],
      //   raster: ndsiStretch
      // });

      //
      // https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-support-rasterFunctionUtils.html#RasterColormapByNameParameters
      //
      const ndsiRFColorized = rasterFunctionUtils.colormap({
        colorRampName: 'blue-bright',
        /*colormap: [
         {value: -1.0, color: "#FF0000"},
         {value: 1.0, color: "#00FF00"}
         ],*/
        raster: ndsiStretch
      });

      const validRasterFunctionsInfos = new Map();
      const displayItems = validRasterFunctions.map(({name, description}) => {
        validRasterFunctionsInfos.set(name, description);
        const displayItem = document.createElement('calcite-option');
        displayItem.setAttribute('value', name);
        displayItem.innerHTML = name;
        return displayItem;
      });
      const displaySelect = document.getElementById('display-select');
      displaySelect.replaceChildren(...displayItems);
      displaySelect.addEventListener('calciteSelectChange', () => {

        if (displaySelect.value.includes('Snow')) {
          naipImageryLayerClone.rasterFunction = ndsiRFColorized.clone();
        } else {
          naipImageryLayerClone.rasterFunction = {functionName: displaySelect.value};
        }

        displayTooltip.innerHTML = validRasterFunctionsInfos.get(displaySelect.value);
      });
      displayTooltip.innerHTML = validRasterFunctionsInfos.values().next().value;

      const _maxScale = 10;
      const _defaultScale = 6000;
      const _minScale = 25000;

      const detailsView = new MapView({
        container: 'inspection-view-container',
        //map: view.map,
        map: new EsriMap({
          basemap: {referenceLayers: [referenceLayer]},
          layers: [naipImageryLayerClone]
        }),
        extent: view.map.extent,
        scale: _defaultScale,
        constraints: {
          maxScale: _maxScale,
          minScale: _minScale
        },
        ui: {components: []}
      });
      detailsView.when(() => {

        this.initializeCellExtents({view: detailsView, naipImageryLayer: naipImageryLayerClone});

        // VIEW LOADING INDICATOR //
        const viewLoading = new ViewLoading({view: detailsView});
        detailsView.ui.add(viewLoading, 'bottom-right');

        // SCALE SLIDER //
        const detailedScaleSlider = document.getElementById('detailed-scale-slider');
        detailedScaleSlider.addEventListener('calciteSliderInput', () => {
          detailsView.scale = Number(detailedScaleSlider.value);
        });

        // DETAILED MAP SCALE //
        const scaleFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const scaleLabel = document.createElement('calcite-chip');
        scaleLabel.setAttribute('scale', 's');
        scaleLabel.setAttribute('icon', 'switch');
        scaleLabel.setAttribute('title', 'map scale');
        detailsView.ui.add(scaleLabel, 'bottom-left');
        reactiveUtils.watch(() => detailsView.scale, scale => {
          scaleLabel.innerHTML = `1: ${ scaleFormatter.format(scale) }`;
          detailedScaleSlider.value = Math.round(scale);
        }, {initial: true});

        // UPDATE DETAILS VIEW WHEN VIEW VIEWPOINT CHANGES //
        reactiveUtils.watch(() => view.viewpoint, viewpoint => {
          detailsView.set({viewpoint: viewpoint.clone().set({scale: detailsView.scale})});
        });

        let _zoomExtent = null;
        this.addEventListener('image-selected', ({detail: {rasterId, zoomExtent}}) => {
          _zoomExtent = zoomExtent;
          naipImageryLayerClone.set({
            mosaicRule: {
              method: 'lock-raster',
              lockRasterIds: [rasterId]
            }
          });
        });

        const imageZoomAction = document.getElementById('image-zoom-action');
        imageZoomAction.addEventListener('click', () => {
          _zoomExtent && view.goTo({target: _zoomExtent});
        });

        const inspectionExtentGraphic = new Graphic({
          symbol: {
            type: 'simple-fill',
            style: 'diagonal-cross',
            color: "rgba(154,214,202,0.5)", // "rgba(0,255,204,0.5)",
            outline: {
              style: 'solid',
              color: "#9AD6CA", //"#00FFCC",
              width: 1.8
            }
          }
        });
        const locationLayer = new GraphicsLayer({
          title: 'Inspection Location',
          graphics: [inspectionExtentGraphic],
          effect: 'drop-shadow(1px 1px 2px #424242)'
        });
        view.map.add(locationLayer);

        view.whenLayerView(locationLayer).then(locationLayerView => {
          locationLayerView.set({highlightOptions: {haloOpacity: 0.5, fillOpacity: 0.5}});
        });

        reactiveUtils.watch(() => detailsView.extent, extent => {
          inspectionExtentGraphic.set({geometry: extent});
        });

        view.container.style.cursor = 'pointer';
        reactiveUtils.on(() => view, ['pointer-down', 'drag'], (evt) => {
          evt.stopPropagation();
          detailsView.set({center: view.toMap(evt)});
        });

        //
        // SWIPE
        //
        let swipe = new Swipe({
          leadingLayers: detailsView.map.basemap.referenceLayers.toArray(),
          direction: "horizontal",
          position: 80,
          visible: false
        });
        detailsView.ui.add(swipe);

        const imageSwipeAction = document.getElementById('image-swipe-action');
        imageSwipeAction.addEventListener('click', () => {
          const isActive = imageSwipeAction.toggleAttribute('active');
          swipe.set({view: isActive ? detailsView : null, visible: isActive});
        });

      });
    });

  }

  /**
   *
   * https://www.esri.com/arcgis-blog/products/product/imagery/on-map-scale-and-raster-resolution/
   *
   * @param detailsView
   * @param naipImageryLayerClone
   */
  initializeCellExtents({view, naipImageryLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/geometry/Extent',
      'esri/geometry/Polyline',
      'esri/geometry/Polygon',
      'esri/Graphic',
      'esri/layers/GraphicsLayer',
      'esri/geometry/geometryEngine',
      'esri/geometry/support/geodesicUtils',
      'esri/geometry/support/webMercatorUtils',
      'esri/widgets/DistanceMeasurement2D'
    ], (reactiveUtils, Extent, Polyline, Polygon, Graphic, GraphicsLayer,
        geometryEngine, geodesicUtils, webMercatorUtils, DistanceMeasurement2D) => {

      // INTERPOLATION  //
      /*const nearestSwitch = document.getElementById('nearest-switch');
       nearestSwitch.addEventListener('calciteSwitchChange', () => {
       naipImageryLayer.set({
       interpolation: nearestSwitch.checked ? 'nearest' : 'bilinear'
       });
       });*/

      // MEASUREMENT //
      const measurementWidget = new DistanceMeasurement2D({
        container: 'measurement-container',
        view: view,
        unit: 'meters',
        visible: false
      });

      // INSPECTION BLOCK //
      const inspectionBlock = document.getElementById('inspection-block');
      view.ui.add(inspectionBlock, 'top-left');

      // INSPECTION ACTION //
      let _inspectionActive = false;
      const imageInspectionAction = document.getElementById('image-inspection-action');
      imageInspectionAction.addEventListener('click', () => {
        _inspectionActive = imageInspectionAction.toggleAttribute('active');
        inspectionBlock.toggleAttribute('hidden', !_inspectionActive);
        // INTERPOLATION //
        naipImageryLayer.set({
          interpolation: _inspectionActive ? 'nearest' : 'bilinear'
        });
      });

      // INTERPOLATION //
      /*const nearestSection = document.getElementById('nearest-section');
       nearestSection.addEventListener('calciteBlockSectionToggle', () => {
       naipImageryLayer.set({
       interpolation: nearestSection.open ? 'nearest' : 'bilinear'
       });
       });*/

      const measurePixelsAction = document.getElementById('measure-pixels-action');
      const measureDistanceAction = document.getElementById('measure-distance-action');
      const acceptableAction = document.getElementById('acceptable-action');
      const acceptableOptions = document.getElementById('acceptable-options');

      let _activeTool = null;
      const _setActiveTool = toolName => {
        _activeTool = toolName;

        const isAcceptableTool = (_activeTool === 'acceptable');
        acceptableAction.toggleAttribute('active', isAcceptableTool);
        acceptableAction.toggleAttribute('indicator', isAcceptableTool);
        acceptableOptions.toggleAttribute('disabled', !isAcceptableTool);

        const isMeasurePixels = (_activeTool === 'measure-pixels');
        measurePixelsAction.toggleAttribute('active', isMeasurePixels);
        measurePixelsAction.toggleAttribute('indicator', isMeasurePixels);
        !isMeasurePixels && (lineGraphic.geometry = null);

        const isMeasureDistance = (_activeTool === 'measure-distance');
        measureDistanceAction.toggleAttribute('active', isMeasureDistance);
        measureDistanceAction.toggleAttribute('indicator', isMeasureDistance);

        measurementWidget.visible = isMeasureDistance;
        isMeasureDistance && measurementWidget.viewModel.start();

      };

      acceptableAction.addEventListener('click', () => {
        _setActiveTool(acceptableAction.hasAttribute('active') ? null : 'acceptable');
      });
      measureDistanceAction.addEventListener('click', () => {
        _setActiveTool(measureDistanceAction.hasAttribute('active') ? null : 'measure-distance');
      });
      measurePixelsAction.addEventListener('click', () => {
        _setActiveTool(measurePixelsAction.hasAttribute('active') ? null : 'measure-pixels');
      });

      const {fullExtent: rasterExtent, sourceJSON: {pixelSizeX: cellSize}} = naipImageryLayer;

      //let _rasterFootprint = null;
      let _imageResolution = null;
      let _rasterAzimuth = null;
      this.addEventListener('image-selected', ({detail: {feature, rasterAzimuth}}) => {
        const {geometry, attributes: {Res}} = feature;
        //_rasterFootprint = new Polyline({spatialReference: geometry.spatialReference, paths: [...geometry.rings]});
        _imageResolution = Number(Res);
        _rasterAzimuth = rasterAzimuth;
      });

      const resolutionNotice = document.getElementById('resolution-notice');
      const resolutionLabel = document.getElementById('resolution-label');

      let _viewResolution;
      let _pixelsVisible;
      reactiveUtils.watch(() => view.resolution, resolution => {
        _viewResolution = resolution;
        _pixelsVisible = (_viewResolution < cellSize);

        resolutionNotice.setAttribute('kind', _pixelsVisible ? 'success' : 'warning');
        resolutionNotice.setAttribute('icon', _pixelsVisible ? 'check-circle' : 'exclamation-mark-triangle');
        resolutionLabel.innerHTML = _pixelsVisible
          ? 'Image pixels are visible'
          : 'Zoom in to view image pixels...';

        //console.info("resolution: ", resolution, "| scale: ", view.scale, " | res: ", (view.scale / 4000));
      }, {initial: true});

      const pixelsToPoints = 1.333;
      const pointsToPixels = 0.75;

      const createDashedLineSymbol = (imageCellSize, viewResolution) => {
        return {
          type: "cim",
          data: {
            type: "CIMSymbolReference",
            primitiveOverrides: [
              {
                type: "CIMPrimitiveOverride",
                primitiveName: "dashOverride",
                propertyName: "DashTemplate",
                valueExpressionInfo: {
                  type: "CIMExpressionInfo",
                  title: "Dash override",
                  expression: `
                    var res = ($view.scale / 4000.0);                    
                    var size = Round((${ imageCellSize } / res), 1);                                                                             
                    return [size, size];`
                }
              },
              {
                type: "CIMPrimitiveOverride",
                primitiveName: "text-override",
                propertyName: "textString",
                valueExpressionInfo: {
                  type: "CIMExpressionInfo",
                  title: "Text Override",
                  expression: `
                    var lengthMeters = LengthGeodetic(Geometry($feature),'meters');
                    var lengthPixels = Floor(lengthMeters / ${ imageCellSize }, 0);                                                             
                    return Concatenate([lengthPixels, 'pixels'],' ');`
                }
              }
            ],
            symbol: {
              type: "CIMLineSymbol",
              //useRealWorldSymbolSizes: true,
              symbolLayers: [
                {
                  type: "CIMVectorMarker",
                  enable: true,
                  size: 10,
                  colorLocked: true,
                  anchorPointUnits: "Relative",
                  frame: {xmin: -5, ymin: -5, xmax: 5, ymax: 5},
                  markerGraphics: [
                    {
                      type: "CIMMarkerGraphic",
                      primitiveName: "text-override",
                      textString: "Pixel Count",
                      geometry: {x: 0, y: 0},
                      symbol: {
                        type: "CIMTextSymbol",
                        fontFamilyName: "Avenir Next LT Pro",
                        fontStyleName: "Bold",
                        horizontalAlignment: "Center",
                        verticalAlignment: "Center",
                        height: 15.0,
                        offsetX: 0.0,
                        offsetY: 12.0,
                        symbol: {
                          type: "CIMPolygonSymbol",
                          symbolLayers: [
                            {
                              type: "CIMSolidFill",
                              enable: true,
                              color: [255, 255, 255, 255]
                            }
                          ]
                        },
                        haloSize: 1.5,
                        haloSymbol: {
                          type: "CIMPolygonSymbol",
                          symbolLayers: [
                            {
                              type: "CIMSolidFill",
                              enable: true,
                              color: [0, 0, 0, 127]
                            }
                          ]
                        }
                      }
                    }
                  ],
                  scaleSymbolsProportionally: true,
                  respectFrame: true,
                  markerPlacement: {
                    type: "CIMMarkerPlacementOnLine",
                    angleToLine: true,
                    relativeTo: "LineMiddle",
                    offset: 0,
                    startPointOffset: 0
                  }
                },
                {
                  type: "CIMSolidStroke",
                  effects: [
                    {
                      type: "CIMGeometricEffectDashes",
                      primitiveName: "dashOverride",
                      dashTemplate: [4, 4],
                      lineDashEnding: "NoConstraint",
                      controlPointEnding: "NoConstraint",
                      offsetAlongLine: 0
                    }
                  ],
                  enable: true,
                  capStyle: "Butt",
                  joinStyle: "Miter",
                  lineStyle3D: "Strip",
                  miterLimit: 10,
                  width: 3.0,
                  color: [217, 0, 18, 255]
                },
                {
                  type: "CIMSolidStroke",
                  enable: true,
                  capStyle: "Butt",
                  joinStyle: "Miter",
                  lineStyle3D: "Strip",
                  miterLimit: 10,
                  width: 2.0,
                  color: [255, 255, 255, 255]
                }
              ]
            }
          }
        };
      };

      const lineGraphic = new Graphic({
        symbol: createDashedLineSymbol(_imageResolution, view.resolution)
      });

      const extentGraphic = new Graphic({
        symbol: {
          type: 'simple-fill',
          style: 'diagonal-cross',  //'solid',
          color: 'rgba(154,214,202,0.4)',
          outline: {color: '#9AD6CA', width: 1.5}
        }
      });

      const intersectionGraphic = new Graphic({
        symbol: {
          type: 'simple-marker',
          style: 'circle',
          size: 7.0,
          color: 'rgba(0,0,255,0.5)',
          outline: {color: 'white', width: 1.0}
        }
      });

      const locationGraphic = new Graphic({
        symbol: {
          type: 'simple-marker',
          style: 'circle',
          size: 5.5,
          color: 'gold',
          outline: {color: 'crimson', width: 1.0}
        }
      });
      const extentLayer = new GraphicsLayer({
        title: 'Extent',
        graphics: [extentGraphic, intersectionGraphic, locationGraphic, lineGraphic]
        //effect: 'drop-shadow(2px, 2px, 3px, #424242)'
      });
      view.map.add(extentLayer);

      const _updateExtent = (evt) => {

        const location = webMercatorUtils.webMercatorToGeographic(view.toMap(evt));
        const {x: originLon, y: originLat} = location;

        const [wide, length] = acceptableOptions.selectedItems.at(0).value.split('|').map(Number);
        const dxMeters = (wide * _imageResolution);
        const dyMeters = (length * _imageResolution);

        const {x: offsetLon} = geodesicUtils.pointFromDistance(location, dxMeters, (_rasterAzimuth - 90.0));
        const {y: offsetLat} = geodesicUtils.pointFromDistance(location, dyMeters, _rasterAzimuth);

        const _acceptableExtent = new Extent({
          spatialReference: location.spatialReference,
          xmin: originLon,
          ymin: originLat,
          xmax: offsetLon,
          ymax: offsetLat
        });
        _acceptableExtent.centerAt(location);

        let _acceptableArea = Polygon.fromExtent(_acceptableExtent);
        _acceptableArea = geometryEngine.densify(_acceptableArea, cellSize);
        _acceptableArea = geometryEngine.rotate(_acceptableArea, -_rasterAzimuth);

        // REVERSE CLIP //
        const viewExtent = webMercatorUtils.webMercatorToGeographic(Polygon.fromExtent(view.extent.clone().expand(2.0)));
        _acceptableArea = geometryEngine.difference(viewExtent, _acceptableArea);

        return _acceptableArea;
      };

      reactiveUtils.on(() => view, 'drag', (dragEvt) => {
        if (_inspectionActive && _pixelsVisible && (_activeTool === 'acceptable')) {
          dragEvt.stopPropagation();
          switch (dragEvt.action) {
            case 'start':
            case 'update':
              view.container.style.cursor = 'grabbing';
              extentGraphic.geometry = _updateExtent(dragEvt);
              break;
            case 'end':
              view.container.style.cursor = 'default';
              extentGraphic.geometry = null;
              break;
          }
        }
      });

      let origin;
      reactiveUtils.on(() => view, ['pointer-down', 'drag'], (dragEvt) => {
        if (_inspectionActive && _pixelsVisible && (_activeTool === 'measure-pixels')) {
          dragEvt.stopPropagation();

          if (dragEvt.type === 'pointer-down') {
            lineGraphic.set({
              geometry: null,
              symbol: createDashedLineSymbol(_imageResolution, view.resolution)
            });
            origin = view.toMap(dragEvt);

          } else {
            switch (dragEvt.action) {
              case 'start':
              case 'update':
                view.container.style.cursor = 'grabbing';
                const destination = view.toMap(dragEvt);
                lineGraphic.geometry = new Polyline({
                  spatialReference: view.spatialReference,
                  paths: [[
                    [origin.x, origin.y],
                    [destination.x, destination.y]
                  ]]
                });
                break;
              case 'end':
                view.container.style.cursor = 'default';
                //lineGraphic.geometry = null;
                break;
            }
          }
        }
      });

      /*
       const _snapToCellOrigin = (location) => {

       const horizontal = new Polyline({
       spatialReference: location.spatialReference,
       paths: [[[_rasterFootprint.extent.xmin, location.y], [location.x, location.y]]]
       });
       const [intersection] = geometryEngine.intersectLinesToPoints(horizontal, _rasterFootprint);
       intersectionGraphic.geometry = intersection;

       let dxMeters = 0.0;
       if (intersection) {
       const rasterOffset = Math.abs(intersection.x % cellSize);
       dxMeters = Math.abs((location.x - rasterOffset) % _imageResolution);
       }

       location.x -= dxMeters;
       return location;
       };

       reactiveUtils.on(() => view, 'pointer-move', (pointerEvt) => {
       if (_inspectionActive && _acceptableActive && _pixelsVisible) {
       locationGraphic.geometry = _snapToCellOrigin(view.toMap(pointerEvt));
       } else {
       locationGraphic.geometry = null;
       }
       });
       */

    });
  }

  /**
   *
   * @param view
   */
  initializeSwipe({view}) {
    require([
      'esri/core/reactiveUtils',
      'esri/widgets/LayerList',
      'esri/widgets/Swipe'
    ], (reactiveUtils, LayerList, Swipe) => {

      //
      // SWIPE //
      //
      const swipe = new Swipe({
        view: view,
        leadingLayers: [],
        trailingLayers: [],
        mode: "horizontal",
        position: 75
      });
      view.ui.add(swipe);

      reactiveUtils.whenOnce(() => swipe.viewModel.state === "ready").then(() => {
        setTimeout(() => {
          // GET SWIPE CONTAINER //
          const swipeContainer = document.querySelector(".esri-swipe__container");

          // ADD SWIPE LABEL CONTAINER //
          const swipeLabelContainer = document.createElement("div");
          swipeLabelContainer.classList.add('swipe-label-container');
          swipeContainer.after(swipeLabelContainer);

          // LEADING LABEL //
          const swipeLabelLeading = document.createElement("div");
          swipeLabelLeading.classList.add('swipe-label', 'swipe-label-leading');
          swipeLabelLeading.setAttribute('title', 'Natural Color bands red, green, blue (4, 3, 2) displayed with dynamic range adjustment applied');
          swipeLabelLeading.innerHTML = 'Natural Color';

          const swipeLabelToggleIcon = document.createElement('calcite-icon');
          swipeLabelToggleIcon.setAttribute('icon', 'check-square');
          swipeLabelToggleIcon.setAttribute('scale', 's');
          swipeLabelLeading.prepend(swipeLabelToggleIcon);

          swipeLabelLeading.addEventListener("click", evt => {
            evt.stopPropagation();
            baseImageryLayer.visible = (!baseImageryLayer.visible);
            swipeLabelToggleIcon.setAttribute('icon', baseImageryLayer.visible ? 'check-square' : 'square');
          });

          // TRAILING LABELS //
          const swipeLabelTrailing = document.createElement("div");
          swipeLabelTrailing.classList.add('swipe-label', 'swipe-label-trailing');
          swipeLabelTrailing.setAttribute('title', 'Bands shortwave infrared-2, shortwave infrared-1, red (12, 11, 4) with dynamic range adjustment applied');
          swipeLabelTrailing.innerHTML = "Short-wave Infrared";

          swipeLabelContainer.append(swipeLabelLeading, swipeLabelTrailing);

          // UPDATE POSITION //
          reactiveUtils.watch(() => swipe.position, position => {
            swipeLabelContainer.style.left = `${ position }%`;
          });

        }, 2000);
      });

      //
      // TOGGLE SWIPE WHEN BASE LAYER IS VISIBLE //
      //
      view.whenLayerView(imageryLayer).then(imageryLayerView => {
        reactiveUtils.watch(() => imageryLayerView.suspended, suspended => {

          swipe.position = suspended ? 100 : 75;
          swipe.disabled = suspended;
          swipe.container.toggleAttribute("hidden", suspended);

          this.dispatchEvent(new CustomEvent("suspended-change", {detail: {suspended: suspended}}));
        }, {initial: true});
      });

    });
  }

}

export default new Application();
