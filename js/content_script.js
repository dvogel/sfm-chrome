var parameters = null;
var results = null;

var PREFIX_LENGTH = 3;
var SUFFIX_LENGTH = 3;
var OPEN_TAG = '<i style="background: yellow none;">';
var CLOSE_TAG = '</i>';

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

    } else {
        console.log('content_script.js', 'handleMessage', request, sender, response);
    }
};
chrome.extension.onRequest.addListener(handleMessage);

var renderText = function (el) {
    var inline_tags = ['a', 'abbr', 'acronym', 'b', 'basefont', 'bdo', 'big',
    'br', 'cite', 'code', 'dfn', 'em', 'font', 'i', 'img', 'input', 'kbd',
    'label', 'q', 's', 'samp', 'select', 'small', 'span', 'strike', 'strong',
    'sub', 'sup', 'textarea', 'tt', 'u', 'var', 'applet', 'button', 'del',
    'iframe', 'ins', 'map', 'object', 'script' ];
    var ignored_tags = ['script', 'style'];
    var rope = [];

    var tag = el.tagName.toLowerCase();
    if (ignored_tags.indexOf(tag) >= 0)
        return '';

    if (inline_tags.indexOf(tag) == -1) 
        rope.push('\n');

    var eltext = $(tag).text();
    if (eltext.trim() != '')
        rope.push(eltext);

    $(el).children().each(function(idx, ch){
        rope.push(renderText(ch));
    });

    if ((tag == 'br') || (inline_tags.indexOf(tag) == -1))
        rope.push('\n');

    return rope.join("\n");
};

// Copy the document because the readability script modifies the DOM
var doc = window.document.documentElement.cloneNode(true);
$(doc).find('script').remove();
$(doc).find('style').remove();
readability.flags = readability.FLAG_WEIGHT_CLASSES;
var title_markup = readability.getArticleTitle(doc);
var article_markup = readability.grabArticle(doc);
var title = readability.getInnerText(title_markup).trim();
var article = readability.getInnerText(article_markup).replace(title, '').trim();
article = article.replace(/\n/g, '\n\n');
var req = {
    'method': 'articleExtracted',
    'url': window.location.href,
    'text': article,
    'title': title
};
chrome.extension.sendRequest(req);
