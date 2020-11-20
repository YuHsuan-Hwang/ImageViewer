#!/usr/bin/env python

import numpy as np
import time

from datetime import datetime
import websockets

import asyncio

from astropy.io import fits

import cv2

from protobufs.imageviewer_pb2 import ZoomRequest
from protobufs.imageviewer_pb2 import ImageResponse

# construct the task of a client connection
async def OneClientTask(websocket, path):
	
	# show the number of clients when new client is connected
	global client_num
	client_num += 1
	print("(", datetime.now(), ") established one connection to ", websocket.remote_address[0],",", client_num, "client connected")
	print()

	try:

		print("(", datetime.now(), ") work begin")

		time1 = time.time()

		# read fits file
		path = "/Users/yuhsuan/Documents/web-projects/ImageViewer/client/images/"
		filename = "member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5_7_9_11.cont.I.pbcor.fits"
		#filename = "vla_3ghz_msmf.fits"
		#filename = "mips_24_GO3_sci_10.fits"
		hdu_list = fits.open(path+filename)

		#hdu_list.info()
		dim   = hdu_list[0].header['NAXIS' ]
		x_len = hdu_list[0].header['NAXIS1']
		y_len = hdu_list[0].header['NAXIS2']

		x_centerpix = hdu_list[0].header['CRPIX1']
		y_centerpix = hdu_list[0].header['CRPIX2']
		x_centerra  = hdu_list[0].header['CRVAL1']
		y_centerdec = hdu_list[0].header['CRVAL2']
		x_coordelta = hdu_list[0].header['CDELT1']
		y_coordelta = hdu_list[0].header['CDELT2']

		if dim==2:
			image_data = hdu_list[0].data
		elif dim==4:
			image_data = hdu_list[0].data[0][0]
		else:
			print("(", datetime.now(),"image fomat does not support")
			
		image_data = image_data.astype('float32') # for cv2.resize to work

		hdu_list.close()

		# colorbar settings
		vmax = np.max( np.nan_to_num( image_data ) )
		vmin = np.min( np.nan_to_num( image_data ) )

		scale = 1.0
		axis_range = [ 0, x_len-1, 0, y_len-1 ] # xmin, xmax, ymin, ymax
		
		time2 = time.time()
		print( "(", datetime.now(), ") read fits file done, time =", (time2-time1)*1000.0 , "millisec")

		# keep receiving message from the client
		async for message_bytes in websocket:

			# receive and decode the message
			message = ZoomRequest()
			message.ParseFromString(message_bytes)

			# print send time
			time2 = time.time()
			print("(", datetime.now(), ") received message, send time: ", round(time2*1000.0)-message.send_start_time, "millisec" )
			time1 = time.time()

			print( "(", datetime.now(), ") start task: zoom image" )

			# scroll amount
			delta_y = message.zoom_deltay
				
			# screen resolution
			x_screensize_in_px, y_screensize_in_px = message.x_screensize_in_px, message.y_screensize_in_px # 500*2, 500*2
			x_screensize_in_px, y_screensize_in_px = int(x_screensize_in_px/10), int(y_screensize_in_px/10) # test with lower resolution: 100, 100

			time2 = time.time()
			print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")
			time1 = time.time()

			if delta_y==-9999:
				scale = 1.0
			else:
				scale += float(delta_y)*0.01
				if scale <= 0.3: scale = 0.3

			# calcluate the new ymin and ymax
			rebin_ratio = 1.0
			y_len_scaled = int( y_len / scale )
			if y_len_scaled % 2 == 1 : y_len_scaled += 1
			ymin = int( y_len/2-y_len_scaled/2 )
			ymax = int( y_len/2+y_len_scaled/2-1 )
			
			# calculate the min of the coordinates
			if ymin<0:
				x_coor_min = x_centerra  - x_centerpix*x_coordelta
				y_coor_min = y_centerdec - y_centerpix*y_coordelta
			else:
				x_coor_min = x_centerra  - ( x_centerpix-ymin )*x_coordelta
				y_coor_min = y_centerdec - ( y_centerpix-ymin )*y_coordelta
			
			x_range_min = x_centerra  - ( x_centerpix-ymin ) * x_coordelta
			y_range_min = y_centerdec - ( y_centerpix-ymin ) * y_coordelta
			x_range_max = x_centerra  + ( ymax-x_centerpix ) * x_coordelta
			y_range_max = y_centerdec + ( ymax-y_centerpix ) * y_coordelta

			# draw the image
			# smaller than orig image, need to manage the margin of the plotting
			if ymin<0:
				y_screensize_in_px_scaled = int( y_screensize_in_px * scale )
				if y_screensize_in_px_scaled % 2 == 1 : y_screensize_in_px_scaled += 1
				# image resolution is too high, rebin
				if y_len>(y_screensize_in_px_scaled):
					image_data_scaled = cv2.resize( image_data,
													(y_screensize_in_px_scaled, y_screensize_in_px_scaled),
													interpolation=cv2.INTER_AREA )
					axis_range = [ ymin, y_screensize_in_px_scaled+ymin-1, ymin, y_screensize_in_px_scaled+ymin-1 ]
					rebin_ratio = (y_screensize_in_px_scaled)/y_len

				else:
					image_data_scaled = image_data
					axis_range = [ ymin, y_len-ymin-1, ymin, y_len-ymin-1 ]

			# larger than orig image, need to slice the image
			else:

				image_data_scaled = image_data[ ymin:ymax+1:1, ymin:ymax+1:1 ]

				# image resolution is too high, rebin
				if y_len_scaled>y_screensize_in_px:
					image_data_scaled = cv2.resize( image_data_scaled,
													(y_screensize_in_px, x_screensize_in_px),
													interpolation=cv2.INTER_AREA )
					axis_range = [ 0, x_screensize_in_px-1, 0, y_screensize_in_px-1 ]
					rebin_ratio = y_screensize_in_px/y_len_scaled

				else:
					axis_range = [ 0, ymax-ymin, 0, ymax-ymin ]

			time2 = time.time()
			print( "(", datetime.now(), ") output array, time =", (time2-time1)*1000.0 , "millisec",
					192*192/(time2-time1)/1000.0, "px/millisec" )
			time1 = time.time()

			# calculate the values of the coordinates
			#x_data = np.linspace( cxmin, cxmin+x_coordelta/rebin_ratio*(image_data_scaled.shape[0]-1), num=image_data_scaled.shape[0] )
			#y_data = np.linspace( cymin, cymin+y_coordelta/rebin_ratio*(image_data_scaled.shape[1]-1), num=image_data_scaled.shape[1] )
			#print( x_data, len(x_data), image_data_scaled.shape[0] )
			#print( y_data, len(y_data), image_data_scaled.shape[1] )

			# set the returning message
			return_message = ImageResponse()

			#return_message.image_data.extend( list(image_data_scaled.flatten()) )
			
			return_message.filename = filename

			for j in range( image_data_scaled.shape[1] ):
				row_data = return_message.image_data.add()
				row_data.row_data.extend( image_data_scaled[j] )

			return_message.image_width  = image_data_scaled.shape[0]
			return_message.image_height = image_data_scaled.shape[1]
			return_message.xmin = axis_range[0]
			return_message.ymin = axis_range[2]
			return_message.vmin = vmin
			return_message.vmax = vmax

			return_message.x_coor_min   = x_coor_min
			return_message.x_coor_delta = x_coordelta/rebin_ratio
			return_message.y_coor_min   = y_coor_min
			return_message.y_coor_delta = y_coordelta/rebin_ratio
			return_message.x_range_min = x_range_min
			return_message.x_range_max = x_range_max
			return_message.y_range_min = y_range_min
			return_message.y_range_max = y_range_max

			return_message.rebin_ratio = rebin_ratio
			
			return_message.task_start_time = message.send_start_time
			return_message.send_start_time = round(time1*1000.0)
			return_message_bytes = return_message.SerializeToString() # encode

			# send back message
			await websocket.send(return_message_bytes)
			print("(", datetime.now(), ") end task: sent image")

		# keep receiving message from the client
		async for message_bytes in websocket:
			print("test")
		

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
