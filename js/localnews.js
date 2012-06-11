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
                var item_contexts = local_news.map(function(pattern){
                    return {'url': pattern.replace(/^\./, '')};
                });

                var localnews_rows = $("#localnews-table-row-tmpl").tmpl(item_contexts);

                $("#local-affiliates tbody").empty().append(localnews_rows);
                $("#local-affiliates").show();
            }
        });
    });
});

