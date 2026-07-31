use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PetData {
    pub id: i32,
    pub pet_type: String, // "dragon", "owl", "fenrir"
    pub stage: i32,       // 1, 2, 3, 4
    pub exp: i32,
    pub emoji: String,
    pub label: String,
}
