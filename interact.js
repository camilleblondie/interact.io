var interactApp = angular.module('interactApp', ['chart.js', 'ngRoute', 'ngCookies']);

interactApp.service('authTokenService', ['$cookies', function($cookies) {
  return {
      getAuthToken: function () {
        return $cookies.get('authToken');
      },
      setAuthToken: function (value) {
        $cookies.put('authToken', value);
      }
  };
}]);

interactApp.controller("loginController", function($scope, $location, $http, $rootScope, authTokenService) {
  $scope.login = function() {
    var request = {
      method: 'POST',
      url: 'https://app-staging.mycontacts.io/api/v2/login',
      data: { "username" : $scope.email,
              "password" : $scope.password,
              "client" : "Apiary" }
    };
    $http(request).then(function(response) {
      authTokenService.setAuthToken(response.data.token.authToken);
      $scope.authToken = authTokenService.getAuthToken();
    }, function(error) {
      console.log("Login error: " + error);
    });
  };
});

interactApp.controller('graphController', function($scope, $http, $rootScope, authTokenService) {
  $scope.title = 'Activity Report';
  $scope.options = { 'scaleShowGridLines': false,
  'legendTemplate' : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].strokeColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>" };
  $scope.periods = {
    'oneWeek': { 'selectedPeriodTimeNumber': 1, 'selectedPeriodTimeUnit': 'week' },
    'oneMonth': { 'selectedPeriodTimeNumber': 1, 'selectedPeriodTimeUnit': 'month'},
    'threeMonths': { 'selectedPeriodTimeNumber': 3, 'selectedPeriodTimeUnit': 'months'},
    'oneYear': { 'selectedPeriodTimeNumber': 1, 'selectedPeriodTimeUnit': 'year'}
  };
  $scope.contacts = {
    'sebastian': { 'name' : 'Sebastian', 'id' : '53fefe62-fb06-4c49-ae37-cd9fa44745d5' },
    'michael': { 'name' : 'Michael', 'id' : '31eb901b-4ecb-46f4-8355-ecf2e16e170c' }
  };
  
  // default selected contact
  $scope.selectedContact = {
    'sebastian': true,
    'michael': false
  };
  // default selected period
  $scope.selectedPeriod = $scope.periods.threeMonths;
  // default selected interval
  $scope.selectedInterval = 'daily';

  $scope.authToken = authTokenService.getAuthToken();

  var request = null;

  $scope.updateChart = function() {
    $scope.error = false;
    if ($scope.authToken == undefined) {
      $scope.error = true;
      $scope.errorMessage = "You are not logged in.";
      return;
    }
    var contactId = [];

    if ($scope.selectedContact != null) {
      if ($scope.selectedContact.sebastian && $scope.selectedContact.michael) {
        contactId.push($scope.contacts.sebastian.id);
        contactId.push($scope.contacts.michael.id);
      }
      else if ($scope.selectedContact.michael) {
        contactId.push($scope.contacts.michael.id);
      }
      else {
        contactId.push($scope.contacts.sebastian.id);
      }

      $scope.labels = [];
      $scope.data = [];
      $scope.series = [];
      var _labels = [];
      var _data = [];
      var groupByIntervalDatas = [];

      contactId.forEach(getData);

      function getData(element, contactIdIndex, contactIdArray) {
        request = {
          method: 'GET',
          url: 'https://app-staging.mycontacts.io/api/v2/contacts/' + element + '/interactions',
          headers: {
            'authToken': $scope.authToken
          }
        };

        $http(request).then(function(response) {
          var responseData = response.data.data; // array of interaction objects
          var createdDate = new Date(response.data.data[0].created);

          var selectedPeriodTimeNumber = $scope.selectedPeriod.selectedPeriodTimeNumber;
          var selectedPeriodTimeUnit = $scope.selectedPeriod.selectedPeriodTimeUnit;

          var responseDataFilteredByPeriodTime = responseData.filter(filterByPeriodTime);

          function filterByPeriodTime(interaction) {
            var createdMoment = moment(interaction.created);
            var todaySubstracted = moment().subtract(selectedPeriodTimeNumber, selectedPeriodTimeUnit);
            var today = moment();

            if (createdMoment.isBetween(todaySubstracted, today)) {
              return true;
            }
            else {
              return false;
            }
          }

          if (responseDataFilteredByPeriodTime.length == 0) {
            $scope.error = true;
            $scope.errorMessage = "No data found for the selected period time.";
          }
          else {
              if ($scope.selectedContact.sebastian && $scope.selectedContact.michael) {
              $scope.series.push($scope.contacts.sebastian.name);
              $scope.series.push($scope.contacts.michael.name);
            }
            else if ($scope.selectedContact.michael) {
              $scope.series.push($scope.contacts.michael.name);
            }
            else {
              $scope.series.push($scope.contacts.sebastian.name);
            }
          }

          var groupByIntervalData = {};

          responseDataFilteredByPeriodTime.reverse().forEach(groupByInterval);

          function groupByInterval(element, index, array) {
            //console.log("element: " + JSON.stringify(element.created));
            var createdMoment = moment(element.created);
            var key;
            if ($scope.selectedInterval == 'weekly') {
              key = createdMoment.format("WW[-]YYYY");
            }
            else if ($scope.selectedInterval == 'monthly') {
              key = createdMoment.format("MM[-]YYYY");
            }
            else {
              key = createdMoment.format("DD[-]MM[-]YYYY");
            }
            if (groupByIntervalData[key] === undefined) {
              groupByIntervalData[key] = 1;
            }
            else {
              groupByIntervalData[key] += 1;
            }
          };

          _labels = _labels.concat(Object.keys(groupByIntervalData));
          groupByIntervalDatas.push(groupByIntervalData);

          if (contactIdIndex == contactIdArray.length - 1) {
            //console.log("_labels: " + JSON.stringify(_labels));
            var _uniqueLabels = _labels.filter(function(item, pos, self) {
                return self.indexOf(item) == pos;
            });
            //console.log("_uniqueLabels: " + JSON.stringify(_uniqueLabels));

            function comp(a, b) {
              var difference;
              if ($scope.selectedInterval == 'weekly') {
                difference = moment(a, "WW-YYYY").diff(moment(b, "WW-YYYY"));
              }
              else if ($scope.selectedInterval == 'monthly') {
                difference = moment(a, "MM-YYYY").diff(moment(b, "MM-YYYY"));
              }
              else {
                difference = moment(a, "DD-MM-YYYY").diff(moment(b, "DD-MM-YYYY"));
              }
              return difference;
            }

            _uniqueLabels.sort(comp);

            for (var i = 0; i < groupByIntervalDatas.length; i++) {
              var _array = [];
              _uniqueLabels.forEach(createData);

              function createData(element, index, array) {
                if (Object.keys(groupByIntervalDatas[i]).indexOf(element) != -1) {
                  _array.push(groupByIntervalDatas[i][element]);
                }
                else {
                  _array.push(0);
                }
              };
              _data.push(_array);
            };

            var _prettyUniqueLabels = _uniqueLabels.map(prettifyDates);

            function prettifyDates (element, index, array) {
              var momentDate;
              if ($scope.selectedInterval == 'weekly') {
                momentDate = moment(element, "WW-YYYY");
                beginMoment = momentDate.startOf('week').format('D MMM YYYY');
                momentDate = moment(element, "WW-YYYY");
                endMoment = momentDate.endOf('week').format('D MMM YYYY');
                momentDate = beginMoment + ' - ' + endMoment;
              }
              else if ($scope.selectedInterval == 'monthly') {
                momentDate = moment(element, "MM-YYYY").format('MMM YYYY');
              }
              else {
                momentDate = moment(element, "DD-MM-YYYY").format('D MMM YYYY');
                console.log("momentDate: " + momentDate);
              }
              return momentDate;
            }

            $scope.labels = _prettyUniqueLabels;
            $scope.data = _data;
          }
        },
        function(error) {
          console.log("Error requesting data: " + error);
        });
      
      }
    }
  };

  $scope.updateChart();
});