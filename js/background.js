var MINIMUM_COVERAGE = 0.0;

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
    search_server: 'http://churnalism.sunlightfoundation.com:8080',
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

var coverage = function (text, row) {
    var chars_matched = 0;
    jQuery.each(row['fragments'], function(idx, fragment){
        chars_matched += fragment[2];
    });
    var pct_of_match = chars_matched / row['characters'];
    var pct_of_source = chars_matched / text.length;
    return Math.max(pct_of_match, pct_of_source);
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
    var row_coverage = function(row){ return coverage(text, row); };
    var best = select_search_result(results, row_coverage);
    next(best);
};
    
var checkForValidUrl = function (tab) {
    var loc = parseUri(tab.get('url'));
    if (onWhitelist({'host': loc.host, 'pathname': loc.path})) {
        chrome.pageAction.show(tab.get('id'));
        chrome.pageAction.setPopup({'tabId': tab.get('id'), 'popup': ''});

        chrome.tabs.insertCSS(tab.get('id'), {file: "/css/churnalism.css"});
        executeScriptsSynchronously(tab.get('id'), [
            "/js/jquery-1.7.1.min.js",
            "/js/extractor.js",
            "/js/content_script.js"
        ]);
    }
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
            'url': url.replace('__UUID__', search_result['uuid'])
                      .replace('__DOCTYPE__', best_match['doctype'])
                      .replace('__DOCID__', best_match['docid'])
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
                with_best_search_result(result.text, result, function(best_match){
                    if (best_match && (coverage(result.text, best_match) >= MINIMUM_COVERAGE)) {
                        chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/found.png"});
                        chrome.pageAction.setTitle({tabId: sender.tab.id, title: "Churnalism Alert!"});
                        chrome.pageAction.setPopup({tabId: sender.tab.id, popup: ""});
                    } else {
                        chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/nonefound.png"});
                        chrome.pageAction.setTitle({tabId: sender.tab.id, title: "This page is Churnalism-free"});
                        chrome.pageAction.setPopup({tabId: sender.tab.id, popup: "/html/explainnomatch.html"});
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
                if (best_match && (coverage(tag.get('article_text')) >= MINIMUM_COVERAGE)) {
                    chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/found.png"});
                    chrome.pageAction.setPopup({tabId: sender.tab.id, popup: ""});
                } else {
                    chrome.pageAction.setIcon({tabId: sender.tab.id, path: "/img/nonefound.png"});
                    chrome.pageAction.setTitle({tabId: sender.tab.id, title: "This page is Churnalism-free"});
                    chrome.pageAction.setPopup({tabId: sender.tab.id, popup: "/html/explainnomatch.html"});
                }
            });
        }
    } else if (request.method == 'getAllTabs') {
        chrome.windows.getAll({populate: true}, function(windows){
            var tabs = [];
            jQuery(windows).each(function(winIdx, win){
                jQuery(win.tabs).each(function(tabIdx, tab) {
                    tabs.push(tab);
                });
            });
            response(tabs);
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
