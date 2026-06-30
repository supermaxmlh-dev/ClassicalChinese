import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let articlesDir = root.appendingPathComponent("data/articles")
let outputDir = root.appendingPathComponent("images/articles")
try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

func textValue(_ object: [String: Any], _ key: String) -> String {
  object[key] as? String ?? ""
}

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
  NSColor(
    calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
    green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255,
    alpha: alpha
  )
}

func font(_ name: String, _ size: CGFloat) -> NSFont {
  NSFont(name: name, size: size) ?? NSFont.systemFont(ofSize: size, weight: .semibold)
}

func drawMountain(seed: Int, y: CGFloat, height: CGFloat, fill: NSColor, width: CGFloat) {
  let path = NSBezierPath()
  path.move(to: NSPoint(x: 0, y: y))
  let points = [
    NSPoint(x: 80 + CGFloat(seed % 40), y: y + height * 0.42),
    NSPoint(x: 160 + CGFloat(seed % 70), y: y + height * 0.22),
    NSPoint(x: 250 + CGFloat(seed % 60), y: y + height * 0.72),
    NSPoint(x: 350 + CGFloat(seed % 80), y: y + height * 0.35),
    NSPoint(x: 470 + CGFloat(seed % 50), y: y + height * 0.82),
    NSPoint(x: 620 + CGFloat(seed % 90), y: y + height * 0.28),
    NSPoint(x: width, y: y + height * 0.58)
  ]
  points.forEach { path.line(to: $0) }
  path.line(to: NSPoint(x: width, y: y))
  path.close()
  fill.setFill()
  path.fill()
}

func drawImage(id: String, title: String, source: String, tags: [String]) throws {
  let seed = Int(id) ?? 1
  let palettes: [(UInt32, UInt32, UInt32)] = [
    (0xf7efe1, 0x5d6f65, 0xb94a3a),
    (0xf3eadb, 0x526a7a, 0xbe6f35),
    (0xf8f1df, 0x45645c, 0xa63d40),
    (0xf0eadf, 0x60705f, 0x315f72)
  ]
  let palette = palettes[seed % palettes.count]

  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: 800,
    pixelsHigh: 500,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    throw NSError(domain: "GuanzhiImage", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to create bitmap"])
  }

  let context = NSGraphicsContext(bitmapImageRep: bitmap)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  defer { NSGraphicsContext.restoreGraphicsState() }

  let rect = NSRect(x: 0, y: 0, width: 800, height: 500)
  color(palette.0).setFill()
  rect.fill()

  for x in stride(from: 0, through: 800, by: 32) {
    let line = NSBezierPath()
    line.move(to: NSPoint(x: CGFloat(x), y: 0))
    line.line(to: NSPoint(x: CGFloat(x), y: 500))
    color(0x8b4513, alpha: 0.045).setStroke()
    line.lineWidth = 1
    line.stroke()
  }
  for y in stride(from: 0, through: 500, by: 32) {
    let line = NSBezierPath()
    line.move(to: NSPoint(x: 0, y: CGFloat(y)))
    line.line(to: NSPoint(x: 800, y: CGFloat(y)))
    color(0x8b4513, alpha: 0.038).setStroke()
    line.lineWidth = 1
    line.stroke()
  }

  drawMountain(seed: seed * 7, y: 100, height: 210, fill: color(palette.1, alpha: 0.16), width: 800)
  drawMountain(seed: seed * 11, y: 64, height: 180, fill: color(palette.1, alpha: 0.24), width: 800)

  let sun = NSBezierPath(ovalIn: NSRect(x: 616, y: 326, width: 82, height: 82))
  color(palette.2, alpha: 0.66).setFill()
  sun.fill()

  let river = NSBezierPath()
  river.move(to: NSPoint(x: 0, y: 98))
  river.curve(to: NSPoint(x: 800, y: 128), controlPoint1: NSPoint(x: 180, y: 58), controlPoint2: NSPoint(x: 580, y: 176))
  river.line(to: NSPoint(x: 800, y: 0))
  river.line(to: NSPoint(x: 0, y: 0))
  river.close()
  color(0x6f8d91, alpha: 0.18).setFill()
  river.fill()

  let sealRect = NSRect(x: 68, y: 332, width: 72, height: 72)
  color(palette.2, alpha: 0.92).setFill()
  NSBezierPath(roundedRect: sealRect, xRadius: 8, yRadius: 8).fill()
  let first = String(title.prefix(1))
  first.draw(in: sealRect.insetBy(dx: 15, dy: 9), withAttributes: [
    .font: font("PingFangSC-Semibold", 42),
    .foregroundColor: color(0xfffbf2)
  ])

  let titleRect = NSRect(x: 162, y: 298, width: 520, height: 90)
  title.draw(in: titleRect, withAttributes: [
    .font: font("Songti SC", title.count > 7 ? 46 : 56),
    .foregroundColor: color(0x26302c),
    .kern: 1.0
  ])

  let subtitle = source.isEmpty ? tags.prefix(3).joined(separator: " · ") : source
  subtitle.draw(in: NSRect(x: 166, y: 264, width: 500, height: 36), withAttributes: [
    .font: font("PingFangSC-Regular", 21),
    .foregroundColor: color(0x5b625d)
  ])

  let caption = "观止学堂 · 文言文精读"
  caption.draw(in: NSRect(x: 560, y: 42, width: 190, height: 28), withAttributes: [
    .font: font("PingFangSC-Regular", 16),
    .foregroundColor: color(0x52605b, alpha: 0.86)
  ])

  guard let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.84]) else {
    throw NSError(domain: "GuanzhiImage", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to create JPEG"])
  }
  try jpeg.write(to: outputDir.appendingPathComponent("\(id)-main.jpg"))
}

let files = try FileManager.default.contentsOfDirectory(at: articlesDir, includingPropertiesForKeys: nil)
  .filter { $0.pathExtension == "json" }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }

for file in files {
  let data = try Data(contentsOf: file)
  guard
    let article = try JSONSerialization.jsonObject(with: data) as? [String: Any],
    let tags = article["tags"] as? [String]
  else { continue }
  try drawImage(
    id: textValue(article, "id"),
    title: textValue(article, "title"),
    source: textValue(article, "source"),
    tags: tags
  )
}

print("Generated \(files.count) article images in images/articles.")
