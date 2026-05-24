#[cfg(not(target_arch = "wasm32"))]
use tokio_cron_scheduler::{Job, JobScheduler};
#[cfg(not(target_arch = "wasm32"))]
use lettre::{
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};
#[cfg(not(target_arch = "wasm32"))]
use sqlx::Row;

#[cfg(not(target_arch = "wasm32"))]
pub async fn start_cron_jobs() -> Result<(), Box<dyn std::error::Error>> {
    let sched = JobScheduler::new().await?;

    // Jadwal berjalan setiap hari jam 08:00:00 (Waktu server)
    // Format Cron: detik menit jam hari_bulan bulan hari_minggu
    sched.add(
        Job::new_async("0 0 8 * * *", |_uuid, mut _l| {
            Box::pin(async move {
                println!("Menjalankan Cron Job: Mengirim Email Pengingat Harian...");
                if let Err(e) = send_daily_reminders().await {
                    eprintln!("Error saat mengirim pengingat harian: {}", e);
                } else {
                    println!("Berhasil menyelesaikan Cron Job Pengingat Harian.");
                }
            })
        })?
    ).await?;

    // Mulai scheduler di background task agar tidak memblokir aplikasi
    let _ = tokio::spawn(async move {
        if let Err(e) = sched.start().await {
            eprintln!("Error pada cron scheduler: {}", e);
        }
    });

    Ok(())
}

#[cfg(not(target_arch = "wasm32"))]
async fn send_daily_reminders() -> Result<(), Box<dyn std::error::Error>> {
    let pool = crate::services::db::get_pool();
    
    // Ambil semua pengguna yang sudah diverifikasi dan HANYA yang belum aktif hari ini
    // Atau yang last_active_date-nya NULL.
    let rows = sqlx::query(
        "SELECT u.email, u.full_name, e.current_streak \
         FROM users u \
         JOIN user_engagement_stats e ON u.email = e.email \
         WHERE u.is_verified = true \
           AND (e.last_active_date < CURRENT_DATE OR e.last_active_date IS NULL)"
    )
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        println!("Tidak ada pengguna yang membutuhkan pengingat hari ini.");
        return Ok(());
    }

    let smtp_username = std::env::var("SMTP_USERNAME").unwrap_or_else(|_| "lingomindid@gmail.com".to_string());
    let smtp_password = std::env::var("SMTP_PASSWORD").ok();

    if smtp_password.is_none() {
        println!("SMTP_PASSWORD tidak diatur. Pengingat tidak akan dikirimkan.");
        return Ok(());
    }

    let creds = Credentials::new(smtp_username.clone(), smtp_password.unwrap());
    let mailer = SmtpTransport::relay("smtp.gmail.com")
        .unwrap()
        .credentials(creds)
        .port(587)
        .build();

    let app_url = std::env::var("APP_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());

    for row in rows {
        let email: String = row.get("email");
        let full_name: String = row.get("full_name");
        let current_streak: i32 = row.get("current_streak");

        let subject = "Saatnya Belajar Bahasa di LingoMind! 🚀";
        
        let body = if current_streak > 0 {
            format!(
                "Hai {},\n\n\
                Hebat! Pertahankan streak {} harimu! Mari luangkan waktu beberapa menit hari ini untuk belajar dan menjaga streak-mu agar tidak kembali ke nol.\n\n\
                Klik di sini untuk mulai belajar: {}\n\n\
                Salam hangat,\nLingoMind Team",
                full_name, current_streak, app_url
            )
        } else {
            format!(
                "Hai {},\n\n\
                Mari mulai belajar hari ini dan bangun streak-mu di LingoMind! Konsistensi adalah kunci dalam mempelajari bahasa baru.\n\n\
                Klik di sini untuk mulai belajar: {}\n\n\
                Salam hangat,\nLingoMind Team",
                full_name, app_url
            )
        };

        let email_msg_res = Message::builder()
            .from(format!("LingoMind <{}>", smtp_username).parse()?)
            .to(email.parse()?)
            .subject(subject)
            .body(body);

        if let Ok(email_msg) = email_msg_res {
            let mailer_clone = mailer.clone();
            let _ = tokio::task::spawn_blocking(move || {
                let _ = mailer_clone.send(&email_msg);
            }).await;
            println!("Pengingat harian dikirim ke: {}", email);
        }
    }

    Ok(())
}
