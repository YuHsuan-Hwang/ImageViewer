'use strict';

// define the elements in the webpage
let divImage     = document.getElementById("div-image"    );
let txtFilename  = document.getElementById("txt-filename" );
let txtCursor    = document.getElementById("txt-cursor"   );
let btnZfit      = document.getElementById("btn-zfit"     );
let btnZin       = document.getElementById("btn-zin"      );
let btnZout      = document.getElementById("btn-zout"     );

let zoom_timer         = false; // a timer that turn on/off zoom_fuction_call
let zoom_function_call = false; // check if function zoom is called in a certain interval
let zoom_interval      = 100;   // interval of sending zoom request, millisec
let cursor_position    = [0,0]


divImage.style.visibility = 'hidden';
Plotly.newPlot( divImage, [{z:[[0]],type:'heatmapgl'}] );


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
	console.log(new Date(),"image displayed, send back time: ", 
				send_time, "millisec, total response time: ",
				total_response_time, "millisec",
				192*192/total_response_time, "px/millisec" );

	// read the message
	let width = return_message.getImageWidth();
	let height = return_message.getImageHeight();
	let xmin = return_message.getXmin();
	let ymin = return_message.getYmin();
	let vmin = return_message.getVmin();
	let vmax = return_message.getVmax();

	let time1 = Date.now();
	let data = new Array(height);
	for (let i=0; i<height; i++) {
		data[i] = return_message.getImageDataList()[i].getRowDataList();
	}

	let x_coor_min   = return_message.getXCoorMin();
	let x_coor_delta = return_message.getXCoorDelta();
	let y_coor_min   = return_message.getYCoorMin();
	let y_coor_delta = return_message.getYCoorDelta();
	let x_range_min  = return_message.getXRangeMin();
	let x_range_max  = return_message.getXRangeMax();
	let y_range_min  = return_message.getYRangeMin();
	let y_range_max  = return_message.getYRangeMax();
	let rebin_ratio  = return_message.getRebinRatio();

	txtFilename.value = return_message.getFilename();

	let heatmap_layout = { 
		autosize:false, width:580, height:600, dragmode:false,
		margin:{ l:70, r:10, b:60, t:40 },
		xaxis:{ range:[ x_range_min, x_range_max ], title:"Right ascension", color:'royalblue', zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2, ticks:'inside', ticklen:8, tickcolor:'royalblue' },
		yaxis:{ range:[ y_range_min, y_range_max ], title:{text:"Declination",standoff:1000},automargin:true, color:'royalblue', zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2, ticks:'inside', ticklen:8, tickcolor:'royalblue', tickangle:-90 },
		paper_bgcolor:'Aliceblue',
	}
	// x:xdata, y:ydata,  , zsmooth:false
	Plotly.react( divImage, [{z:data, x0:x_coor_min, dx:x_coor_delta, y0:y_coor_min, dy:y_coor_delta, type:'heatmapgl',
							  showscale:false, zmin:vmin, zmax:vmax, zsmooth:false }],
				  heatmap_layout, {displaylogo: false} );
	
	console.log(new Date(),"image displayed: ", Date.now()-time1, "millisec" )
	divImage.style.visibility = 'visible';
};

// send zoom message
let ZoomSend = function(delta_y) {

	// set the message
	let message = new proto.ImageViewer.ZoomRequest();
	//message.setEventType( 1 ); // 1 for ZOOM
	message.setXScreensizeInPx( (divImage.offsetWidth-80-2) *window.devicePixelRatio ); // minus the length of axis(70px) and border(2px)
	message.setYScreensizeInPx( (divImage.offsetHeight-100-2)*window.devicePixelRatio );
	message.setZoomDeltay( delta_y );
	message.setSendStartTime( Date.now() );
	
	// encode and send
	let message_bytes = message.serializeBinary();
	console.log(new Date(),"send message: ", message_bytes);
	ws.send(message_bytes);

}

// response when scroll the image
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


divImage.on( 'plotly_hover', function(event){
    event.points.map( function(data){
		cursor_position = [ data.x, data.y ];
		txtCursor.value = "  Position: ("+data.x.toFixed(4)+","+data.y.toFixed(4)+"), Value: "+data.z;
	} );
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

