'use strict';

// define the elements in the webpage
let divImage     = document.getElementById("div-image"    );
let txtFilename  = document.getElementById("txt-filename" );
let txtCursor    = document.getElementById("txt-cursor"   );
let divHistz     = document.getElementById("div-histz"    );
let divProfilex     = document.getElementById("div-profilex"    );
let divProfiley     = document.getElementById("div-profiley"    );
//let btnZfit      = document.getElementById("btn-zfit"     );
//let btnZin       = document.getElementById("btn-zin"      );
//let btnZout      = document.getElementById("btn-zout"     );

class Session{

	constructor( input_ip ){
		this.ws = new WebSocket( input_ip );

		// set the type of receiving message
		this.ws.binaryType = "arraybuffer";
	}

	OnOpen(){
		console.log(new Date(),"connection established");
		console.log(new Date(),"screen devicePixelRatio:"+window.devicePixelRatio);
	}

	OnClose(event){
		if (event.wasClean) {
			console.log(new Date(),"connection closed cleanly");
		} else {
			console.log(new Date(),"connection lost");
		}
	}
		
}

class ImageDisplay{

    constructor( input_div_image, input_txt_cursor, input_div_histz, input_div_profilex, input_div_profiley ) {

		this.div_image = input_div_image;
		this.txt_cursor = input_txt_cursor;
		this.div_histz = input_div_histz;
		this.div_profilex = input_div_profilex;
		this.div_profiley = input_div_profiley;

		this.zoom_timer = false;  // a timer that turn on/off zoom_fuction_call
		this.zoom_function_call = false; // check if function zoom is called in a certain interval
		this.zoom_interval = 100;   // interval of sending zoom request, millisec

		this.cursor_value = [0,0,0,0,0]; // x_px, y_px, x_ra, y_dec, z_value
		
		this.init_image_flag = true;

		this.filename;
		this.width;
		this.height;
		this.xmin;
		this.ymin;
		this.vmin;
		this.vmax;
		this.data = [[0]];
		this.x_coor_min;
		this.x_coor_delta;
		this.y_coor_min;
		this.y_coor_delta;
		this.x_range_min;
		this.x_range_max;
		this.y_range_min;
		this.y_range_max;
		this.rebin_ratio;

	}
	
	InitDisplay() {
		let heatmap_layout = { 
			autosize:false, width:580, height:600, dragmode:false,
			margin:{ l:70, r:10, b:60, t:40 },
			xaxis:{ title:"Right ascension", color:'royalblue', zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2, ticks:'inside', ticklen:8, tickcolor:'royalblue' },
			yaxis:{ title:{text:"Declination"}, color:'royalblue', zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2, ticks:'inside', ticklen:8, tickcolor:'royalblue', tickangle:-90 },
			paper_bgcolor:'Aliceblue'
		}
		Plotly.react( this.div_image, [{z:[[0]],type:'heatmapgl',showscale:false, zsmooth:false, colorscale:'Viridis'}], heatmap_layout, {displaylogo: false} );
		
		let hist_layout = {
			autosize:false, width:580, height:190,
			margin:{ l:50, r:150, b:40, t:40 },
			xaxis:{ title:"Value", color:'royalblue', linecolor:'royalblue', mirror:true },
			yaxis:{ color:'royalblue', linecolor:'royalblue', mirror:true },
			paper_bgcolor:'Aliceblue'
		}
		
		Plotly.react( this.div_histz, [{x:[],type:'histogram',opacity: 0.4}], hist_layout, {displaylogo: false} );

		let bar_layout = {
			autosize:false, width:580, height:190,
			margin:{ l:50, r:10, b:40, t:40 },
			xaxis:{ title:"Coordinate", color:'royalblue', linecolor:'royalblue', mirror:true },
			yaxis:{ color:'royalblue', linecolor:'royalblue', mirror:true },
			paper_bgcolor:'Aliceblue', bargap:0
		}

		Plotly.react( this.div_profilex, [{y:[],type:'bar',opacity: 0.4}], bar_layout, {displaylogo: false} );
		Plotly.react( this.div_profiley, [{y:[],type:'bar',opacity: 0.4}], bar_layout, {displaylogo: false} );
	}

	WheelEvent(event,ws){
		event.preventDefault();
		//console.log(event.deltaMode)

		// zoom if no function call in a certain interval
		if( !this.zoom_function_call ){

			// send zoom message to the backend
			this.ZoomSend( event.deltaY,ws );

			// manage the time interval
			this.zoom_function_call = true; // just sent zoom message
			window.clearTimeout(this.zoom_timer); // default the timer

			// let the client send zoom message after a time interval
			this.zoom_timer =  window.setTimeout( this.ZoomTimer.bind(this), this.zoom_interval );

		}else{
			console.log(new Date(),"zoom reject");
		}
	}

	ZoomTimer(){
		this.zoom_function_call = false;
		console.log(new Date(),"set zoom_function_call to false");
	}

	// send zoom message
	ZoomSend(delta_y,ws) {
		// set the message
		let message = new proto.ImageViewer.ZoomRequest();
		//message.setEventType( 1 ); // 1 for ZOOM
		message.setXScreensizeInPx( (this.div_image.offsetWidth-80-2)  *window.devicePixelRatio ); // minus the length of axis(70px) and border(2px)
		message.setYScreensizeInPx( (this.div_image.offsetHeight-100-2)*window.devicePixelRatio );
		message.setZoomDeltay( delta_y );
		message.setSendStartTime( Date.now() );
	
		// encode and send
		let message_bytes = message.serializeBinary();
		console.log(new Date(),"send message: ", message_bytes);
		ws.send(message_bytes);
	}

	HoverEvent(event) {
		let x_px = event.points[0].pointNumber[1];
		let y_px = event.points[0].pointNumber[0];
		let x = event.points[0].x;
		let y = event.points[0].y;
		let z = event.points[0].z;
		this.cursor_value = [ x_px, y_px, x, y, z ];
		this.txt_cursor.value = "  Position: ("+x.toFixed(4)+","+y.toFixed(4)+"), Image: ("+x_px+","+y_px+"), Value: "+z.toFixed(6);

		this.UpdateProfilex();
	}
	
	UpdateData(raw_message) {

		// receive and decode the message
		let return_message_bytes = new Uint8Array(raw_message);
		let return_message = proto.ImageViewer.ImageResponse.deserializeBinary(return_message_bytes);

		// print send time and total response time
		let send_time = Date.now() - return_message.getSendStartTime();
		let total_response_time = Date.now() - return_message.getTaskStartTime();
		console.log(new Date(),"image displayed, send back time: ", 
					send_time, "millisec, total response time: ",
					total_response_time, "millisec",
					192*192/total_response_time, "px/millisec" );
		
		let time1 = Date.now();
		// read the message
		this.filename = return_message.getFilename();
		this.width = return_message.getImageWidth();
		this.height = return_message.getImageHeight();
		this.xmin = return_message.getXmin();
		this.ymin = return_message.getYmin();
		this.vmin = return_message.getVmin();
		this.vmax = return_message.getVmax();

		
		let data = new Array(this.height);
		for (let i=0; i<this.height; i++) {
			data[i] = return_message.getImageDataList()[i].getRowDataList();
		}
		this.data = data;
		this.x_coor_min   = return_message.getXCoorMin();
		this.x_coor_delta = return_message.getXCoorDelta();
		this.y_coor_min   = return_message.getYCoorMin();
		this.y_coor_delta = return_message.getYCoorDelta();
		this.x_range_min  = return_message.getXRangeMin();
		this.x_range_max  = return_message.getXRangeMax();
		this.y_range_min  = return_message.getYRangeMin();
		this.y_range_max  = return_message.getYRangeMax();
		this.rebin_ratio  = return_message.getRebinRatio();

		console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )
	}

	UpdateDisplay(){
		let time1 = Date.now();
		txtFilename.value = this.filename;

		Plotly.update( this.div_image,
					   { z:[this.data], x0:this.x_coor_min, dx:this.x_coor_delta, y0:this.y_coor_min, dy:this.y_coor_delta,
						 zmin:this.vmin, zmax:this.vmax },
					   { 'xaxis.range':[this.x_range_min,this.x_range_max], 'yaxis.range':[this.y_range_min,this.y_range_max] } )
		console.log(new Date(),"image display: ", Date.now()-time1, "millisec" )
	}

	UpdateHistz(){
		Plotly.update( this.div_histz, {x:[this.data.flat()]} );
	}

	UpdateProfilex(){
		Plotly.update( this.div_profilex, { y:[this.data[ this.cursor_value[1] ]] } );
	}

	UpdateProfiley(){
		Plotly.update( this.div_profiley, {y:[this.data.flat()]} );
	}

}



// setup image display
let image_display = new ImageDisplay( divImage, txtCursor, divHistz, divProfilex, divProfiley );
image_display.InitDisplay();

// setup connection with the server
let session = new Session("ws://localhost:5675/");

session.ws.onopen = function(event) {
	session.OnOpen();
	image_display.ZoomSend(-9999,session.ws);
};

session.ws.onclose = function(event) { session.OnClose(event) };

session.ws.onmessage = function(event) {

	image_display.UpdateData(event.data);
	image_display.UpdateDisplay();

	if ( image_display.init_image_flag===true ) {
		image_display.UpdateHistz();
		image_display.init_image_flag=false;
	}
};

// response when scroll the image
divImage.addEventListener( 'wheel', function(event){
	image_display.WheelEvent(event,session.ws);
} );

// response when the cursor move to different pixels
divImage.on( 'plotly_hover', function(event){
	image_display.HoverEvent(event);
} );






/*
let zoom_timer         = false; // a timer that turn on/off zoom_fuction_call
let zoom_function_call = false; // check if function zoom is called in a certain interval
let zoom_interval      = 100;   // interval of sending zoom request, millisec
let cursor_position    = [0,0]
*/

/*
divImage.style.visibility = 'hidden';
Plotly.newPlot( divImage, [{z:[[0]],type:'heatmapgl'}] );
*/

/*
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
	Plotly.react( divImage, [{z:data, x0:x_coor_min, dx:x_coor_delta, y0:y_coor_min, dy:y_coor_delta, type:'heatmapgl',
							  showscale:false, zmin:vmin, zmax:vmax, zsmooth:false }],
				  heatmap_layout, {displaylogo: false} );
	
	console.log(new Date(),"image displayed: ", Date.now()-time1, "millisec" )
	divImage.style.visibility = 'visible';
};
*/

/*
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
*/

/*
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
*/


/*
divImage.on( 'plotly_hover', function(event){
    event.points.map( function(data){
		cursor_position = [ data.x, data.y ];
		txtCursor.value = "  Position: ("+data.x.toFixed(4)+","+data.y.toFixed(4)+"), Value: "+data.z;
	} );
} );
*/

/*
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
*/
