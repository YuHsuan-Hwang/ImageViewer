'use strict';

// define the elements in the webpage
let btnOpen = document.getElementById("btn-open");
let imgMain = document.getElementById("img-main");
let btnZfit = document.getElementById("btn-zfit");
let btnZin  = document.getElementById("btn-zin" );
let btnZout = document.getElementById("btn-zout");

let zoom_time = new Date();
let first_onmessage = true;

let zoom_timer = false; // a timer that turn on/off zoom_fuction_call
let zoom_function_call = false; // check if function zoom is called in a certain interval
let zoom_interval = 100; // interval of sending zoom request

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
	if (first_onmessage==true){
		console.log(new Date(),"image displayed, response time: ", new Date()-zoom_time, "millisec" );
		first_onmessage = false;
	} else {
		console.log(new Date(),"zoomed, response time: ", new Date()-zoom_time, "millisec" );
	}
};

// zoom the image
let Zoom = function(event) {

	event.preventDefault();
	//console.log(event.deltaMode)

	// zoom if no function call in a certain interval
	if( !zoom_function_call ){

		// send zoom message to the backend
		ws.send(event.deltaY);
		zoom_time = new Date()

		// manage the time interval
		zoom_function_call = true; // just sent zoom message
		window.clearTimeout(zoom_timer); // default the timer
		zoom_timer =  window.setTimeout( "zoom_function_call = false;", zoom_interval ); // let the client send zoom message after a time interval
		console.log(new Date(),"set zoom_function_call to false");

	}else{
		console.log(new Date(),"zoom reject");
	}
	
}

// response when scroll the image
imgMain.addEventListener( "wheel", Zoom )

// zoom fit button
btnZfit.addEventListener( "click", function(event){
	ws.send(-9999);
	zoom_time = new Date()
} );

// zoom in button
btnZin.addEventListener( "click", function(event){
	ws.send(10);
	zoom_time = new Date()
} );

// zoom out button
btnZout.addEventListener( "click", function(event){
	ws.send(-10);
	zoom_time = new Date()
} );

