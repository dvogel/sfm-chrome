(function($){
    // This is for adding formatting to the document text to allow for CSS styling, etc.
    var markup_text = function (txt) {
        var trimmed = txt.trim();
        var normalizedWhitespace = trimmed.replace(/^\s+$/gm, '');
        var hasConsecutiveLineBreaks = /[\r\n]{2,}/g.test(normalizedWhitespace);
        var lineBreakPatternText = '(\\r|\\n|\\r\\n|\\n\\r)';
        if (hasConsecutiveLineBreaks)
            lineBreakPatternText = lineBreakPatternText + '{2,}';
        var lineBreakPattern = new RegExp(lineBreakPatternText, "g");
        var withPTags = normalizedWhitespace.replace(lineBreakPattern, '</p>\n<p>');
        return '<p>' + withPTags + '</p>';
    };
    $.fn.extend({
        markupAsArticle: function (){
            // The assumption here is that the html is just text
            // so .html() and .text() each achieve the correct outcome
            // with correct usage of this function while .html() is less
            // correct but fails more gracefully with incorrect usage of
            // this function.
            var txt = $(this).html();
            var markup = markup_text(txt);
            $(this).html(markup);
            return this;
        }
    });


    $(document).ready(function(){

        var query_params = (function(a) {
            if (a == "") return {};
            var b = {};
            for (var i = 0; i < a.length; ++i)
            {
                var p=a[i].split('=');
                if (p.length != 2) continue;
                b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
            }
            return b;
        })(window.location.search.substr(1).split('&'));

        $("#show-text").click(function(event){
            var request = {
                'method': 'getTab',
                'tabId': parseInt(query_params['tabId'])
            };
            chrome.extension.sendRequest(request, function(tab){
                $("#article-text").html(tab.article_text).markupAsArticle().show();

                $("#show-text").hide();
                $("#hide-text").show();
                $("#text-is-wrong").show();
            });
        });

        $("#hide-text").click(function(event){
            $("#hide-text").hide();
            $("#article-text").hide();
            $("#text-is-wrong").hide();
            $("#show-text").show();
        });

        $("#text-is-wrong").click(function(event){
            chrome.extension.sendRequest({'method': 'reportTextProblem', 'tabId': query_params['tabId']});
        });

        // The pageAction popup window does not automatically resize itself
        // to fit the content. This triggers a re-draw.
        setTimeout(function(){
            $("#article-text").hide();
        }, 0);
    });

})(jQuery);
