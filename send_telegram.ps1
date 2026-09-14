$token = $env:TELEGRAM_BOT_TOKEN
$chatId = "450913223"
$filePath = "C:/project/nesarouter/NPWP CV. STAR JAYA ABADI.pdf"
$uri = "https://api.telegram.org/bot$token/sendDocument"
$form = @{
    chat_id = $chatId
    document = Get-Item $filePath
    caption = "NPWP CV. STAR JAYA ABADI"
}
$result = Invoke-RestMethod -Uri $uri -Method Post -Form $form
$result | ConvertTo-Json -Depth 5
