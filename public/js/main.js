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
    const card = target.closest(".ui.fluid.card");
    const postID = card.attr("postID");
    const postClass = card.attr("postClass");
    const postDescription = card.find(".description").text();
    const postImageSrc = card.find(".img img").attr("src");

    console.log('Repost button clicked'); // Debugging log

    // Populate the modal with the post's content
    $('#repost-modal textarea[name="body"]').val(postDescription);
    if (postImageSrc) {
        $('#repost-modal img#imgInp').attr('src', postImageSrc).show();
    } else {
        $('#repost-modal img#imgInp').hide();
    }
    $('#repost-modal').modal('show');

    // Store the postID and postClass in the modal for later use
    $('#repost-modal').data('postID', postID).data('postClass', postClass);
}

// Handle the repost modal form submission
$('#repost-form').on('submit', function(e) {
    e.preventDefault();
    
    const postID = $('#repost-modal').data('postID');
    const postClass = $('#repost-modal').data('postClass');
    const description = $(this).find('textarea[name="body"]').val();
    const imageFile = $(this).find('input[name="picinput"]')[0].files[0];
    const currDate = Date.now();
    const formData = new FormData();
    
    formData.append('postID', postID);
    formData.append('postClass', postClass);
    formData.append('description', description);
    formData.append('repost', currDate);
    formData.append('_csrf', $('meta[name="csrf-token"]').attr('content'));

    if (imageFile) {
        formData.append('image', imageFile);
    }

    $.ajax({
        url: '/repost',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(data) {
            if (data.success) {
                alert('Post reposted successfully!');
                $('#repost-modal').modal('hide');
                // Optionally add the reposted post to the feed
                addRepostedPostToFeed(data.post);
            } else {
                alert('Failed to repost: ' + data.message);
            }
        },
        error: function(xhr, status, error) {
            console.error('Error reposting:', error);
            alert('An error occurred while reposting. Please try again.');
        }
    });
});

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
    let idleTime = 0;
    $('#pagegrid').on('mousemove keypress scroll mousewheel', function() {
        if (!isActive) {
            activeStartTime = Date.now();
            isActive = true;
        }
        idleTime = 0;
    });

    setInterval(function() {
        idleTime += 1;
        if (idleTime > 4) { // 60.001-74.999 seconds (idle time)
            resetActiveTimer(false);
        }
    }, 15000);

    $('a.item.logoutLink').on('click', function() {
        resetActiveTimer(true);
    });

    /**
     * Other site functionalities:
     */
    $('#loading').hide();
    $('#content').fadeIn('slow');

    $('.message .close').on('click', function() {
        $(this).closest('.message').transition('fade');
    });

    $('.checkbox').checkbox();

    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/forgot') {
        $.post("/pageLog", {
            path: window.location.pathname,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
        if (window.location.pathname !== '/notifications') {
            setInterval(function() {
                $.getJSON("/notifications", { bell: true }, function(json) {
                    if (json.count != 0) {
                        $("i.big.alarm.icon").replaceWith('<i class="big icons"><i class="red alarm icon"></i><i class="corner yellow lightning icon"></i></i>');
                    }
                });
            }, 5000);
        }
    };

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

    $(`#content .fluid.card .img img, #content img.ui.avatar.image, #content a.avatar img`).visibility({
        type: 'image'
    });

    $('.ui.repost.button').on('click', repostPost);
});

$(window).on("beforeunload", function() {
    if (!window.loggingOut) {
        resetActiveTimer(false);
    }
});
