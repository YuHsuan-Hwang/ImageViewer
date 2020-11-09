import numpy as np
import cv2

def RebinColumn( data, dim_new, mode ):
	
	dim_old = len( data[0] )

	binsize_new = dim_old / dim_new
	#print( binsize_new )

	rebin_matrix = np.zeros( (dim_old,dim_new) )

	index_old = 0 # going through every index in data
	fraction = 0 # remaining fraction for next data_new bin

	# calculate the transform fractions for every elements in new data
	for i in range(dim_new):

		# new bin size is large
		if fraction<=binsize_new:

			# add up remaining fraction from last loop
			if fraction!=0.0:
				rebin_matrix[index_old][i] = fraction
				#print( i , "front", index_old, fraction )
				index_old += 1

			# add up complete data bins
			for j in range( int(binsize_new-fraction) ):
				rebin_matrix[index_old][i] = 1.0
				#print( i , "middle", index_old, 1 )
				index_old += 1

			# add up incomplete data bins
			fraction = binsize_new-fraction-int(binsize_new-fraction)
			if (fraction>1e-5) | (index_old<dim_old) :
				rebin_matrix[index_old][i] = fraction
				#print( i , "back", index_old, fraction )
				fraction = 1-fraction
				if fraction==0: index_old += 1

		# new bin size is small
		else:
			rebin_matrix[index_old][i] = binsize_new
			#print( i , "iso", index_old, binsize_new )
			fraction = fraction-binsize_new
			if fraction==0: index_old += 1

	# perform the transform matrix
	data_new = np.dot(data, rebin_matrix)

	# manage the unit
	if mode == "avg": # for flux intensity (ex Jy/beam)
		data_new = data_new / np.array([binsize_new])
		#print( np.mean(data), np.mean(data_new) )
	#elif mode == "sum": # for flux
		#print( sum(data), sum(data_new) )

	return data_new


def Rebin( data, shape_new, mode="avg" ):

	# rebin the rows
	data = RebinColumn( data.T, shape_new[0], mode )
	data = data.T

	# rebin the columns
	return RebinColumn( data, shape_new[1], mode )


#test_data = np.array([[50.0, 7.0, 2.0, 0.0, 1.0],[0.0, 0.0, 2.0, 8.0, 4.0],[4.0, 1.0, 1.0, 0.0, 0.0]])

#print( test_data.dtype )
#print( Rebin( test_data, (3,2) ) )

#test_data_scaled  = cv2.resize( test_data, (2,3), interpolation=cv2.INTER_AREA )
#print( test_data_scaled )
