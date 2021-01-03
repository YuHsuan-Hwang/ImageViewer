# Image Viewer
Read and display fits files
![](https://i.imgur.com/q2EtFt9.png)

## Current Features
![](https://i.imgur.com/CouzK3w.png)
* main panel
    * interactive cube image display
    * focus zoom and pan
    * rebin the image to screen resolution
    * information of the cursor position
    * adjust color scale
    * change image channels
* histogram panel
    * interactive image histogram display
    * focus zoom and pan
    * cube histogram calculation
    * color scale settings
* profile panels
    * interactive x,y,z profile of the cursor position
    * focus zoom and pan
* channel panel
    * switch channels

## Issues
* x axis coordinate is not shown when negative dx is used
* zooming is blocked when showing new profile data

## Future Work
* animation
* backend scheduling
* rebin x,y,z profile
* compress response message