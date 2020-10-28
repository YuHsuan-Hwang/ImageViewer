'use strict';

// define the elements in the webpage
let btnOpen = document.getElementById("btn-open");
let imgMain = document.getElementById("img-main");

// setup connection with the server
let ws = new WebSocket("ws://localhost:5675/");

// update the status if the connection is opened
ws.onopen = function(event) {
	console.log(new Date(),"connection established");
};

// update the status if the connection is closed
ws.onclose = function(event) {
	if (event.wasClean) {
		console.log(new Date(),"connection closed cleanly");
	} else {
		console.log(new Date(),"connection lost");
	}
};

// response when choose a image file
function OnChange(element) {

	let callback = function(){

		let hdu = this.getHDU();
		let header = hdu.header;
		console.log(header);
		let dataunit = hdu.data;
		console.log(dataunit);

		console.log(dataunit.blob);

		let reader = new FileReader();
		reader.readAsArrayBuffer(dataunit.blob);
		reader.onloadend = (event) => {
			console.log(reader.result);
			ws.send(reader.result);

			//let view = new Float32Array(reader.result);
			//console.log(view);
		}

	}

	let fits = new astro.FITS( element.files[0], callback );

/*
	// read the image file
  let image = element.files[0];

	// obtain the 64base url of the image and send to the server
	let image_url;
  let reader = new FileReader();
  reader.onloadend = function() {
    image_url = reader.result;
		console.log("url: ",image_url);
		ws.send(image_url); // send to server
  }
  reader.readAsDataURL(image); // convert image to 64base url
*/

}

// receive message from the server
ws.onmessage = function(event){

	imgMain.src = event.data

};

