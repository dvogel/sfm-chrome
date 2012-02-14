var results = {};
var titles = {};
var text = {};
var defaultOptions = {
    sites: [
        { url: "www.reuters.com" 
        },
        { url: "hosted.ap.org" 
        },
        { url: ".nytimes.com" 
        },
        { url: "www.washingtonpost.com" 
        },
        { url: "www.ft.com" 
        },
        { url: "www.bbc.co.uk/news" 
        },
        { url: "www.guardian.co.uk" 
        },
        { url: "www.dailymail.co.uk" 
        },
        { url: "www.telegraph.co.uk" 
        },
        { url: "www.prnewswire.com" 
        },
        { url: "www.pcmag.com" 
        }
    ],
    search_server: 'http://127.0.0.1:7000',
    submit_urls: false
};

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

RegExp.escape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function getRegex () {
    // FIXME: parse the URL to avoid mattching things like 'www.nytimes.nyud.net'
    var sites = restoreOptions().sites;
    var pattern = "^http[s]?://(__)".replace("__", sites.map(function(site){
        if (site.url.substr(0, 1) == '.') {
            return '[^/]+' + RegExp.escape(site.url);
        } else {
            return RegExp.escape(site.url);
        }
    }).join("|"));
    return new RegExp(pattern);
}

var executeScriptsSynchronously = function (tab, files, callback) {
    if (files.length > 0) {
        var file = files[0];
        var rest = files.slice(1);
        chrome.tabs.executeScript(tab.id, {file: file}, function(){
            if (rest.length > 0) {
                executeScriptsSynchronously(tab, rest, callback);
            } else if (callback) {
                callback.call(null);
            }
        });
    }
};

function checkForValidUrl(tabId, changeInfo, tab) {
    if (changeInfo.status == 'loading') {
        text[tabId] = null;
        results[tabId] = null;

        var sites = getRegex();
        if (sites.test(tab.url)) {
            chrome.pageAction.show(tabId);
            chrome.pageAction.setPopup({tabId:tabId,popup:""});

            chrome.tabs.insertCSS(tab.id, {file: "/css/churnalism.css"});
            executeScriptsSynchronously(tab.id, [
                "/js/jquery-1.7.1.min.js",
                "/js/readability.js",
                "/js/content_script.js"
            ]);
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

var requestIFrameInjection = function (tab) {
    var result = results[tab.id];
    if (result == null)
        return;

    var hit_count = result['documents']['rows'].length;
    if (hit_count == 0)
        return;

    var options = restoreOptions();
    var url = options.search_server + '/sidebyside/chrome/search/';
    var query_params = {
        'text': text[tab.id],
        'title': titles[tab.id]
    };
    $.ajax({
        "type": "POST",
        "crossDomain": false,
        "cache": true,
        "url": url,
        "data": query_params,
        "success": function(iframe_content){
            var req = {
                'method': 'injectIFrame',
                'content': iframe_content
            };
            chrome.tabs.sendRequest(tab.id, req);
        },
        "error": function(xhr, text_status, error_thrown) {
            var req = {
                'method': 'injectIFrame',
                'content': xhr.response
            };
            chrome.tabs.sendRequest(tab.id, req);
        }
    });
};

var handleMessage = function (request, sender, response) {
    if (request.method == "articleExtracted") {
        var options = restoreOptions();

        var query_params = {
            'title': request.title,
            'text': request.text,
            'url': (options.submit_urls == true) ? request.url : null
        };
        text[sender.tab.id] = request.text;
        titles[sender.tab.id] = request.title;
        var url = options.search_server + '/api/search/';
        $.ajax({
            "type": "POST",
            "crossDomain": false,
            "cache": true,
            "url": url,
            "data": query_params,
            "success": function(result){ 
                if (result['documents']['rows'].length > 0) {
                    chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/found.png"});
                }
                results[sender.tab.id] = result;
                response(result);
            }
        });

    } else if (request.method == 'whoami?') {
        response(sender.tab);

    } else if (request.method == "getOptions") {
        response(restoreOptions());

    } else if (request.method == "saveOptions") {
        response(saveOptions(request.options));

    } else if (request.method == "resetOptions") {
        response(resetOptions());

    } else if (request.method == "log") {
        console.log(request.args);
    }
}

chrome.tabs.onUpdated.addListener(checkForValidUrl);
chrome.pageAction.onClicked.addListener(requestIFrameInjection);
chrome.extension.onRequest.addListener(handleMessage);
