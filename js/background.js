var results={};
var defaultOptions={sites:[{url:"http://www.reuters.com"},
                           {url:"http://hosted.ap.org/"},
                           {url:"http://www.nytimes.com"},
                           {url:"http://www.washingtonpost.com"},
                           {url:"http://www.ft.com"},
                           {url:"http://www.bbc.co.uk/news"},
                           {url:"http://www.guardian.co.uk"},
                           {url:"http://www.dailymail.co.uk"},
                           {url:"http://www.telegraph.co.uk"},
                           {url:"http://www.prnewswire.com/"},
                           {url:"http://www.pcmag.com/"}
                          ]};

RegExp.escape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function saveOptions(options){
  localStorage.setItem("options",JSON.stringify(options));
  return options;
}

function restoreOptions(){
  var options=JSON.parse(localStorage.getItem("options"));
  return (options==null)?resetOptions():options;
}

function resetOptions(){
  localStorage.setItem("options",JSON.stringify(defaultOptions));
  return defaultOptions;
}

function getRegex(){
  var regex="";
  var sites=restoreOptions().sites;
  $.each(sites,function(index,value){
    regex+="^"+RegExp.escape(value.url);
    if (index!=sites.length-1){
      regex+="|";
    }
  })
  return new RegExp(regex);
}

function checkForValidUrl(tabId, changeInfo, tab) {
  if (changeInfo.status =="loading"){
    var sites=getRegex()
    if (sites.test(tab.url)) {
      chrome.pageAction.show(tabId);
      chrome.pageAction.setPopup({tabId:tabId,popup:""});
      chrome.tabs.executeScript(null,{file: "/js/jquery.js"});
//      chrome.tabs.executeScript(null,{file: "/js/readability.js"});
      chrome.tabs.executeScript(null,{file: "/js/content_script.js"});
    }
  }
};

var reduce_fragments = function (results) {
    var bounds = [];
    var rows = results.documents.rows;
    for (var row_idx in rows) {
        var row = rows[row_idx];
        for (var frag_idx in row.fragments) {
            var frag = row.fragments[frag_idx];
            bounds.push([frag[0], frag[0] + frag[2]]);
        }
    };


    var compare_bounds = function (a, b) {
        if (a[0] == b[0]) {
            return b[1] - a[1];
        } else {
            return a[0] - b[0];
        }
    };
    bounds.sort(compare_bounds);

    var subsumes = function (a, b) {
        return ((a[0] <= b[0]) && (b[1] <= a[1]));
    };

    var overlaps = function (a, b) {
        if ((a[0] <= b[0]) && (b[0] <= a[1])) {
            return true;
        } else if ((b[0] <= a[0]) && (a[0] <= b[1])) {
            return true;
        } else {
            return false;
        }
    };

    var idx = 0;
    var newbounds = [];
    while (bounds.length > 0) {
        var a = bounds.shift();

        if (bounds.length == 0) {
            newbounds.push([a[0], a[1]]);
        } else {
            while (bounds.length > 0) {
                var b = bounds.shift();
                if (subsumes(a, b)) {
                    /* Ignore b */
                } else if (subsumes(b, a)) {
                    /* Copy b to a */
                    a[0] = b[0];
                    a[1] = b[1];
                } else if (overlaps(a, b)) {
                    /* Merge a and b */
                    a[0] = Math.min(a[0], b[0]);
                    a[1] = Math.max(a[1], b[1]);
                } else {
                    /* Put b back on the stack. It will be the next a. */
                    bounds.unshift(b);
                    break;
                }
            }
            newbounds.push([a[0], a[1]]);
        }
    }
    return newbounds;
};

function handleMessage(request,sender,response){
  if (request.method=="articleExtracted"){
    console.log("Searching for content at: " + sender.tab.url);
    console.log(request.text);
    $.post("http://us.churnalism.com/search/",{text:request.text},function(data){
      console.log("Results received");
      results[sender.tab.id]=data;
      chrome.pageAction.setIcon({tabId:sender.tab.id,path:"/img/found.png"});
      chrome.pageAction.setPopup({tabId:sender.tab.id,popup:"/html/popup.html"});
      response({});
    });
  }else if(request.method == "paragraphExtracted") {
      var text = request.text;
      $.ajax({
          "type": "POST",
          "crossDomain": true,
          "url": "http://us.churnalism.com/search/", 
          "data": { "text": text },
          "success": function(results){ 
              chrome.pageAction.setIcon({tabId:sender.tab.id,path:"/img/found.png"});
              chrome.pageAction.setPopup({tabId:sender.tab.id,popup:"/html/popup.html"});
              var fragments = reduce_fragments(results);
              var matches = fragments.map(function(f){ 
                    return text.slice(f[0], f[1]);
              });
              response(matches);
          }
      });
  }else if(request.method=="getOptions"){
    response(restoreOptions());
  }else if(request.method=="saveOptions"){
    response(saveOptions(request.options));
  }else if(request.method=="resetOptions"){
    response(resetOptions());
  }
}

chrome.tabs.onUpdated.addListener(checkForValidUrl);
chrome.extension.onRequest.addListener(handleMessage);
