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

    function renderList (options) {
        $("#sites-list").remove();

        var sites_list = $("#sites-list-tmpl").tmpl([{}]);
        $("#sites-list-container").append(sites_list);

        var item_contexts = options.sites.map(function(site){ return {'url': site}; });
        $('#sites-list tbody').empty().append($("#site-list-item").tmpl(item_contexts));

        $("#sites-list").tablesorter({
            sortList: [[0,0]], 
            headers: { 
                0: { sorter: 'text' } 
            }
        });
    }

    function updateOptions(){
        var options = {
            search_server: searchServer(),
            submit_urls: submitUrls(),
            use_generic_news_pattern: useGenericNewsPattern(),
            sites: []
        };
        $('#sites-list tbody td:first-child').each(function(i,el){
            options.sites.push($(el).text());
        });
        chrome.extension.sendRequest({method:"saveOptions", options:options});
    }

    function displayOptions(){
        chrome.extension.sendRequest({method:"getOptions"}, function(options){
            renderList(options);
            submitUrls(options['submit_urls']);
            searchServer(options['search_server']);
            useGenericNewsPattern(options['use_generic_news_pattern']);
        });
    };

    function useGenericNewsPattern (val) {
        if (val == null) {
            return ($("input#use-generic-news-pattern")[0].checked == true);
        } else if (val == true) {
            $("input#use-generic-news-pattern")[0].checked = true;
        } else {
            $("input#use-generic-news-pattern")[0].checked = undefined;
        }
    }

    function submitUrls (val) {
        if (val == null) {
            return ($("input#submit-urls")[0].checked == true);
        } else if (val == true) {
            $("input#submit-urls")[0].checked = true;
        } else {
            $("input#submit-urls")[0].checked = undefined;
        }
    }

    function searchServer (val) {
        if (val == null) {
            return $("input#search-server").val();
        } else {
            $("input#search-server").val(val);
        }
    }

    $("#newSite").submit(function(event){
        event.preventDefault();
        if ($("#newSite").valid()){
            var input = $(this).find("input");
            if (!input.val()){
                return;
            }
            $("#sites-list").append($("#site-list-item").tmpl({url:input.val()}));
            updateOptions();
            input.val("");
        }
    });

    $(document).ready(function(){
        $("#reset").click(function(){
            chrome.extension.sendRequest({method:"resetOptions"},function(response){
                displayOptions();
            });
        });

        $("#save").click(function(){
            updateOptions();
        });

        $(".delete").live('click',function(){
            $(this).parent().parent().remove();
            updateOptions();
        });

        displayOptions();

        $(window).unload(function(){
            updateOptions();
        });
    });
});
