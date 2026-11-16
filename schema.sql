-- Do Whatever Community — D1 (SQLite) schema
-- Port of the v5 artifact schema (server/src/schema.ts) for Cloudflare Pages
-- Functions, D1 binding name: DB.
--
-- NOTES
-- * Timestamps are INTEGER milliseconds since epoch (matches the artifact's
--   drizzle timestamp_ms columns).
-- * Booleans are INTEGER 0/1.
-- * Blob keys are TEXT pointers into the R2 bucket bound as IMAGES
--   (avatars, post/listing photos, model display pictures, adult welcome
--   picture). The image BYTES never live in D1.
-- * ID photos are NEVER stored in this database. Age-verification review
--   rows (age_verification_requests) hold only an R2 object key in the
--   separate ID_VAULT bucket while a review is pending; the key is cleared
--   and the R2 object deleted the moment the operator decides.
-- * profiles.is_operator is an addition over the artifact schema: it gates
--   the Reports inbox and the age-verification review queue to the
--   operator (Chris). It is set by the first-run claim endpoint
--   POST /api/owner/setup (only while no operator exists), or by matching
--   the OPERATOR_DEVICE_ID Pages variable.
-- * The production database starts EMPTY — no data migration from the
--   artifact. Apply with: wrangler d1 execute dwc --file=schema.sql
--   (or via the Cloudflare dashboard once the database is created).

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  birthday TEXT,
  terms_agreed_at INTEGER,
  age_verified INTEGER NOT NULL DEFAULT 0,
  is_operator INTEGER NOT NULL DEFAULT 0,
  chat_name TEXT NOT NULL DEFAULT '',
  occupation TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_blob_key TEXT,
  payout_method TEXT NOT NULL DEFAULT '',
  payout_handle TEXT NOT NULL DEFAULT '',
  -- MySpace throwback v2 (added by community-v2-migration.sql on live D1)
  top_friends TEXT NOT NULL DEFAULT '',
  layout_css TEXT NOT NULL DEFAULT '',
  layout_preset TEXT NOT NULL DEFAULT '',
  presence_status TEXT NOT NULL DEFAULT 'offline',
  away_message TEXT NOT NULL DEFAULT '',
  last_seen INTEGER,
  is_model INTEGER NOT NULL DEFAULT 0,
  model_bio TEXT NOT NULL DEFAULT '',
  model_categories TEXT NOT NULL DEFAULT '',
  model_display_blob_key TEXT,
  model_gender TEXT NOT NULL DEFAULT '',
  model_eye_color TEXT NOT NULL DEFAULT '',
  model_weight_lbs INTEGER,
  model_styles TEXT NOT NULL DEFAULT '',
  model_music TEXT NOT NULL DEFAULT '',
  model_gamer TEXT NOT NULL DEFAULT '',
  model_breast TEXT NOT NULL DEFAULT '',
  model_ink TEXT NOT NULL DEFAULT '',
  -- Creator/Seller area v3 (added by community-v3-migration.sql on live D1)
  seller_types TEXT NOT NULL DEFAULT '',
  seller_tags TEXT NOT NULL DEFAULT '',
  seller_open_to TEXT NOT NULL DEFAULT '',
  seller_price_min_cents INTEGER NOT NULL DEFAULT 0,
  seller_price_max_cents INTEGER NOT NULL DEFAULT 0,
  buyer_types TEXT NOT NULL DEFAULT '',
  buyer_tags TEXT NOT NULL DEFAULT '',
  buyer_budget_max_cents INTEGER NOT NULL DEFAULT 0,
  -- Music (v3.1, added by community-v3-migration.sql on live D1)
  ash_tracks TEXT NOT NULL DEFAULT '', -- A Steady Heart picks: track numbers 1–21, max 5
  show_vnr_player INTEGER NOT NULL DEFAULT 0, -- opt-in Vita Nova Radio player on the member page
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One account per person: name + date of birth must be unique (when a
-- birthday is on file). The server also checks this case-insensitively
-- with whitespace collapsed and returns the friendly error.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_name_dob
  ON profiles (lower(full_name), birthday) WHERE birthday IS NOT NULL;

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'forum', -- forum | card_auth | adult
  flair TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '', -- comma-separated, normalized lowercase
  allow_comments INTEGER NOT NULL DEFAULT 1,
  image_blob_key TEXT,
  gif_url TEXT,
  gif_label TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'not_checked',
  verification_summary TEXT NOT NULL DEFAULT '',
  -- Creator/Seller area v3 (added by community-v3-migration.sql on live D1)
  is_creator INTEGER NOT NULL DEFAULT 0,
  content_genre TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  file_blob_key TEXT,
  file_name TEXT NOT NULL DEFAULT '',
  file_mime TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_profile ON posts (profile_id);
CREATE INDEX IF NOT EXISTS idx_posts_kind ON posts (kind);
CREATE INDEX IF NOT EXISTS idx_posts_creator ON posts (is_creator);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  gif_url TEXT,
  gif_label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);

CREATE TABLE IF NOT EXISTS post_votes (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  value INTEGER NOT NULL, -- hearts only: 1 (legacy -1 rows are upgraded to 1)
  PRIMARY KEY (post_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_post_votes_post ON post_votes (post_id);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id INTEGER NOT NULL REFERENCES comments(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  value INTEGER NOT NULL, -- hearts only: 1
  PRIMARY KEY (comment_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON comment_votes (comment_id);

CREATE TABLE IF NOT EXISTS auth_votes (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  verdict TEXT NOT NULL, -- real | fake | unsure
  PRIMARY KEY (post_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_votes_post ON auth_votes (post_id);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL, -- sanitized HTML (b/strong/i/em/u/s/ul/ol/li/br/p/a only)
  price_cents INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Pokemon Cards',
  kind TEXT NOT NULL DEFAULT 'sale', -- sale | trade | flea
  image_blob_key TEXT,
  image2_blob_key TEXT,
  image3_blob_key TEXT,
  gif_url TEXT,
  trade_wanted TEXT NOT NULL DEFAULT '',
  allow_comments INTEGER NOT NULL DEFAULT 1,
  verification_status TEXT NOT NULL DEFAULT 'not_checked',
  verification_summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active', -- active | sold
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings_profile ON listings (profile_id);
CREATE INDEX IF NOT EXISTS idx_listings_kind_status ON listings (kind, status);

CREATE TABLE IF NOT EXISTS bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  amount_cents INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bids_listing ON bids (listing_id);

CREATE TABLE IF NOT EXISTS trade_votes (
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  verdict TEXT NOT NULL, -- good | fair | bad
  PRIMARY KEY (listing_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_trade_votes_listing ON trade_votes (listing_id);

CREATE TABLE IF NOT EXISTS listing_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  gif_url TEXT,
  gif_label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listing_comments_listing ON listing_comments (listing_id);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  buyer_id INTEGER NOT NULL REFERENCES profiles(id),
  seller_id INTEGER NOT NULL REFERENCES profiles(id),
  item_title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid', -- paid | shipped | delivered
  carrier TEXT NOT NULL DEFAULT '',
  tracking_number TEXT NOT NULL DEFAULT '',
  tracking_alerts INTEGER NOT NULL DEFAULT 0, -- stored preference only; no email sends yet
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders (listing_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES profiles(id), -- NULL = guest
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  censored INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages (created_at);

-- MySpace throwback v2: 1:1 instant messages between members (AIM-style).
-- is_read flips to 1 when the recipient opens the conversation.
CREATE TABLE IF NOT EXISTS direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES profiles(id),
  recipient_id INTEGER NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON direct_messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages (recipient_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL, -- post | comment | listing
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', -- open | reviewed
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter_id);

CREATE TABLE IF NOT EXISTS payout_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  kind TEXT NOT NULL, -- sale_credit | payout_request
  amount_cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | available | requested | sent
  order_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payout_profile ON payout_entries (profile_id);
CREATE INDEX IF NOT EXISTS idx_payout_order ON payout_entries (order_id);

-- Community-reported ACTUAL card sales — the data the Card Check price
-- chart is built from. card_key is the normalized name used for matching.
CREATE TABLE IF NOT EXISTS card_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  card_name TEXT NOT NULL,
  card_key TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  sold_date TEXT NOT NULL, -- YYYY-MM-DD
  venue TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_card_sales_key ON card_sales (card_key);
CREATE INDEX IF NOT EXISTS idx_card_sales_profile ON card_sales (profile_id);

-- The single 18+ welcome-screen picture slot (id = 1). Starts EMPTY —
-- the operator uploads their own welcome picture; no stock photo.
CREATE TABLE IF NOT EXISTS adult_welcome (
  id INTEGER PRIMARY KEY,
  image_blob_key TEXT,
  set_by_profile_id INTEGER,
  updated_at INTEGER NOT NULL
);

-- Age-verification review queue (OPERATOR REVIEW, not AI auto-check).
-- A member uploads a photo ID; the Function stores the image in the
-- separate ID_VAULT R2 bucket and inserts one row here with status
-- 'pending'. The operator reviews the image (via the operator-only
-- id-image endpoint), approves or rejects, the R2 object is deleted
-- immediately, and blob_key is set to NULL — the only record kept is the
-- decision (status + timestamps) and the age_verified flag on the profile.
-- NO ID image, name, birthdate, or ID number from the ID is ever written
-- to this table or any table.
CREATE TABLE IF NOT EXISTS age_verification_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  blob_key TEXT, -- R2 key in ID_VAULT while pending; NULL after decision
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by_profile_id INTEGER REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_age_req_status ON age_verification_requests (status);
CREATE INDEX IF NOT EXISTS idx_age_req_profile ON age_verification_requests (profile_id);

-- Creator/Seller area v3 — ephemeral private conversations (seller <-> buyer).
-- Messages are stored server-side in D1 and DELETED when the conversation
-- is closed. That is private + ephemeral, NOT true end-to-end encryption
-- (no client key exchange on this stack). The UI says "Private · deletes
-- when closed" and never calls it end-to-end encrypted.
-- A conversation is one pair of members (member_a_id / member_b_id, either
-- order); at most one OPEN conversation per pair. post_id is set when the
-- chat was started from a creator post, so the seller knows what it's about.
-- closed_at NULL = open; set = closed and all its messages deleted.
CREATE TABLE IF NOT EXISTS ephemeral_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_a_id INTEGER NOT NULL REFERENCES profiles(id),
  member_b_id INTEGER NOT NULL REFERENCES profiles(id),
  post_id INTEGER REFERENCES posts(id),
  created_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_eph_pair ON ephemeral_conversations (member_a_id, member_b_id);
CREATE INDEX IF NOT EXISTS idx_eph_last ON ephemeral_conversations (last_message_at);

CREATE TABLE IF NOT EXISTS ephemeral_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES ephemeral_conversations(id),
  sender_id INTEGER NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eph_msg_conv ON ephemeral_messages (conversation_id, created_at);

-- Receipts (v3.1) — invoice / money-spent history for private chats.
-- Saved when a transaction is marked done in a private chat, before the
-- messages are deleted — the receipt survives the delete. Per-user:
-- profile_id is the owner; GET only returns the caller's own rows. Both
-- parties get one (buyer "spent", seller "received"). No chat content is
-- kept — only amount, note, other username, kind, date. One transaction
-- per conversation.
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  conversation_id INTEGER REFERENCES ephemeral_conversations(id),
  other_profile_id INTEGER NOT NULL REFERENCES profiles(id),
  other_username TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'spent', -- spent | received
  amount_cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_profile ON receipts (profile_id, created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_conv ON receipts (conversation_id);
