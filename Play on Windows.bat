@echo off
rem Red Dust Outpost - play this version on a Windows computer.
rem Double-click this file. It starts a small local web server for the "www" folder and opens the game in your browser.
rem Keep this window open while you play. Close it to stop.
cd /d "%~dp0www"
set PORT=8090
start "" "http://localhost:%PORT%/index.html"
where py >nul 2>nul && (py -m http.server %PORT% & goto :eof)
where python >nul 2>nul && (python -m http.server %PORT% & goto :eof)
echo Python not found - using the built-in Windows server instead.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$root=(Get-Location).Path; $l=New-Object Net.HttpListener; $l.Prefixes.Add('http://localhost:%PORT%/'); $l.Start(); Write-Host 'Red Dust Outpost is running at http://localhost:%PORT%/ - keep this window open.';" ^
 "$t=@{'.html'='text/html';'.js'='text/javascript';'.mjs'='text/javascript';'.css'='text/css';'.json'='application/json';'.png'='image/png';'.jpg'='image/jpeg';'.jpeg'='image/jpeg';'.webp'='image/webp';'.svg'='image/svg+xml';'.glb'='model/gltf-binary';'.gltf'='model/gltf+json';'.bin'='application/octet-stream';'.wasm'='application/wasm';'.mp3'='audio/mpeg';'.ogg'='audio/ogg';'.wav'='audio/wav';'.ico'='image/x-icon';'.webmanifest'='application/manifest+json';'.ktx2'='image/ktx2'};" ^
 "while($l.IsListening){ $c=$l.GetContext(); $p=[Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/')); if($p -eq ''){$p='index.html'}; $f=Join-Path $root $p;" ^
 " try{ if(Test-Path $f -PathType Leaf){ $b=[IO.File]::ReadAllBytes($f); $e=[IO.Path]::GetExtension($f).ToLower(); $c.Response.ContentType=$(if($t[$e]){$t[$e]}else{'application/octet-stream'}); $c.Response.ContentLength64=$b.Length; $c.Response.OutputStream.Write($b,0,$b.Length) } else { $c.Response.StatusCode=404 } } catch {} ; $c.Response.Close() }"
