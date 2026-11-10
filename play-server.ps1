# Red Dust Outpost - a tiny local web server so the game can run on a Windows computer.
# Started by "Play on Windows.bat". Serves the "www" folder, then opens the game in your browser.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'www'
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.css'='text/css'; '.json'='application/json';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.gif'='image/gif'; '.svg'='image/svg+xml'; '.ico'='image/x-icon';
  '.glb'='model/gltf-binary'; '.gltf'='model/gltf+json'; '.bin'='application/octet-stream'; '.wasm'='application/wasm'; '.ktx2'='image/ktx2';
  '.mp3'='audio/mpeg'; '.ogg'='audio/ogg'; '.wav'='audio/wav'; '.m4a'='audio/mp4'; '.webmanifest'='application/manifest+json'; '.txt'='text/plain' }
$listener = $null; $port = 0
foreach ($p in 8090..8099) {   # use the first free port
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $listener = $l; $port = $p; break } catch { }
}
if (-not $listener) { Write-Host 'Could not start the local server (ports 8090-8099 are all busy).'; Read-Host 'Press Enter to close'; exit 1 }
$url = "http://localhost:$port/index.html"
Write-Host ''
Write-Host "  Red Dust Outpost is running at $url"
Write-Host '  Keep this window open while you play. Close it to stop the game.'
Write-Host ''
Start-Process $url
while ($listener.IsListening) {
  $ctx = $listener.GetContext(); $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '' -or $rel.EndsWith('/')) { $rel = $rel + 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and [IO.File]::Exists($file)) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $fs = [IO.File]::OpenRead($file); $res.ContentLength64 = $fs.Length; $fs.CopyTo($res.OutputStream); $fs.Close()
    } else { $res.StatusCode = 404 }
  } catch { try { $res.StatusCode = 500 } catch { } }
  try { $res.Close() } catch { }
}
