var width = 700;
var height = 600;
var country = "US";
var stat = "confirmed";
var dailyReportBaseUri = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/";

function addZero(n) {
    return n > 10 ? '' + n : '0' + n;
}

function getCSVFileName () {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getUTCDate() > date.getDate() ? date.getDate() : date.getDate() - 1;
    const year = date.getFullYear();
    let formatedDate = addZero(month) + '-' + addZero(day) + '-' + year;
    return dailyReportBaseUri + formatedDate + '.csv';
}

var currState = d3.select('#state').property('value');

d3.select('#state')
    .on('change', function() {
        let newState = d3.select('#state').property('value');
        if (currState && currState !== newState) {
            currState = newState;
            init(currState);
        }
    });

if (currState) init(currState);
function capitalize(s) {
    return s.charAt(0).toUpperCase() + currState.slice(1);
}
function init(currState) {
    d3.queue().defer(d3.csv, dataUri, (row, i, header) => {
        return {
            country: row.Country_Region,
            state: row.Province_State,
            county: row.Admin2,
            confirmed: +row.Confirmed,
            deaths: +row.Deaths,
            recovered: +row.Recovered,
        }
    })
    .defer(d3.json, `./maps/${currState}.json`)
    .await((error, coronaData, topoData) => {
        if (error) console.log(error);
        else {
            coronaData = coronaData.filter(row => row.country === country && row.state === capitalize(currState));
            let stateDetails = {
                name: capitalize(currState),
                confirmed: 0,
                deaths: 0,
                recovered: 0
            };
            coronaData.forEach(c => {
                topoData.objects[currState+'-counties'].geometries.forEach(g => {
                    if (g.properties.NAME === c.county) {
                        g.properties.confirmed = c.confirmed;
                        g.properties.deaths = c.deaths;
                        g.properties.recovered = c.recovered;
                    }
                })
                stateDetails.confirmed += c.confirmed;
                stateDetails.deaths += c.deaths;
                stateDetails.recovered += c.recovered;
            });
            var topology = topojson.feature(topoData, topoData.objects[currState + '-counties']);
            d3.select("select")
				.on('change', function(){
					drawMap(coronaData, topology);
                });
            d3.select('#map').selectAll('svg').selectAll('.map').remove();
            drawMap(coronaData, topology);
            showStateInfo(stateDetails);
        }
    });
}

const drawMap = function (coronaData, topology, stateDetails) {
    var stat = d3.select('#stat').property('value');
    var prevSelected = null;
    // color scale
    var colorValues = {
        deaths: ["#facaca", "#f70505"],
        confirmed: ["#cdd8fa", "#426ff5"]
    };
    var colorScale = d3.scaleLinear()
                .domain(d3.extent(coronaData, d => d[stat]))
                .range(colorValues[stat]);
    // // draw map
    var map = d3.select("#map")
        .selectAll('svg')
        .attr("width", width)
        .attr("height", height);
    var projection = d3.geoMercator()
                   .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection)

    var bounds = d3.geoBounds(topology),
        center = d3.geoCentroid(topology);

    // Compute the angular distance between bound corners
    var distance = d3.geoDistance(bounds[0], bounds[1]),
        scale = (height + distance * 1000) / distance / Math.sqrt(2);
    // Update the projection scale and centroid
    projection.scale(scale).center(center);
    var atlas = map.selectAll('.map').data(topology.features);
    atlas.exit().remove();
    atlas.style("stroke", "black")
        .attr("fill", d => {
            if (d.properties[stat] == undefined) return '#ccc';
            else return colorScale(d.properties[stat]);
        });
    atlas.enter()
        .append("path")
        .classed('map',true)
        .attr('d', path)
        .style("stroke", "black")
        .attr("fill", d => {
            if (d.properties[stat] == undefined) return '#ccc';
            else return colorScale(d.properties[stat]);
        })
        .on('click', function(d) {
            d3.select(this).style('stroke', '#03fccf').style('stroke-width', 1);
            if (prevSelected && prevSelected != this) d3.select(prevSelected).style('stroke', 'black');
            prevSelected =this;
            var info = d3.select("#county-info");
            info.style('opacity', 1)
                .html(`<p>County Name: ${d.properties.NAME}</p>
                <p>Confirmed: ${d.properties.confirmed != undefined?d.properties.confirmed:'No data'}</p>
                <p>Deaths: ${d.properties.deaths != undefined?d.properties.deaths:'No data'}</p>
                <p>Recovered: ${d.properties.recovered != undefined?d.properties.recovered:'No data'}</p>`);
        })
        .on('mouseover touchstart', function(d){
            var tooltip = d3.select('#tooltip');
            tooltip.style('opacity', 1)
                .style('left', (d3.event.pageX - tooltip.node().offsetWidth/2) + 'px')
                .style('top', (d3.event.pageY + 10) + 'px')
                .html(`<p>Name: ${d.properties.NAME}</p>
                    <p>Confirmed: ${d.properties.confirmed != undefined?d.properties.confirmed:'Data not available'}</p>
                    <p>Deaths: ${d.properties.deaths != undefined?d.properties.deaths:'Data not available'}</p>
                    <p>Recovered: ${d.properties.recovered != undefined?d.properties.recovered:'Data not available'}</p>`);
        })
        .on('mouseout touchend', function(d){
            d3.select('#tooltip').style('opacity', 0);
        });
}

function showStateInfo(stateDetails) {
    var stateInfo = d3.select("#state-info");
    stateInfo.style('opacity', 1)
        .html(`<p>State Name: ${stateDetails.name}</p>
        <p>Confirmed: ${stateDetails.confirmed}</p>
        <p>Deaths: ${stateDetails.deaths}</p>
        <p>Recovered: ${stateDetails.recovered}</p>`);
}