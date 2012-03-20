var parameters = null;
var results = null;

var PREFIX_LENGTH = 3;
var SUFFIX_LENGTH = 3;
var OPEN_TAG = '<i style="background: yellow none;">';
var CLOSE_TAG = '</i>';

var standardize_quotes = function (text, leftsnglquot, rightsnglquot, leftdblquot, rightdblquot) {
    return text.replace(/[\u2018\u201B]/g, leftsnglquot)
               .replace(/[\u0027\u2019\u201A']/g, rightsnglquot)
               .replace(/[\u201C\u201F]/g, leftdblquot)
               .replace(/[\u0022\u201D"]/g, rightdblquot);
};

var eat_chars = function (text, expected) {
    var chars_eaten = 0;
    var found = "";

    var textstream = new String(text);
    var expected_c = expected.substr(0, 1);
    while ((found != expected) && (textstream.length > 0)) {
        var c = textstream.substr(0, 1);
        var textstream = textstream.slice(1);

        if (c == expected_c) {
            found += c;
            expected_c = expected.substr(found.length, 1);
        } else {
            chars_eaten += 1;
        }
    }

    if (found == expected) {
        return [true, chars_eaten];
    } else {
        return [false, found];
    }
};

var highlight_match = function (p, match) {
    /* This function finds the `match` text in the html of the the
     * `p` element. The boundaries of the text are determined, then
     * the html corresponding to the text is wrapped in `OPEN_TAG`
     * and `CLOSE_TAG`
     */
    console.log("");
    console.log("Highlighting", match, " in: ", $(p).html());

    var text_offset = $(p).text().indexOf(match);
    if (text_offset == -1) {
        /* Throw an exception to force callers to limit their calls to 
         * when they know the `match` text is in the `p` paragraph.
         */
        throw "highlight_match: given match text not found in given paragraph"
    }

    var match_length = match.length;
    var matches = [];
    while ((matches.length == 0) && (match_length >= PREFIX_LENGTH)) {
        console.log("Trying match_length of ", match_length);
        var html = $(p).html();
        var prefix = match.substr(0, match_length);
        var html_offset = html.indexOf(prefix);
        if (html_offset >= 0) {
            console.log("Found at html_offset", html_offset);
            var meal = eat_chars(html.slice(html_offset), match);
            console.log("meal", meal[0], meal[1]);
            if (meal[0]) {
                var prelude = html.slice(0, html_offset);
                var suffix_boundary = html_offset + match.length + meal[1];
                var matched = html.slice(html_offset, suffix_boundary);
                var postlude = html.slice(suffix_boundary);
                console.log("suffix_boundary", suffix_boundary);
                console.log("prelude", prelude);
                console.log("matched", matched);
                console.log("postlude", postlude);
                $(p).html(prelude +
                          OPEN_TAG +
                          matched +
                          CLOSE_TAG +
                          postlude);
                return;
            }
        }

        if (match_length <= (PREFIX_LENGTH * 2)) {
            match_length -= 2;
        } else {
            match_length = Math.ceil(match_length / 2);
        }
    }
};

var handleMessage = function (request, sender, response) {
    if (request.method == 'log') {
        console.log(request.message);

    } else if (request.method == 'injectIFrame') {
        $("#churnalism-overlay").remove();

        var overlay = $('<div id="churnalism-overlay"><button id="churnalism-close">Close</button></div>');
        var overlay_frame = document.createElement("iframe");
        $(overlay_frame).attr('id', 'churnalism-iframe');

        overlay.append(overlay_frame);
        $("body").append(overlay);
        $("#churnalism-close").click(function(click){
            $("#churnalism-overlay").remove();
        });

        var doc = overlay_frame.contentDocument || overlay_frame.contentWindow.document;
        doc.open();
        doc.writeln(request.content);
        doc.close();

        $("#churnalism-overlay").scroll(prevent_scroll);
        $("#churnalism-overlay").bind('mousewheel', prevent_scroll);
    } else {
        console.log('content_script.js', 'handleMessage', request, sender, response);
    }
};
chrome.extension.onRequest.addListener(handleMessage);

var prevent_scroll = function (event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
};

jQuery(document).ready(function(){
    jQuery('iframe').each(function(idx, iframe){
        var src = jQuery(iframe).attr('src');
        if (/wmode=opaque/i.test(src)) {
            src = src.replace(/wmode=opaque/i, 'wmode=transparent');
        } else if (src != null) {
            src = src + ((src.indexOf('?') == -1) ? '?' : '&') + 'wmode=transparent';
        } 
        jQuery(iframe).attr('src', src);
    });

    ArticleExtractor(window);
    var article_document = new ExtractedDocument(document);
    var article = article_document.get_article_text();
    article = standardize_quotes(article, "'", "'", '"', '"');
    var title = article_document.get_title();
    var req = {
        'method': 'articleExtracted',
        'url': window.location.href,
        'text': article,
        'title': title
    };
    chrome.extension.sendRequest(req);
});

