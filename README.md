# Glassly (Android)

Okul panelin, cebinde. Telefon doğrudan okul sunucusuna bağlanır; araya başka sunucu girmez.

## APK nasıl alınır (bilgisayar gerekmez, tarayıcıdan yapılır)
1. github.com'da yeni bir **özel (private)** depo aç, adı `glassly` olsun.
2. Bu klasörün içindeki **her şeyi** (`.github` klasörü dahil) depoya yükle ("Add file > Upload files").
3. Depoda **Actions** sekmesine gir. "Build APK" kendiliğinden çalışır (5-10 dk). Çalışmazsa "Run workflow" de.
4. Bitince çalışmanın içindeki **Glassly-APK** dosyasını indir, zip'ten çıkar.
5. `app-debug.apk` dosyasını telefona at, aç. "Bilinmeyen kaynaklardan yükle" izni isteyebilir, ver.

## Güvenlik
- Şifre ve TC sadece "Beni hatırla" seçersen kaydedilir ve **PIN ile şifrelenir** (AES-256). 5 yanlış PIN'de silinir.
- Veriler yalnızca okul sunucusuyla, HTTPS üzerinden konuşur.
