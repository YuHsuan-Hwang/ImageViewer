#!/usr/bin/env python

import numpy as np
import math
import time
from datetime import datetime
import websockets
import asyncio
from astropy.io import fits

import protobufs.imageviewer_pb2 as pb

import multiprocessing
import concurrent.futures
from threading import current_thread
from threading import active_count

from PIL import Image
#import cv2
#from skimage.transform import resize
#import scipy.ndimage

class Model:

    def __init__( self, input_filename ):

        # original info of the image, initialize in ReadFits
        self.filename = input_filename
        self.x_len = None # orig_width
        self.y_len = None # orig_height
        self.z_len = None # channel_num

        self.image_data = None

        self.orig_x_coor_min = None   # the coordinate of the (0,0) bin
        self.orig_x_coor_delta = None # the length of a bin
        self.orig_y_coor_min = None
        self.orig_y_coor_delta = None

        # status of the display image
        self.channel = 0
        self.xmin = 0
        self.x_len_scaled = None # initialize in ReadFits
        self.ymin = 0
        self.y_len_scaled = None

        self.xmin_slice = 0
        self.xmax_slice = None
        self.ymin_slice = 0
        self.ymax_slice = None

        self.x_screensize_in_px = None # initialize in InitDisplayResponse
        self.y_screensize_in_px = None

    def ReadFits( self ):

        time1 = time.time()

        # read fits file
        print("(", datetime.now(), ") read fits file:", self.filename)
        path = "/Users/yuhsuan/Documents/web-projects/ImageViewer/client/images/"
        hdu_list = fits.open(path+self.filename)

        dim   = hdu_list[0].header['NAXIS']
        self.x_len = hdu_list[0].header['NAXIS1']
        self.y_len = hdu_list[0].header['NAXIS2']
        self.z_len = hdu_list[0].header['NAXIS3']
        print("(", datetime.now(), ") x, y, z:",self.x_len, self.y_len, self.z_len)

        x_centerpix = hdu_list[0].header['CRPIX1']
        y_centerpix = hdu_list[0].header['CRPIX2']
        z_centerpix = hdu_list[0].header['CRPIX3']
        x_centervalue = hdu_list[0].header['CRVAL1']
        y_centervalue = hdu_list[0].header['CRVAL2']
        z_centervalue = hdu_list[0].header['CRVAL3']
        self.orig_x_coor_delta = hdu_list[0].header['CDELT1']  # the length of a bin
        self.orig_y_coor_delta = hdu_list[0].header['CDELT2']
        z_coordelta = hdu_list[0].header['CDELT3']

        print("start read data")
        self.image_data = hdu_list[0].data[0]
        #self.image_data = self.image_data.astype("float32")

        hdu_list.close()

        # calculate coordinate
        self.orig_x_coor_min = x_centervalue - (x_centerpix-1)*self.orig_x_coor_delta # the coordinate of the (0,0) bin
        self.orig_y_coor_min = y_centervalue - (y_centerpix-1)*self.orig_y_coor_delta
        print("(", datetime.now(), ") orig coor min:", self.orig_x_coor_min, self.orig_y_coor_min )

        self.x_len_scaled = self.x_len
        self.y_len_scaled = self.y_len

        time2 = time.time()
        print( "(", datetime.now(), ") read fits file done, time =", (time2-time1)*1000.0 , "millisec")
    
    def OnMessage( self, message_bytes ):

        print("(", datetime.now(), ") received raw message: ", message_bytes)

        event_type = message_bytes[0]
        request_message = message_bytes[1:]
        print("(", datetime.now(), ") message type: ", event_type )
        print("(", datetime.now(), ") request message: ", request_message )
        
        # trigger certain response
        if ( event_type==pb.EventType.INIT_DISPLAY ):
            return_message_bytes = self.InitDisplayResponse( request_message )
            return return_message_bytes
        
        elif ( event_type==pb.EventType.ZOOM ):
            return_message_bytes = self.ZoomResponse( request_message )
            return return_message_bytes

        elif ( event_type==pb.EventType.PROFILE ):
            return_message_bytes = self.ProfileResponse( request_message )
            return return_message_bytes
        
        elif ( event_type==pb.EventType.CHANNEL ):
            return_message_bytes = self.ChannelResponse( request_message )
            return return_message_bytes
        
        elif ( event_type==pb.EventType.HIST ):
            return_message_bytes = self.HistResponse( request_message )
            return return_message_bytes
        
        else:
            print("(", datetime.now(), ")!!!unknown message!!!")


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
        
        # for testing
        #self.x_screensize_in_px, self.y_screensize_in_px = int(self.x_screensize_in_px/10), int(self.y_screensize_in_px/10) # test with lower resolution: 100, 100
        #self.x_screensize_in_px, self.y_screensize_in_px = int(self.x_screensize_in_px/100), int(self.y_screensize_in_px/100) # test with lower resolution: 10, 10

        time2 = time.time()
        print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

        # output array
        time1 = time.time()
        image_data_return = self.image_data[0]

        if self.y_len>self.y_screensize_in_px:  # image resolution is too high, rebin
            image_data_return = np.array( Image.fromarray(image_data_return).resize(size=(self.x_screensize_in_px, self.y_screensize_in_px)) )
            rebin_ratio = self.y_screensize_in_px/self.y_len
        else:
            rebin_ratio = 1

        time2 = time.time()
        print( "(", datetime.now(), ") output array, time =", (time2-time1)*1000.0 , "millisec",
                self.x_len*self.y_len/(time2-time1)/1000.0, "px/millisec" )
        
        # output histogram
        x, y = self.Histogram( 2 )

        # set the returning message
        response_message = pb.InitDisplayResponse()

        response_message.filename = self.filename
        response_message.orig_width = self.x_len
        response_message.orig_height = self.y_len
        response_message.channel_num = self.z_len

        for j in range( image_data_return.shape[1] ):
            row_data = response_message.image_data.add()
            row_data.point_data.extend( image_data_return[j] )
		
        response_message.image_width  = image_data_return.shape[0]
        response_message.image_height = image_data_return.shape[1]

        response_message.orig_x_coor_min   = self.orig_x_coor_min
        response_message.orig_x_coor_delta = self.orig_x_coor_delta
        response_message.orig_y_coor_min   = self.orig_y_coor_min
        response_message.orig_y_coor_delta = self.orig_y_coor_delta

        response_message.x_rebin_ratio = rebin_ratio
        response_message.y_rebin_ratio = rebin_ratio
        
        response_message.numbers.extend( y )
        response_message.bins.extend( x )

        response_message.task_start_time = message.send_start_time
        time1 = time.time()
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

        self.channel = message.channel
        self.xmin = message.xmin
        self.ymin = message.ymin
        self.x_len_scaled = message.width
        self.y_len_scaled = message.height

        time2 = time.time()
        print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

        # output array
        image_data_return, x_rebin_ratio, y_rebin_ratio = self.ImageArrayModel( self.xmin, self.ymin, self.x_len_scaled, self.y_len_scaled, self.channel )
        

        # set the returning message
        response_message = pb.ZoomResponse()

        for j in range( image_data_return.shape[0] ):
            row_data = response_message.image_data.add()
            row_data.point_data.extend( image_data_return[j] )
		
        response_message.channel = self.channel
        response_message.image_width  = image_data_return.shape[0]
        response_message.image_height = image_data_return.shape[1]

        response_message.x_rebin_ratio = x_rebin_ratio
        response_message.y_rebin_ratio = y_rebin_ratio

        response_message.task_start_time = message.send_start_time
        time1 = time.time()
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
        profile_x = self.image_data[self.channel,position_y,:]
        profile_y = self.image_data[self.channel,:,position_x]
        profile_z = self.image_data[:,position_y,position_x]

        # set the returning message
        response_message = pb.ProfileResponse()
        response_message.profile_x.extend( profile_x )
        response_message.profile_y.extend( profile_y )
        response_message.profile_z.extend( profile_z )

        response_message.task_start_time = message.send_start_time
        time1 = time.time()
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
        image_data_return, x_rebin_ratio, y_rebin_ratio = self.ImageArrayModel( self.xmin, self.ymin, self.x_len_scaled, self.y_len_scaled, self.channel )

        # output histogram
        x, y = self.Histogram( 2 )

        # set the returning message
        response_message = pb.ChannelResponse()

        for j in range( image_data_return.shape[0] ):
            row_data = response_message.image_data.add()
            row_data.point_data.extend( image_data_return[j] )
        print(image_data_return)
        response_message.channel = self.channel
        response_message.image_width  = image_data_return.shape[0]
        response_message.image_height = image_data_return.shape[1]

        response_message.x_rebin_ratio = x_rebin_ratio
        response_message.y_rebin_ratio = y_rebin_ratio

        response_message.numbers.extend( y )
        response_message.bins.extend( x )
        
        response_message.task_start_time = message.send_start_time
        time1 = time.time()
        response_message.send_start_time = round(time1*1000.0)
        
        # encode and send back message
        response_message_bytes = response_message.SerializeToString()
        return_message_bytes = bytes([pb.EventType.CHANNEL]) + response_message_bytes
        print("(", datetime.now(), ") end task: change channel")

        return return_message_bytes
    
    def HistResponse( self, message_bytes ):

        # receive and decode the message
        message = pb.HistRequest()
        message.ParseFromString(message_bytes)

         # print send time
        time2 = time.time()
        print("(", datetime.now(), ") received message, send time: ",
        round(time2*1000.0)-message.send_start_time, "millisec" )

        # read message
        time1 = time.time()
        print("(", datetime.now(), ") start task: change histogram mode" )

        hist_mode = message.hist_mode

        time2 = time.time()
        print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

        # calculate histogram
        if (hist_mode==1): # per-cube
            x, y = self.Histogram( 1 )
        else: # hist_mode==2, per-channel
            x, y = self.Histogram( 2 )

        # set the returning message
        response_message = pb.HistResponse()

        response_message.numbers.extend( y )
        response_message.bins.extend( x )

        response_message.task_start_time = message.send_start_time
        time1 = time.time()
        response_message.send_start_time = round(time1*1000.0)
        
        # encode and send back message
        response_message_bytes = response_message.SerializeToString()
        return_message_bytes = bytes([pb.EventType.HIST]) + response_message_bytes
        print("(", datetime.now(), ") end task: change histogram mode")

        return return_message_bytes


    def ImageArrayModel( self, xmin, ymin, x_len_scaled, y_len_scaled, channel ):
        time1 = time.time()
        image_data_return = self.image_data[channel]
        
        # slice the image
        if (xmin<0): self.xmin_slice = 0
        else: self.xmin_slice = xmin
        if (ymin<0): self.ymin_slice = 0
        else: self.ymin_slice = ymin

        if (xmin+x_len_scaled>self.y_len): self.xmax_slice = self.y_len
        else: self.xmax_slice = xmin+x_len_scaled
        if (ymin+y_len_scaled>self.y_len): self.ymax_slice = self.y_len
        else: self.ymax_slice = ymin+y_len_scaled

        image_data_return =  image_data_return[ self.ymin_slice:self.ymax_slice:1, self.xmin_slice:self.xmax_slice:1 ]

        # calculate required resolution, especially for smaller image
        x_screensize_in_px_scaled = math.ceil(self.x_screensize_in_px * (self.xmax_slice-self.xmin_slice)/x_len_scaled)
        y_screensize_in_px_scaled = math.ceil(self.y_screensize_in_px * (self.ymax_slice-self.ymin_slice)/y_len_scaled)
        print( x_screensize_in_px_scaled, y_screensize_in_px_scaled )

        # rebin
        if ( (self.xmax_slice-self.xmin_slice)>x_screensize_in_px_scaled )|( (self.ymax_slice-self.ymin_slice)>y_screensize_in_px_scaled ):
            print( "rebin" )
            image_data_return = np.array( Image.fromarray(image_data_return).resize(size=(x_screensize_in_px_scaled, y_screensize_in_px_scaled)) )
            x_rebin_ratio = (x_screensize_in_px_scaled)/(self.xmax_slice-self.xmin_slice)                                
            y_rebin_ratio = (y_screensize_in_px_scaled)/(self.ymax_slice-self.ymin_slice)
        else:
            x_rebin_ratio = 1
            y_rebin_ratio = 1
        
        time2 = time.time()
        print( "(", datetime.now(), ") output array, time =", (time2-time1)*1000.0 , "millisec",
                self.x_len*self.y_len/(time2-time1)/1000.0, "px/millisec" )

        return image_data_return, x_rebin_ratio, y_rebin_ratio

    def Histogram( self, mode ):
        
        time1 = time.time()

        if (mode==1): # per cube

            range_max = np.zeros(self.z_len)
            range_min = np.zeros(self.z_len)

            def CalMaxMin( i ):
                data = self.image_data[i]
                range_max[i] = np.nanmax( data )
                range_min[i] = np.nanmin( data )
                return
        
            with concurrent.futures.ThreadPoolExecutor() as executor:
                print("start thread pool")
                executor.map( CalMaxMin, range(self.z_len) )
            
            time2 = time.time()
            print( "(", datetime.now(), ") test time", (time2-time1)*1000.0 , "millisec")
            time1 = time.time()

            range_max = np.nanmax(range_max)
            print(range_max)
            range_min = np.nanmin(range_min)
            print(range_min)

            time2 = time.time()
            print( "(", datetime.now(), ") test time", (time2-time1)*1000.0 , "millisec")
            time1 = time.time()

            bin_num = int((self.x_len*self.y_len*self.z_len)**0.333)

            print(bin_num,range_min,range_max)

            y = np.zeros( [self.z_len,bin_num],dtype=np.int64 )
            x = np.linspace( range_min, range_max, bin_num )
            x += np.ones(len(x))*0.5*(x[1]-x[0])

            def CalHist( i ):
                y[i], _ = np.histogram( self.image_data[i], bin_num, range=(range_min,range_max) )
                return
            
            with concurrent.futures.ThreadPoolExecutor(4) as executor:
                print("start thread pool")
                executor.map( CalHist, range(self.z_len) )
            
            y = np.sum( y, axis=0 )


        else: # mode==2, per channel

            range_max = np.nanmax( self.image_data[self.channel] )
            range_min = np.nanmin( self.image_data[self.channel] )
            bin_num = int(np.sqrt(self.x_len*self.y_len))

            print(bin_num,range_min,range_max)

            y, x = np.histogram( self.image_data[self.channel], bin_num, range=(range_min,range_max) )
            x = x[:-1] + np.ones(len(y))*0.5*(x[1]-x[0])


        time2 = time.time()
        print( "(", datetime.now(), ") output histogram, time =", (time2-time1)*1000.0 , "millisec")

        return x, y
    
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
        #model = Model( "HD163296_CO_2_1.fits" )
        #model = Model( "S255_IR_sci.spw29.cube.I.pbcor.fits" )
        model = Model( "GV_Tau_sci.spw0.cube.I.manual.image.pbcor.10ch.fits" )
        
        #model = Model( "member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5_7_9_11.cont.I.pbcor.fits" )
        #model = Model( "vla_3ghz_msmf.fits" )
        #model = Model( "mips_24_GO3_sci_10.fits" )
        #model = Model( "cluster_08192.fits" )

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