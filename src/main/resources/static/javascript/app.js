var PlanningPoker = angular.module('PlanningPoker', ['chart.js']);

PlanningPoker.config(['$httpProvider', function ($httpProvider) {
    if (!$httpProvider.defaults.headers.get) {
        $httpProvider.defaults.headers.get = {}
    }
    //prevent IE caching AJAX requests
    $httpProvider.defaults.headers.get['If-Modified-Since'] = 'Mon, 26 Jul 1997 05:00:00 GMT';
    $httpProvider.defaults.headers.get['Cache-Control'] = 'no-cache';
    $httpProvider.defaults.headers.get['Pragma'] = 'no-cache';
}]);

PlanningPoker.directive('showFocus', function ($timeout) {
    return function (scope, element, attrs) {
        scope.$watch(attrs.showFocus,
            function (newValue) {
                $timeout(function () {
                    newValue && element[0].focus();
                });
            }, true);
    };
});

PlanningPoker.filter('userNameCaseFilter', function () {
    return function (input) {
        if (!input) {
            return ''
        }
        else if (input.length > 2) {
            return input.replace(/\w\S*/g, function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        } else {
            return input.toUpperCase();
        }
    }
});

PlanningPoker.controller('PokerCtrl', ['$scope', '$http', function ($scope, $http) {
    $scope.userName = '';
    $scope.isAdmin = false;
    $scope.inSession = false;
    $scope.loading = false;
    $scope.inSession = false;
    $scope.voted = false;
    $scope.sessionUsers = [];
    $scope.notVoted = [];
    $scope.votedUsers = [];
    $scope.waitingFor = [];
    $scope.votingResults = [];
    $scope.resultsData = [];
    $scope.integerScale = true;
    $scope.defaultItemText = 'the current item';
    $scope.currentItem = $scope.defaultItemText;
    $scope.itemInput = undefined;
    $scope.legalEstimates = [1, 3, 5, 8, 13, 21, 0];
    $scope.legalEstimatesOne = [1, 3, 5, 8];
    $scope.legalEstimatesTwo = [13, 21, 0];
    $scope.labels = $scope.legalEstimates.map(String);

    $http({
        method: 'GET',
        url: '/version'
    }).success(function (response) {
        $scope.appVersion = response;
        $http({
            method: 'GET',
            url: '/feedbackRecipient'
        }).success(function (response) {
            $scope.feedbackMailLink = 'mailto:' + response + '?subject=' +
                'Planning Poker | Feedback for version ' + $scope.appVersion;
        });
    });

    $scope.createSession = function () {
        $scope.loading = true;
        $http({
            method: 'POST',
            url: '/createSession',
            params: {
                userName: $scope.userName
            }
        }).success(function (response) {
            $scope.loading = false;
            $scope.inSession = true;
            $scope.sessionId = response;
            $scope.isAdmin = true;
            var socket = new SockJS('/stomp');
            var stompClient = Stomp.over(socket);
            stompClient.debug = null;
            stompClient.connect({}, function (frame) {
                stompClient.subscribe("/topic/results/" + response, function (data) {
                    $scope.$apply(function () {
                        var message = JSON.parse(data.body);
                        $scope.resultsData = $scope.aggregateResults(message);
                        $scope.integerScale = Math.max.apply($scope.resultsData) <= 7;
                        $scope.votedUsers = message.map(function (estimate) {
                            return estimate.userName.toUpperCase();
                        });
                        $scope.waitingFor = $scope.notVoted.filter(function (user) {
                            return $scope.votedUsers.indexOf(user.toUpperCase()) < 0;
                        });
                    });
                });
                stompClient.subscribe("/topic/users/" + response, function (data) {
                    $scope.$apply(function () {
                        var users = JSON.parse(data.body);
                        $scope.sessionUsers = users;
                        $scope.notVoted = users;
                        $scope.waitingFor = $scope.notVoted.filter(function (user) {
                            return $scope.votedUsers.indexOf(user.toUpperCase()) < 0;
                        });
                    });
                });
            });
        });
    };

    $scope.joinSession = function () {
        if (!$scope.sessionId) {
            alert("Please enter a valid session ID.")
        } else {
            $scope.loading = true;
            $scope.inSession = true;
            var socket = new SockJS('/stomp');
            var stompClient = Stomp.over(socket);
            stompClient.debug = null;
            stompClient.connect({}, function (frame) {
                stompClient.subscribe("/topic/users/" + $scope.sessionId, function (data) {
                    $scope.$apply(function () {
                        var users = JSON.parse(data.body);
                        $scope.sessionUsers = users;
                        $scope.notVoted = users;
                        $scope.waitingFor = $scope.notVoted.filter(function (user) {
                            return $scope.votedUsers.indexOf(user.toUpperCase()) < 0;
                        });
                    });
                });
                stompClient.subscribe("/topic/results/" + $scope.sessionId, function (data) {
                    $scope.$apply(function () {
                        var message = JSON.parse(data.body);
                        if (message.length == 0 && $scope.votedUsers.indexOf($scope.userName.toUpperCase()) > -1) {
                            $scope.voted = false;
                        } else {
                            $scope.resultsData = $scope.aggregateResults(message);
                            $scope.integerScale = Math.max.apply($scope.resultsData) <= 7;
                            $scope.votedUsers = message.map(function (estimate) {
                                return estimate.userName.toUpperCase();
                            });
                            $scope.waitingFor = $scope.notVoted.filter(function (user) {
                                return $scope.votedUsers.indexOf(user.toUpperCase()) < 0;
                            });
                        }
                    });
                });
                stompClient.subscribe("/topic/item/" + $scope.sessionId, function (data) {
                    $scope.$apply(function () {
                        if (!$scope.voted || !data.body == $scope.defaultItemText) {
                            $scope.currentItem = data.body
                        }
                    });
                });
                $http({
                    method: 'POST',
                    url: '/joinSession',
                    params: {
                        sessionId: $scope.sessionId,
                        userName: $scope.userName
                    }
                }).then(function successCallback(response) {
                    $scope.loading = false;
                }, function errorCallback(response) {
                    $scope.loading = false;
                    if (response.data.message == 'user exists') {
                        alert("A user with that name has already joined this session. " +
                            "Please try again with a different username.");
                        $scope.userName = ''
                    } else {
                        alert("Session " + $scope.sessionId + " has not yet been started. " +
                            "Please try again in a few seconds, or start a new session as moderator.")
                    }
                    $scope.voted = false;
                    $scope.inSession = false;
                    $scope.loading = false;
                    $scope.isAdmin = false;
                });
            });
        }
    };

    $scope.vote = function (estimateValue) {
        $scope.loading = true;
        if ($scope.currentItem == $scope.defaultItemText) {
            $scope.currentItem = 'Results';
        }
        $http({
            method: 'POST',
            url: '/vote',
            params: {
                sessionId: $scope.sessionId,
                userName: $scope.userName,
                estimateValue: estimateValue
            }
        }).then(
            function successCallback(response) {
                $scope.loading = false;
                $scope.voted = true;
            },
            function errorCallback(response) {
                alert("Session " + $scope.sessionId + " is not currently active.");
                $scope.voted = false;
                $scope.inSession = false;
                $scope.loading = false;
                $scope.isAdmin = false;
                $scope.sessionId = undefined;
                $scope.itemInput = undefined;
            }
        );
    };

    $scope.setCurrentItem = function () {
        const item = ($scope.itemInput && $scope.itemInput.length > 0) ? $scope.itemInput : $scope.defaultItemText;
        $http({
            method: 'POST',
            url: '/setCurrentItem',
            params: {
                sessionId: $scope.sessionId,
                item: item
            }
        });
        $scope.currentItem = item;
    };

    $scope.reset = function () {
        $scope.integerScale = true;
        $scope.loading = true;
        $scope.itemInput = undefined;
        $scope.currentItem = $scope.defaultItemText;
        $http({
            method: 'DELETE',
            url: '/reset',
            params: {
                sessionId: $scope.sessionId,
                userName: $scope.userName
            }
        }).success(function (response) {
            $scope.loading = false;
            $scope.voted = false;
        });
        $scope.setCurrentItem();
    };

    $scope.aggregateResults = function (result) {
        $scope.votingResults = result;
        var estimates = $scope.votingResults.map(function (val) {
            return val.estimateValue
        });
        return $scope.legalEstimates.map(function (x) {
            return estimates.filter(function (y) {
                return x == y
            }).length
        })
    };

}]);
