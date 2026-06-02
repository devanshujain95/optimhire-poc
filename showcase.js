(function () {
  var leftVideo = document.querySelector('[data-paired-video="left"]');
  var rightVideo = document.querySelector('[data-paired-video="right"]');
  var toggleButton = document.querySelector("[data-video-toggle]");
  var progressInput = document.querySelector("[data-video-progress]");
  var leftDelayMs = 550;
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

  function getDuration() {
    if (Number.isFinite(rightVideo.duration) && rightVideo.duration > 0) {
      return rightVideo.duration;
    }

    return 0;
  }

  function updateProgress() {
    var duration = getDuration();

    if (!duration || isSeeking) {
      return;
    }

    progressInput.value = String((rightVideo.currentTime / duration) * 100);
  }

  function playPair() {
    var hasStarted = leftVideo.currentTime > 0 || rightVideo.currentTime > 0;

    clearLeftTimer();
    setButtonState(true);
    playVideo(rightVideo);

    if (hasStarted) {
      playVideo(leftVideo);
      return;
    }

    leftPlayTimer = window.setTimeout(function () {
      leftPlayTimer = null;
      playVideo(leftVideo);
    }, leftDelayMs);
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
    var nextRightTime = duration * (Number(progressInput.value) / 100);
    var nextLeftTime = Math.max(0, nextRightTime - leftDelayMs / 1000);

    clearLeftTimer();
    rightVideo.currentTime = nextRightTime;
    leftVideo.currentTime = nextLeftTime;
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
