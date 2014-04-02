$(function () {
  $('.worker').each(function () {
    var $workerContainer = $(this);

    $workerContainer.find('.solver-stage').each(function () {
      var $solverStageContainer = $(this);

      $solverStageContainer.find('.score-distribution').each(function () {
        var $scoreDistributionContainer = $(this);
        var scoreDistribution = $scoreDistributionContainer.data('score-distribution');

        // Need to wait until the chart is visible in order for highcharts to render it correctly.
        if($workerContainer.filter(':visible').length === 0) {
          var $tabForWorker = $('a[href=#' + $workerContainer[0].id + ']');

          $tabForWorker.one('shown.bs.tab', function () {
            initializeChart();
          });
        } else {
          initializeChart();
        }

        ////////////////////
        // Helper functions.

        function initializeChart() {
          //
          // [API Documentation](http://api.highcharts.com/highcharts#chart).
          //
          // [Example histograms](http://stackoverflow.com/a/18056126).
          //
          $scoreDistributionContainer.highcharts({
            chart: {
              type: 'column'
            },
            legend: {
              enabled: false
            },
            plotOptions: {
              column: {
                borderWidth: 0,
                groupPadding: 0,
                pointPadding: 0
              },
              series: {
                tooltip: {
                  pointFormat: '<b>{point.y}</b><br/>'
                }
              }
            },
            series: [{
              data: scoreDistribution
            }],
            title: {
              text: 'Scoring Distribution'
            },
            xAxis: {
              title: {
                enabled: false,
                text: 'Score'
              }
            },
            yAxis: {
              title: {
                enabled: false,
                text: 'Count'
              }
            }
          });
        }
      });
    });
  });
});
