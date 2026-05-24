use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

#[tokio::main]
async fn main() {
    let creds = Credentials::new("lingomindid@gmail.com".to_string(), "tnkheqhfpgjqcrgt".to_string());
    println!("Building mailer...");
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::from_url("smtps://smtp.gmail.com")
        .unwrap()
        .credentials(creds)
        .build();
    println!("Mailer built.");

    let email = Message::builder()
        .from("LingoMind <lingomindid@gmail.com>".parse().unwrap())
        .to("adhityarachmanh@gmail.com".parse().unwrap())
        .subject("Test LingoMind SMTPS")
        .body("Test SMTPS dari aplikasi Dioxus.".to_string())
        .unwrap();

    println!("Sending email...");
    match mailer.send(email).await {
        Ok(_) => println!("Email sent successfully!"),
        Err(e) => println!("Error: {}", e),
    }
}
