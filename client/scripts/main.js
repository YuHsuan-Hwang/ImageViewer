'use strict';

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

class View{

	constructor( input_div_image, input_txt_cursor, input_div_histz, input_div_profilex, input_div_profiley, input_div_profilez ) {

		this.div_image = input_div_image;
		this.txt_cursor = input_txt_cursor;
		this.div_histz = input_div_histz;
		this.div_profile_x = input_div_profilex;
		this.div_profile_y = input_div_profiley;
		this.div_profile_z = input_div_profilez;

		this.filename;
		this.orig_width;
		this.orig_height;
		this.channel_num;

		this.vmin;
		this.vmax;
		this.data = [[0]];

		this.channel = 0;
		this.width;
		this.height;

		this.x_coor_min;
		this.x_coor_delta;
		this.y_coor_min;
		this.y_coor_delta;
		this.x_range_min;
		this.x_range_max;
		this.y_range_min;
		this.y_range_max;

		this.cursor_value = [0,0,0,0,0]; // x_px, y_px, x_ra, y_dec, z_value
		this.rebin_ratio;

		this.profile_x;
		this.profile_y;
		this.profile_z;
		
	}

	SetupInterface() {
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
			margin:{ l:70, r:150, b:40, t:40 },
			xaxis:{ title:"Value", color:'royalblue', linecolor:'royalblue', mirror:true },
			yaxis:{ title:"Number", color:'royalblue', linecolor:'royalblue', mirror:true },
			paper_bgcolor:'Aliceblue'
		}
		
		Plotly.react( this.div_histz, [{x:[],type:'histogram',opacity: 0.4}], hist_layout, {displaylogo: false} );

		let bar_layout = {
			autosize:false, width:700, height:190,
			margin:{ l:70, r:20, b:40, t:40 },
			xaxis:{ title:"Coordinate", color:'royalblue', linecolor:'royalblue', mirror:true },
			yaxis:{ title:"Value", color:'royalblue', linecolor:'royalblue', mirror:true },
			paper_bgcolor:'Aliceblue', bargap:0
		}

		Plotly.react( this.div_profile_x, [{y:[],type:'bar',opacity: 0.4}], bar_layout, {displaylogo:false} );
		Plotly.react( this.div_profile_y, [{y:[],type:'bar',opacity: 0.4}], bar_layout, {displaylogo:false} );
		Plotly.react( this.div_profile_z, [{y:[],type:'bar',opacity: 0.4}], bar_layout, {displaylogo:false} );
	}

	UpdateDisplay(channel){
		let time1 = Date.now();
		txtFilename.value = this.filename;


		Plotly.update( this.div_image,
					   { z:[this.data[channel]], x0:this.x_coor_min, dx:this.x_coor_delta, y0:this.y_coor_min, dy:this.y_coor_delta,
						 zmin:this.vmin[channel], zmax:this.vmax[channel] },
					   { 'xaxis.range':[this.x_range_min,this.x_range_max], 'yaxis.range':[this.y_range_min,this.y_range_max] } )
	
		console.log(new Date(),"image display: ", Date.now()-time1, "millisec" )
		
	}

	UpdateHistz(channel){
		Plotly.update( this.div_histz, {x:[this.data[channel].flat()]} );
	}

	UpdateTxtCrusor(){
		this.txt_cursor.value = "  Position: ("+this.cursor_value[0]+","+this.cursor_value[1]
		+"), Image: ("+this.cursor_value[2].toFixed(4)+","+this.cursor_value[3].toFixed(4)+"), Value: "
		+this.cursor_value[4].toFixed(6);
	}

	UpdateProfile(){

		Plotly.update( this.div_profile_x, { y:[this.profile_x] } );
		Plotly.update( this.div_profile_y, { y:[this.profile_y] } );
		Plotly.update( this.div_profile_z, { y:[this.profile_z] } );
	}

}

class Controller{

	constructor( input_view ) {

		this.view = input_view;

		this.zoom_timer = false;  // a timer that turn on/off zoom_fuction_call
		this.zoom_function_call = false; // check if function zoom is called in a certain interval
		this.zoom_interval = 100;   // interval of sending zoom request, millisec

	}


	// first task when connection is established
	InitSetup(){

		// draw all the interface with blanck figures
		this.view.SetupInterface();

	}

	// ask backend to display initial image
	InitDisplayRequest( ws ) {

		// set the message
		let request_message = new proto.ImageViewer.InitDisplayRequest();
		request_message.setXScreensizeInPx( (this.view.div_image.offsetWidth-80-2)  *window.devicePixelRatio ); // minus the length of axis(70px) and border(2px)
		request_message.setYScreensizeInPx( (this.view.div_image.offsetHeight-100-2)*window.devicePixelRatio );

		let message = new proto.ImageViewer.Request();
		message.setEventType( 1 ); // INIT_DISPLAY
		message.setInitDisplayRequestMessage( request_message );
		message.setSendStartTime( Date.now() );

		// encode and send
		let message_bytes = message.serializeBinary();
		console.log(new Date(),"send message: ", message_bytes);
		ws.send(message_bytes);

	}

	WheelEvent( event, ws ){
		event.preventDefault();
		//console.log(event.deltaMode)

		// zoom if no function call in a certain interval
		if( !this.zoom_function_call ){

			// send zoom message to the backend
			this.ZoomRequest( event.deltaY,ws );

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
	ZoomRequest( delta_y, ws ) {
		// set the message
		let request_message = new proto.ImageViewer.ZoomRequest();
		request_message.setChannel( this.view.channel );
		request_message.setDeltaY( delta_y );

		let message = new proto.ImageViewer.Request();
		message.setEventType( 2 ); // ZOOM
		message.setZoomRequestMessage( request_message );
		message.setSendStartTime( Date.now() );
	
		// encode and send
		let message_bytes = message.serializeBinary();
		console.log(new Date(),"send message: ", message_bytes);
		ws.send(message_bytes);
	}

	HoverEvent( event, ws ) {
		let x_px = Math.round( event.points[0].pointNumber[1]/this.view.rebin_ratio );
		let y_px = Math.round( event.points[0].pointNumber[0]/this.view.rebin_ratio );

		let x = event.points[0].x;
		let y = event.points[0].y;
		let z = event.points[0].z;
		this.view.cursor_value = [ x_px, y_px, x, y, z ];

		this.view.UpdateTxtCrusor();
		this.ProfileRequest(x_px, y_px,ws);
	}

	ProfileRequest( x_px, y_px, ws ) {

		// set the message
		let request_message = new proto.ImageViewer.ProfileRequest();
		request_message.setPositionX( x_px );
		request_message.setPositionY( y_px );

		let message = new proto.ImageViewer.Request();
		message.setEventType( 3 ); // PROFILE
		message.setProfileRequestMessage( request_message );
		message.setSendStartTime( Date.now() );
		
		// encode and send
		if( ws.readyState != 0){
			let message_bytes = message.serializeBinary();
			ws.send(message_bytes);
			console.log(new Date(),"send message: ", message_bytes);
		}
		
	}

	ChannelBtn( mode, ws ) {
		if( mode===0 ) {
			if ( this.view.channel!=0 ){
				this.view.channel = 0;
				this.ZoomRequest(0,ws);
			}
		} else if ( mode===9999 ) {
			if ( this.view.channel!=this.view.channel_num-1 ){
				this.view.channel = this.view.channel_num-1;
				this.ZoomRequest(0,ws);
			}
		} else if ( mode===1 ) {
			if ( this.view.channel!=this.view.channel_num-1 ){
				this.view.channel += 1;
				this.ZoomRequest(0,ws);
			}
		} else { // mode===-1
			if ( this.view.channel!=0 ){
				this.view.channel -= 1;
				this.ZoomRequest(0,ws);
			}
		}
	}
	
	OnMessage( raw_message ) {

		// receive and decode the message
		let return_message_bytes = new Uint8Array(raw_message);
		let return_message = proto.ImageViewer.Response.deserializeBinary(return_message_bytes);

		// print send time and total response time
		let send_time = Date.now() - return_message.getSendStartTime();
		let total_response_time = Date.now() - return_message.getTaskStartTime();
		console.log(new Date(),"image displayed, send back time: ", 
					send_time, "millisec, total response time: ",
					total_response_time, "millisec",
					this.orig_width*this.orig_height/total_response_time, "px/millisec" );

		if ( return_message.getEventType() == 1 ){ // INIT_DISPLAY
			this.InitDisplayResponse( return_message.getInitDisplayResponseMessage() );
		} else if ( return_message.getEventType() == 2 ){ // ZOOM
			this.ZoomResponse( return_message.getZoomResponseMessage() );
		} else if ( return_message.getEventType() == 3 ){ // PROFILE
			this.ProfileResponse( return_message.getProfileResponseMessage() );
		}

	}

	InitDisplayResponse( response_message ) {

		// read the message
		let time1 = Date.now();

		this.view.filename = response_message.getFilename();
		this.view.width = response_message.getImageWidth();
		this.view.height = response_message.getImageHeight();
		this.view.channel_num = response_message.getChannelNum();

		this.view.vmin = response_message.getVminList();
		this.view.vmax = response_message.getVmaxList();

		let data = new Array(this.view.height);
		for (let i=0; i<this.view.height; i++) {
			data[i] = response_message.getImageDataList()[i].getPointDataList();
		}
		this.view.data[response_message.getChannel()] = data;

		this.view.x_coor_min   = response_message.getXCoorMin();
		this.view.x_coor_delta = response_message.getXCoorDelta();
		this.view.y_coor_min   = response_message.getYCoorMin();
		this.view.y_coor_delta = response_message.getYCoorDelta();
		this.view.x_range_min  = response_message.getXRangeMin();
		this.view.x_range_max  = response_message.getXRangeMax();
		this.view.y_range_min  = response_message.getYRangeMin();
		this.view.y_range_max  = response_message.getYRangeMax();

		this.view.rebin_ratio  = response_message.getRebinRatio();

		console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )
		
		// display image
		this.view.UpdateDisplay(response_message.getChannel());
		this.view.UpdateHistz(response_message.getChannel());

	}

	ZoomResponse( response_message ) {

		// read the message
		let time1 = Date.now();

		this.view.width = response_message.getImageWidth();
		this.view.height = response_message.getImageHeight();
		this.view.channel = response_message.getChannel();
		
		let data = new Array(this.view.height);
		for (let i=0; i<this.view.height; i++) {
			data[i] = response_message.getImageDataList()[i].getPointDataList();
		}
		this.view.data[response_message.getChannel()] = data;

		this.view.x_coor_min   = response_message.getXCoorMin();
		this.view.x_coor_delta = response_message.getXCoorDelta();
		this.view.y_coor_min   = response_message.getYCoorMin();
		this.view.y_coor_delta = response_message.getYCoorDelta();
		this.view.x_range_min  = response_message.getXRangeMin();
		this.view.x_range_max  = response_message.getXRangeMax();
		this.view.y_range_min  = response_message.getYRangeMin();
		this.view.y_range_max  = response_message.getYRangeMax();

		this.view.rebin_ratio  = response_message.getRebinRatio();

		console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )
		
		// display image
		this.view.UpdateDisplay(response_message.getChannel());
		this.view.UpdateHistz(response_message.getChannel());

	}

	ProfileResponse( response_message ) {

		// read the message
		let time1 = Date.now();

		this.view.profile_x = response_message.getProfileXList();
		this.view.profile_y = response_message.getProfileYList();
		this.view.profile_z = response_message.getProfileZList();

		console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )

		// display profile
		this.view.UpdateProfile();

	}

}

// define the elements in the webpage
let divImage     = document.getElementById( "div-image"     );
let txtFilename  = document.getElementById( "txt-filename"  );
let txtCursor    = document.getElementById( "txt-cursor"    );
let divHistz     = document.getElementById( "div-histz"     );
let divProfileX  = document.getElementById( "div-profile-x" );
let divProfileY  = document.getElementById( "div-profile-y" );
let divProfileZ  = document.getElementById( "div-profile-z" );
let btnChannelFirst = document.getElementById( "btn-channel-first" );
let btnChannelPrev  = document.getElementById( "btn-channel-prev"  );
let btnChannelNext  = document.getElementById( "btn-channel-next"  );
let btnChannelLast  = document.getElementById( "btn-channel-last"  );

// setup image display
let view = new View( divImage, txtCursor, divHistz, divProfileX, divProfileY, divProfileZ );
let controller = new Controller( view );

// setup connection with the server
let session = new Session("ws://localhost:5675/");

controller.InitSetup();

// WebSocket events
session.ws.onopen = function(event) {
	session.OnOpen();
	controller.InitDisplayRequest( session.ws );
};

session.ws.onclose = function(event) { session.OnClose(event) };

session.ws.onmessage = function(event) {
	controller.OnMessage(event.data);
};

// web element events
// response when scroll the image
divImage.addEventListener( 'wheel', function(event){
	controller.WheelEvent(event,session.ws);
} );

// response when the cursor move to different pixels
divImage.on( 'plotly_hover', function(event){
	controller.HoverEvent(event,session.ws);
} );

// response when click button
btnChannelFirst.addEventListener( 'click', function(event){
	controller.ChannelBtn(0,session.ws);
} );
btnChannelPrev.addEventListener( 'click', function(event){
	controller.ChannelBtn(-1,session.ws);
} );
btnChannelNext.addEventListener( 'click', function(event){
	controller.ChannelBtn(1,session.ws);
} );
btnChannelLast.addEventListener( 'click', function(event){
	controller.ChannelBtn(9999,session.ws);
} );