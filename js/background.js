// These thresholds default to impossibly high values
// which effectively disable the extension unless the
// values can be updated by bootstrap.
var Params = {
    'MINIMUM_COVERAGE_PCT': Number.MAX_VALUE,
    'MINIMUM_COVERAGE_CHARS': Number.MAX_VALUE,
    'WARNING_RIBBON_SRC': '/sidebyside/chrome/ribbon/'
};

var LocalNews = [
];

Backbone.sync = function(method, model, options) {
    /* Do nothing */
};

var TabState = Backbone.Model.extend({
    defaults: function () {
        return {
            id: null,
            url: null,
            search_result: null,
            article_text: null,
            article_title: null
        };
    },

    initialize: function (options) {
        this.on('change:url', function(){
            this.set({
                'article_text': null,
                'article_title': null,
                'search_result': null
            });
        }, this);
    }
});

var TabStates = Backbone.Collection.extend({
    model: TabState,

    get_or_create: function (id) {
        var mdl = this.get(id);
        if (mdl == null) {
            return this.create({'id': id});
        } else {
            return mdl;
        }
    }
});

var Tabs = new TabStates();

var defaultOptions = {
    sites: [
        "www.google.com/hostednews/...",
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
        ".usatoday.com",
        "www.latimes.com",
        "www.mercurynews.com",
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
        "www.npr.org",
        "www.techcrunch.com",
        ".politico.com",
        "thehill.com",
        ".rollcall.com",
        ".talkingpointsmemo.com",
        "www.bloomberg.com",
        ".businessweek.com",
        "www.csmonitor.com",
        "timesofindia.indiatimes.com",
        ".aljazeera.com",
        "news.smh.com.au",
        "news.yahoo.com",
        ".msnbc.msn.com"
    ],
    include_local_news: true,
    use_generic_news_pattern: false,
    search_server: 'http://churnalism.sunlightfoundation.com',
    submit_urls: false
};

var bootstrap = function (callback) {
    var options = restoreOptions();
    
    var url = options.search_server + '/sidebyside/chrome/parameters/';
    $.ajax({
        "type": "GET",
        "url": url
    }).success(function(result){
        for (var key in result) {
            var key1 = key.toUpperCase();
            if (Params.hasOwnProperty(key1)) {
                var current_value = Params[key1];
                var new_value = result[key];
                if (typeof(current_value) == typeof(new_value)) {
                    console.log('Accepting remote setting', key1, current_value, new_value);
                    Params[key1] = result[key];
                }
            }
        }
    
        // Update these settings same time tomorrow
        setTimeout(bootstrap, 86400000);
    }).error(function(){
        // Try again in an hour
        setTimeout(bootstrap, 3600000);
    }).then(function(){
        $.get(options.search_server + '/static/chromeext/localnews.json').success(function(result){
            LocalNews = result;
            LocalNews.sort();
            console.log("Fetched " + LocalNews.length + " local news sites.");
        }).then(compileWhitelist);
    });
};

var saveOptions = function (options){
    localStorage.setItem("options",JSON.stringify(options));
    compileWhitelist();
    return options;
};

var restoreOptions = function (){
    var options=JSON.parse(localStorage.getItem("options"));
    return (options==null)?resetOptions():options;
};

var resetOptions = function (){
    localStorage.setItem("options",JSON.stringify(defaultOptions));
    return defaultOptions;
};

var onWhitelist = function (location) {
    // This function is replaced by compileWhitelist
    return false;
};

var compileWhitelist = function () {
    console.log("Recompiling onWhitelist");

    var options = restoreOptions();
    var sites = options.sites;

    if (options.include_local_news == true) {
        for (var idx = 0; idx < LocalNews.length; idx++) {
            var s = LocalNews[idx];
            if (sites.indexOf(s) == -1) {
                sites.push(s);
            }
        }
    }

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
            return /(news|article)/i.test(loc.host + loc.pathname);
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

var executeScriptsSynchronously = function (tab_id, files, callback) {
    if (files.length > 0) {
        var file = files[0];
        var rest = files.slice(1);
        chrome.tabs.executeScript(tab_id, {file: file}, function(){
            if (rest.length > 0) {
                executeScriptsSynchronously(tab_id, rest, callback);
            } else if (callback) {
                callback.call(null);
            }
        });
    }
};


var sufficient_coverage = function (row) {
    return ((row['coverage'][0] >= Params['MINIMUM_COVERAGE_CHARS']) 
            && (Math.round(row['coverage'][1]) >= Params['MINIMUM_COVERAGE_PCT']));
};

var select_search_result = function (search_results, predicate) {
    var rows = search_results['documents']['rows'];
    return rows.reduce(function(state, row){
        var attr = predicate(row);
        if (attr > state[0]) {
            return [attr, row];
        } else {
            return state;
        }
    }, [null, null])[1];
};

var with_best_search_result = function (text, results, next) {
    var row_coverage_and_density = function(row){ return row['coverage'][0] + row['density']; };
    var best = select_search_result(results, row_coverage_and_density);
    next(best);
};
    
var checkForValidUrl = function (tab) {
    if (Params['MINIMUM_COVERAGE_PCT'] == Number.MAX_VALUE)
        return;

    var loc = parseUri(tab.get('url'));
    if (onWhitelist({'host': loc.host, 'pathname': loc.path})) {
        chrome.pageAction.show(tab.get('id'));
        chrome.pageAction.setPopup({'tabId': tab.get('id'), 'popup': ''});

        chrome.tabs.insertCSS(tab.get('id'), {file: "/css/churnalism.css"});
        executeScriptsSynchronously(tab.get('id'), [
            "/js/jquery-1.7.1.min.js",
            "/js/jquery-ui-1.8.20.custom.min.js",
            "/js/extractor.js",
            "/js/content_script.js"
        ]);
    }
};

var comparisonUrl = function (uuid, doctype, docid) {
    var options = restoreOptions();
    var url = options.search_server + '/sidebyside/chrome/__UUID__/__DOCTYPE__/__DOCID__/';
    url = url.replace('__UUID__', uuid)
             .replace('__DOCTYPE__', doctype)
             .replace('__DOCID__', docid);
    return url;
};

var requestIFrameInjection = function (chromeTab) {
    var tab = Tabs.get(chromeTab.id);
    if (tab == null) {
        throw 'Unknown tab (' + chromeTab.id + ') -- the world is falling apart!';
    }

    var options = restoreOptions();
    var url = options.search_server + '/sidebyside/chrome/__UUID__/__DOCTYPE__/__DOCID__/';
    var search_result = tab.get('search_result');
    if ((search_result == null) || (search_result['documents']['rows'].length == 0))
        return;

    with_best_search_result(tab.get('article_text'), search_result, function(best_match){
        var req = {
            'method': 'injectIFrame',
            'url': comparisonUrl(search_result.uuid,
                                 best_match.doctype,
                                 best_match.docid)
        };
        chrome.tabs.sendRequest(tab.get('id'), req);
    });
};

var handleMessage = function (request, sender, response) {
    console.log(request.method, request, sender);
    if (request.method == "articleExtracted") {
        if (request.text.length == 0) {
            chrome.pageAction.hide(sender.tab.id);
            return;
        }

        var options = restoreOptions();

        var tab = Tabs.get(sender.tab.id);

        var prior_result = tab.get('search_result');
        if (prior_result == null) {
            var query_params = {
                'title': request.title,
                'text': request.text
            };
            if (options.submit_urls) {
                query_params['url'] = request.url;
            } else {
            }
            tab.set({
                'article_text': request.text,
                'article_title': request.title
            });

            var url = options.search_server + '/api/search/';
            $.ajax({
                "type": "POST",
                "url": url,
                "data": query_params
            }).success(function(result){
                with_best_search_result(request.text, result, function(best_match){
                    if (best_match && sufficient_coverage(best_match)) {
                        chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/found.png"});
                        chrome.pageAction.setTitle({tabId: sender.tab.id, title: "Churnalism Alert!"});
                        chrome.pageAction.setPopup({tabId: sender.tab.id, popup: ""});

                        var req = {
                            'method': 'injectWarningRibbon',
                            'src': options.search_server + Params['WARNING_RIBBON_SRC'],
                            'match': {
                                'url': comparisonUrl(result.uuid,
                                                     best_match.doctype,
                                                     best_match.docid)
                            }
                        };
                        chrome.tabs.sendRequest(sender.tab.id, req);

                    } else {
                        chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/nonefound.png"});
                        chrome.pageAction.setTitle({tabId: sender.tab.id, title: "This page is Churnalism-free"});
                        chrome.pageAction.setPopup({tabId: sender.tab.id, popup: "/html/explainnomatch.html?tabId=" + sender.tab.id});
                    }
                });
                tab.set({'search_result': result});
                response(result);
            }).error(function(xhr, text_status, error_thrown){
                chrome.pageAction.hide(tab.get('id'));
            });

        } else {
            // Older Chrome versions don't provide the webNavigation API so we have to rely on the
            // tabs.onUpdated event to signal when to extract the article text. Unfortunately this leads
            // to multiple article extractions and we don't want to make a network request for each.
            with_best_search_result(tab.get('article_text'), prior_result, function(best_match){
                if (best_match && sufficient_coverage(best_match)) {
                    chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/found.png"});
                    chrome.pageAction.setPopup({tabId: sender.tab.id, popup: ""});
                } else {
                    chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/nonefound.png"});
                    chrome.pageAction.setTitle({tabId: sender.tab.id, title: "This page is Churnalism-free"});
                    chrome.pageAction.setPopup({tabId: sender.tab.id, popup: "/html/explainnomatch.html"});
                }
            });
        }

    } else if (request.method == 'getAllBrowserTabs') {
        chrome.windows.getAll({populate: true}, function(windows){
            var tabs = [];
            jQuery(windows).each(function(winIdx, win){
                jQuery(win.tabs).each(function(tabIdx, tab) {
                    tabs.push(tab);
                });
            });
            response(tabs);
        });

    } else if (request.method == 'getTab') {
        response(Tabs.get(request.tabId));

    } else if (request.method == 'getLocalNews') {
        response(LocalNews);

    } else if (request.method == 'whoami?') {
        response(sender.tab);

    } else if (request.method == "getParameters") {
        response(Params);

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

bootstrap();

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo){
    Tabs.remove(tabId);
});
if (chrome.webNavigation == null) {
    console.log('chrome.webNavigation is not supported by this browser, falling back to chrome.tabs');
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, chromeTab){
        if (changeInfo.status == 'complete') {
            var tab = Tabs.get_or_create(tabId);
            tab.set({'url': chromeTab.url});
            checkForValidUrl(tab);
        }
    });
} else {
    chrome.webNavigation.onCommitted.addListener(function(details){
        if (details.frameId != 0)
            return;

        var tab = Tabs.get_or_create(details.tabId);
        if (details.transitionType == 'reload') {
            tab.set({'url': null});
        }
    });
    chrome.webNavigation.onDOMContentLoaded.addListener(function(details){
        if (details.frameId != 0)
            return;

        var tab = Tabs.get_or_create(details.tabId);
        if (tab == null) {
            throw 'No such tab found: ' + details.tabId;
        }
        tab.set({'url': details.url});
        checkForValidUrl(tab);
    });
}
chrome.pageAction.onClicked.addListener(requestIFrameInjection);
chrome.extension.onRequest.addListener(handleMessage);
