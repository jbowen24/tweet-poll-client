dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("esri.arcgis.utils");
dojo.require("esri.map");

/******************************************************
***************** begin config section ****************
*******************************************************/

var TITLE = "#WhereToLive"
var BASEMAP_SERVICE = "http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer";

var PARAMETER_STANDARDIZEDNAME = "standardizedName";

var SYMBOL_BASE_SIZE = 7;
var SYMBOL_COLOR = {r:0,g:0,b:233};

var CENTER_X = -10910315;
var CENTER_Y = 4002853;
var LEVEL = 4;

/******************************************************
***************** end config section ******************
*******************************************************/

var _map;
var _service;
var _locations;
var _center;
var _selected;

var _dojoReady = false;
var _jqueryReady = false;

var _isMobile = isMobile();
var _isIE = (navigator.appVersion.indexOf("MSIE") > -1);

var _isEmbed = false;

dojo.addOnLoad(function() {_dojoReady = true;init()});
jQuery(document).ready(function() {_jqueryReady = true;init()});

function init() {
	
	if (!_jqueryReady) return;
	if (!_dojoReady) return;
	
	$(document).keydown(onKeyDown);
	
	_service = new HerokuService();
	
	_center = new esri.geometry.Point(CENTER_X, CENTER_Y, new esri.SpatialReference(102100));
	
	// jQuery event assignment
	
	$(this).resize(handleWindowResize);
	
	$("#zoomIn").click(function(e) {
        _map.setLevel(_map.getLevel()+1);
    });
	$("#zoomOut").click(function(e) {
        _map.setLevel(_map.getLevel()-1);
    });
	$("#zoomExtent").click(function(e) {
        _map.centerAndZoom(_center, LEVEL);
    });
	
	$("#title").append(TITLE);
	
	_map = new esri.Map("map", {slider:false});
	
	_map.addLayer(new esri.layers.ArcGISTiledMapServiceLayer(BASEMAP_SERVICE));
	_map.centerAndZoom(_center, LEVEL);
	

	if(_map.loaded){
		finishInit();
	} else {
		dojo.connect(_map,"onLoad",function(){
			finishInit();
		});
	}

	_service.getLocations(function(locations){_locations = locations; finishInit()});
	
}

function finishInit() {
	
	if (!_locations) return false;	
	if (!_map.loaded) return false;
	
	$("#listIcon").click(function(e) {
		deselect();
        flipToTable();
    });
	
	$.each(_locations, function(index, value) {
		_map.graphics.add(value);
	});
	
	writeTable();
	
	var params = esri.urlToObject(document.location.href).query;
	var starterName;
	if (params != null) {
		$.each(params,function(index,value){			
			if (index.toLowerCase() == PARAMETER_STANDARDIZEDNAME.toLowerCase()) {
				starterName = value
			}
		});
	}
	if (starterName) {
		_selected = $.grep(_locations, function(n, i) {
			return n.attributes.getStandardizedName() == starterName;
		})[0];
		postSelection();
		_map.centerAndZoom(_selected.geometry, 5);
	}
		
	dojo.connect(_map.graphics, "onMouseOver", layerOV_onMouseOver);
	dojo.connect(_map.graphics, "onMouseOut", layerOV_onMouseOut);
	dojo.connect(_map.graphics, "onClick", layerOV_onClick);		
	
	// click action on the map where there's no graphic 
	// causes a deselect.

	dojo.connect(_map, 'onClick', function(event){
		if (event.graphic == null) {
			deselect();
		}
	});
	
	handleWindowResize();
	$("#whiteOut").fadeOut();
	
	setTimeout(refreshLocations, 3000);
	
}

function refreshLocations()
{
	console.log('test');
	_service.getLocations(function(locations){
		_map.graphics.clear();
		_locations = locations; 
		$.each(_locations, function(index, value) {
			_map.graphics.add(value);
		});
		writeTable();
		setTimeout(refreshLocations, 3000);
	});
	
}

function onKeyDown(e)
{

	if (e.keyCode == 27) {
		if (_selected) {
			deselect();
			flipToTable();
		}
	}
	
}

function layerOV_onMouseOver(event) 
{
	if (_isMobile) return;
	var graphic = event.graphic;
	_map.setMapCursor("pointer");
	if (graphic!=_selected) {
		graphic.setSymbol(createSymbol(SYMBOL_BASE_SIZE*graphic.attributes.getCount()+3, 0.35));
		$("#hoverInfo").html(graphic.attributes.getShortName());
		var pt = _map.toScreen(graphic.geometry);
		hoverInfoPos(pt.x,pt.y);	
	}
}


function layerOV_onMouseOut(event) 
{
	var graphic = event.graphic;
	_map.setMapCursor("default");
	$("#hoverInfo").hide();
	graphic.setSymbol(createSymbol(SYMBOL_BASE_SIZE*graphic.attributes.getCount(), 0.25));
}


function layerOV_onClick(event) 
{
	$("#hoverInfo").hide();
	var graphic = event.graphic;
	_selected = graphic;
	postSelection();
	flipToLyrics();
	adjustExtent();
}

function tableRec_onClick(event)
{
	deselect();
	$(this).addClass("selected");
	var standardizedName = $(this).find(".hiddenData").html();
	_selected = $.grep(_locations, function(n, i){return n.attributes.getStandardizedName() == standardizedName})[0];
	postSelection();
	flipToLyrics();
	adjustExtent();
}

function adjustExtent()
{
	// make sure point doesn't occupy right-most 400px of map.
	if ((_map.toScreen(_selected.geometry).x > ($("#map").width() - 400)) || (!_map.extent.expand(0.75).contains(_selected.geometry))) 
		_map.centerAt(_selected.geometry);
}

function deselect()
{
	_selected = null;
	$(".page1 li").removeClass("selected");
	if ($('.page2').is(':visible')) flipToTable();
	$("#map").multiTips({
		pointArray : [],
		labelValue: "",
		mapVariable : _map,
		labelDirection : "top",
		backgroundColor : "#000000",
		textColor : "#FFFFFF",
		pointerColor: "#000000"
	});		
}

function postSelection()
{
	$("#map").multiTips({
		pointArray : [_selected],
		labelValue: _selected.attributes.getShortName(),
		mapVariable : _map,
		labelDirection : "top",
		backgroundColor : "#000000",
		textColor : "#FFFFFF",
		pointerColor: "#000000"
	});		

	_service.queryRecsByCity(_selected.attributes.getStandardizedName(), function(recs){
		$("#info").empty();
		writeLyrics(recs);		
	});	
}

function writeLyrics(recs)
{
	$("#info").append("<b>"+_selected.attributes.getShortName()+"</b>");
	$("#info").append("<br>");
	$("#info").append("<br>");
	$.each(recs, function(index, value) {
		$("#info").append("<b>"+value.place+"</b>, <i>"+value.user+"</i>");
		$("#info").append("<br>");
		$("#info").append("<br>");
	});
}

function writeTable()
{
	var list = [];
	$.each(_locations, function(index, value){
		list.push({name: value.attributes.getShortName(), standardizedName: value.attributes.getStandardizedName()});
	});
	list.sort(function(a,b){
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;
		return 0;
	});
	$(".page1").empty();
	var ul = $("<ul></ul>");
	var li;
	$.each(list, function(index, value){
		li = "<li>"+value.name+"<div class='hiddenData'>"+value.standardizedName+"</div></li>";
		$(ul).append(li);
	});
	$(".page1").append(ul);
	$(".page1 li").click(tableRec_onClick);
}

function flipToTable()
{
	$(".page2").removeClass('flip in').addClass('flip out').hide();
	$(".page1").removeClass('flip out').addClass('flip in').show();	
}

function flipToLyrics()
{
	$(".page1").removeClass('flip in').addClass('flip out').hide();
	$(".page2").removeClass('flip out').addClass('flip in').show();	
}

function hoverInfoPos(x,y){
	if (x <= ($("#map").width())-230){
		$("#hoverInfo").css("left",(x-($("#hoverInfo").width()/2))-5);
	}
	else{
		$("#hoverInfo").css("left",x-25-($("#hoverInfo").width()));
	}
	if (y >= ($("#hoverInfo").height())+50){
		$("#hoverInfo").css("top",y-35-($("#hoverInfo").height()));
	}
	else{
		$("#hoverInfo").css("top",y-15+($("#hoverInfo").height()));
	}
	$("#hoverInfo").show();
}

function handleWindowResize() {
	if ((($("body").height() <= 500) || ($("body").width() <= 800)) || _isEmbed) $("#header").height(0);
	else $("#header").height(115);
	
	$("#map").height($("body").height() - $("#header").height());
	$("#map").width($("body").width());
	_map.resize();
	$(".page1").css("max-height", $("#map").height()-100);
	$(".page2").css("max-height", $("#map").height()-100);
}

function createSymbol(size, opacity)
{
	return new esri.symbol.SimpleMarkerSymbol(
				esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, size,
				new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([SYMBOL_COLOR.r, SYMBOL_COLOR.g, SYMBOL_COLOR.b]), 2),
				new dojo.Color([SYMBOL_COLOR.r, SYMBOL_COLOR.g, SYMBOL_COLOR.b, opacity])
			);	
}