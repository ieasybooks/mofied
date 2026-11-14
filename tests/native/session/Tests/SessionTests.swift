import XCTest

@MainActor
final class SessionTests: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "com.mofied.app")
  var session: XCUIElement {
    app.otherElements.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND NOT identifier BEGINSWITH %@", "session-", "session-pager-")).firstMatch
  }
  var media: XCUIElement { app.buttons["media-controls"] }
  override func setUpWithError() throws { continueAfterFailure = false }

  func opening(previous: String? = nil) -> String {
    XCTAssertTrue(session.waitForExistence(timeout: 30), "The API session should load")
    let id = session.identifier
    if let previous { XCTAssertNotEqual(id, previous, "A relaunch must fetch a new server plan") }
    XCTAssertTrue(media.waitForExistence(timeout: 20))
    waitForLabel("إيقاف مؤقت")
    return id
  }
  func waitForLabel(_ label: String) {
    expectation(for: NSPredicate(format: "label == %@", label), evaluatedWith: media)
    waitForExpectations(timeout: 20)
  }
  func leaveAndReturn() {
    XCUIDevice.shared.press(.home)
    XCTAssertTrue(app.wait(for: .runningBackground, timeout: 5))
    app.activate()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5))
  }
  /// The media's "0:07 / 1:30" clock, which follows the native player's position.
  var clock: XCUIElement {
    app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "[0-9]+:[0-9]{2} / [0-9]+:[0-9]{2}")).firstMatch
  }
  func playhead() -> Int {
    XCTAssertTrue(clock.waitForExistence(timeout: 10))
    let played = clock.label.split(separator: " ")[0].split(separator: ":").compactMap { Int($0) }
    return played[0] * 60 + played[1]
  }
  /// The label only says what the controller wants; the clock shows the player itself.
  func waitForPlayhead(after seconds: Int) {
    let deadline = Date().addingTimeInterval(15)
    while playhead() <= seconds && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.5)) }
    XCTAssertGreaterThan(playhead(), seconds, "The native player must actually play")
  }
  func pause() {
    if media.label == "إيقاف مؤقت" { media.tap() }
    XCTAssertEqual(media.label, "تشغيل")
  }
  func capture(_ name: String) {
    let a = XCTAttachment(screenshot: app.screenshot())
    a.name = name; a.lifetime = .keepAlways; add(a)
  }
  func testSessionsContinueAcrossAppSwitchesUntilRelaunch() {
    app.terminate(); app.launch()
    let first = opening()

    leaveAndReturn()
    XCTAssertEqual(session.identifier, first, "Returning must continue the same session")
    waitForLabel("إيقاف مؤقت")
    waitForPlayhead(after: playhead())
    capture("A playing session continues after leaving the app")

    pause()
    leaveAndReturn()
    XCTAssertEqual(session.identifier, first)
    XCTAssertEqual(media.label, "تشغيل", "A manual pause survives leaving the app")
    let paused = playhead()
    RunLoop.current.run(until: Date().addingTimeInterval(2.5))
    XCTAssertEqual(playhead(), paused, "A paused player stays still after returning")
    capture("A paused session stays paused after leaving the app")

    app.buttons["عن التطبيق"].tap()
    app.buttons["سياسة الخصوصية"].tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "لا يُحفظ تقدم الجلسة")).firstMatch.waitForExistence(timeout: 10))
    app.buttons["رجوع"].tap()
    app.buttons["متابعة المشاهدة"].tap()
    XCTAssertEqual(session.identifier, first)
    XCTAssertEqual(media.label, "تشغيل")
    capture("Info preserves the current paused session")

    app.terminate(); app.launch()
    _ = opening(previous: first)
    capture("A relaunch gets a fresh session")
    pause()
  }

  func open(_ link: String) {
    XCUIDevice.shared.system.open(URL(string: link)!)
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
  }

  func testPausingThenMovingOnPlaysTheNextMedia() {
    app.terminate(); app.launch()
    _ = opening()
    pause()
    app.swipeUp(velocity: .fast)
    // A pause belongs to the media it was made on.
    waitForLabel("إيقاف مؤقت")
    capture("The next media plays after a paused one")
  }

  func testShareSheetKeepsTheSessionPlaying() {
    app.terminate(); app.launch()
    let first = opening()
    app.buttons["مشاركة المادة"].tap()
    let copy = app.cells["Copy"]
    XCTAssertTrue(copy.waitForExistence(timeout: 10), "The system share sheet should open")
    capture("System share sheet")
    copy.tap()
    XCTAssertTrue(session.waitForExistence(timeout: 10))
    // Title and link travel together; check with `xcrun simctl pbpaste`.
    XCTAssertEqual(session.identifier, first)
    waitForLabel("إيقاف مؤقت")
  }

  func testShareLinksStartNewSessionsAndPlainLinksKeepTheCurrentOne() {
    app.terminate(); app.launch()
    let first = opening()
    open("mofied://")
    XCTAssertEqual(session.identifier, first, "A plain link only brings the app forward")
    open("mofied://?start=26920")
    let second = opening(previous: first)
    capture("A share link opens a new session")
    XCUIDevice.shared.press(.home)
    XCTAssertTrue(app.wait(for: .runningBackground, timeout: 5))
    open("mofied://?start=44445")
    _ = opening(previous: second)
    app.terminate()
    // A cold launch from a share link.
    open("mofied://?start=26920")
    _ = opening()
  }
}
