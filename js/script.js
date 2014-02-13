// NAMESPACE / SETTINGS ///////////

var shipwire = {
	settings: {
		totalMinutes     : 10,
		totalOrdersRange : {min: 6, max: 14},   // ammount of orders
		durationRange    : {min: 40, max: 200}  // in seconds
	}
};

// HELPERS ////////////////////////

shipwire.helpers = (function(){
	var convert = (function(){
		var secondsToMinutes = function(seconds) {
			var divisor  = seconds % (60 * 60),
				minutes  = Math.floor(divisor / 60),
				divisor2 = divisor % 60,
				seconds  = Math.ceil(divisor2);
			    if(seconds < 10) { seconds = '0'+seconds; }
			    return minutes+':'+seconds;
			};
		return {
			secondsToMinutes: secondsToMinutes
		};
	})();
	return {
		convert: convert
	};
})();

// ARRAY SORT //////////////
// prototype helper for sorting arrays of objects. Usage: [{id: 2},{id: 1}].sortBy('id') = [{id: 1},{id: 2}]

Array.prototype.sortBy = function(property) {
	if(!property) { console.warn('Array.sortBy must define a property'); return; }
	this.sort(function(a,b) {
		if(!a.hasOwnProperty(property) || !b.hasOwnProperty(property)) {
			console.warn('Array.sortBy property not found');
			return;
		}
		if(a[property] < b[property]) { return -1; } else { return 1; }
	});
};
Array.prototype.isArray = true;  // helpful in determining if a variable is a number or array (used in the grouping algorithms)

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

shipwire.orderCollection = new function(){
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
			collection.sortBy('start');

			// TODO: these algorithms can most likely be simplified and optimized more
			// Group orders together that overlap
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

			// The above algorithm will produce "chains" of overlapping orders
			// for example:
			/*
				-----
				| 1 |  -----
				-----  | 3 |
					   |   |
					   |   |  -----
					   -----  | 2 |
							  -----
			*/
			// However, since 1 and 2 DONT overlap, they need to be grouped together as well.
			// The following algorithm will group them like this:
			/*
				-----
				| 1 |  -----
				-----  | 3 |
					   |   |
				-----  |   |
				| 2 |  -----
				-----
			*/
			// The above group would look like: [[1, 2] 3] with 1 & 2 in the same column
			return createSubGroups(collectionGroups);
		},
		createSubGroups = function(collectionGroups) {
			for(var i=0, l=collectionGroups.length; i<l; i++) {
				var group = collectionGroups[i];

				// loop through the current order group
				for(var j=0; j<group.length; j++) {
					var order = group[j];

					// loop through the current order group again to find other orders that don't collide
					for(var k=0; k<group.length; k++) {
						var compareOrder = group[k];

						// don't compare the orders if they're the same, or if the compare order is already a sub-group of orders
						// check if order and compareOrder DONT overlap
						if(order !== compareOrder && !compareOrder.isArray && !getOrderById(order).checkOverlap(getOrderById(compareOrder))) {
							if(group[j].isArray) {
								// the current order is already a sub-group of orders
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
								// create a sub-group of orders that don't overlap
								group[j] = [order, compareOrder];
								group.splice(k,1);
							}
						}
					}
				}
			}
			return collectionGroups;
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
		};

	// generate initial data
	set();

	// public methods
	return {
		set: set,
		get: get,
		getGroups: getGroups,
		getOrderById: getOrderById
	};
};

// ORDERS VIEW ////////////////////

shipwire.ordersView = new function() {
	var $grid     = $('#orders-grid'),
		$content  = $('#orders-content');

	this.init = function(){
		renderGrid();
		this.renderOrders();
	};

	var renderGrid = function() {
		var gridHTML = '';
		for(var i=0, l=shipwire.settings.totalMinutes+1; i<l; i++) {
			gridHTML += '<div class="time"><span>'+i +' min</span></div>';
		}
		$grid.html(gridHTML);
	};

	this.renderOrders = function() {
		var orderGroups = shipwire.orderCollection.getGroups(),
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
		return '<div class="order color-'+((order.id % 5) + 1)+'" style="top: '+order.start+'px; left: '+order.x+'%; width: '+order.width+'%; height: '+order.duration+'px;"><span><h2>#'+order.id+'</h2>    '+shipwire.helpers.convert.secondsToMinutes(order.start)+'-'+shipwire.helpers.convert.secondsToMinutes(order.end)+'</span></div>';
	};

	// start
	this.init.call(this);
};

// OUTPUT VIEW ////////////////////

shipwire.outputView = new function() {
	var orderData,
		$output = $('#output ul');

	this.init = function() {
		this.renderOutput();
	};

	this.renderOutput = function() {
		$output.empty();
		var orderData = shipwire.orderCollection.get(),
			outputHTML = '';

		orderData.sortBy('id');
		for(var i=0, l=orderData.length; i<l; i++) {
			var order = orderData[i];
			outputHTML += '<li class="color-'+((order.id % 5) + 1)+'">Order '+order.id+' whose processing starts at '+order.start+' and lasts '+order.duration+' seconds.'+'</li>';
		}
		$output.html(outputHTML);
	};

	// start init
	this.init();
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