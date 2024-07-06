// Before Page load:
$('#content').hide();
$('#loading').show();
let isActive = false;
let activeStartTime;

function resetActiveTimer(loggingOut) {
    if (isActive) {
        const currentTime = new Date();
        const activeDuration = currentTime - activeStartTime;
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/forgot') {
            $.post("/pageTimes", {
                time: activeDuration,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            }).then(function() {
                if (loggingOut) {
                    window.loggingOut = true;
                    window.location.href = '/logout';
                }
            });
        }
        isActive = false;
    }
}

function repostPost(event) {
    event.preventDefault();
    const target = $(event.target).closest('.ui.repost.button');
    const postID = target.closest(".ui.fluid.card").attr("postID");
    const postClass = target.closest(".ui.fluid.card").attr("postClass");
    const currDate = Date.now();

    if (!target.hasClass("green")) { // Only repost if not already reposted
        target.addClass("green");

        $.post("/repost", {
            postID: postID,
            postClass: postClass,
            repost: currDate,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        }).done(function(data) {
            if (data.success) {
                alert('Post reposted successfully!');
                addRepostedPostToFeed(data.post);
            } else {
                alert('Failed to repost: ' + data.message);
                target.removeClass("green");
            }
        }).fail(function(xhr, status, error) {
            console.error('Error reposting:', error);
            console.error('Status:', status);
            console.error('Response:', xhr.responseText);
            alert('An error occurred while reposting. Please try again. Error: ' + error);
            target.removeClass("green");
        });
    } else {
        alert('You have already reposted this post.');
    }
}

function addRepostedPostToFeed(postData) {
    // Create HTML for the reposted post
    const repostedPostHtml = `
        <div class="ui fluid card" postID="${postData.postID}" postClass="repost">
            <div class="content">
                <div class="description">${postData.body}</div>
            </div>
            <!-- Add other post elements (like, comment buttons etc.) -->
        </div>
    `;

    // Add the reposted post to the top of the feed
    $('#feed-container').prepend(repostedPostHtml);
}

$(window).on("load", function() {
    /**
     * Recording user's active time on website:
     */
    // From the first answer from https://stackoverflow.com/questions/667555/how-to-detect-idle-time-in-javascript
    let idleTime = 0;
    // Definition of an active user: mouse movement, clicks etc.
    // idleTime is reset to 0 whenever mouse movement occurs.
    $('#pagegrid').on('mousemove keypress scroll mousewheel', function() {
        // If there hasn't been a "start time" for activity, set it. We use session storage so we can track activity when pages changes too.
        if (!isActive) {
            activeStartTime = Date.now();
            isActive = true;
        }
        idleTime = 0;
    });

    // Every 15 seconds, increase idleTime by 1. If idleTime is greater than 4 (i.e. there has been inactivity for about 60-74 seconds), log the duration of activity and reset the active timer.
    setInterval(function() {
        idleTime += 1;
        if (idleTime > 4) { // 60.001-74.999 seconds (idle time)
            resetActiveTimer(false);
        }
    }, 15000);

    // When a user logs out of the website, log the duration of activity and reset the active timer.
    $('a.item.logoutLink').on('click', function() {
        resetActiveTimer(true);
    });

    /**
     * Other site functionalities:
     */
    // Close loading dimmer on content load.
    $('#loading').hide();
    $('#content').fadeIn('slow');

    // Fomantic UI: Enable closing messages
    $('.message .close').on('click', function() {
        $(this).closest('.message').transition('fade');
    });

    // Fomantic UI: Enable checkboxes
    $('.checkbox').checkbox();

    // Check if user has any notifications every 5 seconds.
    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/forgot') {
        $.post("/pageLog", {
            path: window.location.pathname,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
        if (window.location.pathname !== '/notifications') {
            setInterval(function() {
                // Method to be executed;
                $.getJSON("/notifications", { bell: true }, function(json) {
                    if (json.count != 0) {
                        $("i.big.alarm.icon").replaceWith('<i class="big icons"><i class="red alarm icon"></i><i class="corner yellow lightning icon"></i></i>');
                    }
                });
            }, 5000);
        }
    };

    // Picture Preview on Image Selection (Used for: uploading new post, updating profile)
    function readURL(input) {
        if (input.files && input.files[0]) {
            let reader = new FileReader();
            reader.onload = function(e) {
                $('#imgInp').attr('src', e.target.result);
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    $("#picinput").change(function() {
        readURL(this);
    });

    // Lazy loading of images on site
    $(`#content .fluid.card .img img, #content img.ui.avatar.image, #content a.avatar img`).visibility({
        type: 'image'
    });

    // Add event listener for repost button
    $('.ui.repost.button').on('click', repostPost);
});

$(window).on("beforeunload", function() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
    if (!window.loggingOut) {
        resetActiveTimer(false);
    }
});
