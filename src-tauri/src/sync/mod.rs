pub mod apply;
pub mod changes;
pub mod client;

#[derive(Clone)]
pub struct SyncState {
    pub server_url: String,
    pub sync_key: String,
    pub last_sync: String,
    pub client: reqwest::Client,
}

impl SyncState {
    pub fn new(server_url: String, sync_key: String, last_sync: String) -> Self {
        Self {
            server_url,
            sync_key,
            last_sync,
            client: reqwest::Client::new(),
        }
    }
}
