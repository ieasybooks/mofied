# bun run test:fastlane
require "minitest/autorun"
require "review_replacement"

class ReviewReplacementTest < Minitest::Test
  Pending = Mofied::ReviewReplacement::Pending

  # App Store Connect's review submissions, as a script: each call to #pending
  # answers with the next entry, repeating the last one.
  class FakeStore
    attr_reader :cancelled, :calls

    def initialize(*answers)
      @answers = answers
      @cancelled = []
      @calls = []
    end

    def pending
      @calls << :pending
      @answers.length > 1 ? @answers.shift : @answers.first
    end

    def cancel(pending)
      @calls << :cancel
      @cancelled << pending
    end
  end

  def replacement(store, now: [0], **options)
    @logged = []
    @slept = []
    Mofied::ReviewReplacement.new(
      store: store, version: "0.1.4", build: "1004", timeout: 600, interval: 15,
      clock: -> { now.first }, sleeper: ->(seconds) { @slept << seconds; now[0] += seconds },
      log: ->(message) { @logged << message }, **options
    )
  end

  def older(state = "WAITING_FOR_REVIEW")
    Pending.new(state: state, version: "0.1.3", build: "1003", handle: :older_submission)
  end

  def test_nothing_in_review
    store = FakeStore.new(nil)
    assert_equal :nothing_in_review, replacement(store).run
    assert_equal [], store.cancelled
    assert_equal ["Nothing is in review on the App Store."], @logged
  end

  def test_cancels_an_older_submission_then_waits_until_it_is_gone
    store = FakeStore.new(older, older("CANCELING"), older("CANCELING"), nil)
    assert_equal :cancelled, replacement(store).run
    assert_equal [:older_submission], store.cancelled.map(&:handle)
    # Read, cancel, then poll until App Store Connect has no submission left.
    assert_equal %i[pending cancel pending pending pending], store.calls
    assert_equal [15, 15], @slept
    assert_includes @logged.first, "Pulling 0.1.3 (1003, WAITING_FOR_REVIEW) out of review so 0.1.4 (1004) replaces it."
    assert_equal "The review is cancelled; 0.1.4 (1004) goes next.", @logged.last
  end

  def test_cancels_a_version_in_review_too
    store = FakeStore.new(older("IN_REVIEW"), nil)
    assert_equal :cancelled, replacement(store).run
    assert_equal 1, store.cancelled.length
  end

  def test_a_timeout_stops_before_submitting
    store = FakeStore.new(older, older("CANCELING"))
    error = assert_raises(Mofied::ReviewReplacement::Error) { replacement(store).run }
    assert_equal "0.1.3 (1003, CANCELING) is still in review 10 minutes after the cancellation; submitted nothing.", error.message
    assert_equal 600, @slept.sum
  end

  def test_this_version_and_build_already_in_review_is_left_alone
    %w[WAITING_FOR_REVIEW IN_REVIEW].each do |state|
      store = FakeStore.new(Pending.new(state: state, version: "0.1.4", build: "1004", handle: :ours))
      assert_equal :already_submitted, replacement(store).run
      assert_equal [], store.cancelled
      assert_equal ["0.1.4 (1004, #{state}) is already submitted, so there's nothing to submit."], @logged
    end
  end

  def test_this_version_returned_with_issues_needs_a_new_version
    store = FakeStore.new(Pending.new(state: "UNRESOLVED_ISSUES", version: "0.1.4", build: "1004", handle: :ours))
    error = assert_raises(Mofied::ReviewReplacement::Error) { replacement(store).run }
    assert_match(/returned 0\.1\.4 \(1004, UNRESOLVED_ISSUES\)\. Fix the issues and release a new version\./, error.message)
    assert_equal [], store.cancelled
  end

  def test_the_same_version_with_another_build_is_replaced
    store = FakeStore.new(Pending.new(state: "WAITING_FOR_REVIEW", version: "0.1.4", build: "999", handle: :stale), nil)
    assert_equal :cancelled, replacement(store).run
    assert_equal [:stale], store.cancelled.map(&:handle)
  end

  def test_a_dry_run_only_says_what_it_would_do
    store = FakeStore.new(older)
    assert_equal :would_cancel, replacement(store).run(dry_run: true)
    assert_equal [], store.cancelled
    assert_equal ["Would pull 0.1.3 (1003, WAITING_FOR_REVIEW) out of review so 0.1.4 (1004) replaces it."], @logged
  end

  def test_a_submission_without_a_version_or_build_is_described
    store = FakeStore.new(Pending.new(state: "UNRESOLVED_ISSUES", version: nil, build: nil, handle: :odd))
    assert_equal :would_cancel, replacement(store).run(dry_run: true)
    assert_equal ["Would pull a version (no build, UNRESOLVED_ISSUES) out of review so 0.1.4 (1004) replaces it."], @logged
  end
end

class AppStoreReviewsTest < Minitest::Test
  Version = Struct.new(:version_string, :build) do
    def get_build
      build
    end
  end
  Build = Struct.new(:version)
  Submission = Struct.new(:state, :app_store_version_for_review, :cancelled) do
    def cancel_submission
      self.cancelled = true
    end
  end

  class FakeApp
    attr_reader :asked

    def initialize(submission)
      @submission = submission
    end

    def get_in_progress_review_submission(platform:, includes:)
      @asked = { platform: platform, includes: includes }
      @submission
    end
  end

  def test_reads_the_version_and_build_in_review_and_cancels_that_submission
    submission = Submission.new("IN_REVIEW", Version.new("0.1.3", Build.new("1003")))
    app = FakeApp.new(submission)
    reviews = Mofied::AppStoreReviews.new(app, "IOS")
    pending = reviews.pending
    assert_equal({ platform: "IOS", includes: "appStoreVersionForReview" }, app.asked)
    assert_equal ["IN_REVIEW", "0.1.3", "1003"], [pending.state, pending.version, pending.build]
    reviews.cancel(pending)
    assert submission.cancelled
  end

  def test_nothing_in_review
    assert_nil Mofied::AppStoreReviews.new(FakeApp.new(nil), "IOS").pending
  end

  def test_a_submission_without_a_version
    pending = Mofied::AppStoreReviews.new(FakeApp.new(Submission.new("READY_FOR_REVIEW", nil)), "IOS").pending
    assert_equal ["READY_FOR_REVIEW", nil, nil], [pending.state, pending.version, pending.build]
  end
end
