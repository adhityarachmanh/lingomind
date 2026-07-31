use bcrypt::{hash, DEFAULT_COST};

fn main() {
    let password = "admin";
    let hashed = hash(password, DEFAULT_COST).unwrap();
    println!("Hash for 'admin': {}", hashed);
}
