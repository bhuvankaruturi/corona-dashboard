var width = 600;
var height = 550;
var country = "US";
var stat = "confirmed";
var dailyReportBaseUri = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/";
var colorValues = {
    deaths: d3.interpolateRgb("#fcd9d9","#bd0202"),
    confirmed: d3.interpolateRgb("#d4ddfa","#002aff")
}
var dataCSV = {};
var dataRead = false;

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

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function transformName(s) {
    return s.toLowerCase().split(' ').join('-');
}

var currState = d3.select('#state').property('value');

d3.select('#state')
    .on('change', function() {
        let newState = d3.select('#state').property('value');
        if (currState && currState !== newState) {
            currState = newState;
            if (dataRead) buildNewMap(currState);
            else init(currState)
        }
    });

populateOptions('texas');

async function init(currState) {
    let promise = getCoronaData(getCSVFileName());
    let result = await promise;
    if (result) {
        dataRead = true;
        buildNewMap(currState);
    }
}

function populateOptions(defaultMap='texas') {
    let keys = Object.keys(states);
    let stateList = [];
    for (let key of keys) {
        stateList.push({name: states[key], id: transformName(states[key])});
    }
    d3.select("#state").selectAll("option").data(stateList)
            .enter().append("option")
            .property('value', d => d.id)
            .property('textContent', d => d.name)
            .property('selected', d => d.id === defaultMap);
    currState = defaultMap;
    init(currState);
}

async function getCoronaData(dataUri) {
    let promise = new Promise((resolve, reject) => {
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
    .await((error, coronaData) => {
        if (error) {
            console.log(error);
            reject(0);
        }
        else { 
            let allStates = 'all-states';
            coronaData.forEach(row => {
                if (row.country === country) {
                    let state = transformName(row.state);
                    if (dataCSV[state]) {
                        dataCSV[state].info.confirmed += row.confirmed;
                        dataCSV[state].info.deaths += row.deaths;
                        dataCSV[state].info.recovered += row.recovered;
                        dataCSV[state].regions.push({
                            name: row.county, 
                            confirmed: row.confirmed,
                            deaths: row.deaths,
                            recovered: row.recovered
                        });
                    } else {
                        dataCSV[state] = {};
                        dataCSV[state].info = {
                            name: row.state, 
                            confirmed: row.confirmed,
                            deaths: row.deaths,
                            recovered: row.recovered 
                        };
                        dataCSV[state].regions = [];
                        dataCSV[state].regions.push({
                                                name: row.county, 
                                                confirmed: row.confirmed,
                                                deaths: row.deaths,
                                                recovered: row.recovered 
                                            });
                    }
                    if (dataCSV[allStates]) {
                        dataCSV[allStates].info.confirmed += row.confirmed;
                        dataCSV[allStates].info.deaths += row.deaths;
                        dataCSV[allStates].info.recovered += row.recovered;
                        dataCSV[allStates].regions.push(dataCSV[state].info);
                    } else {
                        dataCSV[allStates] = {};
                        dataCSV[allStates].info = {
                            name: row.state, 
                            confirmed: row.confirmed,
                            deaths: row.deaths,
                            recovered: row.recovered 
                        };
                        dataCSV[allStates].info.name = country;
                        dataCSV[allStates].info.confirmed = row.confirmed;
                        dataCSV[allStates].info.deaths = row.deaths;
                        dataCSV[allStates].info.recovered = row.recovered;
                        dataCSV[allStates].regions = [dataCSV[state].info];
                    }
                }
            });
            resolve(1);
        }
    });
    });
    return promise;
}

function buildNewMap(currState) {
    d3.queue().defer(d3.json, `./maps/${currState}.json`)
        .await((error, topoData) => {
            if (error) console.log(error);
            else {
                let objectName = currState;
                if (currState !== "all-states") objectName += '-counties';
                dataCSV[currState].regions.forEach(c => {
                    topoData.objects[objectName].geometries.forEach(g => {
                        if (g.properties.NAME === c.name) {
                            g.properties.confirmed = c.confirmed;
                            g.properties.deaths = c.deaths;
                            g.properties.recovered = c.recovered;
                        }
                    })
                });
                var topology = topojson.feature(topoData, topoData.objects[objectName]);
                d3.select("select")
                    .on('change', function(){
                        drawMapWithStat();
                    });
                d3.select('#map').selectAll('svg').selectAll('.map').remove();
                drawMap(topology);
                showInfo(dataCSV[currState].info);
            }
        });
}

const drawMap = function (topology) {
    var stat = d3.select('#stat').property('value');
    var prevSelected = null;
    
    var colorScale = d3.scaleSequential(colorValues[stat])
                    .domain(d3.extent(dataCSV[currState].regions, d => d[stat]));
    // draw map
    var map = d3.select("#map")
        .selectAll('svg')
        .attr("width", width)
        .attr("height", height);
    var projection = d3.geoAlbersUsa().fitSize([width, height], topology);
    var path = d3.geoPath()
        .projection(projection)

    var atlas = map.selectAll('.map').data(topology.features);
    atlas.enter()
        .append("path")
        .classed('map',true)
        .attr('d', path)
        .style("stroke", "black")
        .attr("fill", d => {
            if (d.properties[stat] == undefined) return '#ccc';
            else return colorScale(d.properties[stat]);
        })
        .on('mouseover touchstart', function(d){
            var tooltip = d3.select('#tooltip');
            tooltip.style('opacity', 1)
                .style('left', (d3.event.pageX - tooltip.node().offsetWidth/2) + 'px')
                .style('top', (d3.event.pageY + 10) + 'px')
                .html(`<p>Name: ${d.properties.NAME}</p>
                    <p>Confirmed: ${d.properties.confirmed != undefined?d.properties.confirmed:'Data not available'}</p>
                    <p>Deaths: ${d.properties.deaths != undefined?d.properties.deaths:'Data not available'}</p>`);
        })
        .on('mouseout touchend', function(d){
            d3.select('#tooltip').style('opacity', 0);
        });
        createLegend(colorScale, stat);
}

function drawMapWithStat() {
    let stat = d3.select('#stat').property('value');
    var colorScale = d3.scaleSequential(colorValues[stat])
                    .domain(d3.extent(dataCSV[currState].regions, d => d[stat]));
    let atlas = d3.select('#map').selectAll('svg').selectAll('.map');
    atlas.style("stroke", "black")
        .attr("fill", d => {
            if (d.properties[stat] == undefined) return '#ccc';
            else return colorScale(d.properties[stat]);
        });
    createLegend(colorScale, stat);
}

function createLegend(colorScale, stat) {
    var colorLegend = d3.legendColor()
        .labelFormat(d3.format(".0f"))
        .labels(thresholdLabels)
        .title(capitalize(stat))
        .scale(colorScale)
        .cells(5)
        .shapePadding(5)
        .shapeWidth(50)
        .shapeHeight(20)
        .labelOffset(12);
    var legend = d3.select('#scale').selectAll('svg');
    legend.selectAll('g').remove();
    legend.append("g")
        .attr("transform", "translate(10, 12)")
        .call(colorLegend);
}

function thresholdLabels ({
    i,
    genLength,
    generatedLabels,
    labelDelimiter
  }) {
    if (i === 0) {
      const values = generatedLabels[i].split(` ${labelDelimiter} `)
      return `Less than ${values[0]}`
    } else if (i === genLength - 1) {
      const values = generatedLabels[i].split(` ${labelDelimiter} `)
      return `${values[0]} or more`
    }
    return generatedLabels[i]
}

function showInfo(details) {
    var info = d3.select("#state-info");
    info.style('opacity', 1)
        .html(`<p>Name: <span class="name">${details.name == "US" ? "United States" : details.name}</span></p>
        <p>Confirmed: ${details.confirmed}</p>
        <p>Deaths: ${details.deaths}</p>
        ${currState == 'all-states'?`<p>Recovered: ${details.recovered}</p>`:''}`);
}