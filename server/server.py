#!/usr/bin/env python

import numpy as np
import time
from datetime import datetime
import websockets
import asyncio
from astropy.io import fits
import cv2
import protobufs.imageviewer_pb2 as pb

class Model:

    def __init__( self, input_filename ):

        # original info of the image, initialize in ReadFits
        self.filename = input_filename
        self.x_len = None # orig_width
        self.y_len = None # orig_height
        self.z_len = None # channel_num

        self.image_data = None

        self.orig_x_coor_min = None
        self.orig_x_coor_delta = None
        self.orig_y_coor_min = None
        self.orig_y_coor_delta = None

        self.vmin = None
        self.vmax = None

        # status of the display image
        self.channel = 0
        self.xmin = 0
        self.x_len_scaled = None # initialize in ReadFits
        self.ymin = 0
        self.y_len_scaled = None

        self.x_screensize_in_px = None # initialize in InitDisplayResponse
        self.y_screensize_in_px = None

    def ReadFits( self ):

        time1 = time.time()

        # read fits file
        print("(", datetime.now(), ") read fits file: ", self.filename)
        path = "/Users/yuhsuan/Documents/web-projects/ImageViewer/client/images/"
        hdu_list = fits.open(path+self.filename)

        dim   = hdu_list[0].header['NAXIS' ]
        self.x_len = hdu_list[0].header['NAXIS1']
        self.y_len = hdu_list[0].header['NAXIS2']
        self.z_len = hdu_list[0].header['NAXIS3']

        x_centerpix = hdu_list[0].header['CRPIX1']
        y_centerpix = hdu_list[0].header['CRPIX2']
        z_centerpix = hdu_list[0].header['CRPIX3']
        x_centervalue = hdu_list[0].header['CRVAL1']
        y_centervalue = hdu_list[0].header['CRVAL2']
        z_centervalue = hdu_list[0].header['CRVAL3']
        self.orig_x_coor_delta = hdu_list[0].header['CDELT1']
        self.orig_y_coor_delta = hdu_list[0].header['CDELT2']
        z_coordelta = hdu_list[0].header['CDELT3']

        self.image_data = hdu_list[0].data[0]
        self.image_data = self.image_data.astype('float32') # for cv2.resize to work

        hdu_list.close()

        # calculate coordinate
        self.orig_x_coor_min = x_centervalue - x_centerpix*self.orig_x_coor_delta
        self.orig_y_coor_min = y_centervalue - y_centerpix*self.orig_y_coor_delta
        print("(", datetime.now(), ") orig coor min: ", self.orig_x_coor_min, self.orig_y_coor_min )

        # colorbar settings
        self.vmax = np.nanmax( np.nanmax( self.image_data, axis=1 ), axis=1 )
        self.vmin = np.nanmin( np.nanmin( self.image_data, axis=1 ), axis=1 )

        self.x_len_scaled = self.x_len
        self.y_len_scaled = self.y_len

        time2 = time.time()
        print( "(", datetime.now(), ") read fits file done, time =", (time2-time1)*1000.0 , "millisec")

    def OnMessage_old( self, message_bytes ):

        # receive and decode the message
        message = pb.Request()
        message.ParseFromString(message_bytes)

        # print send time
        time2 = time.time()
        print("(", datetime.now(), ") received message, send time: ",
        round(time2*1000.0)-message.send_start_time, "millisec" )

        # trigger certain response
        if ( message.event_type==pb.EventType.INIT_DISPLAY ):
            return_message_bytes = self.InitDisplayResponse( message )

        elif ( message.event_type==pb.EventType.ZOOM ):
            return_message_bytes = self.ZoomResponse( message )

        elif ( message.event_type==pb.EventType.PROFILE ):
            return_message_bytes = self.ProfileResponse( message )
        
        elif ( message.event_type==pb.EventType.CHANNEL ):
            return_message_bytes = self.ChannelResponse( message )
        
        return return_message_bytes

    def OnMessage( self, message_bytes ):

        print("(", datetime.now(), ") received raw message: ", message_bytes)

        event_type = message_bytes[0]
        request_message = message_bytes[1:]
        print("(", datetime.now(), ") message type: ", event_type )
        print("(", datetime.now(), ") request message: ", request_message )
        
        # trigger certain response
        if ( event_type==pb.EventType.INIT_DISPLAY ):
            return_message_bytes = self.InitDisplayResponse( request_message )
        
        elif ( event_type==pb.EventType.ZOOM ):
            return_message_bytes = self.ZoomResponse( request_message )

        elif ( event_type==pb.EventType.PROFILE ):
            return_message_bytes = self.ProfileResponse( request_message )
        
        elif ( event_type==pb.EventType.CHANNEL ):
            return_message_bytes = self.ChannelResponse( request_message )
        
        return return_message_bytes
        


    def InitDisplayResponse( self, message_bytes ):

        # receive and decode the message
        message = pb.InitDisplayRequest()
        message.ParseFromString(message_bytes)

         # print send time
        time2 = time.time()
        print("(", datetime.now(), ") received message, send time: ",
        round(time2*1000.0)-message.send_start_time, "millisec" )

        # read message
        time1 = time.time()
        print("(", datetime.now(), ") start task: init display" )

        self.x_screensize_in_px, self.y_screensize_in_px = message.x_screensize_in_px, message.y_screensize_in_px # 500*2, 500*2
        self.x_screensize_in_px, self.y_screensize_in_px = int(self.x_screensize_in_px/10), int(self.y_screensize_in_px/10) # test with lower resolution: 100, 100

        time2 = time.time()
        print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

        # output array
        time1 = time.time()
        image_data_onechannel = self.image_data[0]
       
        if self.y_len>self.y_screensize_in_px:  # image resolution is too high, rebin
            image_data_return = cv2.resize( image_data_onechannel,
                                            (self.y_screensize_in_px, self.x_screensize_in_px),
                                            interpolation=cv2.INTER_AREA )					
            rebin_ratio = self.y_screensize_in_px/self.y_len

        else:
            image_data_return = image_data_onechannel
            rebin_ratio = 1

        time2 = time.time()
        print( "(", datetime.now(), ") output array, time =", (time2-time1)*1000.0 , "millisec",
                self.x_len*self.y_len/(time2-time1)/1000.0, "px/millisec" )

        # set the returning message
        response_message = pb.InitDisplayResponse()

        response_message.filename = self.filename
        response_message.orig_width = self.x_len
        response_message.orig_height = self.y_len
        response_message.channel_num = self.z_len

        response_message.vmin.extend( self.vmin )
        response_message.vmax.extend( self.vmax )

        for j in range( image_data_return.shape[1] ):
            row_data = response_message.image_data.add()
            row_data.point_data.extend( image_data_return[j] )
		
        response_message.image_width  = image_data_return.shape[0]
        response_message.image_height = image_data_return.shape[1]

        response_message.orig_x_coor_min   = self.orig_x_coor_min
        response_message.orig_x_coor_delta = self.orig_x_coor_delta
        response_message.orig_y_coor_min   = self.orig_y_coor_min
        response_message.orig_y_coor_delta = self.orig_y_coor_delta

        response_message.rebin_ratio = rebin_ratio

        response_message.hist_data.extend( self.image_data.flatten() )

        response_message.task_start_time = message.send_start_time
        response_message.send_start_time = round(time1*1000.0)
        
        # encode and send back message
        response_message_bytes = response_message.SerializeToString()
        return_message_bytes = bytes([pb.EventType.INIT_DISPLAY]) + response_message_bytes
        print("(", datetime.now(), ") end task: init display")

        return return_message_bytes

    def ZoomResponse( self, message_bytes ):

        # receive and decode the message
        message = pb.ZoomRequest()
        message.ParseFromString(message_bytes)

         # print send time
        time2 = time.time()
        print("(", datetime.now(), ") received message, send time: ",
        round(time2*1000.0)-message.send_start_time, "millisec" )

        # read message
        time1 = time.time()
        print("(", datetime.now(), ") start task: zoom image" )

        channel = message.channel
        xmin = message.xmin
        ymin = message.ymin
        x_len_scaled = message.width
        y_len_scaled = message.height

        time2 = time.time()
        print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

        # update status
        self.xmin = xmin
        self.ymin = ymin
        self.x_len_scaled =  x_len_scaled
        self.y_len_scaled = y_len_scaled
        self.channel = channel

        # output array
        time1 = time.time()
        image_data_return, rebin_ratio = self.ImageArray( xmin, ymin, x_len_scaled, y_len_scaled, channel )
        time2 = time.time()
        print( "(", datetime.now(), ") output array, time =", (time2-time1)*1000.0 , "millisec",
                self.x_len*self.y_len/(time2-time1)/1000.0, "px/millisec" )

        # set the returning message
        response_message = pb.ZoomResponse()

        for j in range( image_data_return.shape[1] ):
            row_data = response_message.image_data.add()
            row_data.point_data.extend( image_data_return[j] )
		
        response_message.channel = self.channel
        response_message.image_width  = image_data_return.shape[0]
        response_message.image_height = image_data_return.shape[1]

        response_message.rebin_ratio = rebin_ratio

        response_message.task_start_time = message.send_start_time
        response_message.send_start_time = round(time1*1000.0)

        # encode and send back message
        response_message_bytes = response_message.SerializeToString()
        return_message_bytes = bytes([pb.EventType.ZOOM]) + response_message_bytes
        print("(", datetime.now(), ") end task: zoom image")

        return return_message_bytes

    def ProfileResponse( self, message_bytes ):

        # receive and decode the message
        message = pb.ProfileRequest()
        message.ParseFromString(message_bytes)

         # print send time
        time2 = time.time()
        print("(", datetime.now(), ") received message, send time: ",
        round(time2*1000.0)-message.send_start_time, "millisec" )

        # read message
        time1 = time.time()
        print("(", datetime.now(), ") start task: cal profile" )

        channel = message.channel
        position_x = message.position_x
        position_y = message.position_y

        time2 = time.time()
        print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

        # output profiles
        profile_x = self.image_data[channel,position_y,:]
        profile_y = self.image_data[channel,:,position_x]
        profile_z = self.image_data[:,position_x,position_y]

        # set the returning message
        response_message = pb.ProfileResponse()
        response_message.profile_x.extend( profile_x )
        response_message.profile_y.extend( profile_y )
        response_message.profile_z.extend( profile_z )

        response_message.task_start_time = message.send_start_time
        response_message.send_start_time = round(time1*1000.0)
        
        # encode and send back message
        response_message_bytes = response_message.SerializeToString()
        return_message_bytes = bytes([pb.EventType.PROFILE]) + response_message_bytes
        print("(", datetime.now(), ") end task: cal profile")

        return return_message_bytes
    
    def ChannelResponse( self, message_bytes ):

        # receive and decode the message
        message = pb.ChannelRequest()
        message.ParseFromString(message_bytes)

         # print send time
        time2 = time.time()
        print("(", datetime.now(), ") received message, send time: ",
        round(time2*1000.0)-message.send_start_time, "millisec" )

        # read message
        time1 = time.time()
        print("(", datetime.now(), ") start task: change channel" )

        self.channel = message.channel

        time2 = time.time()
        print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

        # output array
        time1 = time.time()
        image_data_return, rebin_ratio = self.ImageArray( self.xmin, self.ymin, self.x_len_scaled, self.y_len_scaled, self.channel )
        time2 = time.time()
        print( "(", datetime.now(), ") output array, time =", (time2-time1)*1000.0 , "millisec",
                self.x_len*self.y_len/(time2-time1)/1000.0, "px/millisec" )

        # set the returning message
        response_message = pb.ChannelResponse()

        for j in range( image_data_return.shape[1] ):
            row_data = response_message.image_data.add()
            row_data.point_data.extend( image_data_return[j] )
		
        response_message.channel = self.channel
        response_message.image_width  = image_data_return.shape[0]
        response_message.image_height = image_data_return.shape[1]

        response_message.rebin_ratio = rebin_ratio

        response_message.hist_data.extend( self.image_data.flatten() )
        
        response_message.task_start_time = message.send_start_time
        response_message.send_start_time = round(time1*1000.0)
        
        # encode and send back message
        response_message_bytes = response_message.SerializeToString()
        return_message_bytes = bytes([pb.EventType.CHANNEL]) + response_message_bytes
        print("(", datetime.now(), ") end task: change channel")

        return return_message_bytes
    
    def ImageArray( self, xmin, ymin, x_len_scaled, y_len_scaled, channel ):

        image_data_onechannel = self.image_data[channel]
        
        if y_len_scaled>self.y_len: # smaller than orig image, need to manage the margin of the plotting
            y_screensize_in_px_scaled = int( self.y_screensize_in_px * (self.y_len/y_len_scaled) )
            if y_screensize_in_px_scaled % 2 == 1 : y_screensize_in_px_scaled += 1

            if self.y_len>(y_screensize_in_px_scaled): # image resolution is too high, rebin
                image_data_return = cv2.resize( image_data_onechannel,
                                                (y_screensize_in_px_scaled, y_screensize_in_px_scaled),
                                                interpolation=cv2.INTER_AREA )
                rebin_ratio = (y_screensize_in_px_scaled)/self.y_len

            else:
                image_data_return = image_data_onechannel
                rebin_ratio = 1

        else: # larger than orig image, need to slice the image

            image_data_return = image_data_onechannel[ ymin:ymin+y_len_scaled:1, ymin:ymin+y_len_scaled:1 ]
            
            if y_len_scaled>self.y_screensize_in_px: # image resolution is too high, rebin
                image_data_return = cv2.resize( image_data_return,
                                                (self.y_screensize_in_px, self.x_screensize_in_px),
                                                interpolation=cv2.INTER_AREA )					
                rebin_ratio = self.y_screensize_in_px/y_len_scaled

            else:
                rebin_ratio = 1
        
        return image_data_return, rebin_ratio


class Server:

    def __init__( self, input_ip, input_port ):

        self.ip = input_ip
        self.port = input_port
        self.client_num = 0 # number of clients connected to the server
        self.loop = asyncio.get_event_loop() # create a event loop
        self.start_server = None

    def Run( self ):

        print( "(", datetime.now(), ") server started (press Ctrl-C to exit the server)" )
        self.loop.run_until_complete( self.start_server )
        self.loop.run_forever()

    def Close( self ):
        
        self.loop.stop()
        print("\n(", datetime.now(), ") exiting the server")

    def ConnectClient( self, ws ):

        # show the number of clients when new client is connected
        self.client_num += 1
        print("(", datetime.now(), ") established one connection to ", ws.remote_address[0], ",", self.client_num, "client connected")
        print()

    def DisconnectClient( self, ws ):

        # show the number of clients
        self.client_num -= 1
        print("(", datetime.now(), ") lost connection from ", ws.remote_address[0], ",", self.client_num, "client connected")
        print()




server = Server( "localhost", 5675 )

# task of a client connection
async def OneClientTask( ws, path ):
    
    server.ConnectClient( ws )
    try:
        print("(", datetime.now(), ") work begin")

        #model = Model( "member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5.cube.I.pbcor.fits" )
        model = Model( "member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5_7_9_11.cont.I.pbcor.fits" )
        #model = Model( "HD163296_CO_2_1.fits" )
        #model = Model( "vla_3ghz_msmf.fits" )
        #model = Model( "mips_24_GO3_sci_10.fits" )

        model.ReadFits()

        # keep receiving message from the client
        async for message_bytes in ws:
            
            return_message_bytes = model.OnMessage( message_bytes )
            await ws.send(return_message_bytes)

    # listen to connection and show the number of clients when a client is disconnected
    except websockets.exceptions.ConnectionClosed:
        server.DisconnectClient( ws )

# start the server
try:
    # setup a task that connects to the server
    server.start_server = websockets.serve( OneClientTask, server.ip, server.port )
    server.Run()

# listen for ctrl c to terminate the program
except KeyboardInterrupt:
    server.Close()