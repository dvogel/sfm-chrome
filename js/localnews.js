$(function() {
    (function(){
        // remove layerX and layerY
        var all = $.event.props,
        len = all.length,
        res = [];
        while (len--) {
            var el = all[len];
            if (el != 'layerX' && el != 'layerY') res.push(el);
        }
        $.event.props = res;
    }());

    $(document).ready(function(){
        chrome.extension.sendRequest({method: "getLocalNews"}, function(local_news){
            if ((local_news == null) || (local_news.length == 0)) {
                $("#no-affiliates").hide();
            } else {
                local_news.sort();
                var urls = local_news.map(function(pattern){
                    return pattern.replace(/^\./, '');
                });

                var localnews_rows_tmpl = $("#localnews-table-rows-tmpl").html();
                var rendered = Ashe.parse(localnews_rows_tmpl, {urls: urls});

                $("#local-affiliates tbody").empty().append($(rendered));
                $("#local-affiliates").show();
            }
        });
    });
});

