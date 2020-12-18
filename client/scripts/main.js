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
            console.log(new Date(),"connection lost: ", event);
        }
    }
		
}

/**
 * properties for displaying image
 * and methods related to actions on web elements
 */
class View{

    constructor( input_div_image, input_txt_filename, input_txt_cursor,
                 input_div_hist, input_inp_vmax, input_inp_vmin,
                 input_div_profilex, input_div_profiley, input_div_profilez ) {
        // web elements
        this.div_image = input_div_image;
        this.txt_filename = input_txt_filename;
        this.txt_cursor = input_txt_cursor;
        this.div_hist = input_div_hist;
        this.inp_vmax = input_inp_vmax;
        this.inp_vmin = input_inp_vmin;
        this.div_profile_x = input_div_profilex;
        this.div_profile_y = input_div_profiley;
        this.div_profile_z = input_div_profilez;

        // original info of the image (initialized in controller.InitDisplayResponse)
        this.filename;
        this.orig_width, this.orig_height, this.channel_num; // x, y, z pixel length of the cube data
        this.orig_x_coor_min, this.orig_x_coor_delta, this.orig_y_coor_min, this.orig_y_coor_delta; // coordinate min and delta, the "value" of the bins, in degree

        // image data for display (updated in controller.XxxxResponse)
        this.vmin, this.vmax; // colorscale min and max
        this.image_data = [[0]]; // main display image, 3d data, change with controller.scale
        //this.hist_data; // histogram of the current channel, change with view.channel
        this.hist_data_y, this.hist_data_x;
        this.profile_x, this.profile_y, this.profile_z; // profile of the current cursor position and channel, change with view.corsor_value and view.channel

        // status of the display image
        this.channel = 0; // x, y pixel length after zooming, current channel
        this.x_coor_min, this.x_coor_delta, this.y_coor_min, this.y_coor_delta; // coordinate min and delta, the "value" of the bins, in degree after zooming
        this.x_range_min, this.x_range_max, this.y_range_min, this.y_range_max; // coordinate display range, the "edge" of the image, in degree after zooming
        this.x_min = 0, this.y_min = 0;  // coordinate min in px after zooming, relative to the orig data, for plotting profiles
        this.cursor_value = [0,0,0,0,0]; // position and value of the cursor (orig image): x_px, y_px, x_ra, y_dec, z_value
        this.cursor_pos = [0,0];
        this.x_rebin_ratio = 1, this.y_rebin_ratio = 1; // rebin status
    }

    // setup all the interface with blanck figures
    BlanckDisplay() {
        // setup the main image display panel
        let heatmap_layout = {
            autosize:false, width:580, height:600, dragmode:"pan", margin:{ l:70, r:10, b:60, t:40 },
            xaxis:{ title:"Right ascension", color:'royalblue',
                    zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2,
                    ticks:'inside', ticklen:8, tickcolor:'royalblue' },
            yaxis:{ title:{text:"Declination"}, color:'royalblue',
                    zeroline:false, showgrid:false, linecolor:'royalblue', mirror:'ticks', linewidth:2,
                    ticks:'inside', ticklen:8, tickcolor:'royalblue', tickangle:-90 },
            paper_bgcolor:'Aliceblue'
        }
        Plotly.react( this.div_image, [{z:[[0]],type:'heatmapgl',showscale:false, zsmooth:false, colorscale:'Viridis',hoverinfo:"none"}],
                      heatmap_layout, {displayModeBar:false,displaylogo:false,scrollZoom:true} ); // Plotly.react runs slightly faster than Plotly.newPlot

       let hist_layout = {
            autosize:false, width:580, height:190, margin:{ l:70, r:150, b:40, t:40 },
            xaxis:{ title:"Value",       color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"log(Number)", color:'royalblue', linecolor:'royalblue', mirror:true, type:'log' },
            paper_bgcolor:'Aliceblue', bargap:0,
            shapes:[{type:'line',x0:0.01, x1:0.01,y0:0, y1:1,yref:'paper',line:{color:'lightpink', width:1}},
            {type:'line',x0:-0.01,x1:-0.01,y0:0,y1:1,yref:'paper',line:{color:'lightgreen',width:1}}]
        }
        Plotly.react( this.div_hist, [{y:[],type:'bar',opacity: 0.4}], hist_layout, {displaylogo:false});

        // setup x, y, z profile panels
        let bar_layout_x = {
            autosize:false, width:700, height:190, margin:{ l:70, r:20, b:40, t:40 },
            xaxis:{ title:"X Coordinate", color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"Value",        color:'royalblue', linecolor:'royalblue', mirror:true },
            paper_bgcolor:'Aliceblue', bargap:0
        }
        let bar_layout_y = {
            autosize:false, width:700, height:190, margin:{ l:70, r:20, b:40, t:40 },
            xaxis:{ title:"Y Coordinate", color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"Value",        color:'royalblue', linecolor:'royalblue', mirror:true },
            paper_bgcolor:'Aliceblue', bargap:0
        }
        let bar_layout_z = {
            autosize:false, width:700, height:190, margin:{ l:70, r:20, b:40, t:40 },
            xaxis:{ title:"Channel", color:'royalblue', linecolor:'royalblue', mirror:true },
            yaxis:{ title:"Value",   color:'royalblue', linecolor:'royalblue', mirror:true },
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
    // change color scale of the main image
    UpdateDisplayVrange(){
        Plotly.restyle( this.div_image, { zmin:this.vmin[this.channel], zmax:this.vmax[this.channel] } );
    }
    // replot the image back to the same range instead of zooming
    Redisplay(){
        console.log(new Date(),"zoom reject");
        Plotly.update( this.div_image, {}, { 'xaxis.range':[this.x_range_min,this.x_range_max],'yaxis.range':[this.y_range_min,this.y_range_max] } )
    }

    // update histogram data
    UpdateHist(){       
        Plotly.update( this.div_hist, {y:[this.hist_data_y],x:[this.hist_data_x]},//{x:[this.hist_data]},
            { shapes:[{type:'line',x0:this.vmax[this.channel],x1:this.vmax[this.channel],y0:0,y1:1,yref:'paper',line:{color:'lightpink',width:2}},
                      {type:'line',x0:this.vmin[this.channel],x1:this.vmin[this.channel],y0:0,y1:1,yref:'paper',line:{color:'lightgreen',width:2}}] });
        this.inp_vmax.value = this.vmax[this.channel];
        this.inp_vmin.value = this.vmin[this.channel];
    }
    // update vmin vmax in the histogram panel
    UpdateHistVrange(){
        Plotly.relayout( this.div_hist,
                         { shapes:[{type:'line',x0:this.vmax[this.channel],x1:this.vmax[this.channel],y0:0,y1:1,yref:'paper',line:{color:'lightpink', width:2}},
                                   {type:'line',x0:this.vmin[this.channel],x1:this.vmin[this.channel],y0:0,y1:1,yref:'paper',line:{color:'lightgreen',width:2}}] } );
        this.inp_vmax.value = this.vmax[this.channel];
        this.inp_vmin.value = this.vmin[this.channel];
    }

    // update the status of cursor
    UpdateTxtCursor(){
        this.txt_cursor.value = "  Position: (" + this.cursor_value[0] + "," + this.cursor_value[1]
                                + "), Image: (" + this.cursor_value[2].toFixed(5) + "," + this.cursor_value[3].toFixed(5)
                                + "), Value: "  + this.cursor_value[4].toExponential(5);
    }

    // update profile data
    UpdateProfile() {
        Plotly.update( this.div_profile_x, { y:[this.profile_x], x0:[this.x_min], dx:[1] },
                       { shapes:[{type:'line',x0:this.cursor_value[0],x1:this.cursor_value[0],y0:0, y1:1,yref:'paper',line:{color:'grey',width:2}}] } );
        Plotly.update( this.div_profile_y, { y:[this.profile_y], x0:[this.y_min], dx:[1] }, 
                       { shapes:[{type:'line',x0:this.cursor_value[1],x1:this.cursor_value[1],y0:0, y1:1,yref:'paper',line:{color:'grey',width:2}}] } );
        Plotly.update( this.div_profile_z, { y:[this.profile_z] },
                       { shapes:[{type:'line',x0:this.channel,        x1:this.channel,        y0:0, y1:1,yref:'paper',line:{color:'grey',width:2}}] });
    }
    UpdateProfileTmp() {
        Plotly.update( this.div_profile_x, { y:[this.image_data[this.channel][this.cursor_pos[1]]], x0:[this.x_min], dx:[1/this.x_rebin_ratio] },
            { shapes:[{type:'line',x0:this.cursor_value[0],x1:this.cursor_value[0],y0:0, y1:1,yref:'paper',line:{color:'grey',width:2}}] } );
        Plotly.update( this.div_profile_y, { y:[this.ArrayColumn(this.image_data[this.channel],this.cursor_pos[0])], x0:[this.y_min], dx:[1/this.y_rebin_ratio] }, 
            { shapes:[{type:'line',x0:this.cursor_value[1],x1:this.cursor_value[1],y0:0, y1:1,yref:'paper',line:{color:'grey',width:2}}] } );
    }
    ArrayColumn(arr, n) {
        return arr.map(x=> x[n]);
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

        // scroll event parameter
        this.relayout_call = true;
        this.zoom_timer;
        this.zoom_interval = 50;

        // mouse event parameter
        this.hover_function_call = false; // set to true after init display is complete
        this.hover_timer;
        this.hover_interval = 50;

        // required info when displaying new image
        this.scale = 1; // zoom status
        this.xmin = 0, this.ymin = 0; // in orig px size
        this.request_width, this.request_height; // in orig px size
        this.width, this.height; // rebinned size
        this.v_range_percent = 99.9; // range percentage of the color scale
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
        this.SendRequest( [1], request_message.serializeBinary(), ws ) // 1: INIT_DISPLAY
    }

    RelayoutEvent( event, ws ) {
        if( this.relayout_call ) { // trigger zooming after the new zoomed image is plotted

            //this.relayout_call = false;
            //this.hover_function_call = false;

            // read the new axis range
            this.view.x_range_min = event["xaxis.range"][0];
            this.view.x_range_max = event["xaxis.range"][1];
            this.view.y_range_min = event["yaxis.range"][0];
            this.view.y_range_max = event["yaxis.range"][1];
            
            // calculate the new required data range
            this.xmin = parseInt( 0.5+(event["xaxis.range"][0]-this.view.orig_x_coor_min)/this.view.orig_x_coor_delta );
            this.ymin = parseInt( 0.5+(event["yaxis.range"][0]-this.view.orig_y_coor_min)/this.view.orig_y_coor_delta );
            this.request_width  = 1+Math.ceil( (event["xaxis.range"][1]-event["xaxis.range"][0])/this.view.orig_x_coor_delta );
            this.request_height = 1+Math.ceil( (event["yaxis.range"][1]-event["yaxis.range"][0])/this.view.orig_y_coor_delta );
            //console.log( this.xmin, this.ymin, this.request_width, this.request_height );

            this.view.x_min = this.xmin;
            this.view.y_min = this.ymin;
            if (this.view.x_min<0){
                this.view.x_min = 0;
            }
            if (this.view.y_min<0){
                this.view.y_min = 0;
            }

            /* // for heatmap
            // read the new axis range
            this.view.x_range_min = event['xaxis.range[0]'];
            this.view.x_range_max = event['xaxis.range[1]'];
            this.view.y_range_min = event['yaxis.range[0]'];
            this.view.y_range_max = event['yaxis.range[1]'];
            
            // calculate the new required data range
            this.xmin = Math.ceil( 0.5+(event['xaxis.range[0]']-this.view.orig_x_coor_min)/this.view.orig_x_coor_delta );
            this.ymin = Math.ceil( 0.5+(event['yaxis.range[0]']-this.view.orig_y_coor_min)/this.view.orig_y_coor_delta );
            this.request_width  = parseInt( (event['xaxis.range[1]']-event['xaxis.range[0]'])/this.view.orig_x_coor_delta );
            this.request_height = parseInt( (event['yaxis.range[1]']-event['yaxis.range[0]'])/this.view.orig_y_coor_delta );
            //console.log( this.xmin, this.ymin, this.request_width, this.request_height );
            */

            //if( (this.request_width<this.view.orig_width)||(this.request_height<this.view.orig_width) ) { // ask for new data if zoom in

            // manage the time interval
            window.clearTimeout(this.zoom_timer); // default the timer
            console.log("set up zoom_timer");
            this.zoom_timer =  window.setTimeout( () => { // arrow function, or "this" will become "window object" if use traditional function syntax
                console.log("send zoom request");
                this.ZoomRequest( ws );
                this.relayout_call = false;
                this.hover_function_call = false;
            }, this.zoom_interval );

            //}
        
        }else {
            // replot the image back to the same range instead of zooming
            this.view.Redisplay();
        }
    }

    // send zoom message
    ZoomRequest( ws ) {  
        // set the message
        let request_message = new proto.ImageViewer.ZoomRequest();
        request_message.setChannel( this.view.channel );
        request_message.setXmin( this.xmin );
        request_message.setYmin( this.ymin );
        request_message.setWidth( this.request_width );
        request_message.setHeight( this.request_height );
        request_message.setSendStartTime( Date.now() );

        // encode and send
        this.SendRequest( [2], request_message.serializeBinary(), ws ) // 2: ZOOM
    }

    // response to cursor hover events
    HoverEvent( event, ws ) {

        if (this.hover_function_call){ // detect mouse position after the new image is plotted

            this.view.cursor_pos[0] = event.points[0].pointNumber[1];
            this.view.cursor_pos[1] = event.points[0].pointNumber[0];

            let x_px = parseInt( 0.5+(event.points[0].x-this.view.orig_x_coor_min)/this.view.orig_x_coor_delta ); // px in orig image
            let y_px = parseInt( 0.5+(event.points[0].y-this.view.orig_y_coor_min)/this.view.orig_y_coor_delta ); // px in orig image
            let x = event.points[0].x; // ra
            let y = event.points[0].y; // dec
            let z = event.points[0].z; // value
            
            // update cursor_value
            this.view.cursor_value = [ x_px, y_px, x, y, z ];

            // display cursor info
            this.view.UpdateTxtCursor();
            this.view.UpdateProfileTmp();

            // manage the time interval and send profile request to the backend
            window.clearTimeout(this.hover_timer); // default the timer
                console.log("set up hover_timer");
                this.hover_timer =  window.setTimeout( () => {
                console.log("send hover request");
                this.ProfileRequest(x_px, y_px, ws);
            }, this.hover_interval );            
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
        this.SendRequest( [3], request_message.serializeBinary(), ws ) // 3: PROFILE
    }

    // response to channel buttons in the animation panel
    ChannelBtn( mode, ws ) {
        switch ( mode ) {
            case 0:
                if ( this.view.channel!=0 ){
                    this.view.channel = 0;
                    inpChannel.value=this.view.channel;
                    this.ChannelRequest(ws);
                }
                break;
            case 9999:
                if ( this.view.channel!=this.view.channel_num-1 ){
                    this.view.channel = this.view.channel_num-1;
                    inpChannel.value=this.view.channel;
                    this.ChannelRequest(ws);
                }
                break;
            case 1:
                if ( this.view.channel!=this.view.channel_num-1 ){
                    this.view.channel += 1;
                    inpChannel.value=this.view.channel;
                    this.ChannelRequest(ws);
                }
                break;
            case -1:
                if ( this.view.channel!=0 ){
                    this.view.channel -= 1;
                    inpChannel.value=this.view.channel;
                    this.ChannelRequest(ws);
                }
                break;
        }
    }

    InputChannel( input_channel, ws ) {
        if ( (this.view.channel!=input_channel)&&(input_channel!=undefined) ) {
            this.view.channel = input_channel;
            this.ChannelRequest(ws);
        }
    }

    // send channel request
    ChannelRequest( ws ) {
        // set the message
        let request_message = new proto.ImageViewer.ChannelRequest();
        request_message.setChannel( this.view.channel );
        request_message.setSendStartTime( Date.now() );

        // encode and send
        this.SendRequest( [4], request_message.serializeBinary(), ws ) // 4: CHANNEL
    }

    SelectVrange( input_v_range_percent ) {
        if( input_v_range_percent!=-9999) {

            this.v_range_percent = input_v_range_percent

            // reset vmin, vmax
            this.view.vmin = new Array(this.view.channel_num).fill(-9999);
            this.view.vmax = new Array(this.view.channel_num).fill(-9999);

            // calculate vmin, vmax
            let v_min_index = this.view.orig_width * this.view.orig_height * (100.0-this.v_range_percent)/100.0;
            let v_max_index = v_min_index;
            for (let i=0; i<this.view.hist_data_y.length; i++) {
                v_min_index -= this.view.hist_data_y[i];
                if (v_min_index<0.0){
                    this.view.vmin[this.view.channel] = this.view.hist_data_x[i];
                    break;
                }
            }
            for (let i=this.view.hist_data_y.length-1; i>=0; i--) {
                v_max_index -= this.view.hist_data_y[i];
                if (v_max_index<0.0){
                    this.view.vmax[this.view.channel] = this.view.hist_data_x[i];
                    break;
                }
            }

            // display image
            this.view.UpdateDisplayVrange();
            this.view.UpdateHistVrange();
        }
    }

    InputVmax( input_vmax ) {
        this.view.vmax = new Array(this.view.channel_num).fill(input_vmax);
        this.view.UpdateDisplayVrange();
        this.view.UpdateHistVrange();
        selectVrange.value=-9999;
    }
    InputVmin( input_vmin ) {
        this.view.vmin = new Array(this.view.channel_num).fill(input_vmin);
        this.view.UpdateDisplayVrange();
        this.view.UpdateHistVrange();
        selectVrange.value=-9999;
    }

    HistRequest( hist_mode,ws ) {

        // reset vmin, vmax if not in Custom mode
        if (selectVrange.value!=-9999) {
            this.view.vmin = new Array(this.view.channel_num).fill(-9999);
            this.view.vmax = new Array(this.view.channel_num).fill(-9999);
        }

        // set the message
        let request_message = new proto.ImageViewer.HistRequest();
        request_message.setHistMode( hist_mode );
        request_message.setSendStartTime( Date.now() );

        // encode and send
        this.SendRequest( [5], request_message.serializeBinary(), ws ) // 5: HIST
    }

    SendRequest( event_type, request_message_bytes, ws ) {
        let message_bytes = new Uint8Array( request_message_bytes.length+1 );
        message_bytes.set( event_type, 0 );
        message_bytes.set( request_message_bytes, 1 );
        console.log(new Date(),"send message: ", message_bytes);
        if( ws.readyState != 0){
            ws.send(message_bytes);
        }
        else {
            console.log("send request reject");
        }
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
            case 5: // HIST
                this.HistResponse( return_message_bytes );
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

        this.width = return_message.getImageWidth();
        this.height = return_message.getImageHeight();
        let data = new Array(this.height);
        for (let i=0; i<this.height; i++) {
            data[i] = return_message.getImageDataList()[i].getPointDataList();
        }
        this.view.image_data[0] = data;

        this.view.hist_data_y = return_message.getNumbersList();
        this.view.hist_data_x = return_message.getBinsList();

        // update image info
        this.view.x_rebin_ratio  = return_message.getXRebinRatio();
        this.view.y_rebin_ratio  = return_message.getYRebinRatio();

        console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )

        // set the initial coordinate of the main image display
        this.view.x_range_min = this.view.orig_x_coor_min - 0.5*this.view.orig_x_coor_delta;
        this.view.x_range_max = this.view.orig_x_coor_min + (this.view.orig_width-0.5)*this.view.orig_x_coor_delta;
        this.view.y_range_min = this.view.orig_y_coor_min - 0.5*this.view.orig_y_coor_delta;
        this.view.y_range_max = this.view.orig_y_coor_min + (this.view.orig_height-0.5)*this.view.orig_y_coor_delta;
        this.view.x_coor_min = this.view.x_range_min + 0.5*this.view.orig_x_coor_delta/this.view.x_rebin_ratio;
        this.view.x_coor_delta = this.view.orig_x_coor_delta/this.view.x_rebin_ratio;
        this.view.y_coor_min = this.view.y_range_min + 0.5*this.view.orig_y_coor_delta/this.view.y_rebin_ratio;
        this.view.y_coor_delta = this.view.orig_y_coor_delta/this.view.y_rebin_ratio;

        // update image data for display
        this.view.vmin = Array(this.view.channel_num).fill(-9999)
        this.view.vmax = Array(this.view.channel_num).fill(-9999)

        // calculate vmin, vmax
        let v_min_index = this.view.orig_width * this.view.orig_height * (100.0-this.v_range_percent)/100.0;
        let v_max_index = v_min_index;
        for (let i=0; i<this.view.hist_data_y.length; i++) {
            v_min_index -= this.view.hist_data_y[i];
            if (v_min_index<0.0){
                this.view.vmin[0] = this.view.hist_data_x[i];
                break;
            }
        }
        for (let i=this.view.hist_data_y.length-1; i>=0; i--) {
            v_max_index -= this.view.hist_data_y[i];
            if (v_max_index<0.0){
                this.view.vmax[0] = this.view.hist_data_x[i];
                break;
            }
        }
        
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
        let data = new Array(this.width);
        for (let i=0; i<this.width; i++) {
            data[i] = return_message.getImageDataList()[i].getPointDataList();
        }
        this.view.image_data[return_message.getChannel()] = data;

        // update image info
        this.view.x_rebin_ratio = return_message.getXRebinRatio();
        this.view.y_rebin_ratio = return_message.getYRebinRatio();

        console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )


        // calculate new coordinate
        if ( this.xmin<0 ) {
            this.view.x_coor_min = this.view.orig_x_coor_min - 0.5*this.view.orig_x_coor_delta + 0.5*this.view.orig_x_coor_delta/this.view.x_rebin_ratio;
        } else {
            this.view.x_coor_min = this.view.orig_x_coor_min + (this.xmin-0.5)*this.view.orig_x_coor_delta + 0.5*this.view.orig_x_coor_delta/this.view.x_rebin_ratio;
        }
        if ( this.ymin<0 ) {
            this.view.y_coor_min = this.view.orig_y_coor_min - 0.5*this.view.orig_y_coor_delta + 0.5*this.view.orig_y_coor_delta/this.view.y_rebin_ratio;
        } else {
            this.view.y_coor_min = this.view.orig_y_coor_min + (this.ymin-0.5)*this.view.orig_y_coor_delta + 0.5*this.view.orig_y_coor_delta/this.view.y_rebin_ratio;
        }
        this.view.x_coor_delta = this.view.orig_x_coor_delta / this.view.x_rebin_ratio;
        this.view.y_coor_delta = this.view.orig_y_coor_delta / this.view.y_rebin_ratio;
        
        // display image
        this.view.UpdateDisplay();

        // allow zoom and hover event
        this.relayout_call = true;
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

        //this.view.hist_data    = return_message.getHistDataList();
        this.view.hist_data_y = return_message.getNumbersList();
        this.view.hist_data_x = return_message.getBinsList();

        // update image info
        this.view.x_rebin_ratio  = return_message.getXRebinRatio();
        this.view.y_rebin_ratio  = return_message.getYRebinRatio();

        console.log(new Date(),"read message: ", Date.now()-time1, "millisec" )

        if ( (this.view.vmin[this.view.channel]===-9999)&&(this.v_range_percent!=-9999) ) {
            // calculate vmin, vmax
            let v_min_index = this.view.orig_width * this.view.orig_height * (100.0-this.v_range_percent)/100.0;
            let v_max_index = v_min_index;
            for (let i=0; i<this.view.hist_data_y.length; i++) {
                v_min_index -= this.view.hist_data_y[i];
                if (v_min_index<0.0){
                    this.view.vmin[this.view.channel] = this.view.hist_data_x[i];
                    break;
                }
            }
            for (let i=this.view.hist_data_y.length-1; i>=0; i--) {
                v_max_index -= this.view.hist_data_y[i];
                if (v_max_index<0.0){
                    this.view.vmax[this.view.channel] = this.view.hist_data_x[i];
                    break;
                }
            }
        }

        // display image
        this.view.UpdateDisplay();
        if ( selectHist.value==='2'){
            this.view.UpdateHist();
        }
        this.view.UpdateProfile();
    }

    HistResponse( return_message_bytes ){
        // decode and read the message
        let time1 = Date.now();

        let return_message = proto.ImageViewer.HistResponse.deserializeBinary(return_message_bytes);

        // print send time and total response time
        let send_time = Date.now() - return_message.getSendStartTime();
        let total_response_time = Date.now() - return_message.getTaskStartTime();
        console.log(new Date(),"image displayed, send back time: ", 
                    send_time, "millisec, total response time: ",
                    total_response_time, "millisec" );

        // update image data for display
        this.view.hist_data_y = return_message.getNumbersList();
        this.view.hist_data_x = return_message.getBinsList();

        if (this.v_range_percent!=-9999) {
            // calculate vmin, vmax
            let v_min_index = this.view.orig_width * this.view.orig_height * (100.0-this.v_range_percent)/100.0;
            let v_max_index = v_min_index;
            for (let i=0; i<this.view.hist_data_y.length; i++) {
                v_min_index -= this.view.hist_data_y[i];
                if (v_min_index<0.0){
                    this.view.vmin = new Array(this.view.channel_num).fill(this.view.hist_data_x[i]);
                    break;
                }
            }
            for (let i=this.view.hist_data_y.length-1; i>=0; i--) {
                v_max_index -= this.view.hist_data_y[i];
                if (v_max_index<0.0){
                    this.view.vmax = new Array(this.view.channel_num).fill(this.view.hist_data_x[i]);
                    break;
                }
            }
        }

        // display image
        this.view.UpdateDisplayVrange();
        this.view.UpdateHist();
    }

}

// define the elements in the webpage
// main image display panel
let divImage     = document.getElementById( "div-image"     );
let txtFilename  = document.getElementById( "txt-filename"  );
let txtCursor    = document.getElementById( "txt-cursor"    );

// hist panel
let divHist      = document.getElementById( "div-hist"      );
let selectHist   = document.getElementById("select-hist-mode");
let selectVrange = document.getElementById( "select-vrange" );
let inpVmax      = document.getElementById( "inp-vmax"      );
let inpVmin      = document.getElementById( "inp-vmin"      );

// profile panels
let divProfileX  = document.getElementById( "div-profile-x" );
let divProfileY  = document.getElementById( "div-profile-y" );
let divProfileZ  = document.getElementById( "div-profile-z" );

// animation panel
let btnChannelFirst = document.getElementById( "btn-channel-first" );
let btnChannelPrev  = document.getElementById( "btn-channel-prev"  );
let btnChannelNext  = document.getElementById( "btn-channel-next"  );
let btnChannelLast  = document.getElementById( "btn-channel-last"  );
let inpChannel      = document.getElementById( "inp-channel"       );


// setup image display
let view = new View( divImage, txtFilename, txtCursor, divHist, inpVmax, inpVmin, divProfileX, divProfileY, divProfileZ );
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
// response when the cursor move to different pixels
divImage.on( 'plotly_hover', function(event){
    controller.HoverEvent(event,session.ws);
} );

// response when scroll and pan on the main image
divImage.on('plotly_relayout', function(event){
    controller.RelayoutEvent(event,session.ws);
} );

// response when select color range
function SelectHist(){
    controller.HistRequest(selectHist.value,session.ws);
}
function SelectVrange(){
    controller.SelectVrange(selectVrange.value);
};
inpVmax.addEventListener('change', function(event){
    controller.InputVmax(parseFloat(event.target.value));
} );
inpVmin.addEventListener('change', function(event){
    controller.InputVmin(parseFloat(event.target.value));
} );

// response when change channel
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
inpChannel.addEventListener('change', function(event){
    controller.InputChannel(parseInt(event.target.value),session.ws);
} );