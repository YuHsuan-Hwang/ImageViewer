#!/usr/bin/env python

import numpy as np
import time

from datetime import datetime
import websockets

import asyncio

from astropy.io import fits
from astropy.wcs import WCS

import base64
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import copy

from io import BytesIO

import cv2

from protobufs.imageviewer_pb2 import ZoomRequest
from protobufs.imageviewer_pb2 import ImageResponse
def DrawFigure( image_data, colMap, vmin, vmax, axis_range=None ):

	# figure settings	
	fig = plt.figure()
	fig.set_size_inches(1,1)
	ax = plt.subplot()
	ax.axis('off')
	ax.set_frame_on(False)

	# draw the image
	ax.imshow(image_data, cmap=colMap, vmin=vmin, vmax=vmax)
	if ( axis_range!=None ):
		ax.axis( axis_range )
	fig.tight_layout(pad=0, h_pad=0, w_pad=0)
	ax.invert_yaxis()

	return fig


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
		hdu_list = fits.open("../client/images/member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5_7_9_11.cont.I.pbcor.fits")
		#hdu_list = fits.open("../client/images/vla_3ghz_msmf.fits")#too large
		#hdu_list = fits.open("../client/images/mips_24_GO3_sci_10.fits")

		#hdu_list.info()
		dim   = hdu_list[0].header['NAXIS' ]
		x_len = hdu_list[0].header['NAXIS1']
		y_len = hdu_list[0].header['NAXIS2']
		
		if dim==2:
			image_data = hdu_list[0].data
		elif dim==4:
			image_data = hdu_list[0].data[0][0]
		else:
			print("(", datetime.now(),"image fomat does not support")
			
		image_data = image_data.astype('float32')
		#image_data = np.nan_to_num( image_data )

		wcs = WCS(hdu_list[0].header).celestial
		hdu_list.close()

		# colorbar settings
		colMap = copy.copy( cm.get_cmap("viridis") )
		colMap.set_bad(color='C0')
		vmax = np.max( np.nan_to_num( image_data ) )
		vmin = np.min( np.nan_to_num( image_data ) )

		scale = 1.0
		
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

			# recognize the requested task
			#if message.event_type == EventType.ZOOM:

			print( "(", datetime.now(), ") start task: zoom image" )

			# scroll amount
			delta_y = message.zoom_deltay
				
			# screen resolution
			x_screensize_in_px, y_screensize_in_px = message.x_screensize_in_px, message.y_screensize_in_px # 500*2, 500*2
			x_screensize_in_px, y_screensize_in_px = int(x_screensize_in_px/10), int(y_screensize_in_px/10) # test with lower resolution: 100, 100

			print(x_screensize_in_px, y_screensize_in_px)

			# fit the size of image to the y axis
			set_dpi = y_screensize_in_px
			size_ratio = x_len / y_len
			screen_ratio = x_screensize_in_px / y_screensize_in_px

			time2 = time.time()
			print("(", datetime.now(), ") read message done, time: ", (time2-time1)*1000.0 , "millisec")
			time1 = time.time()
			
			size_in_px = y_len

			# image zoom fit
			if ( int(delta_y)==-9999 ):

				scale = 1
				size_in_px_scaled = size_in_px

				# rebin and draw the image
				# image resolution is too high, rebin to low resolution (i.e. the screen size)
				if size_in_px>x_screensize_in_px:
					image_data_scaled = cv2.resize( image_data, (y_screensize_in_px, x_screensize_in_px), interpolation=cv2.INTER_AREA )
				'''
					fig = DrawFigure( image_data_scaled, colMap, vmin, vmax )
				# image resolution is low, plot the figure without rebinning
				else:
					fig = DrawFigure( image_data, colMap, vmin, vmax )
					set_dpi = size_in_px # lower the resolution of the output figure
				'''
			# image zoom in and out
			else:

				# calculate the scale
				scale += float(delta_y)*0.01
				if scale <= 0.7: scale = 0.7
			
				if scale < 1.0: scale = 1.0 # turn of shrinking

				# calcluate the new xmin and xmax
				size_in_px_scaled = int( size_in_px / scale )
				if size_in_px_scaled % 2 == 1 : size_in_px_scaled += 1
				ymin = int( size_in_px/2-size_in_px_scaled/2 )
				ymax = int( size_in_px/2+size_in_px_scaled/2-1 )

				# rebin and draw the image
				# smaller than orig image, need to manage the margin of the plotting
				if ymin<0:

					# image resolution is too high, rebin to low resolution (i.e. the screen size)
					if size_in_px_scaled>(y_screensize_in_px-2*ymin):
						image_data_scaled = cv2.resize(image_data, (y_screensize_in_px+2*ymin, x_screensize_in_px+2*ymin), interpolation=cv2.INTER_AREA)
					'''
						fig = DrawFigure( image_data_scaled, colMap, vmin, vmax, [ymin,x_screensize_in_px+ymin,x_screensize_in_px+ymin,ymin] )
					# image resolution is low, plot the figure without rebinning
					else:
						fig = DrawFigure( image_data, colMap, vmin, vmax, [ymin,x_screensize_in_px+ymin,x_screensize_in_px+ymin,ymin] )
						set_dpi = size_in_px # lower the resolution of the output figure
					'''
				# larger than orig image, need to slice the image
				else:

					image_data_scaled = image_data[ymin:ymax:1,ymin:ymax:1] # slice the image
					# image resolution is too high, rebin to low resolution (i.e. the screen size)
					if size_in_px>x_screensize_in_px:
						image_data_scaled = cv2.resize(image_data_scaled, (y_screensize_in_px, x_screensize_in_px), interpolation=cv2.INTER_AREA)

					'''
						fig = DrawFigure( image_data_scaled, colMap, vmin, vmax )
					# the px size of the image is large, just plot the figure without rebinning
					else:
						fig = DrawFigure( image_data, colMap, vmin, vmax )
						set_dpi = size_in_px # lower the resolution of the output figure
					'''
			time2 = time.time()
			print( "(", datetime.now(), ") resize and draw done, time =", (time2-time1)*1000.0 , "millisec")
			time1 = time.time()

			'''			
			# save figure to png file
			image_png = BytesIO()
			fig.savefig( image_png, format='png', dpi=set_dpi )
			plt.close(fig) # close the figure
			#fig.savefig( "test.png", format='png', dpi=192 )

			# encode png file
			image_url = base64.encodebytes( image_png.getvalue() )
			image_url = image_url.decode('utf-8')
			time2 = time.time()
			print( "(", datetime.now(), ") encode png file done, time =", (time2-time1)*1000.0 , "millisec")
			time1 = time.time()
			'''
			
			# set the returning message
			return_message = ImageResponse()
			#return_message.image_url = "data:image/png;base64,"+image_url
			return_message.image_data.extend( list(image_data_scaled.flatten()) )
			return_message.image_width = image_data_scaled.shape[0]
			return_message.image_height = image_data_scaled.shape[1]
			return_message.task_start_time = message.send_start_time
			return_message.send_start_time = round(time1*1000.0)
			return_message_bytes = return_message.SerializeToString() # encode

			# send back message
			await websocket.send(return_message_bytes)
			print("(", datetime.now(), ") end task: sent image")

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
