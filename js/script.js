// NAMESPACE / SETTINGS ///////////

var shipwire = {
	settings: {
		totalMinutes     : 10,
		totalOrdersRange : {min: 7, max: 14},   // ammount of orders
		durationRange    : {min: 40, max: 170}  // in seconds
	}
};

// HELPERS ////////////////////////

shipwire.helpers = (function(){
	var convert = (function(){
			var secondsToMinutes = function(seconds) {
				// returns a string like 2:45
			    var divisor  = seconds % (60 * 60),
			    	minutes  = Math.floor(divisor / 60),
			    	divisor2 = divisor % 60,
			    	seconds  = Math.ceil(divisor2);
			    if(seconds < 10) {
			    	seconds = '0'+seconds;
			    }
			    return minutes+':'+seconds;
			};
			return {
				secondsToMinutes: secondsToMinutes
			}
		})(),
		sort = (function(){
			var byStart = function(a, b) {
					if(a.start < b.start) { return -1; } else { return 1; }
				},
				byId = function(a, b) {
					if(a.id < b.id) { return -1; } else { return 1; }
				};
			return {
				byStart: byStart,
				byId: byId
			}
		})();
	return {
		convert: convert,
		sort: sort
	}
})();

// ORDER //////////////////////////

shipwire.order = function(id) {
	var rand      = Math.random();  // random seed
	this.start    = Math.round(rand*((shipwire.settings.totalMinutes - (shipwire.settings.durationRange.max / 60)) * 60));
	this.duration = Math.round(rand*(shipwire.settings.durationRange.max - shipwire.settings.durationRange.min))+shipwire.settings.durationRange.min;
	this.end      = this.start + this.duration;
	this.id       = id;
};
shipwire.order.prototype = {
	// checks if the current order overlaps time with another
	checkOverlap: function(otherOrder) {
		var s1 = this.start,
			s2 = otherOrder.start,
			e1 = this.end,
			e2 = otherOrder.end;
		if((s1 <= s2 && s2 <= e1) || (s1 <= e2 && e2 <= e1) || (s2 <= s1 && s1 <= e2) || (s2 <= e1 && e1 <= e2)) {
			return true;
		} else {
			return false;
		}
	}
};

// ORDER COLLECTION ///////////////////////////

shipwire.orderCollection = (function(){
	var collection,
		collectionGroups,
		set = function() {
			// generate fake order data automatically
			collection = [];
			var randomTotalOrders = Math.round(Math.random()*(shipwire.settings.totalOrdersRange.max - shipwire.settings.totalOrdersRange.min))+shipwire.settings.totalOrdersRange.min;
			for(var i=0, l=randomTotalOrders; i<l; i++) {
				// create an order
				collection.push(new shipwire.order(i+1));
			}
			return collection;
		},
		get = function() {
			if(!collection || typeof collection === 'undefined' || collection === []) { set(); }   // fallback in case get is called, but data is not set yet
			return collection;
		},
		getOrderById = function(id) {
			var order;
			for(var i=0, l=collection.length; i<l; i++) {
				if(collection[i].id === id) {
					order = collection[i];
					break;
				}
			}
			return order;
		},
		getGroups = function(){
			// first, sort orders by start time
			collection.sort(shipwire.helpers.sort.byStart);
			// combine the orders that would overlap into array groups
			var i, j;
			collectionGroups = [[collection[0].id]];
			for(i=1, l=collection.length; i<l; i++) {
				var order = collection[i],
					foundOverlap = false;

				for(j=i-1; j>=0; j--) {
					var compareOrder = collection[j];
					if(order.checkOverlap(compareOrder)) {
						var foundOverlapInGroups = false,
							k = collectionGroups.length;
						while(!foundOverlapInGroups && k--) {
							if(collectionGroups[k].indexOf(compareOrder.id) !== -1) {
								collectionGroups[k].push(order.id);
								foundOverlapInGroups = true;
							}
						}
						foundOverlap = true;
						break;
					}
				}

				// create new group if nothing matches
				if(!foundOverlap) { collectionGroups.push([order.id]); }
			}

			// Now we have arrays of orders that will overlap, but we need to go 1 step more
			// and figure out which orders in the order group DONT overlap and group them together. For example:
			/*
				-----
				| 1 |  -----
				-----  | 3 |
					   |   |
				-----  |   |
				| 2 |  -----
				-----
			*/
			// 1 and 2 should be in the same sub-array of the overall group

			for(i=0, l=collectionGroups.length; i<l; i++) {
				var group = collectionGroups[i];
				for(j=0; j<group.length; j++) {
					var order = group[j];
					for(var k=0; k<group.length; k++) {
						var compareOrder = group[k];
						if(order !== compareOrder && typeof compareOrder !== 'object' && !getOrderById(order).checkOverlap(getOrderById(compareOrder))) {
							if(typeof group[j] === 'object') {
								var overlaps = false;
								for(var m=0; m<group[j].length; m++) {
									if(getOrderById(compareOrder).checkOverlap(getOrderById(group[j][m]))) {
										overlaps = true;
										break;
									}
								}
								if(!overlaps) {
									group[j].push(compareOrder);
									group.splice(k,1);
								}
							} else {
								group[j] = [order, compareOrder];
								group.splice(k,1);
							}
						}
					}
				}
			}

			// the resulting array (depending on the data) could look something like this:
			/*
				[
					[1,5],
					[7,[2,6],4],
					[3,6]
				]
			*/
			// in this example, the 3 array rows are all in the same overlap zone and in the middle array
			// 2 and 6 don't overlap (so we can stack them instead)

			return collectionGroups;
		};

	// generate initial data
	set();

	// public methods
	return {
		set: set,
		get: get,
		getGroups: getGroups,
		getOrderById: getOrderById
	}
})();

// ORDERS VIEW ////////////////////

shipwire.ordersView = new function() {
	var $grid     = $('#orders-grid'),
		$content  = $('#orders-content');

	var init = function(){
		console.log('> Orders view init');
		renderGrid();
		renderOrders();
	};

	var renderGrid = function() {
		var gridHTML = '';
		for(var i=0, l=shipwire.settings.totalMinutes+1; i<l; i++) {
			gridHTML += '<div class="time"><span>'+i +' min</span></div>';
		}
		$grid.html(gridHTML);
	};

	var renderOrders = function() {
		console.log('> Orders view render');
		var orderData   = shipwire.orderCollection.get(),
			orderGroups = shipwire.orderCollection.getGroups(),
			orderHTML   = '';

		// loop through the order groups, keeping in mind there may be nested arrays of orders in the same range that don't overlap
		for(i=0; i<orderGroups.length; i++) {
			var group = orderGroups[i];
			for(j=0; j<group.length; j++) {
				var orderOrSubGroup = group[j],
					order;

				if(orderOrSubGroup.length) {
					// this is a sub-array of orders that don't overlap, render each
					for(var k=0; k<orderOrSubGroup.length; k++) {
						order       = shipwire.orderCollection.getOrderById(orderOrSubGroup[k]);
						order.width = 100/group.length;
						order.x     = order.width * j;

						orderHTML += getSingleOrderTemplate(order);
					}
				} else {
					// this is a single order
					order       = shipwire.orderCollection.getOrderById(group[j]);
					order.width = 100/group.length;
					order.x     = order.width * j;

					orderHTML += getSingleOrderTemplate(order);
				}
			}
		}
		$content.html(orderHTML);
	};

	var getSingleOrderTemplate = function(order) {
		return '<div class="order" style="top: '+order.start+'px; left: '+order.x+'%; width: '+order.width+'%; height: '+order.duration+'px;"><span>Order '+order.id+'    '+shipwire.helpers.convert.secondsToMinutes(order.start)+'-'+shipwire.helpers.convert.secondsToMinutes(order.end)+'</span></div>';
	};

	// start
	init.call(this);

	// public facing methods
	return {
		init: init,
		renderOrders: renderOrders
	}
};

// OUTPUT VIEW ////////////////////

shipwire.outputView = new function() {
	var orderData,
		$output = $('#output ul');

	var init = function() {
		renderOutput();
	};

	var renderOutput = function() {
		$output.empty();
		var orderData = shipwire.orderCollection.get(),
			outputHTML = '';
		for(var i=0, l=orderData.length; i<l; i++) {
			var order = orderData[i];
			outputHTML += '<li>Order '+order.id+' whose processing starts at '+order.start+' and lasts '+order.duration+' seconds.'+'</li>';
		}
		$output.html(outputHTML);
	};

	// start init
	init();

	// public facing methods
	return {
		init: init,
		renderOutput: renderOutput
	}
};

// REGENERATE ////////////////////

shipwire.regenerate = (function(){
	var $button = $('button#regenerate');

	$button.on('click', function() {
		shipwire.orderCollection.set();
		shipwire.outputView.renderOutput();
		shipwire.ordersView.renderOrders();
	});
})();
