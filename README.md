# Image Viewer
Read and display fits files
![](https://i.imgur.com/xz9YjZ2.png)

## Current Features
* interactive cube data display
    * focus zooming and panning: rebin the image to screen resolution
    * image information of the cursor position
    * adjust color scale
    * change image channels
* interactive image histogram
    * cube data histogram
* interactive x,y,z profile of the cursor position
    * focus zooming and panning
    * show cursor position

## Issues
* x axis coordinate is not shown when negative dx is used
* zooming is blocked when showing new profile data

## Future Work
* animation
* backend scheduling
* rebin x,y,z profile
* compress response message