/* 
Created for the Shopify Fall 2017 Internship Back End Development Problem, found here: https://goo.gl/xUPxtd
Structured around async queue, docs here: https://caolan.github.io/async/docs.html#queue
*/

var request = require('request');
var async = require('async');
var _ = require('underscore');

var jsonPages = [];
var pageNumbers = [];
var unfulfilledOrdersWithCookies = [];
var output = {remaining_cookies: 0, unfulfilled_orders: []};

// get first page, as well as the number of pages required to parse
var apiGetNumPages = async.queue(function(task, callback) {

	let uri = 'https://backend-challenge-fall-2017.herokuapp.com/orders.json';

  let options = { 
    method: 'get',
    json: true,
    uri: uri
  }

  request(options, function (err, res, body) {
    jsonPages.push(body);
    
    let total = body.pagination.total - body.pagination.per_page;
    let perPage = body.pagination.per_page;
    let pageNumber = 2;
		
		while (total > 0) {
			total = total - perPage;
			// {name: pageNumber} format used to handle pushing items to the queue batch-wise (see above docs link)
      pageNumbers.push({name: pageNumber});
			pageNumber++;
		}  
    
    callback();
  });
}, 1);

apiGetNumPages.drain = function () {

	// get remaining pages
  var apiGetPages = async.queue(function(task, callback) {

    let uri = 'https://backend-challenge-fall-2017.herokuapp.com/orders.json?page=' + task.name;
    
    let options = {
      method: 'get',
      json: true,
      uri: uri
    }
    
    request(options, function (err, res, body) {
      jsonPages.push(body);
      callback();
    });
  }, 1);
  
  apiGetPages.drain = function() {
  	
  	let availableCookies = jsonPages[0].available_cookies;
  	
  	// collect all unfulfilled orders with cookies and add them to a list
    for (let i = 0; i < jsonPages.length; i++) {
  		for (let j = 0; j < jsonPages[i].orders.length; j++) {
  			if (jsonPages[i].orders[j].fulfilled !== true) {
  				for (let k = 0; k < (jsonPages[i].orders[j].products.length); k++) {
  					if ( _.contains(jsonPages[i].orders[j].products[k], 'Cookie') ) {
  						unfulfilledOrdersWithCookies.push([jsonPages[i].orders[j].id, jsonPages[i].orders[j].products[k].amount]);
  					}
  				}
  			} 
  		}
  	}
		
  	// sort results as required by specification
    unfulfilledOrdersWithCookies.sort(function (a, b) {
  		return b[1] - a[1];
  	});

  	for (let i = 0; i < unfulfilledOrdersWithCookies.length; i++) {
 			// if cookie amount in order is more than available cookies, consider order unfulfilled
      if (unfulfilledOrdersWithCookies[i][1] > availableCookies) {
  			output.unfulfilled_orders.push(unfulfilledOrdersWithCookies[i][0]);
  		} else {
  			availableCookies = availableCookies - unfulfilledOrdersWithCookies[i][1];
  		}
  	}
		
		output.remaining_cookies = availableCookies;
		console.log(output);
  }

  apiGetPages.push(pageNumbers, function(err) {
  });
}

apiGetNumPages.push({name: 'numPages'}, function(err) {
}); 