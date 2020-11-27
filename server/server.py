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

	def __init__(self, input_filename):

		self.filename = input_filename
		self.x_len = None # orig_width
		self.y_len = None # orig_height
		self.z_len = None # channel_num

		self.image_data = None
		self.image_data_scaled = None

		self.vmin = None
		self.vmax = None

		self.x_centerpix = None
		self.y_centerpix = None
		self.z_centerpix = None
		self.x_centerra = None
		self.y_centerdec = None
		self.z_centerfreq = None
		self.x_coordelta = None
		self.y_coordelta = None
		self.z_coordelta = None

		self.x_coor_min = None
		self.x_coor_delta = None
		self.y_coor_min = None
		self.y_coor_delta = None
		self.x_range_min = None
		self.x_range_max = None
		self.y_range_min = None
		self.y_range_max = None

		self.channel = 0
		self.scale = 1
		self.axis_range = None

		self.x_screensize_in_px = None
		self.y_screensize_in_px = None

	def ReadFits(self):

		time1 = time.time()

		# read fits file
		path = "/Users/yuhsuan/Documents/web-projects/ImageViewer/client/images/"
		hdu_list = fits.open(path+self.filename)

		dim   = hdu_list[0].header['NAXIS' ]
		self.x_len = hdu_list[0].header['NAXIS1']
		self.y_len = hdu_list[0].header['NAXIS2']
		self.z_len = hdu_list[0].header['NAXIS3']

		self.x_centerpix = hdu_list[0].header['CRPIX1']
		self.y_centerpix = hdu_list[0].header['CRPIX2']
		self.z_centerpix = hdu_list[0].header['CRPIX3']
		self.x_centerra  = hdu_list[0].header['CRVAL1']
		self.y_centerdec = hdu_list[0].header['CRVAL2']
		self.z_centerfreq = hdu_list[0].header['CRVAL3']
		self.x_coordelta = hdu_list[0].header['CDELT1']
		self.y_coordelta = hdu_list[0].header['CDELT2']
		self.z_coordelta = hdu_list[0].header['CDELT3']

		self.image_data = hdu_list[0].data[0]
		self.image_data = self.image_data.astype('float32') # for cv2.resize to work

		hdu_list.close()
		
		# colorbar settings
		self.vmax = np.nanmax( np.nanmax( self.image_data, axis=1 ), axis=1 )
		self.vmin = np.nanmin( np.nanmin( self.image_data, axis=1 ), axis=1 )

		self.axis_range = [ 0, self.x_len-1, 0, self.y_len-1 ] # xmin, xmax, ymin, ymax
		
		time2 = time.time()
		print( "(", datetime.now(), ") read fits file done, time =", (time2-time1)*1000.0 , "millisec")


	def InitDisplayResponse( self, message ):

		time1 = time.time()
		print("(", datetime.now(), ") start task: init display" )

		self.x_screensize_in_px, self.y_screensize_in_px = message.init_display_request_message.x_screensize_in_px, message.init_display_request_message.y_screensize_in_px # 500*2, 500*2
		self.x_screensize_in_px, self.y_screensize_in_px = int(self.x_screensize_in_px/10), int(self.y_screensize_in_px/10) # test with lower resolution: 100, 100

		time2 = time.time()
		print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

		self.ImageModel()

		# set the returning message
		response_message = pb.InitDisplayResponse()

		response_message.filename = self.filename
		response_message.orig_width = self.x_len
		response_message.orig_height = self.y_len
		response_message.channel_num = self.z_len

		response_message.vmin.extend( self.vmin )
		response_message.vmax.extend( self.vmax )

		for j in range( self.image_data_scaled.shape[1] ):
			row_data = response_message.image_data.add()
			row_data.point_data.extend( self.image_data_scaled[j] )
		
		response_message.channel = self.channel
		response_message.image_width  = self.image_data_scaled.shape[0]
		response_message.image_height = self.image_data_scaled.shape[1]

		response_message.x_coor_min   = self.x_coor_min
		response_message.x_coor_delta = self.x_coor_delta
		response_message.y_coor_min   = self.y_coor_min
		response_message.y_coor_delta = self.y_coor_delta
		response_message.x_range_min = self.x_range_min
		response_message.x_range_max = self.x_range_max
		response_message.y_range_min = self.y_range_min
		response_message.y_range_max = self.y_range_max

		response_message.rebin_ratio = self.rebin_ratio

		return_message = pb.Response()
		return_message.event_type = pb.EventType.INIT_DISPLAY
		return_message.init_display_response_message.CopyFrom( response_message )
		return_message.task_start_time = message.send_start_time
		return_message.send_start_time = round(time1*1000.0)

		# encode and send back message
		return_message_bytes = return_message.SerializeToString()
		print("(", datetime.now(), ") end task: sent image")

		return return_message_bytes

	def ZoomResponse( self, message ):

		time1 = time.time()
		print("(", datetime.now(), ") start task: zoom image" )

		delta_y = message.zoom_request_message.delta_y
		self.channel = message.zoom_request_message.channel

		time2 = time.time()
		print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

		if delta_y==-9999:
			self.scale = 1.0
		else:
			self.scale += float(delta_y)*0.01
			if self.scale <= 0.3: self.scale = 0.3

		self.ImageModel()

		# set the returning message
		response_message = pb.ZoomResponse()

		for j in range( self.image_data_scaled.shape[1] ):
			row_data = response_message.image_data.add()
			row_data.point_data.extend( self.image_data_scaled[j] )
		
		response_message.channel = self.channel
		response_message.image_width  = self.image_data_scaled.shape[0]
		response_message.image_height = self.image_data_scaled.shape[1]

		response_message.x_coor_min   = self.x_coor_min
		response_message.x_coor_delta = self.x_coor_delta
		response_message.y_coor_min   = self.y_coor_min
		response_message.y_coor_delta = self.y_coor_delta
		response_message.x_range_min = self.x_range_min
		response_message.x_range_max = self.x_range_max
		response_message.y_range_min = self.y_range_min
		response_message.y_range_max = self.y_range_max

		response_message.rebin_ratio = self.rebin_ratio

		return_message = pb.Response()
		return_message.event_type = pb.EventType.ZOOM
		return_message.zoom_response_message.CopyFrom( response_message )
		return_message.task_start_time = message.send_start_time
		return_message.send_start_time = round(time1*1000.0)

		# encode and send back message
		return_message_bytes = return_message.SerializeToString()
		print("(", datetime.now(), ") end task: sent image")

		return return_message_bytes
	
	def ImageModel(self):

		time1 = time.time()

		image_data_onechannel = self.image_data[ self.channel ]

		# calcluate the new ymin and ymax
		self.rebin_ratio = 1.0
		y_len_scaled = int( self.y_len / self.scale )
		if y_len_scaled % 2 == 1 : y_len_scaled += 1
		ymin = int( self.y_len/2-y_len_scaled/2 )
		ymax = int( self.y_len/2+y_len_scaled/2-1 )
		
		# calculate the min of the coordinates
		if ymin<0:
			self.x_coor_min = self.x_centerra  - self.x_centerpix*self.x_coordelta
			self.y_coor_min = self.y_centerdec - self.y_centerpix*self.y_coordelta
		else:
			self.x_coor_min = self.x_centerra  - ( self.x_centerpix-ymin )*self.x_coordelta
			self.y_coor_min = self.y_centerdec - ( self.y_centerpix-ymin )*self.y_coordelta
		
		self.x_range_min = self.x_centerra  - ( self.x_centerpix-ymin ) * self.x_coordelta
		self.y_range_min = self.y_centerdec - ( self.y_centerpix-ymin ) * self.y_coordelta
		self.x_range_max = self.x_centerra  + ( ymax-self.x_centerpix ) * self.x_coordelta
		self.y_range_max = self.y_centerdec + ( ymax-self.y_centerpix ) * self.y_coordelta

		# draw the image
		# smaller than orig image, need to manage the margin of the plotting
		if ymin<0:
			y_screensize_in_px_scaled = int( self.y_screensize_in_px * self.scale )
			if y_screensize_in_px_scaled % 2 == 1 : y_screensize_in_px_scaled += 1
			# image resolution is too high, rebin
			if self.y_len>(y_screensize_in_px_scaled):
				image_data_scaled = cv2.resize( image_data_onechannel,
												(y_screensize_in_px_scaled, y_screensize_in_px_scaled),
												interpolation=cv2.INTER_AREA )
				self.axis_range = [ ymin, y_screensize_in_px_scaled+ymin-1, ymin, y_screensize_in_px_scaled+ymin-1 ]
				self.rebin_ratio = (y_screensize_in_px_scaled)/self.y_len

			else:
				image_data_scaled = image_data_onechannel
				self.axis_range = [ ymin, self.y_len-ymin-1, ymin, self.y_len-ymin-1 ]

		# larger than orig image, need to slice the image
		else:

			image_data_scaled = image_data_onechannel[ ymin:ymax+1:1, ymin:ymax+1:1 ]
			# image resolution is too high, rebin
			if y_len_scaled>self.y_screensize_in_px:
				image_data_scaled = cv2.resize( image_data_scaled,
												(self.y_screensize_in_px, self.x_screensize_in_px),
												interpolation=cv2.INTER_AREA )					
				self.axis_range = [ 0, self.x_screensize_in_px-1, 0, self.y_screensize_in_px-1 ]
				self.rebin_ratio = self.y_screensize_in_px/y_len_scaled

			else:
				self.axis_range = [ 0, ymax-ymin, 0, ymax-ymin ]
		
		self.image_data_scaled = image_data_scaled
		self.x_coor_delta = self.x_coordelta/self.rebin_ratio
		self.y_coor_delta = self.y_coordelta/self.rebin_ratio

		time2 = time.time()
		print( "(", datetime.now(), ") output array, time =", (time2-time1)*1000.0 , "millisec",
				self.x_len*self.y_len/(time2-time1)/1000.0, "px/millisec" )

	def ProfileResponse( self, message ):
		time1 = time.time()
		print("(", datetime.now(), ") start task: cal profile" )

		self.channel = message.profile_request_message.channel
		position_x = message.profile_request_message.position_x
		position_y = message.profile_request_message.position_y

		time2 = time.time()
		print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")

		profile_x = self.image_data[self.channel,:,position_x]
		profile_y = self.image_data[self.channel,position_y,:]
		profile_z = self.image_data[:,position_x,position_y]

		# set the returning message
		response_message = pb.ProfileResponse()
		response_message.profile_x.extend( profile_x )
		response_message.profile_y.extend( profile_y )
		response_message.profile_z.extend( profile_z )

		return_message = pb.Response()
		return_message.event_type = pb.EventType.PROFILE
		return_message.profile_response_message.CopyFrom( response_message )
		return_message.task_start_time = message.send_start_time
		return_message.send_start_time = round(time1*1000.0)

		# encode and send back message
		return_message_bytes = return_message.SerializeToString()
		print("(", datetime.now(), ") end task: cal profile")

		return return_message_bytes


# construct the task of a client connection
async def OneClientTask(websocket, path):
	
	# show the number of clients when new client is connected
	global client_num
	client_num += 1
	print("(", datetime.now(), ") established one connection to ", websocket.remote_address[0],",", client_num, "client connected")
	print()

	try:

		print("(", datetime.now(), ") work begin")

		model = Model( "member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5.cube.I.pbcor.fits" )
		#model = Model( "member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5_7_9_11.cont.I.pbcor.fits" )
		#model = Model( "vla_3ghz_msmf.fits" )
		#model = Model( "mips_24_GO3_sci_10.fits" )

		model.ReadFits()
	
		# keep receiving message from the client
		async for message_bytes in websocket:

			# receive and decode the message
			message = pb.Request()
			message.ParseFromString(message_bytes)

			# print send time
			time2 = time.time()
			print("(", datetime.now(), ") received message, send time: ", round(time2*1000.0)-message.send_start_time, "millisec" )

			if ( message.event_type==pb.EventType.INIT_DISPLAY ):
				return_message_bytes = model.InitDisplayResponse( message )

			elif ( message.event_type==pb.EventType.ZOOM ):
				return_message_bytes = model.ZoomResponse( message )

			elif ( message.event_type==pb.EventType.PROFILE ):
				return_message_bytes = model.ProfileResponse( message )
				
			await websocket.send(return_message_bytes)

	# listen to connection and show the number of clients when a client is disconnected
	except websockets.exceptions.ConnectionClosed:

		# show the number of clients
		client_num -= 1
		print("(", datetime.now(), ") lost connection from ",websocket.remote_address[0],",", client_num, "client connected")
		print()



print( "(", datetime.now(), ") server started (press Ctrl-C to exit the server)" )

client_num = 0 # number of clients connected to the server

# create a event loop
loop = asyncio.get_event_loop()

# setup a task that connects to the server
start_server = websockets.serve(OneClientTask, "localhost", 5675)

# run the task
try:
  loop.run_until_complete(start_server)
  loop.run_forever()

# listen for ctrl c to terminate the program
except KeyboardInterrupt:
  loop.stop()
  print("\n(", datetime.now(), ") exiting the server")
