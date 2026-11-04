# イベントでHTMLを試遊・公開する

## 動作の違い

GitHub Pages版では「HTMLで遊ぶ」から同じ端末で試遊し、公開済みURLのQRを作成できる。「ゲーム作品一覧」では登録済みの作品をカードから選べる。プレイ画面の「大画面」で表示領域を広げられる。

### GitHub Pagesへ事前登録

1. 確認済みのHTMLを「HTMLで遊ぶ」で開き、「運営者がGitHub Pagesに事前登録する」を開く。
2. 作品名と作品IDを確認して登録用JSONを保存する。たとえば `Tool Tidying.html` からは `tool-tidying.json` が提案される。作品IDは日本語・小文字の英数字・ハイフンで変更できる。
3. JSONを `public/games/` に追加してpushする。GitHub Actionsが作品一覧を自動生成する。公開後は `play.html?game=tool-tidying` のようにJSONの拡張子を除いた名前で開ける。
4. 既存のJSONをリネームすると、作品一覧には新しい名前が反映される。以前配ったURLとQRは、新しいファイル名に合わせて作り直す。

会場で新しいHTMLを受け付け、GitHubの再配信を待たずに参加者へQRを渡す場合は、同じアプリをNode.jsのイベント配信モードで起動する。

## 会場内で配信

1. 運営PCと参加者のスマートフォンが、端末間通信を許可する会場ネットワークにつながることを確認する。運営PCのLAN側IPv4アドレスを控える。
2. プロジェクトのディレクトリで、以下をPowerShellで実行する。`192.168.1.20` は実際の運営PCのアドレスに置き換える。

```powershell
$env:EVENT_HOST = '0.0.0.0'
$env:EVENT_PUBLIC_URL = 'http://192.168.1.20:4173/'
$env:EVENT_PUBLISH_KEY = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
Write-Host "公開キーを補助担当者に手渡してください: $env:EVENT_PUBLISH_KEY"
npm run dev
```

3. 補助担当者は運営PCの `http://127.0.0.1:4173/play.html` を開く。参加者が持参したHTMLをドロップし、タッチ操作、個人情報、内容を確認する。
4. 「補助生徒・運営者の公開操作」に公開キーを入力し、「公開してQRをつくる」を押す。参加者のスマートフォンでQRを読み取ってプレイする。最初は `examples/sorting/index.html` で動作確認できる。
5. 必要に応じて「この作品の公開を終了」を使う。作品は24時間で取得できなくなり、期限切れの保存ファイルは次の公開処理時に整理される。会場での配信を終えたらサーバーを停止する。

LAN配信のQRは会場外や携帯回線だけの端末からは開けない。会場外からも使う場合はNode.jsサーバーをHTTPSで配信し、`EVENT_PUBLIC_URL` を公開ルートURL、`EVENT_GAME_DIR` を永続保存ディレクトリに設定する。GitHub Pagesの静的配信にはアップロードAPIを配置できない。HTTPSの配信環境では公開キーをサーバーの環境変数として設定する。

## 受け付ける作品

- UTF-8のHTML一枚、512 KBまで。画像と音声はHTMLに内包し、外部通信なしで遊べるものを使う。
- iframeを `allow-scripts` だけのサンドボックスに入れ、外部サブリソースやフォーム送信を制限する。作品データはAPIからJSONとして取得する。ブラウザー側の隔離に加え、公開する作品は補助担当者が実際に確認する。
- 同時に公開する上限は100件。作品を探すための一覧は設けず、URLを知っている人が取得できる。URLを転送できるため、参加者の氏名、写真、連絡先は入れない。
- イベント本番前に、会場のWi-FiでiPhoneとAndroidの実機を使い、QR読取・起動・タッチ操作・再スタートを確認する。
