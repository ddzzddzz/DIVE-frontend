var _ = require('underscore');

angular.module('diveApp.visualization').controller("VisualizationSideNavCtrl", function($scope) {
  // Sidenav methods
  $scope.toggle = function(i) {
    $scope.categories[i].toggled = !$scope.categories[i].toggled;
  }

  $scope.isOpen = function(i) {
    return $scope.categories[i].toggled;
  }

  // TODO Reconcile this with selectSpec
  $scope.selectChild = function(c) {
    $scope.selectedChild = c;
  }

  $scope.isChildSelected = function(c) {
    return ($scope.selectedChild === c);
  }
});  

angular.module('diveApp.visualization').controller("VisualizationConditionalsCtrl", function($scope, ConditionalDataService) {
  $scope.selectConditional = function(spec) {
    if (spec.name in $scope.selCondVals[$scope.currentdID]) {
      delete $scope.selCondVals[$scope.currentdID][spec.name];      
    }

    var params = {
      dID: $scope.currentdID, 
      spec: spec, 
      pID: $scope.pID
    }
    ConditionalDataService.getConditionalData(params, function(result) {
      result.result.unshift('All')
      $scope.condData[spec.name] = result.result;
    });
    $scope.refreshVizData();
  };
});  

angular.module('diveApp.visualization').controller("VisualizationStatsCtrl", function($scope) {
});  

angular.module('diveApp.visualization').controller("VisualizationExportCtrl", function($scope) {
  $scope.save = function(format) {
     var tmp = document.getElementById("viz-container");
     var svg = tmp.getElementsByTagName("svg")[0];
     var svg_xml = (new XMLSerializer).serializeToString(svg);
     return $http.post(API_URL + "/api/render_svg", {
       data: JSON.stringify({
         format: format,
         svg: svg_xml
       })
     }).success(function(data) {
       var file;
       file = new Blob([data], {
         type: 'application/' + format
       });
       return saveAs(file, 'visualization.' + format);
     });
   };
});  

// Parent controller containing data functions
angular.module('diveApp.visualization').controller("VisualizationCtrl", function($scope, DataService, VizDataService, PropertyService, SpecificationService, ConditionalDataService, pID) {
  // Making resolve data available to directives
  $scope.pID = pID;

  $scope.datasets = [];
  $scope.columnAttrsByDID = {};
  $scope.categories = [];

  // Stats
  $scope.stats = { shown: false }

  // Loading
  $scope.loadingViz = false;

  // CONDITIONALS
  $scope.condList = [];
  $scope.condTypes = {};
  $scope.condData = {};  
  $scope.selConds = {};  // Which are selected to be shown
  $scope.selCondVals = {};  // Selected values for conditionals

  // TIME SERIES


  // CONFIG
  $scope.config = {};
  $scope.selectedValues = {};
  $scope.selectedParameters = {
    x: '',
    y: ''
  }

  DataService.getDatasets({ pID: pID }, function(datasets) {
    $scope.datasets = datasets;
    $scope.columnAttrsByDID = {}
    _.each(datasets, function(e) {
      // Conditionals for time series visualizations
      if (e.structure == 'wide') {
        $scope.condList.push({name: 'Start Date'});
        $scope.condList.push({name: 'End Date'});
        $scope.condData['Start Date'] = e.time_series.names;
        $scope.condData['End Date'] = e.time_series.names;
      }
      $scope.columnAttrsByDID[e.dID] = e.column_attrs;
    })
  });

  // TODO Find a better way to resolve data dependencies without just making everything synchronous
  PropertyService.getProperties({ pID: pID }, function(properties) {
    $scope.properties = properties;
    $scope.overlaps = properties.overlaps;
    $scope.hierarchies = properties.hierarchies;

    // Getting specifications grouped by category
    SpecificationService.getSpecifications({ pID: pID }, function(specs) {
      $scope.categories = _.map(specs, function(v, k) {
        return {
          'name': k,
          'toggled': true,
          'length': v.length,
          'specs': v
        }
      })
      $scope.selectSpec($scope.categories[1].specs[0])
    });
  });

  $scope.selectSpec = function(spec) {
    $scope.selectedChild = spec;
    $scope.selectedSpec = spec;

    if (spec.aggregate) {
      dID = spec.aggregate.dID;
    } else {
      dID = spec.object.dID;
    }

    $scope.currentdID = dID;
    if (!$scope.selCondVals[dID]) {
      $scope.selCondVals[dID] = {};
    }
    var colAttrs = $scope.columnAttrsByDID[dID];
    var colStatsByName = $scope.properties.stats[dID];

    _.each(colAttrs, function(c) {
      $scope.condTypes[c.name] = c.type;
      if (c.name in colStatsByName) {
        c.stats = colStatsByName[c.name]
      }
      if (!$scope.isNumeric(c.type)) {
        $scope.condList.push(c)
      }
    });

    // Get X and Y and group parameters for comparisons
    if (spec.viz_type === 'comparison') {
      var params = {
        dID: $scope.currentdID,
        name: spec.groupBy.title,
        pID: pID
      }
      ConditionalDataService.getConditionalData(params, function(result) {
        $scope.selectedParameters.x = result.result[0];
        $scope.selectedParameters.y = result.result[1];
        $scope.parametersData = result.result;
        $scope.condData[spec.groupBy.title] = result.result;
      });
    }

    $scope.loadingViz = true;

    delete spec.stats;

    $scope.refreshVizData();
    // var params = {
    //   spec: spec,
    //   conditional: $scope.selCondVals,
    //   pID: pID
    // };
    // VizDataService.getVizData(params, function(result) {
    //   $scope.loadingViz = false;
    //   $scope.vizData = result.result;
    //   $scope.vizStats = result.stats;
    //   $scope.
    //   var means = result.stats.means;

    //   var selectedValues = {}
    //   var sortedMeans = Object.keys(means).sort(function(a,b){return means[b]-means[a]});
    //   _.each(sortedMeans, function(e, i) {
    //     selectedValues[e] = (i < 10) ? true : false;
    //   });
    //   $scope.selectedValues = selectedValues;
    // });
  }

  // Sidenav data
  $scope.sortFields = [
    {
      property: 'num_elements',
      display: 'Number of Elements'
    }, {
      property: 'std',
      display: 'Standard Deviation'
    }
  ];
  $scope.sortOrders = [
    {
      property: 1,
      display: 'Ascending'
    }, {
      property: -1,
      display: 'Descending'
    }
  ];
  $scope.filters = {
    sortField: $scope.sortFields[0].property,
    sortOrder: $scope.sortOrders[0].property
  }

  // Watch changes in the configuration
  // TODO Don't run initially
  $scope.$watch('config', function(config) {
    $scope.refreshVizData();
  }, true);
  
  $scope.isNumeric = function(type) {
    if (type === "float" || type === "integer") {
      return true;
    } else {
      return false;
    }
  };

  $scope.refreshVizData = function() {
    $scope.loadingViz = true;

    var spec = $scope.selectedSpec;

    // Remove stats to unbloat the params
    if ('stats' in spec) {
      delete spec.stats;      
    }

    // var filteredSelCondVals = {}
    // _.each($scope.selCondVals, function(v, k) {
    //   if ($scope.selConds[k]) {
    //     filteredSelCondVals[k] = v;
    //   }
    // })

    var params = {
      type: $scope.selectedType,
      spec: spec,
      conditional: $scope.selCondVals,
      config: $scope.config,
      pID: pID
    };

    VizDataService.getVizData(params, function(result) {
      $scope.vizData = result.result;
      $scope.vizStats = result.stats;
      $scope.loadingViz = false;

      var means = result.stats.means;

      var selectedValues = {}
      var sortedMeans = Object.keys(means).sort(function(a,b){return means[b]-means[a]});
      _.each(sortedMeans, function(e, i) {
        selectedValues[e] = (i < 10) ? true : false;
      });
      $scope.selectedValues = selectedValues;
    });
  };
});