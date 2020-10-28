#!/usr/bin/env python

import numpy as np

from datetime import datetime
import websockets

import asyncio

from astropy.io import fits
from astropy.wcs import WCS

import base64
import matplotlib.pyplot as plt

from io import BytesIO

# construct the task of a client connection
async def OneClientTask(websocket, path):
	
	# show the number of clients when new client is connected
	global client_num
	client_num += 1
	print("(", datetime.now(), ") established one connection to ", websocket.remote_address[0],",", client_num, "client connected")
	print()

	try:

		# keep receiving message from the client
		async for message in websocket:
			print("(", datetime.now(), ") work begin")

			#print(message)
						
			#hdu_list = fits.open("../client/images/member.uid___A001_X12a2_X10d._COS850.0005__sci.spw5_7_9_11.cont.I.pbcor.fits")
			#hdu_list.info()
			#image_data = hdu_list[0].data[0][0]
			#wcs = WCS(hdu_list[0].header).celestial
			#hdu_list.close()

			print( "received!" )
			
			image_data = np.nan_to_num( np.reshape( np.frombuffer(message, dtype=np.float32), (192,192) ) )
			image_png = BytesIO()

			fig = plt.figure()
			ax = plt.subplot()#projection=wcs)
			cm = ax.imshow(image_data)
			#fig.colorbar( cm, ax=ax )
			#plt.gca().invert_yaxis()
			ax.axis('off')
			fig.savefig( image_png, format='png', bbox_inches ='tight' )			

			image_url = base64.encodebytes( image_png.getvalue() )
			await websocket.send("data:image/png;base64,"+image_url.decode('utf-8'))
			
			#plt.show()	

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
