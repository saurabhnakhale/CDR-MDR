$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:8088/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "HTTP server running at $prefix"
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $localPath = $request.Url.LocalPath
        if ($localPath -eq "/" -or $localPath -eq "") { $localPath = "/index.html" }
        $filePath = Join-Path $PSScriptRoot ($localPath.TrimStart("/").Replace("/", "\"))

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "text/plain; charset=utf-8"
            if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $mime = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $mime = "application/javascript; charset=utf-8" }
            elseif ($ext -eq ".json") { $mime = "application/json; charset=utf-8" }
            elseif ($ext -eq ".csv") { $mime = "text/csv; charset=utf-8" }
            
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
