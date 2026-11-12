# Glassly (Android)

Okul bilgi sistemine bağlanan, **resmi olmayan** bir öğrenci uygulaması.

## Önemli not
Bu proje Akbim ya da başka bir şirketle bağlantılı değildir, onlar tarafından onaylanmamıştır ve resmi bir ürün değildir. Adı geçen tüm ürün ve marka adları kendi sahiplerine aittir. Uygulama; adında, simgesinde ve görsellerinde bu markalardan hiçbirini kullanmaz.

## Nasıl çalışır
- Kullanıcı yalnızca **kendi** kullanıcı adı ve şifresiyle giriş yapar ve yalnızca kendi hesabındaki bilgilere ulaşır.
- Telefon doğrudan okul sistemine bağlanır; araya başka bir sunucu girmez.
- Şifre telefonda, kullanıcının belirlediği PIN ile şifrelenerek saklanır (AES-GCM + PBKDF2). İstenirse uygulamadan silinebilir.
- Uygulama toplu ya da otomatik istek göndermek için yazılmamıştır.

## Sorumluluk
Uygulama "olduğu gibi" sunulur, hiçbir garanti verilmez. Kullanımdan doğan sonuçlar kullanıcıya aittir. Okulun ve sistem sağlayıcısının kullanım şartlarına uymak kullanıcının sorumluluğundadır.

## APK nasıl alınır
GitHub'daki **Actions** sekmesinden son "Build APK" çalışmasını aç, sayfanın altındaki **Artifacts** bölümünden APK'yı indir.

## Kaldırma talebi
Hak sahibi bir kurum ya da kişi bu projenin kaldırılmasını isterse, depo sahibine GitHub üzerinden yazması yeterlidir.
