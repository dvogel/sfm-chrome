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
        "www.reuters.com",
        "hosted.ap.org",
        ".nytimes.com",
        "www.washingtonpost.com",
        "www.ft.com",
        "www.bbc.co.uk/news/...",
        "www.guardian.co.uk",
        "www.dailymail.co.uk",
        "www.telegraph.co.uk",
        "www.prnewswire.com",
        "www.pcmag.com",
        "online.wsj.com",
        "www.usatoday.com",
        "www.latimes.com",
        "www.mercurynews.com",
        "www.washingtonpost.com",
        "www.nypost.com",
        "www.nydailynews.com",
        "www.denverpost.com",
        "www.freep.com",
        "www.jsonline.com",
        "www.chicagotribune.com",
        ".cnn.com",
        ".time.com",
        "www.miamiherald.com",
        "www.startribune.com",
        "www.newsday.com",
        "www.azcentral.com",
        "www.chron.com",
        "www.suntimes.com",
        "www.dallasnews.com",
        "www.mcclatchydc.com",
        "www.scientificamerican.com",
        "www.sciencemag.org",
        "www.newscientist.com",
    ],
    use_generic_news_pattern: false,
    search_server: 'http://127.0.0.1:7000',
    submit_urls: false
};

function saveOptions(options){
    localStorage.setItem("options",JSON.stringify(options));
    compileWhitelist();
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
    var options = restoreOptions();
    var sites = options.sites;

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
            var literal_suffix = s.slice(3);
            return function (location) {
                return (location.pathname.slice(-literal_suffix.length) == literal_suffix);
            };
        } else if (wild_suffix) {
            var literal_prefix = s.slice(0, -3);
            return function (location) {
                return (location.pathname.slice(0, literal_prefix.length) == literal_prefix);
            };
        } else {
            return function (location) {
                return (location.pathname == s);
            };
        }
    };

    var matchers = sites.map(function(site_pattern){
        var slash_offset = site_pattern.indexOf('/');
        if (slash_offset == 0) {
            return path_matcher(site_pattern);
        } else if (slash_offset == -1) {
            return host_matcher(site_pattern);
        } else {
            var hostpart = site_pattern.slice(0, slash_offset);
            var pathpart = site_pattern.slice(slash_offset);
            return function (location) {
                return host_matcher(hostpart)(location) && path_matcher(pathpart)(location);
            };
        };
    });

    if (options.use_generic_news_pattern == true) {
        matchers.push(function(loc){
            return /(news|article)/.test(loc.host + loc.pathname);
        });
    }

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
compileWhitelist();

chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.pageAction.onClicked.addListener(requestIFrameInjection);
chrome.extension.onRequest.addListener(handleMessage);
