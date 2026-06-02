(function () {
  var leftVideo = document.querySelector('[data-paired-video="left"]');
  var rightVideo = document.querySelector('[data-paired-video="right"]');
  var toggleButton = document.querySelector("[data-video-toggle]");
  var progressInput = document.querySelector("[data-video-progress]");
  var leftDelayMs = 70000;
  var leftPlayTimer = null;
  var isSeeking = false;

  if (!leftVideo || !rightVideo || !toggleButton || !progressInput) {
    return;
  }

  function markMissing(video) {
    var panel = video.closest(".media-panel");

    if (panel) {
      panel.classList.add("is-missing");
    }
  }

  function hasPlayableSource(video) {
    return video.readyState > 0 && Number.isFinite(video.duration) && video.duration > 0;
  }

  function refreshControls() {
    var canPlayBoth = hasPlayableSource(leftVideo) && hasPlayableSource(rightVideo);

    toggleButton.disabled = !canPlayBoth;
    progressInput.disabled = !canPlayBoth;

    if (!canPlayBoth) {
      setButtonState(false);
    }
  }

  function setButtonState(isPlaying) {
    toggleButton.innerHTML = isPlaying
      ? '<span aria-hidden="true">||</span> Pause recordings'
      : '<span aria-hidden="true">&gt;</span> Play recordings';
    toggleButton.setAttribute("aria-pressed", isPlaying ? "true" : "false");
  }

  function clearLeftTimer() {
    if (leftPlayTimer) {
      window.clearTimeout(leftPlayTimer);
      leftPlayTimer = null;
    }
  }

  function playVideo(video) {
    var playback = video.play();

    if (playback && typeof playback.catch === "function") {
      playback.catch(function () {
        setButtonState(false);
      });
    }
  }

  function getLeftDelaySeconds() {
    return leftDelayMs / 1000;
  }

  function getDuration() {
    var rightDuration = Number.isFinite(rightVideo.duration) ? rightVideo.duration : 0;
    var leftDuration = Number.isFinite(leftVideo.duration) ? leftVideo.duration : 0;

    return Math.max(rightDuration, getLeftDelaySeconds() + leftDuration);
  }

  function getTimelineTime() {
    var duration = getDuration();
    var rightTime = Number.isFinite(rightVideo.currentTime) ? rightVideo.currentTime : 0;
    var leftTime = Number.isFinite(leftVideo.currentTime) ? leftVideo.currentTime : 0;
    var timelineTime = rightTime;

    if (rightVideo.ended || leftTime > 0) {
      timelineTime = Math.max(timelineTime, getLeftDelaySeconds() + leftTime);
    }

    return Math.min(duration, timelineTime);
  }

  function getLeftSyncTime(timelineTime) {
    return Math.max(0, timelineTime - getLeftDelaySeconds());
  }

  function syncLeftToTimeline(timelineTime) {
    var nextLeftTime = getLeftSyncTime(timelineTime);

    if (Number.isFinite(leftVideo.duration) && leftVideo.duration > 0) {
      nextLeftTime = Math.min(leftVideo.duration, nextLeftTime);
    }

    leftVideo.currentTime = nextLeftTime;
  }

  function scheduleLeftPlayback(timelineTime) {
    var currentTimelineTime = Number.isFinite(timelineTime) ? timelineTime : getTimelineTime();
    var delaySeconds = getLeftDelaySeconds();

    clearLeftTimer();
    syncLeftToTimeline(currentTimelineTime);

    if (currentTimelineTime >= delaySeconds && !leftVideo.ended) {
      playVideo(leftVideo);
      return;
    }

    leftVideo.pause();
    leftPlayTimer = window.setTimeout(function () {
      leftPlayTimer = null;

      if (rightVideo.currentTime >= delaySeconds) {
        syncLeftToTimeline(rightVideo.currentTime);
        playVideo(leftVideo);
        return;
      }

      if (!rightVideo.paused) {
        scheduleLeftPlayback();
      }
    }, Math.max(0, leftDelayMs - rightVideo.currentTime * 1000));
  }

  function updateProgress() {
    var duration = getDuration();

    if (!duration || isSeeking) {
      return;
    }

    progressInput.value = String((getTimelineTime() / duration) * 100);
  }

  function playPair() {
    var timelineTime = getTimelineTime();

    setButtonState(true);

    if (timelineTime < rightVideo.duration) {
      playVideo(rightVideo);
    }

    scheduleLeftPlayback(timelineTime);
  }

  function pausePair() {
    clearLeftTimer();
    leftVideo.pause();
    rightVideo.pause();
    setButtonState(false);
  }

  toggleButton.addEventListener("click", function () {
    var isPlaying = !rightVideo.paused || !leftVideo.paused || Boolean(leftPlayTimer);

    if (isPlaying) {
      pausePair();
      return;
    }

    playPair();
  });

  progressInput.addEventListener("input", function () {
    isSeeking = true;
  });

  progressInput.addEventListener("change", function () {
    var duration = getDuration();
    var nextTimelineTime = duration * (Number(progressInput.value) / 100);
    var nextRightTime = Math.min(rightVideo.duration, nextTimelineTime);
    var wasPlaying = !rightVideo.paused || !leftVideo.paused || Boolean(leftPlayTimer);

    clearLeftTimer();
    rightVideo.currentTime = nextRightTime;
    syncLeftToTimeline(nextTimelineTime);

    if (wasPlaying) {
      if (nextTimelineTime < rightVideo.duration) {
        playVideo(rightVideo);
      } else {
        rightVideo.pause();
      }

      scheduleLeftPlayback(nextTimelineTime);
    }

    isSeeking = false;
    updateProgress();
  });

  [leftVideo, rightVideo].forEach(function (video) {
    video.addEventListener("loadedmetadata", refreshControls);
    video.addEventListener("error", function () {
      markMissing(video);
      refreshControls();
    });
    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("ended", function () {
      if (leftVideo.ended && rightVideo.ended) {
        clearLeftTimer();
        setButtonState(false);
      }
    });
  });

  window.setTimeout(function () {
    [leftVideo, rightVideo].forEach(function (video) {
      if (!hasPlayableSource(video)) {
        markMissing(video);
      }
    });
    refreshControls();
  }, 900);

  setButtonState(false);
  refreshControls();
})();
