import Foundation

@main
struct InterruptionCacheCheck {
  static func main() {
    let cache = AudioInterruptionState()
    let group = DispatchGroup()
    let queue = DispatchQueue(label: "mofied.interruption-check", attributes: .concurrent)
    for worker in 0..<8 {
      group.enter()
      queue.async {
        for index in 0..<25_000 {
          switch worker {
          case 0:
            // The notification writer alternates beginning/end while JS reads.
            let interrupted = index % 2 == 0
            cache.update(interrupted: interrupted, mayResume: !interrupted)
          case 1:
            cache.setListener(index % 2 == 0 ? { payload in
              precondition(payload["interrupted"] != payload["mayResume"])
              // A callback can reconcile synchronously without deadlocking.
              _ = cache.snapshot
            } : nil)
          default:
            let snapshot = cache.snapshot
            precondition(snapshot.count == 2)
            precondition(snapshot["interrupted"] != snapshot["mayResume"])
          }
        }
        group.leave()
      }
    }
    precondition(group.wait(timeout: .now() + 30) == .success)
    print("PASS: 200,000 concurrent interruption updates, reconciliations, and listener changes")
  }
}
