'use strict';

/**
 * WebSockets connection management
 */
class Session{

    constructor( input_ip ){
        this.ws = new WebSocket( input_ip );
        this.ws.binaryType = "arraybuffer"; // set the type of receiving message
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

/**
 * properties for displayed image
 * and methods related to actions on web elements
 */
class View{

    constructor( input_div_image, input_txt_filename, input_txt_cursor,
                 input_div_hist, input_div_profilex, input_div_profiley, input_div_profilez ) {
        // web elements
        this.div_image = input_div_image;
        this.txt_filename = input_txt_filename;
        this.txt_cursor = input_txt_cursor;
        this.div_hist = input_div_hist;
        this.div_profile_x = input_div_profilex;
        this.div_profile_y = input_div_profiley;
        this.div_profile_z = input_div_profilez;

        // original info of the image (should be initialized in controller.InitDisplayResponse)
        this.filename;
        this.orig_width, this.orig_height, this.channel_num; // x, y, z pixel length of the cube data
        this.orig_x_coor_min, this.orig_x_coor_delta, this.orig_y_coor_min, this.orig_y_coor_delta; // coordinate min and delta in degree

        // image data for display (should be updated in controller.XxxxResponse)
        this.vmin, this.vmax; // colorscale min and max
        this.image_data = [[0]]; // main display image, 3d data, change with controller.scale
        this.hist_data; // histogram of the current channel, change with view.channel
        this.profile_x, this.profile_y, this.profile_z; // profile of the current cursor position and channel, change with view.corsor_value and view.channel

        // status of the display image
        this.channel = 0; // x, y pixel length after zooming, current channel
        this.x_coor_min, this.x_coor_delta, this.y_coor_min, this.y_coor_delta; // coordinate min and delta in degree after zooming
        this.x_range_min, this.x_range_max, this.y_range_min, this.y_range_max; // coordinate display range in degree after zooming
        this.cursor_value_rebin = [0,0]; // position of the cursor after rebin: x_px, y_px
        this.cursor_value = [0,0,0,0,0]; // position and value of the cursor (orig image): x_px, y_px, x_ra, y_dec, z_value
    }

    // setup all the interface with blanck figures
    BlanckDisplay() {
        // setup the main image display panel
        let heatmap_layout = {
            autosize:false, width:580, height:600, dragmode:false, margin:{ l:70, r:10, b:60, t:40 },
            xaxis:{ title:"Right ascension", color:'royalblue',
                    zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2,
                    ticks:'inside', ticklen:8, tickcolor:'royalblue' },
            yaxis:{ title:{text:"Declination"}, color:'royalblue',
                    zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2,
                    ticks:'inside', ticklen:8, tickcolor:'royalblue', tickangle:-90 },
            paper_bgcolor:'Aliceblue'
        }
        Plotly.react( this.div_image, [{z:[[0]],type:'heatmapgl',showscale:false, zsmooth:false, colorscale:'Viridis'}],
                      heatmap_layout, {displaylogo: false} ); // Plotly.react runs slightly faster than Plotly.newPlot
        
        // setup the histogram panel
        let hist_layout = {
            autosize:false, width:580, height:190, margin:{ l:70, r:150, b:40, t:40 },
            xaxis:{ title:"Value",  color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"Number", color:'royalblue', linecolor:'royalblue', mirror:true },
            paper_bgcolor:'Aliceblue'//,
            //shapes:[{type:'line',x0:0.01,x1:0.01,y0:0,y1:1,yref:'paper',line:{color:'lightpink',width:3},editable:true},
            //        {type:'line',x0:-0.01,x1:-0.01,y0:0,y1:1,yref:'paper',line:{color:'lightgreen',width:3},editable:true}]
        }
        Plotly.react( this.div_hist, [{x:[],type:'histogram',opacity: 0.4}], hist_layout, {displayModeBar: false});

        // setup x, y, z profile panels
        let bar_layout_x = {
            autosize:false, width:700, height:190, margin:{ l:70, r:20, b:40, t:40 },
            xaxis:{ title:"X Coordinate", color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"Value",      color:'royalblue', linecolor:'royalblue', mirror:true },
            paper_bgcolor:'Aliceblue', bargap:0
        }
        let bar_layout_y = {
            autosize:false, width:700, height:190, margin:{ l:70, r:20, b:40, t:40 },
            xaxis:{ title:"Y Coordinate", color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"Value",      color:'royalblue', linecolor:'royalblue', mirror:true },
            paper_bgcolor:'Aliceblue', bargap:0
        }
        let bar_layout_z = {
            autosize:false, width:700, height:190, margin:{ l:70, r:20, b:40, t:40 },
            xaxis:{ title:"Channel", color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"Value",      color:'royalblue', linecolor:'royalblue', mirror:true },
            paper_bgcolor:'Aliceblue', bargap:0
        }
        Plotly.react( this.div_profile_x, [{y:[],type:'bar',opacity: 0.4}], bar_layout_x, {displaylogo:false} );
        Plotly.react( this.div_profile_y, [{y:[],type:'bar',opacity: 0.4}], bar_layout_y, {displaylogo:false} );
        Plotly.react( this.div_profile_z, [{y:[],type:'bar',opacity: 0.4}], bar_layout_z, {displaylogo:false} );
    }

    // show the filename
    UpdateFilename(){
        this.txt_filename.value = this.filename;
    }

    // update the main image display panel
    UpdateDisplay(){
        let time1 = Date.now();
        Plotly.update( this.div_image, // use Plotly.update to change only part of the figure
                        { z:[this.image_data[this.channel]], // update image data
                          x0:this.x_coor_min, dx:this.x_coor_delta, y0:this.y_coor_min, dy:this.y_coor_delta, // update coordinates
                          zmin:this.vmin[this.channel], zmax:this.vmax[this.channel] }, // update colorscale
                        { 'xaxis.range':[this.x_range_min,this.x_range_max], // update axis range
                          'yaxis.range':[this.y_range_min,this.y_range_max] } )
        console.log(new Date(),"image display: ", Date.now()-time1, "millisec" )  
    }

    // update histogram data
    UpdateHist(){
        Plotly.update( this.div_hist, {x:[this.hist_data]},
            { shapes:[{type:'line',x0:this.vmax[this.channel],x1:this.vmax[this.channel],y0:0,y1:1,yref:'paper',line:{color:'lightpink',width:3},editable:true},
        {type:'line',x0:this.vmin[this.channel],x1:this.vmin[this.channel],y0:0,y1:1,yref:'paper',line:{color:'lightgreen',width:3},editable:true}] });
    }

    // update the status of cursor
    UpdateTxtCursor(){
        this.txt_cursor.value = "  Position: (" + this.cursor_value[0] + "," + this.cursor_value[1]
                                + "), Image: (" + this.cursor_value[2].toFixed(4) + "," + this.cursor_value[3].toFixed(4)
                                + "), Value: "  + this.cursor_value[4].toFixed(6);
    }

    // update profile data
    UpdateProfile() {
        Plotly.update( this.div_profile_x, { y:[this.profile_x] },
                       { shapes:[{type:'line',x0:this.cursor_value[0],x1:this.cursor_value[0],y0:0, y1:1,yref:'paper',line:{color:'grey',width:1}}] } );
        Plotly.update( this.div_profile_y, { y:[this.profile_y] }, 
                       { shapes:[{type:'line',x0:this.cursor_value[1],x1:this.cursor_value[1],y0:0, y1:1,yref:'paper',line:{color:'grey',width:1}}] } );
        Plotly.update( this.div_profile_z, { y:[this.profile_z] },
                       { shapes:[{type:'line',x0:this.channel,x1:this.channel,y0:0, y1:1,yref:'paper',line:{color:'grey',width:1}}] });
    }

}

/**
 * properties for calling new image data
 * and methods related to web events, backend request, and message response
 */
class Controller{

    constructor( input_view ) {
        // include view
        this.view = input_view;

        // scroll event parameters
        this.zoom_timer = false;      // timer that turn on/off zoom_fuction_call
        this.zoom_timer_call = true; // check if function zoom is called in a certain interval
        this.zoom_interval = 100;     // interval of sending zoom request, millisec
        this.zoom_function_call = true;

        this.hover_function_call = false;

        // required info when calling new image
        this.scale = 1; // zoom status
        this.xmin = 0, this.xmax, this.width;  // x axis status
        this.ymin = 0, this.ymax, this.height; // y axis status
        this.rebin_ratio = 1; // rebin status
    }

    // initial setup after open the browser
    InitSetup(){
        this.view.BlanckDisplay();
    }

    // send screen resolution info to backend to display initial image
    InitDisplayRequest( ws ) {
        // set the message
        let request_message = new proto.ImageViewer.InitDisplayRequest();
        request_message.setXScreensizeInPx( (this.view.div_image.offsetWidth-80-2)  *window.devicePixelRatio ); // minus the length of axis(80px) and border(2px)
        request_message.setYScreensizeInPx( (this.view.div_image.offsetHeight-100-2)*window.devicePixelRatio );
        request_message.setSendStartTime( Date.now() )

        // encode and send
        let event_type = [1]; // INIT_DISPLAY
        let request_message_bytes = request_message.serializeBinary();

        let message_bytes = new Uint8Array( request_message_bytes.length+1 );
        message_bytes.set( event_type, 0 );
        message_bytes.set( request_message_bytes, 1 );
        console.log(new Date(),"send message: ", message_bytes);
        ws.send(message_bytes);
    }

    // response to scroll events
    WheelEvent( event, ws ){
        event.preventDefault();
        //console.log(event.deltaMode)

        // zoom if no function call in a certain interval
        //if(( this.zoom_timer_call ) && ( this.zoom_function_call )){
        if( this.zoom_timer_call ) {

            // close hover event
            this.hover_function_call = false;

            // calculate image scale
            if ( event.deltaY===-9999 ) {
                this.scale = 1.0;
            } else {
                this.scale += event.deltaY*0.01;
                if ( this.scale <= 0.3 ) {
                    this.scale = 0.3;
                }
            }

            /*

            // for testing
            //this.scale = 1.05;

            let y_ratio = (this.view.cursor_value_rebin[1]+1)/this.height;
            let x_ratio = (this.view.cursor_value_rebin[0]+1)/this.width;

            console.log( "this.view.cursor_value_rebin[0], orig height, x_ratio", this.view.cursor_value_rebin[0], this.height, x_ratio );
            
            // calcluate the new min and length
            this.height = parseInt( this.view.orig_height / this.scale );
            //if ( this.height % 2 === 1 ) {
            //    this.height += 1;
            //}
            this.ymin = parseInt( this.view.cursor_value[1]-this.height*y_ratio+1 ); //parseInt( this.view.orig_height/2-this.height/2 );
            this.ymax = this.ymin + this.height - 1;//parseInt( this.view.cursor_value[1]+this.height*(1-this.view.cursor_value[1]/this.view.orig_height)-1 ); //parseInt( this.view.orig_height/2+this.height/2-1 );

            this.xmin = parseInt( this.view.cursor_value[0]-this.height*x_ratio+1 ); //this.ymin;
            this.xmax = this.xmin + this.height - 1;//parseInt( this.view.cursor_value[0]+this.height*(1-this.view.cursor_value[0]/this.view.orig_height)-1 );
            this.width = this.height;

            console.log( "event.deltaY, this.scale, this.height", event.deltaY, this.scale, this.height );
            console.log( "this.view.cursor_value[0]", this.view.cursor_value[0] );
            console.log( "this.ymin, this.ymax, this.xmin, this.xmax", this.ymin, this.ymax, this.xmin, this.xmax );
            */

            this.height = parseInt( this.view.orig_height / this.scale );
            if ( this.height % 2 === 1 ) {
                this.height += 1;
            }
            this.ymin = parseInt( this.view.orig_height/2-this.height/2 );
            this.ymax = parseInt( this.view.orig_height/2+this.height/2-1 );
            this.xmin = this.ymin;
            this.xmax = this.ymax;
            this.width = this.height;

            // send zoom message to the backend
            this.ZoomRequest( ws );

            // manage the time interval
            this.zoom_timer_call = false; // close the access to send zoom request
            window.clearTimeout(this.zoom_timer); // default the timer
            this.zoom_timer =  window.setTimeout( () => { // arrow function, or "this" will become "window object" if use traditional function syntax
                this.zoom_timer_call = true; // "this" still refer to "controller" in arrow function
                console.log(new Date(),"set zoom_timer_call to true");
            }, this.zoom_interval ); // reopen the access to send zoom request after a time interval

        }else{
            console.log(new Date(),"zoom reject");
        }
    }

    // send zoom message
    ZoomRequest( ws ) {  
        // set the message
        let request_message = new proto.ImageViewer.ZoomRequest();
        request_message.setChannel( this.view.channel );
        request_message.setXmin( this.xmin );
        request_message.setYmin( this.ymin );
        request_message.setWidth( this.width );
        request_message.setHeight( this.height );
        request_message.setSendStartTime( Date.now() );

        // encode and send
        let event_type = [2]; // ZOOM
        let request_message_bytes = request_message.serializeBinary();

        let message_bytes = new Uint8Array( request_message_bytes.length+1 );
        message_bytes.set( event_type, 0 );
        message_bytes.set( request_message_bytes, 1 );
        console.log(new Date(),"send message: ", message_bytes);
        ws.send(message_bytes);
    }

    // response to cursor hover events
    HoverEvent( event, ws ) {

        if (this.hover_function_call){

            this.view.cursor_value_rebin = [ event.points[0].pointNumber[1], event.points[0].pointNumber[0] ]

            // for testing
            console.log( "this.height", this.height );
            //this.view.cursor_value_rebin = [ Math.round((this.height-1)/2), Math.round((this.height-1)/2) ]

            this.zoom_function_call = true;

            // calculate the position in the original image
            let x_px, y_px;
            if ( this.ymin<0 ){
                x_px = Math.round( this.view.cursor_value_rebin[0]/this.rebin_ratio );
                y_px = Math.round( this.view.cursor_value_rebin[1]/this.rebin_ratio );
            } else {
                x_px = Math.round( this.xmin + this.view.cursor_value_rebin[0]/this.rebin_ratio );
                y_px = Math.round( this.ymin + this.view.cursor_value_rebin[1]/this.rebin_ratio );
            }
            console.log( "view.cursor_value_rebin[0], this.rebin_ratio", view.cursor_value_rebin[0], this.rebin_ratio );

            // info of the rebinned image
            let x = event.points[0].x; // ra
            let y = event.points[0].y; // dec
            let z = event.points[0].z; // value

            // update cursor_value
            this.view.cursor_value = [ x_px, y_px, x, y, z ];

            // display cursor info and send profile request to the backend
            this.view.UpdateTxtCursor();
            this.ProfileRequest(x_px, y_px,ws);

        }
        
    }

    // send profile request
    ProfileRequest( x_px, y_px, ws ) {
        // set the message
        let request_message = new proto.ImageViewer.ProfileRequest();
        request_message.setPositionX( x_px );
        request_message.setPositionY( y_px );
        request_message.setSendStartTime( Date.now() );
        
        // encode and send
        let event_type = [3]; // PROFILE
        let request_message_bytes = request_message.serializeBinary();

        let message_bytes = new Uint8Array( request_message_bytes.length+1 );
        message_bytes.set( event_type, 0 );
        message_bytes.set( request_message_bytes, 1 );
        if( ws.readyState != 0){
            console.log(new Date(),"send message: ", message_bytes);
            ws.send(message_bytes);
        }
    }

    // response to channel buttons in the animation panel
    ChannelBtn( mode, ws ) {
        switch ( mode ) {
            case 0:
                if ( this.view.channel!=0 ){
                    this.view.channel = 0;
                    this.ChannelRequest(ws);
                }
                break;
            case 9999:
                if ( this.view.channel!=this.view.channel_num-1 ){
                    this.view.channel = this.view.channel_num-1;
                    this.ChannelRequest(ws);
                }
                break;
            case 1:
                if ( this.view.channel!=this.view.channel_num-1 ){
                    this.view.channel += 1;
                    this.ChannelRequest(ws);
                }
                break;
            case -1:
                if ( this.view.channel!=0 ){
                    this.view.channel -= 1;
                    this.ChannelRequest(ws);
                }
                break;
        }
    }

    // send channel request
    ChannelRequest( ws ) {
        // set the message
        let request_message = new proto.ImageViewer.ChannelRequest();
        request_message.setChannel( this.view.channel );
        request_message.setSendStartTime( Date.now() );

        // encode and send
        let event_type = [4]; // CHANNEL
        let request_message_bytes = request_message.serializeBinary();

        let message_bytes = new Uint8Array( request_message_bytes.length+1 );
        message_bytes.set( event_type, 0 );
        message_bytes.set( request_message_bytes, 1 );
        console.log(new Date(),"send message: ", message_bytes);
        ws.send(message_bytes);
    }

    // receive message from the backend
    OnMessage( raw_message ) {

        // receive and decode the message
        let return_message_bytes = new Uint8Array(raw_message);
        console.log(new Date(),"received message: ", return_message_bytes );

        
        let event_type = return_message_bytes[0];
        return_message_bytes = return_message_bytes.slice(1);
        console.log(new Date(),"event_type: ", event_type );

        // trigger certain response
        switch ( event_type ) {
            case 1: // INIT_DISPLAY
                this.InitDisplayResponse( return_message_bytes );
                break;
            case 2: // ZOOM
                this.ZoomResponse( return_message_bytes );
                break;
            case 3: // PROFILE
                this.ProfileResponse( return_message_bytes );
                break;
            case 4: // CHANNEL
                this.ChannelResponse( return_message_bytes );
                break;
        
        }
        
    }

    InitDisplayResponse( return_message_bytes ) {
        // decode and read the message
        let time1 = Date.now();

        let return_message = proto.ImageViewer.InitDisplayResponse.deserializeBinary(return_message_bytes);

        // print send time and total response time
        let send_time = Date.now() - return_message.getSendStartTime();
        let total_response_time = Date.now() - return_message.getTaskStartTime();
        console.log(new Date(),"image displayed, send back time: ", 
                    send_time, "millisec, total response time: ",
                    total_response_time, "millisec",
                    this.orig_width*this.orig_height/total_response_time, "px/millisec" );

        // update original info of the image
        this.view.filename = return_message.getFilename();
        this.view.orig_width = return_message.getOrigWidth();
        this.view.orig_height = return_message.getOrigHeight();
        this.view.channel_num = return_message.getChannelNum();
        this.view.orig_x_coor_min   = return_message.getOrigXCoorMin();
        this.view.orig_x_coor_delta = return_message.getOrigXCoorDelta();
        this.view.orig_y_coor_min   = return_message.getOrigYCoorMin();
        this.view.orig_y_coor_delta = return_message.getOrigYCoorDelta();

        // update image data for display
        this.view.vmin = return_message.getVminList();
        this.view.vmax = return_message.getVmaxList();
        this.width = return_message.getImageWidth();
        this.height = return_message.getImageHeight();
        let data = new Array(this.height);
        for (let i=0; i<this.height; i++) {
            data[i] = return_message.getImageDataList()[i].getPointDataList();
        }
        this.view.image_data[0] = data;
        this.view.hist_data    = return_message.getHistDataList();

        // update image info
        this.rebin_ratio  = return_message.getRebinRatio();

        console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )

        // set the initial coordinate of the main image display
        this.view.x_coor_min = this.view.orig_x_coor_min;
        this.view.x_coor_delta = this.view.orig_x_coor_delta/this.rebin_ratio;
        this.view.y_coor_min = this.view.orig_y_coor_min;
        this.view.y_coor_delta = this.view.orig_y_coor_delta/this.rebin_ratio;
        this.view.x_range_min = this.view.orig_x_coor_min;
        this.view.x_range_max = this.view.orig_x_coor_min + (this.width-1)*this.view.orig_x_coor_delta/this.rebin_ratio;
        this.view.y_range_min = this.view.orig_y_coor_min;
        this.view.y_range_max = this.view.orig_y_coor_min + (this.height-1)*this.view.orig_y_coor_delta/this.rebin_ratio;
        
        // display image
        this.view.UpdateFilename();
        this.view.UpdateDisplay();
        this.view.UpdateHist();

        // allow hover event
        this.hover_function_call = true;

    }

    ZoomResponse( return_message_bytes ) {
        // decode and read the message
        let time1 = Date.now();

        let return_message = proto.ImageViewer.ZoomResponse.deserializeBinary(return_message_bytes);

        // print send time and total response time
        let send_time = Date.now() - return_message.getSendStartTime();
        let total_response_time = Date.now() - return_message.getTaskStartTime();
        console.log(new Date(),"image displayed, send back time: ", 
                    send_time, "millisec, total response time: ",
                    total_response_time, "millisec",
                    this.orig_width*this.orig_height/total_response_time, "px/millisec" );

        // update image data for display
        this.width = return_message.getImageWidth();
        this.height = return_message.getImageHeight();
        this.view.channel = return_message.getChannel();
        let data = new Array(this.height);
        for (let i=0; i<this.height; i++) {
            data[i] = return_message.getImageDataList()[i].getPointDataList();
        }
        this.view.image_data[return_message.getChannel()] = data;

        // update image info
        this.rebin_ratio  = return_message.getRebinRatio();

        console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )

        // calculate the coordinate of the main image display
        if ( this.ymin<0 ) {
            this.view.x_coor_min   = this.view.orig_x_coor_min;
            this.view.y_coor_min   = this.view.orig_y_coor_min;
        } else {
            this.view.x_coor_min   = this.view.orig_x_coor_min + this.ymin * this.view.orig_x_coor_delta;
            this.view.y_coor_min   = this.view.orig_y_coor_min + this.ymin * this.view.orig_y_coor_delta;
        }
        this.view.x_coor_delta = this.view.orig_x_coor_delta / this.rebin_ratio;
        this.view.y_coor_delta = this.view.orig_y_coor_delta / this.rebin_ratio;
        this.view.x_range_min  = this.view.orig_x_coor_min + this.ymin * this.view.orig_x_coor_delta;
        this.view.x_range_max  = this.view.orig_x_coor_min + this.ymax * this.view.orig_x_coor_delta;
        this.view.y_range_min  = this.view.orig_y_coor_min + this.ymin * this.view.orig_y_coor_delta;
        this.view.y_range_max  = this.view.orig_y_coor_min + this.ymax * this.view.orig_y_coor_delta;
        
        // display image
        this.view.UpdateDisplay();

        // turn off scroll event and allow hover event
        this.zoom_function_call = false;
        this.hover_function_call = true;
    }

    ProfileResponse( return_message_bytes ) {
        // decode and read the message
        let time1 = Date.now();

        let return_message = proto.ImageViewer.ProfileResponse.deserializeBinary(return_message_bytes);

        // print send time and total response time
        let send_time = Date.now() - return_message.getSendStartTime();
        let total_response_time = Date.now() - return_message.getTaskStartTime();
        console.log(new Date(),"image displayed, send back time: ", 
                    send_time, "millisec, total response time: ",
                    total_response_time, "millisec",
                    this.orig_width*this.orig_height/total_response_time, "px/millisec" );

        // update image data for display
        this.view.profile_x = return_message.getProfileXList();
        this.view.profile_y = return_message.getProfileYList();
        this.view.profile_z = return_message.getProfileZList();

        console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )

        // display profile
        this.view.UpdateProfile();

        // allow hover event
        this.hover_function_call = true;
    }

    ChannelResponse( return_message_bytes ) {
        // decode and read the message
        let time1 = Date.now();

        let return_message = proto.ImageViewer.ChannelResponse.deserializeBinary(return_message_bytes);

        // print send time and total response time
        let send_time = Date.now() - return_message.getSendStartTime();
        let total_response_time = Date.now() - return_message.getTaskStartTime();
        console.log(new Date(),"image displayed, send back time: ", 
                    send_time, "millisec, total response time: ",
                    total_response_time, "millisec",
                    this.orig_width*this.orig_height/total_response_time, "px/millisec" );

        // update image data for display
        this.width = return_message.getImageWidth();
        this.height = return_message.getImageHeight();
        this.view.channel = return_message.getChannel();
        let data = new Array(this.view.height);
        for (let i=0; i<this.height; i++) {
            data[i] = return_message.getImageDataList()[i].getPointDataList();
        }
        this.view.image_data[return_message.getChannel()] = data;
        this.view.hist_data    = return_message.getHistDataList();

        // update image info
        this.view.rebin_ratio  = return_message.getRebinRatio();

        console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )
        
        // display image
        this.view.UpdateDisplay();
        this.view.UpdateHist();
        this.view.UpdateProfile()
    }

}

// define the elements in the webpage
// main image display panel
let divImage     = document.getElementById( "div-image"     );
let txtFilename  = document.getElementById( "txt-filename"  );
let txtCursor    = document.getElementById( "txt-cursor"    );

// hist panel
let divHist      = document.getElementById( "div-hist"     );

// profile panels
let divProfileX  = document.getElementById( "div-profile-x" );
let divProfileY  = document.getElementById( "div-profile-y" );
let divProfileZ  = document.getElementById( "div-profile-z" );

// animation panel
let btnChannelFirst = document.getElementById( "btn-channel-first" );
let btnChannelPrev  = document.getElementById( "btn-channel-prev"  );
let btnChannelNext  = document.getElementById( "btn-channel-next"  );
let btnChannelLast  = document.getElementById( "btn-channel-last"  );

// setup image display
let view = new View( divImage, txtFilename, txtCursor, divHist, divProfileX, divProfileY, divProfileZ );
let controller = new Controller( view );

// setup connection with the server
let session = new Session("ws://localhost:5675/");

// initial setup of the web page
controller.InitSetup();

// WebSocket events
session.ws.onopen = function(event) {
    session.OnOpen();
    controller.InitDisplayRequest( session.ws );
};

session.ws.onclose = function(event) { 
    session.OnClose(event)
};

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

//divHist.on('plotly_afterplot', function(){
//    alert('new hist plot');
//});

// response when click buttons
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