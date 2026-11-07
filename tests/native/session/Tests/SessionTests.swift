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
    XCTAssertTrue(session.waitForExistence(timeout: 30), "Fresh API session should load")
    let id = session.identifier
    if let previous { XCTAssertNotEqual(id, previous, "Reopening must fetch a new server plan") }
    XCTAssertTrue(media.waitForExistence(timeout: 20))
    let playing = NSPredicate(format: "label == %@", "إيقاف مؤقت")
    expectation(for: playing, evaluatedWith: media)
    waitForExpectations(timeout: 20)
    return id
  }
  func pause() {
    if media.label == "إيقاف مؤقت" { media.tap() }
    XCTAssertEqual(media.label, "تشغيل")
  }
  func capture(_ name: String) {
    let a = XCTAttachment(screenshot: app.screenshot())
    a.name = name; a.lifetime = .keepAlways; add(a)
  }
  func testFreshSessionsAndInfoContinuity() {
    app.terminate(); app.launch()
    let first = opening()
    pause()
    app.buttons["عن التطبيق"].tap()
    app.buttons["سياسة الخصوصية"].tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "لا يُحفظ تقدم الجلسة")).firstMatch.waitForExistence(timeout: 10))
    app.buttons["رجوع"].tap()
    app.buttons["متابعة المشاهدة"].tap()
    XCTAssertEqual(session.identifier, first)
    XCTAssertEqual(media.label, "تشغيل")
    capture("Info preserves the current paused session")

    XCUIDevice.shared.press(.home)
    XCTAssertTrue(app.wait(for: .runningBackground, timeout: 5))
    app.activate()
    let second = opening(previous: first)
    capture("Paused foreground return gets a fresh playing session")

    XCUIDevice.shared.press(.home)
    XCTAssertTrue(app.wait(for: .runningBackground, timeout: 5))
    app.activate()
    let third = opening(previous: second)
    capture("Playing foreground return gets a fresh session")

    pause(); app.terminate(); app.launch()
    _ = opening(previous: third)
    capture("Cold relaunch gets a fresh session")
    pause()
  }
}
