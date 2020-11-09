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

#from rebin import Rebin
import cv2

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
		dim = hdu_list[0].header['NAXIS']
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
		size_in_px = max( x_len, y_len )

		wcs = WCS(hdu_list[0].header).celestial
		hdu_list.close()

		# colorbar settings
		colMap = copy.copy( cm.get_cmap("viridis") )
		colMap.set_bad(color='C0')
		vmax = np.max( np.nan_to_num( image_data ) )
		vmin = np.min( np.nan_to_num( image_data ) )

		scale = 1
		
		time2 = time.time()
		print( 'read fits file done, time =', (time2-time1)*60.0 , 'millisec')

		# keep receiving message from the client
		async for message in websocket:

			time1 = time.time()

			# screen resolution
			x_screensize_in_px, y_screensize_in_px = 100,100 # should be 480*2, 480*2
			set_dpi = max(x_screensize_in_px, y_screensize_in_px)

			# image zoom fit
			if ( int(message)==-9999 ):

				scale = 1
				size_in_px_scaled = size_in_px

				# rebin and draw the image
				# image resolution is too high, rebin to low resolution (i.e. the screen size)
				if size_in_px>x_screensize_in_px:
					#print( np.nan_to_num(image_data).dtype )
					#image_data_scaled = Rebin(np.nan_to_num(image_data), (x_screensize_in_px, y_screensize_in_px))
					#print(image_data_scaled)
					image_data_scaled = cv2.resize( image_data, (y_screensize_in_px, x_screensize_in_px), interpolation=cv2.INTER_AREA )
					#print(image_data_scaled)
					#vmax = np.max(image_data_scaled)
					#vmin = np.min(image_data_scaled)
					fig = DrawFigure( image_data_scaled, colMap, vmin, vmax )
				# image resolution is low, plot the figure without rebinning
				else:
					#vmax = np.max(image_data)
					#vmin = np.min(image_data)
					fig = DrawFigure( image_data, colMap, vmin, vmax )
					set_dpi = size_in_px # lower the resolution of the output figure

			# image zoom in and out
			else:

				# calculate the scale
				scale += float(message)*0.01
				if scale <= 0.7: scale = 0.7
			
				# calcluate the new xmin and xmax
				size_in_px_scaled = int( size_in_px / scale )
				if size_in_px_scaled % 2 == 1 : size_in_px_scaled += 1
				xmin = int( size_in_px/2-size_in_px_scaled/2 )
				xmax = int( size_in_px/2+size_in_px_scaled/2-1 )

				# rebin and draw the image
				# smaller than orig image, need to manage the margin of the plotting
				if xmin<0:

					# image resolution is too high, rebin to low resolution (i.e. the screen size)
					if size_in_px_scaled>(x_screensize_in_px-2*xmin):
						#image_data_scaled = Rebin(np.nan_to_num(image_data), (x_screensize_in_px+2*xmin, y_screensize_in_px+2*xmin))
						image_data_scaled = cv2.resize(image_data, (y_screensize_in_px+2*xmin, x_screensize_in_px+2*xmin), interpolation=cv2.INTER_AREA)
						fig = DrawFigure( image_data_scaled, colMap, vmin, vmax, [xmin,x_screensize_in_px+xmin,x_screensize_in_px+xmin,xmin] )
					# image resolution is low, plot the figure without rebinning
					else:
						fig = DrawFigure( image_data, colMap, vmin, vmax, [xmin,x_screensize_in_px+xmin,x_screensize_in_px+xmin,xmin] )
						set_dpi = size_in_px # lower the resolution of the output figure

				# larger than orig image, need to slice the image
				else:

					image_data_scaled = image_data[xmin:xmax:1,xmin:xmax:1] # slice the image
					# image resolution is too high, rebin to low resolution (i.e. the screen size)
					if size_in_px>x_screensize_in_px:
						#image_data_scaled = Rebin(np.nan_to_num(image_data_scaled), (x_screensize_in_px, y_screensize_in_px))
						image_data_scaled = cv2.resize(image_data_scaled, (y_screensize_in_px, x_screensize_in_px), interpolation=cv2.INTER_AREA)
						fig = DrawFigure( image_data_scaled, colMap, vmin, vmax )
					# the px size of the image is large, just plot the figure without rebinning
					else:
						fig = DrawFigure( image_data, colMap, vmin, vmax )
						set_dpi = size_in_px # lower the resolution of the output figure

			time2 = time.time()
			print( 'resize and draw done, time =', (time2-time1)*60.0 , 'millisec')

			# save figure to png file
			image_png = BytesIO()
			fig.savefig( image_png, format='png', dpi=set_dpi )
			plt.close(fig) # close the figure
			#fig.savefig( "test.png", format='png', dpi=192 )

			# encode and send
			image_url = base64.encodebytes( image_png.getvalue() )
			await websocket.send("data:image/png;base64,"+image_url.decode('utf-8'))

			print("(", datetime.now(), ") sent")

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
