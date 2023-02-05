// - njs script to evaluate hashing for a site and compare it
export default {check};

//function used to delay requests with await command
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

//variables definition for body and hashing to calculate. hash is for the production server, hash2 is for the mirror server
var body ="";
var hash = "";
var hash2 = "";

// main function triggered by the healthcheck
async function check(r) {
  r.warn('hash calculation started');
  var rUri=r.uri;
  main_call (r.variables.server, r.variables.dest_url);
  await delay(30000);
  main_call (r.variables.mirror_server, r.variables.mirror_dest_url);
  

//fuction performing all the calls for the production and mirror server
  async function main_call (server, url){ 
    var fullURL = '/healthCheck/' + encodeURI(url);        // creates the uri to call for the index
    r.subrequest(fullURL,'',subReqCallback);               // subrequest to get the initial body where to fetch the other URIs.
    await delay(1000);                                     // wait one sec to get the response
    var linkReg = /\b(?<=href="|src=")(.*?)(?="|\?)/g;     // variable to set the regex to use for gathering the other URIs from the index
    var urls = body.match (linkReg) ;                      // regex applied to the index page
    const uri_array = urls.toString().split(',');          // split of the URIs set in an array
    const uri_array_final=remove_duplicate (uri_array);    // call to the remove_duplicate function to search and remove duplicated URIs

    print_array (uri_array_final);                       // can be used for troubleshooting to see the URIs got from the index page
    looping_for_hashing (server, uri_array_final);         // call to the loop function to fetch content in the body variable from other URIs
  }


  function subReqCallback(reply) {
    var backend_server_entry = r.variables.backend_server_entry;
    if(reply.status!=200 && reply.uri.startsWith(r.variables.server) ) {
      r.warn('Healthcheck: server #[' + reply.uri + '] is down because of ['+reply.status+']');
      r.subrequest("/upstream/down/" + backend_server_entry,postUpstreamUpdate);
    } else {
      r.warn('Healthcheck: server #[' + reply.uri + '] is up because of ['+reply.status+']');
      // HTTP response code is 200/OK
      body= body + reply.responseText;
	return (body);
    }
  }


  async function looping_for_hashing (server, uri_array) {
    var backend_server_entry = "1";  
    let i = 0;
    while (i < uri_array.length) {
	    r.warn('--> Running healthcheck');
	    r.warn('Client['+r.remoteAddress+'] Method['+r.method+'] URI['+rUri+'] QueryString['+uri_array[i]+'] Checking ['+encodeURI(uri_array[i])+']');
	    var fullURL = '/healthCheck/' + server +  encodeURI(uri_array[i]);
            r.warn('FullURL is:['+fullURL+']');
	    r.subrequest(fullURL,'',subReqCallback);
	    await delay(1000);
	    i++;
   	    }
       if ( server == r.variables.server ) {
	       hash = calculate_hashing (body);
	       r.warn('Page hash for ['+server+'] is: ['+hash+']');
	       body = "";
	       return hash;
       } else {
	       var hash2 = calculate_hashing (body);
	       r.warn('Page hash for ['+server+'] is: ['+hash2+']');
       }
       if ( hash == hash2 ) {
	       r.warn('hash for ['+r.variables.server+'] and hash2 for ['+r.variables.mirror_server+'] are matching');
	       r.warn('Healthcheck: server #[' + r.variables.server + '] is up');
	     	  r.subrequest("/upstream/up/" + backend_server_entry,postUpstreamUpdate);
       }else {
	       r.warn('hash for ['+r.variables.server+'] and hash2 for ['+r.variables.mirror_server+'] are NOT matching');
	       r.warn('Healthcheck: server #[' + r.variables.server + '] is down');
	     	 r.subrequest("/upstream/down/" + backend_server_entry,postUpstreamUpdate);
       }
       body = "";
  }  
  

  function calculate_hashing (body) {
    sizeOfObject (body);
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256')
    .update(body)
    .digest('hex');
    return hash;
  }


  function remove_duplicate (array) {
    var collector = {};
    for (var i = 0; i < array.length; i++) {
    key = array[i].replace(/^\s*/, "").replace(/\s*$/, "");
    collector[key] = true;
  }
    var uri_array_temp = [];
    for (var key in collector) {
      uri_array_temp.push(key);
    }
    const uri_array_temp2 = uri_array_temp.join(',');
    const uri_array_final = uri_array_temp2.toString().split(',');
    return uri_array_final;
  }


  function postUpstreamUpdate(upstreamUpdateRequest) {
    r.warn('NGINX API Response: '+upstreamUpdateRequest.responseText);

    for (var header in upstreamUpdateRequest.headersOut) {
      //r.warn('header ['+header+'] = ['+upstreamUpdateRequest.headersOut[header] + ']');
      r.headersOut[header] = upstreamUpdateRequest.headersOut[header];
    }

    r.status=200;
    r.sendHeader();
    if (upstreamUpdateRequest.responseText)
      r.send(upstreamUpdateRequest.responseText);
    r.finish();
  }


// Functions below can be used just for troubleshooting. 
	
  function check_array(array) {
    if (Array.isArray(array)) {
	    r.warn('Array is ok and its lenght is ['+array.length+']');
    } else { 
	    r.warn('Array is not ok');
    }
  }

	
  function check_string(myVar) {
    if (typeof myVar  === 'string' || myVar instanceof String) {
            r.warn('String is ok');
    } else {
            r.warn('String is not ok');
    }
  }


  function print_array(array) {
    var j=0;
    while ( j  < array.length) {
     r.warn('Array is:\n['+array[j]+']');
  j++;
    }
  }


  function sizeOfObject( object ) {
    var objectList = [];
    var stack = [ object ];
    var bytes = 0;
    while ( stack.length ) {
        var value = stack.pop();
        if ( typeof value === 'boolean' ) {
            bytes += 4;
        }
        else if ( typeof value === 'string' ) {
            //bytes += value.length * 2;
	    bytes += value.length;
        }
        else if ( typeof value === 'number' ) {
            bytes += 8;
        }
        else if
        (
            typeof value === 'object'
            && objectList.indexOf( value ) === -1
        )
        {
            objectList.push( value );

            for( var i in value ) {
                stack.push( value[ i ] );
            }
        }
    }
    r.warn('Size is:['+bytes+']');
  } 

}

