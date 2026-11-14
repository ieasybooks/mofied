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
    capture("A playing session continues after leaving the app")

    pause()
    leaveAndReturn()
    XCTAssertEqual(session.identifier, first)
    XCTAssertEqual(media.label, "تشغيل", "A manual pause survives leaving the app")
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
}
