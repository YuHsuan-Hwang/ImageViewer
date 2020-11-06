#!/usr/bin/env python

import numpy as np

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

from rebin import Rebin


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

		# read fits file

		hdu_list = fits.open("../client/images/member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5_7_9_11.cont.I.pbcor.fits")
		#hdu_list = fits.open("../client/images/vla_3ghz_msmf.fits")。#too large
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
			
		px_size = max( x_len, y_len )

		wcs = WCS(hdu_list[0].header).celestial
		hdu_list.close()

		# colorbar settings
		colMap = copy.copy( cm.get_cmap("viridis") )
		colMap.set_bad(color='C0')
		#vmax = np.max(image_data)
		#vmin = np.min(image_data)

		scale = 1

		# keep receiving message from the client
		async for message in websocket:

			# screen resolution
			x_px_size_screen, y_px_size_screen = 100,100 # should be 480*2, 480*2
			set_dpi = max(x_px_size_screen, y_px_size_screen)

			# image zoom fit
			if ( int(message)==-9999 ):

				scale = 1
				px_size_scaled = px_size

				# rebin and draw the image
				# the px size of the image is too small, rebin to larger px size (i.e. the screen px size)
				if px_size<x_px_size_screen:
					image_data_scaled = Rebin(np.nan_to_num(image_data), (x_px_size_screen, y_px_size_screen))
					vmax = np.max(image_data_scaled)
					vmin = np.min(image_data_scaled)
					fig = DrawFigure( image_data_scaled, colMap, vmin, vmax )
				# the px size of the image is large, just plot the figure without rebinning
				else:
					vmax = np.max(np.nan_to_num(image_data))
					vmin = np.min(np.nan_to_num(image_data))
					fig = DrawFigure( image_data, colMap, vmin, vmax )
					set_dpi = px_size

			# image zoom in and out
			else:

				# calculate the scale
				scale += float(message)*0.01
				if scale <= 0.7: scale = 0.7
			
				# calcluate the new xmin and xmax
				px_size_scaled = int( px_size / scale )
				if px_size_scaled % 2 == 1 : px_size_scaled += 1
				xmin = int( px_size/2-px_size_scaled/2 )
				xmax = int( px_size/2+px_size_scaled/2-1 )

				# rebin and draw the image
				# smaller than orig image
				if xmin<0:

					# the px size of the image is too small, rebin to larger px size (i.e. the screen px size)
					if px_size_scaled<(x_px_size_screen-2*xmin):
						image_data_scaled = Rebin(np.nan_to_num(image_data), (x_px_size_screen+2*xmin, y_px_size_screen+2*xmin))
						fig = DrawFigure( image_data_scaled, colMap, vmin, vmax, [xmin,x_px_size_screen+xmin,x_px_size_screen+xmin,xmin] )
					# the px size of the image is large, just plot the figure without rebinning
					else:
						fig = DrawFigure( image_data, colMap, vmin, vmax, [xmin,x_px_size_screen+xmin,x_px_size_screen+xmin,xmin] )
						set_dpi = px_size

				# larger than orig image
				else:

					image_data_scaled = image_data[xmin:xmax:1,xmin:xmax:1] # slice the image
					# the px size of the image is too small, rebin to larger px size (i.e. the screen px size)
					if px_size_scaled<x_px_size_screen:
						image_data_scaled = Rebin(np.nan_to_num(image_data_scaled), (x_px_size_screen, y_px_size_screen))
						fig = DrawFigure( image_data_scaled, colMap, vmin, vmax )
					# the px size of the image is large, just plot the figure without rebinning
					else:
						fig = DrawFigure( image_data, colMap, vmin, vmax )
						set_dpi = px_size

			# save figure to png file
			image_png = BytesIO()
			fig.savefig( image_png, format='png', dpi=set_dpi )
			plt.close(fig)
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
