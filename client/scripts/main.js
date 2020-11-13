'use strict';

// define the elements in the webpage
let btnOpen = document.getElementById("btn-open");
//let imgMain = document.getElementById("img-main");
let divImage = document.getElementById("div-image");
let btnZfit = document.getElementById("btn-zfit");
let btnZin  = document.getElementById("btn-zin" );
let btnZout = document.getElementById("btn-zout");

let zoom_time = new Date();
let first_onmessage = true;

let zoom_timer = false; // a timer that turn on/off zoom_fuction_call
let zoom_function_call = false; // check if function zoom is called in a certain interval
let zoom_interval = 100; // interval of sending zoom request, millisec

// setup connection with the server
let ws = new WebSocket("ws://localhost:5675/");

// update the status if the connection is opened
ws.onopen = function(event) {

	console.log(new Date(),"connection established");
	//console.log(new Date(),"screen resolution:"+screen.width+"x"+screen.height);
	console.log(new Date(),"screen devicePixelRatio:"+window.devicePixelRatio);
	
	// show the first figure
	ZoomSend(-9999);

};

// update the status if the connection is closed
ws.onclose = function(event) {
	if (event.wasClean) {
		console.log(new Date(),"connection closed cleanly");
	} else {
		console.log(new Date(),"connection lost");
	}
};

// set the type of receiving message
ws.binaryType = "arraybuffer";

// receive message from the server
ws.onmessage = function(event){

	// receive and decode the message
	let return_message_bytes = new Uint8Array(event.data);
	let return_message = proto.ImageViewer.ImageResponse.deserializeBinary(return_message_bytes);

	// print send time and total response time
	let send_time = Date.now() - return_message.getSendStartTime();
	let total_response_time = Date.now() - return_message.getTaskStartTime();
	if (first_onmessage==true){
		console.log(new Date(),"image displayed, send back time: ", send_time, "millisec, total response time: ", total_response_time, "millisec" );
	} else {
		console.log(new Date(),"zoomed, send back time: ", send_time, "millisec, total response time: ", total_response_time, "millisec" );
	}

	// display the image
	//imgMain.src = return_message.getImageUrl();
	//console.log(return_message);
	//console.log(new Date(),return_message.getImageDataList());
	let width = return_message.getImageWidth();
	let height = return_message.getImageHeight();
	let data = [];
	for (let i=0; i<width; i++) {
		data.push( return_message.getImageDataList().slice(i*height, i*height+height) );
	};
	//console.log(data);

	let layout = { 
		autosize:false,
		width:500, height:500,dragmode: false,
		xaxis:{visible: false}, yaxis:{visible: false},showlegend:false,
		margin:{l:0,r:0,b:0,t:0} }
	Plotly.react( divImage, [ { z:data, type:'heatmap',showscale:false } ], layout );
};

// send zoom message
let ZoomSend = function(delta_y) {

	// set the message
	let message = new proto.ImageViewer.ZoomRequest();
	//message.setEventType( 1 ); // 1 for ZOOM
	//message.setXScreensizeInPx( imgMain.width *window.devicePixelRatio );
	//message.setYScreensizeInPx( imgMain.height*window.devicePixelRatio );
	message.setXScreensizeInPx( divImage.offsetWidth *window.devicePixelRatio );
	message.setYScreensizeInPx( divImage.offsetHeight*window.devicePixelRatio );
	message.setZoomDeltay( delta_y );
	message.setSendStartTime( Date.now() );
	
	// encode and send
	let message_bytes = message.serializeBinary();
	console.log(new Date(),"send message: ", message_bytes);
	ws.send(message_bytes);

}

// response when scroll the image
//imgMain.addEventListener( "wheel", function(event){
divImage.addEventListener( "wheel", function(event){

	event.preventDefault();
	//console.log(event.deltaMode)

	// zoom if no function call in a certain interval
	if( !zoom_function_call ){

		// send zoom message to the backend
		ZoomSend( event.deltaY );

		// manage the time interval
		zoom_function_call = true; // just sent zoom message
		window.clearTimeout(zoom_timer); // default the timer
		zoom_timer =  window.setTimeout( function(){
			zoom_function_call = false;
			console.log(new Date(),"set zoom_function_call to false");
		}, zoom_interval ); // let the client send zoom message after a time interval

	}else{
		console.log(new Date(),"zoom reject");
	}
	
} );


// zoom fit button
btnZfit.addEventListener( "click", function(event){
	ZoomSend(-9999);
} );

// zoom in button
btnZin.addEventListener( "click", function(event){
	ZoomSend(10);
} );

// zoom out button
btnZout.addEventListener( "click", function(event){
	ZoomSend(-10);
} );

