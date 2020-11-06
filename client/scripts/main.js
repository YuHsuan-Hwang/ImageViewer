'use strict';

// define the elements in the webpage
let btnOpen = document.getElementById("btn-open");
let imgMain = document.getElementById("img-main");
let btnZfit = document.getElementById("btn-zfit");
let btnZin  = document.getElementById("btn-zin" );
let btnZout = document.getElementById("btn-zout");

let zoom_time = new Date();
let first_onmessage = 1;

// setup connection with the server
let ws = new WebSocket("ws://localhost:5675/");

// update the status if the connection is opened
ws.onopen = function(event) {

	console.log(new Date(),"connection established");
	//console.log(new Date(),"screen resolution:"+screen.width+"x"+screen.height);
	console.log(new Date(),"screen devicePixelRatio:"+window.devicePixelRatio);
	
	// show the first figure
	ws.send(-9999)

};

// update the status if the connection is closed
ws.onclose = function(event) {
	if (event.wasClean) {
		console.log(new Date(),"connection closed cleanly");
	} else {
		console.log(new Date(),"connection lost");
	}
};

// response when choose a image file
function OnChange(element) {
	console.log(new Date(),"no function in current version");
}

// receive message from the server
ws.onmessage = function(event){

	imgMain.src = event.data
	if (first_onmessage==1){
		console.log(new Date(),"image displayed, response time: ", new Date()-zoom_time, "millisec" );
		first_onmessage = 0;
	} else {
		console.log(new Date(),"zoomed, response time: ", new Date()-zoom_time, "millisec" );
	}
};


function zoom(event) {
	event.preventDefault();
	ws.send(event.deltaY);
	zoom_time = new Date()
}

imgMain.onwheel = zoom;


// construct event of clicking the enter button
function ZfitClick(event){
	ws.send(-9999);
	zoom_time = new Date()
}
// response when clicking the enter button
btnZfit.onclick = ZfitClick;


// construct event of clicking the enter button
function ZinClick(event){
  ws.send(1);
	zoom_time = new Date()
}
// response when clicking the enter button
btnZin.onclick = ZinClick;


// construct event of clicking the enter button
function ZoutClick(event){
  ws.send(-1);
	zoom_time = new Date()
}
// response when clicking the enter button
btnZout.onclick = ZoutClick;
