// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri(d){for(var a=parseUri.options,d=a.parser[a.strictMode?"strict":"loose"].exec(d),c={},b=14;b--;)c[a.key[b]]=d[b]||"";c[a.q.name]={};c[a.key[12]].replace(a.q.parser,function(d,b,e){b&&(c[a.q.name][b]=e)});return c}
parseUri.options={strictMode:!1,key:"source,protocol,authority,userInfo,user,password,host,port,relative,path,directory,file,query,anchor".split(","),q:{name:"queryKey",parser:/(?:^|&)([^&=]*)=?([^&]*)/g},parser:{strict:/^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,loose:/^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/}};
// End parseUri


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
        },
        { url: "online.wsj.com"
        },
        { url: "www.usatoday.com"
        },
        { url: "www.latimes.com"
        },
        { url: "www.mercurynews.com"
        },
        { url: "www.washingtonpost.com"
        },
        { url: "www.nypost.com"
        },
        { url: "www.nydailynews.com"
        },
        { url: "www.denverpost.com"
        },
        { url: "www.freep.com"
        },
        { url: "www.jsonline.com"
        },
        { url: "www.chicagotribune.com"
        },
        { url: ".cnn.com"
        },
        { url: ".time.com"
        },
        { url: "www.miamiherald.com"
        },
        { url: "www.startribune.com"
        },
        { url: "www.newsday.com"
        },
        { url: "www.azcentral.com"
        },
        { url: "www.chron.com"
        },
        { url: "www.suntimes.com"
        },
        { url: "www.dallasnews.com"
        },
        { url: "www.mcclatchydc.com"
        },
        { url: "www.scientificamerican.com"
        },
        { url: "www.sciencemag.org"
        },
        { url: "www.newscientist.com"
        }
    ],
    search_server: 'http://127.0.0.1:7000',
    submit_urls: false
};

function saveOptions(options){
    localStorage.setItem("options",JSON.stringify(options));
    whitelist = compileWhitelist(options.sites);
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

var onWhitelist = function (location) {
    // This function is replaced by compileWhitelist
    return false;
};

var compileWhitelist = function () {
    var sites = restoreOptions().sites;

    var host_matcher = function (s) {
        if (s[0] == '.') {
            return function (location) {
                return (location.host.slice(-s.length) == s);
            };
        } else {
            return function (location) {
                return (location.host == s);
            };
        }
    };

    var path_matcher = function (s) {
        var wild_prefix = (s.slice(0, 3) == '...');
        var wild_suffix = (s.slice(-3) == '...');
        if (wild_prefix && wild_suffix) {
            return function (location) {
                return (location.pathname.indexOf(s) >= 0);
            };
        } else if (wild_prefix) {
            return function (location) {
                return (location.pathname.slice(-s.length) == s);
            };
        } else if (wild_suffix) {
            return function (location) {
                return (location.pathname.slice(0, s.length) == s);
            };
        } else {
            return function (location) {
                return (location.pathname == s);
            };
        }
    };

    var matchers = sites.map(function(site){
        var slash_offset = site.url.indexOf('/');
        if (slash_offset == 0) {
            return path_matcher(site.url);
        } else if (slash_offset == -1) {
            return host_matcher(site.url);
        } else {
            var hostpart = site.url.slice(0, slash_offset);
            var pathpart = site.url.slice(slash_offset - 1);
            return function (location) {
                return host_matcher(hostpart)(location) && path_matcher(pathpart)(location);
            };
        };
    });

    // Replaces onWhitelist in outer scope.
    onWhitelist = function (location) {
        for (var idx = 0; idx < matchers.length; idx++) {
            var matcher = matchers[idx];
            if (matcher(location)) {
                return true;
            }
        }
        return false;
    };
};

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

var checkForValidUrl = function (tab) {
    text[tab.id] = null;
    results[tab.id] = null;

    var loc = parseUri(tab.url);
    if (onWhitelist({'host': loc.host, 'pathname': loc.path})) {
        chrome.pageAction.show(tab.id);
        chrome.pageAction.setPopup({tabId:tab.id,popup:""});

        chrome.tabs.insertCSS(tab.id, {file: "/css/churnalism.css"});
        executeScriptsSynchronously(tab, [
            "/js/jquery-1.7.1.min.js",
            "/js/extractor.js",
            "/js/content_script.js"
        ]);
    }
};

var requestIFrameInjection = function (tab) {
/*
    var result = results[tab.id];
    if (result == null)
        return;

    var hit_count = result['documents']['rows'].length;
    if (hit_count == 0)
        return;
*/
    var options = restoreOptions();
    var url = options.search_server + '/sidebyside/chrome/search/';
    var query_params = {
        'title': titles[tab.id]
    };
    if (options.submit_urls) {
        query_params['url'] = tab.url;
    } else {
        query_params['text'] = text[tab.id];
    }
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

var handleTabUpdate = function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'loading') {
        checkForValidUrl(tab);
    }
};

var handleMessage = function (request, sender, response) {
    console.log(request.method, request, sender);
    if (request.method == "articleExtracted") {
        var options = restoreOptions();

        var query_params = {
            'title': request.title
        };
        if (options.submit_urls) {
            query_params['url'] = request.url;
        } else {
            query_params['text'] = request.text;
        }
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
                } else {
                    chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/nonefound.png"});
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

var options = restoreOptions();
compileWhitelist(options.sites);

chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.pageAction.onClicked.addListener(requestIFrameInjection);
chrome.extension.onRequest.addListener(handleMessage);
