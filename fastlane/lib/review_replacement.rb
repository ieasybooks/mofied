# Clears the way for a new App Store submission. App Store Connect keeps one
# review submission in progress per platform, and fastlane's deliver makes sure
# the App Store version exists (creating or renaming it) before it pulls an
# older submission out of review, which App Store Connect refuses while that
# one is waiting for review or in review. So the submit lane runs this first,
# once the new build has finished processing:
#
# - nothing in review: nothing to do;
# - this version and build already in review (a re-run): nothing to do, and
#   the lane doesn't submit it again;
# - this version and build returned with unresolved issues: stop, since only a
#   new version fixes that;
# - anything else in review: cancel it, and wait until App Store Connect has,
#   up to a timeout that stops the lane before it submits.
#
# Plain Ruby, so fastlane/test can run it without fastlane or Apple: the store
# is anything with #pending and #cancel, AppStoreReviews below for real.
module Mofied
  class ReviewReplacement
    Pending = Struct.new(:state, :version, :build, :handle, keyword_init: true)

    class Error < StandardError; end

    UNRESOLVED_ISSUES = "UNRESOLVED_ISSUES"

    def initialize(store:, version:, build:, timeout: 15 * 60, interval: 15,
                   clock: -> { Process.clock_gettime(Process::CLOCK_MONOTONIC) },
                   sleeper: ->(seconds) { sleep(seconds) },
                   log: ->(message) { puts(message) })
      @store = store
      @version = version.to_s
      @build = build.to_s
      @timeout = timeout
      @interval = interval
      @clock = clock
      @sleeper = sleeper
      @log = log
    end

    # What it found or did: :nothing_in_review, :already_submitted,
    # :would_cancel (a dry run) or :cancelled.
    def run(dry_run: false)
      pending = @store.pending
      if pending.nil?
        @log.call("Nothing is in review on the App Store.")
        return :nothing_in_review
      end

      if ours?(pending)
        if pending.state == UNRESOLVED_ISSUES
          raise Error, "App Store review returned #{describe(pending)}. Fix the issues and release a new version."
        end
        @log.call("#{describe(pending)} is already submitted, so there's nothing to submit.")
        return :already_submitted
      end

      if dry_run
        @log.call("Would pull #{describe(pending)} out of review so #{ours} replaces it.")
        return :would_cancel
      end

      @log.call("Pulling #{describe(pending)} out of review so #{ours} replaces it.")
      @store.cancel(pending)
      deadline = @clock.call + @timeout
      until (still = @store.pending).nil?
        if @clock.call >= deadline
          raise Error, "#{describe(still)} is still in review #{@timeout / 60} minutes after the cancellation; submitted nothing."
        end
        @log.call("Waiting for App Store Connect to cancel the review (#{still.state})...")
        @sleeper.call(@interval)
      end
      @log.call("The review is cancelled; #{ours} goes next.")
      :cancelled
    end

    private

    def ours?(pending)
      pending.version.to_s == @version && pending.build.to_s == @build
    end

    def ours
      "#{@version} (#{@build})"
    end

    def describe(pending)
      "#{pending.version || 'a version'} (#{pending.build || 'no build'}, #{pending.state})"
    end
  end

  # App Store Connect's in-progress review submission, through fastlane's
  # spaceship: the version in it and that version's build.
  class AppStoreReviews
    def initialize(app, platform)
      @app = app
      @platform = platform
    end

    def pending
      submission = @app.get_in_progress_review_submission(platform: @platform, includes: "appStoreVersionForReview")
      return nil unless submission

      version = submission.app_store_version_for_review
      build = version&.get_build
      ReviewReplacement::Pending.new(state: submission.state, version: version&.version_string, build: build&.version, handle: submission)
    end

    def cancel(pending)
      pending.handle.cancel_submission
    end
  end
end
