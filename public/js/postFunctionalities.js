function likePost(e) {
    const target = $(e.target).closest('.ui.like.button');
    const label = target.closest('.ui.like.button').next("a.ui.basic.red.left.pointing.label.count");
    const postID = target.closest(".ui.fluid.card").attr("postID");
    const postClass = target.closest(".ui.fluid.card").attr("postClass");
    const currDate = Date.now();

    if (target.hasClass("red")) { // Unlike Post
        target.removeClass("red");
        label.html(function(i, val) { return val * 1 - 1 });

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
            $.post("/userPost_feed", {
                postID: postID,
                unlike: currDate,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        else
            $.post("/feed", {
                postID: postID,
                unlike: currDate,
                postClass: postClass,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
    } else { // Like Post
        target.addClass("red");
        label.html(function(i, val) { return val * 1 + 1 });

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
            $.post("/userPost_feed", {
                postID: postID,
                like: currDate,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        else
            $.post("/feed", {
                postID: postID,
                like: currDate,
                postClass: postClass,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
    }
}



function flagPost(e) {
    const target = $(e.target);
    const post = target.closest(".ui.fluid.card.dim");
    const postID = post.attr("postID");
    const postClass = target.closest(".ui.fluid.card").attr("postClass");
    const flag = Date.now();

    $.post("/feed", {
        postID: postID,
        flag: flag,
        postClass: postClass,
        _csrf: $('meta[name="csrf-token"]').attr('content')
    });
    post.find(".ui.dimmer.flag").dimmer({ closable: false }).dimmer('show');
    // Repeat to ensure it's closable
    post.find(".ui.dimmer.flag").dimmer({ closable: false }).dimmer('show');
}

function likeComment(e) {
    const target = $(e.target);
    const comment = target.parents(".comment");
    const label = comment.find("span.num");
    const commentID = comment.attr("commentID");
    const currDate = Date.now();

    if (target.hasClass("red")) { // Unlike comment
        target.removeClass("red");
        label.html(function(i, val) { return val * 1 - 1 });
        $.post("/feed", {
            commentID: commentID,
            unlike: currDate,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    } else { // Like comment
        target.addClass("red");
        label.html(function(i, val) { return val * 1 + 1 });
        $.post("/feed", {
            commentID: commentID,
            like: currDate,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    }
}

function postComment(e) {
    const target = $(e.target);
    const post = target.closest(".ui.fluid.card");
    const postID = post.attr("postID");
    const postClass = post.attr("postClass");
    const commentArea = target.prev().children("textarea.newcomment");
    const body = commentArea.val();
    const time = Date.now();

    // Prevent from posting empty comments
    if (!body) {
        return;
    }

    if (post.attr("type") === 'userPost')
        $.post("/userPost_feed", {
            postID: postID,
            body: body,
            time: time,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    else
        $.post("/feed", {
            postID: postID,
            postClass: postClass,
            body: body,
            time: time,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });

    commentArea.val("");
    // Dynamically append this comment to the comment section to display immediately
    const newComment = `
    <div class="comment">
      <a class="avatar image" href="/me">
        <img src="${$('#profileAvatar').attr('src')}" alt="User Avatar">
      </a>
      <div class="content">
        <a class="author" href="/me">${user.profile.name || user.username || user.id}</a>
        <div class="metadata">
          <span class="date">${new Date(time).toLocaleString()}</span>
          <div class="rating">
            <i class="heart icon"></i> <span class="num">0</span> Likes
          </div>
        </div>
        <div class="text">${body}</div>
        <div class="actions">
          <a class="like comment">Like</a>
          <a class="flag comment">Mark as Harmful</a>
        </div>
      </div>
    </div>`;
    target.closest(".content").find(".ui.comments").append(newComment);
}

function onEnterSubmit(e) {
    if (e.keyCode === 13 && !e.shiftKey) {
        e.preventDefault();
        postComment(e);
    }
}

$(document).ready(function() {
    $(document).on("click", ".like.button", function(e) { likePost(e); });
    $(document).on("click", ".flag.button", function(e) { flagPost(e); });
    $(document).on("click", ".like.comment", function(e) { likeComment(e); });
    $(document).on("click", ".flag.comment", function(e) { flagPost(e); });
    $(document).on("click", ".actions .reply", function(e) { postComment(e); });
    $(document).on("click", ".repost.button", function(e) { repostPost(e); });
    $(document).on("keydown", ".ui.fluid.card .ui.fluid.left.labeled.right.icon.input textarea.newcomment", function(e) { onEnterSubmit(e); });

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
});
