use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

#[tokio::main]
async fn main() {
    let creds = Credentials::new("lingomindid@gmail.com".to_string(), "tnkheqhfpgjqcrgt".to_string());
    println!("Building mailer...");
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay("smtp.gmail.com")
        .unwrap()
        .credentials(creds)
        // .port(465)
        // .tls(lettre::transport::smtp::client::Tls::Wrapper(
        //     lettre::transport::smtp::client::TlsParameters::builder("smtp.gmail.com".to_string())
        //         .build()
        //         .unwrap(),
        // ))
        .build();
    println!("Mailer built.");

    let email = Message::builder()
        .from("LingoMind <lingomindid@gmail.com>".parse().unwrap())
        .to("test@example.com".parse().unwrap())
        .subject("Test")
        .body("Test".to_string())
        .unwrap();

    println!("Sending email...");
    match mailer.send(email).await {
        Ok(_) => println!("Email sent!"),
        Err(e) => println!("Error: {}", e),
    }
}
