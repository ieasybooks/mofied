import XCTest

@MainActor
final class PreloadTests: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
  let base = "http://127.0.0.1:8789"
  override func setUpWithError() throws { continueAfterFailure = false }

  func state(_ run: String) async throws -> [String: Any] {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "\(base)/qa/state?run=\(run)")!)
    return try JSONSerialization.jsonObject(with: data) as! [String: Any]
  }
  func waitState(_ run: String, _ condition: @escaping ([String: Any]) -> Bool) async throws -> [String: Any] {
    let until = Date().addingTimeInterval(25)
    while Date() < until {
      let current = try await state(run)
      if condition(current) { return current }
      try await Task.sleep(nanoseconds: 100_000_000)
    }
    let current = try await state(run)
    XCTFail("Playback state timed out: \(current)")
    return current
  }
  func tap(_ label: String) {
    let matches = app.buttons.matching(NSPredicate(format: "label == %@", label))
    XCTAssertTrue(matches.firstMatch.waitForExistence(timeout: 20), app.debugDescription)
    (matches.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? matches.firstMatch).tap()
  }
  func swipe() {
    let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.63))
    start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -310)), withVelocity: .slow, thenHoldForDuration: 0.15)
  }
  func open(_ run: String, native: Bool = false) {
    app.activate()
    let address = app.textFields["Address"]
    XCTAssertTrue(address.waitForExistence(timeout: 10), app.debugDescription)
    address.tap()
    address.typeText("\(base)/?test-session=1&qa-run=\(run)&qa-native=\(native ? 1 : 0)\n")
    XCTAssertTrue(app.links["Preload QA 1"].waitForExistence(timeout: 25), app.debugDescription)
  }

  func testManagedMediaSourceUsesWarmBytesThroughAudibleSwipes() async throws {
    let run = UUID().uuidString
    open(run)
    tap("تشغيل الصوت")
    let first = try await waitState(run) { ($0["item"] as? String) == "qa-0" && ($0["time"] as? Double ?? 0) > 0.4 && ($0["warm"] as? Bool) == true }
    XCTAssertEqual(first["managed"] as? Bool, true)
    XCTAssertTrue((first["src"] as? String ?? "").hasPrefix("blob:"), "\(first)")
    for n in 1...3 {
      swipe()
      let current = try await waitState(run) { ($0["item"] as? String) == "qa-\(n)" && ($0["time"] as? Double ?? 0) > 0.4 && ($0["cover"] as? Bool) == false && ($0["warm"] as? Bool) == true }
      XCTAssertEqual(current["muted"] as? Bool, false)
      XCTAssertEqual(current["video"] as? Int, first["video"] as? Int)
      XCTAssertEqual(current["itemNotices"] as? Int, 0, "\(current)")
      XCTAssertEqual(current["duplicateOpeningRequests"] as? Int, 0, "\(current)")
      XCTAssertTrue((current["src"] as? String ?? "").hasPrefix("blob:"))
      XCTAssertEqual(current["playErrors"] as? Int, 0)
    }
    tap("عن التطبيق")
    let paused = try await waitState(run) { ($0["paused"] as? Bool) == true }
    try await Task.sleep(nanoseconds: 900_000_000)
    let stillPaused = try await state(run)
    XCTAssertEqual(stillPaused["time"] as? Double ?? -1, paused["time"] as? Double ?? -2, accuracy: 0.05)
    tap("متابعة المشاهدة")
    _ = try await waitState(run) { ($0["time"] as? Double ?? 0) > (paused["time"] as? Double ?? 0) + 0.4 }
    print("WEB_PRELOAD_PASS \(run) \(try await state(run))")
    tap("إيقاف مؤقت")
  }

  func testNativeFallbackStillPlaysWithSound() async throws {
    let run = UUID().uuidString
    open(run, native: true)
    tap("تشغيل الصوت")
    let first = try await waitState(run) { ($0["item"] as? String) == "qa-0" && ($0["time"] as? Double ?? 0) > 0.4 }
    XCTAssertFalse((first["src"] as? String ?? "").hasPrefix("blob:"))
    swipe()
    let next = try await waitState(run) { ($0["item"] as? String) == "qa-1" && ($0["time"] as? Double ?? 0) > 0.4 }
    XCTAssertEqual(next["video"] as? Int, first["video"] as? Int)
    XCTAssertEqual(next["muted"] as? Bool, false)
    XCTAssertEqual(next["playErrors"] as? Int, 0)
    print("WEB_NATIVE_FALLBACK_PASS \(run) \(next)")
    tap("إيقاف مؤقت")
  }
  func testLiveProductionStreams() async throws {
    try XCTSkipUnless(ProcessInfo.processInfo.environment["MOFIED_LIVE_API"] == "1", "Opt-in production-media check")
    let run = UUID().uuidString
    app.activate()
    let address = app.textFields["Address"]
    XCTAssertTrue(address.waitForExistence(timeout: 10))
    address.tap()
    address.typeText("\(base)/?test-session=1&qa-run=\(run)&qa-live=1\n")
    var current = try await waitState(run) { ($0["time"] as? Double ?? 0) > 0.5 && ($0["warm"] as? Bool) == true }
    tap("تشغيل الصوت")
    for _ in 0..<4 {
      let target = current["nextId"] as! String
      swipe()
      current = try await waitState(run) { ($0["item"] as? String) == target && ($0["time"] as? Double ?? 0) > 0.5 && ($0["warm"] as? Bool) == true }
      XCTAssertTrue((current["src"] as? String ?? "").hasPrefix("blob:"))
      XCTAssertEqual(current["muted"] as? Bool, false)
      XCTAssertEqual(current["itemNotices"] as? Int, 0, "\(current)")
      XCTAssertEqual(current["duplicateOpeningRequests"] as? Int, 0, "\(current)")
      XCTAssertEqual(current["playErrors"] as? Int, 0)
    }
    print("WEB_LIVE_PRELOAD_PASS \(run) \(current)")
    tap("إيقاف مؤقت")
  }

  func testTitleAndSpeakerTouchSwipesKeepNativeLinkTaps() async throws {
    let run = UUID().uuidString
    open(run)
    tap("تشغيل الصوت")
    let first = try await waitState(run) { ($0["item"] as? String) == "qa-0" && ($0["time"] as? Double ?? 0) > 0.3 }
    let speakerName = try XCTUnwrap(first["speakerName"] as? String)
    for (index, label) in ["Preload QA 1", speakerName].enumerated() {
      let link = app.links[label]
      XCTAssertTrue(link.waitForExistence(timeout: 10))
      let origin = link.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
      origin.press(forDuration: 0.05, thenDragTo: origin.withOffset(CGVector(dx: 0, dy: -250)), withVelocity: .slow, thenHoldForDuration: 0.15)
      let next = try await waitState(run) { ($0["item"] as? String) == "qa-\(index + 1)" && ($0["time"] as? Double ?? 0) > 0.3 }
      XCTAssertEqual(next["video"] as? Int, first["video"] as? Int)
      XCTAssertEqual(next["muted"] as? Bool, false)
      XCTAssertEqual(next["playErrors"] as? Int, 0)
      // A background page can still post traces: assert Safari stayed on Mofied.
      XCTAssertTrue(app.links["Preload QA \(index + 2)"].exists)
    }
    tap("إيقاف مؤقت")
    let paused = try await state(run)
    let title = app.links["Preload QA 3"]
    let origin = title.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    origin.press(forDuration: 0.05, thenDragTo: origin.withOffset(CGVector(dx: 0, dy: -40)), withVelocity: .slow, thenHoldForDuration: 0.25)
    try await Task.sleep(nanoseconds: 500_000_000)
    let cancelled = try await state(run)
    XCTAssertEqual(cancelled["item"] as? String, "qa-2")
    XCTAssertEqual(cancelled["paused"] as? Bool, true)
    XCTAssertEqual(cancelled["time"] as? Double ?? -1, paused["time"] as? Double ?? -2, accuracy: 0.05)
    title.tap()
    let address = app.textFields["Address"]
    let destination = expectation(for: NSPredicate(format: "value CONTAINS[c] %@", "faqieh.com"), evaluatedWith: address)
    await fulfillment(of: [destination], timeout: 20)

    // The speaker remains a real link too. Pause before leaving this second page.
    let speakerRun = UUID().uuidString
    open(speakerRun)
    _ = try await waitState(speakerRun) { ($0["time"] as? Double ?? 0) > 0.3 }
    tap("إيقاف مؤقت")
    app.links[speakerName].tap()
    let speakerDestination = expectation(for: NSPredicate(format: "value CONTAINS[c] %@", "faqieh.com"), evaluatedWith: address)
    await fulfillment(of: [speakerDestination], timeout: 20)
    print("WEB_LINK_TOUCH_PASS \(run) \(speakerRun)")
  }

}
