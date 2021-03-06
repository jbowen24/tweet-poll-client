function AGOLService(FEATURE_SERVICE_URL, refreshHandler, REFRESH_RATE)
{
	
	var _recs;
	var _pictureOnly = false;
		
	fetchLocations();
		
	function fetchLocations() 
	{

		var statDefCount = new esri.tasks.StatisticDefinition();
        statDefCount.statisticType = "count";
        statDefCount.onStatisticField = "Stand_loc";
        statDefCount.outStatisticFieldName = "Count";

		var statDefX = new esri.tasks.StatisticDefinition();
        statDefX.statisticType = "min";
        statDefX.onStatisticField = "X_coord";
        statDefX.outStatisticFieldName = "X_coord";

		var statDefY = new esri.tasks.StatisticDefinition();
        statDefY.statisticType = "min";
        statDefY.onStatisticField = "Y_coord";
        statDefY.outStatisticFieldName = "Y_coord";

		var query = new esri.tasks.Query();
		query.where = "Matched = '1' and Hide = '0'";
		if (_pictureOnly) query.where = query.where + " and Media = '1'";
		query.returnGeometry = false;
		query.outStatistics = [statDefCount, statDefX, statDefY];
		query.groupByFieldsForStatistics = ["Stand_loc"];
						
		var queryTask = new esri.tasks.QueryTask(FEATURE_SERVICE_URL);
		queryTask.execute(query, processLocations);
		  		
	}
	
	function convertToRecs(features)
	{
		var recs = [];
		$.each(features, function(index, value){
			recs.push({
				count: value.attributes.Count, 
				x: value.attributes.X_coord, 
				y: value.attributes.Y_coord, 
				standardized_name: value.attributes.Stand_loc, 
				short_name: value.attributes.Stand_loc.split(",")[0]
			});
		});
		return recs;
	}
	
	function processLocations(text)
	{
		if (_recs == null) {
			_recs = convertToRecs(text.features);
			refreshHandler(true);
		} else {
			var temp = convertToRecs(text.features);
			if (diff(temp, _recs)) {
				_recs = temp
				refreshHandler(false);
			}
		}
		setTimeout(fetchLocations, REFRESH_RATE);
	}
	
	function diff(arr1, arr2)
	{
		var matches;
		var flag = false;
		
		if (hasDeletionOccurred(arr1, arr2)) {
			console.log("deletion has occurred");
			return true;
		}
		
		$.each(arr1, function(index, value) {
			matches = $.grep(arr2, function(n, i) {
				return n.standardized_name == value.standardized_name;
			});
			if (matches.length > 0) {
				if (matches[0].count != value.count) {
					console.log("count changed");
					flag = true;
				}
			} else {
				console.log("new one!");
				flag = true;
			}
		});
		return flag;
	}
	
	function hasDeletionOccurred(arrNew, arrOrig)
	{
		// is there a location in the original that is not
		// in the new?
		var matches;
		var flag = false;
		$.each(arrOrig, function(index, value) {
			matches = $.grep(arrNew, function(n, i) {
				return n.standardized_name == value.standardized_name;
			});
			if (matches.length == 0) {
				flag = true;
			}
		});
		return flag;
	}
	
	this.getRecsSortedByCount = function() 
	{
		var list = $.extend(true, [], _recs);
		list.sort(function(a,b){return b.count - a.count});
		return list;
	}
	
	this.getRecsSortedByName = function()
	{
		var list = $.extend(true, [], _recs);
		list.sort(function(a,b){
			if (a.short_name < b.short_name) return -1;
			if (a.short_name > b.short_name) return 1;
			return 0;
		});
		return list;		
	}
	
	this.queryRecsByCity = function(name, callBack)
	{
		
		var query = new esri.tasks.Query();
		query.where = "Stand_loc = '"+name.replace("'", "''")+"' and Hide = '0'";
		if (_pictureOnly) query.where = query.where + " and Media = '1'";
		query.returnGeometry = false;
		query.outFields = ["*"];
		
		var queryTask = new esri.tasks.QueryTask(FEATURE_SERVICE_URL);
		queryTask.execute(query, function(result){
			var recs = [];
			$.each(result.features, function(index, value){
				recs.push({tweet_id: value.attributes.Tweet_ID});
			});
			callBack(recs);
		});	
	}


	this.setPictureOnly = function(val)
	{
		_pictureOnly = val;
		fetchLocations();
	}	
		
}