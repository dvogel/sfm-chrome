$(function() {
    function renderList (options) {
        $('#sites-list').empty().append($("#site-list-item").tmpl(options.sites));
    }

    function updateOptions(){
        var options = {
            search_server: searchServer(),
            submit_urls: submitUrls(),
            use_generic_news_pattern: useGenericNewsPattern(),
            sites: []
        };
        $('#sites-list li label').each(function(i,el){
            options.sites.push({url:$(el).text()});
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

    $("#newSite").validate({
        rules: {
            url: {
                required: true,
                url: true
            }
        }
    });

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

    $("#reset").click(function(){
        chrome.extension.sendRequest({method:"resetOptions"},function(response){
            displayOptions();
        });
    });

    $(".delete").live('click',function(){
        $(this).parent().remove();
        updateOptions();
    });

    displayOptions();

    $(window).unload(function(){
        updateOptions();
    });
});
