-- ═══════════════════════════════════════════════════════════════════════════
--  StayXPulse — schema drift check
--
--  Lists every column the BACKEND CODE reads or writes that is MISSING from the
--  live database. An empty result = code and database are in sync. Anything
--  returned is a latent "column not found" error waiting to happen.
--
--  Read-only. Safe to run anytime.
-- ═══════════════════════════════════════════════════════════════════════════

WITH expected(table_name, column_name) AS (VALUES
  -- hotels
  ('hotels','hotel_name'),('hotels','phone'),('hotels','email'),('hotels','address'),
  ('hotels','gst_number'),('hotels','logo_url'),('hotels','user_id'),('hotels','is_active'),
  ('hotels','subscription_status'),('hotels','trial_start_date'),('hotels','trial_end_date'),
  ('hotels','current_plan_id'),('hotels','plan_valid_from'),('hotels','plan_valid_to'),('hotels','created_at'),
  ('hotels','kitchen_hours_enabled'),('hotels','kitchen_open'),('hotels','kitchen_close'),('hotels','kitchen_slots'),
  -- users
  ('users','name'),('users','email'),('users','password_hash'),('users','role'),
  ('users','hotel_id'),('users','is_active'),('users','last_login'),
  ('users','reset_password_token'),('users','reset_password_expire'),('users','created_at'),
  -- plans
  ('plans','name'),('plans','price'),('plans','duration_days'),('plans','max_rooms'),
  ('plans','features'),('plans','is_active'),('plans','is_popular'),
  -- payments
  ('payments','hotel_id'),('payments','plan_id'),('payments','amount'),('payments','payment_id'),
  ('payments','invoice_number'),('payments','valid_from'),('payments','valid_to'),('payments','paid_at'),
  ('payments','notes'),('payments','gateway'),('payments','txnid'),('payments','razorpay_order_id'),('payments','created_at'),
  -- payment_orders
  ('payment_orders','hotel_id'),('payment_orders','plan_id'),('payment_orders','cycle'),
  ('payment_orders','amount'),('payment_orders','txnid'),('payment_orders','gateway'),
  ('payment_orders','gateway_payment_id'),('payment_orders','status'),('payment_orders','valid_from'),
  ('payment_orders','valid_to'),('payment_orders','customer_ip'),('payment_orders','user_agent'),
  ('payment_orders','terms_accepted'),('payment_orders','terms_accepted_at'),('payment_orders','policy_version'),
  ('payment_orders','initiated_at'),('payment_orders','paid_at'),('payment_orders','created_at'),
  -- payment_orders billing (migration 014)
  ('payment_orders','billing_name'),('payment_orders','billing_company'),('payment_orders','billing_email'),
  ('payment_orders','billing_phone'),('payment_orders','billing_country'),('payment_orders','billing_address1'),
  ('payment_orders','billing_address2'),('payment_orders','billing_city'),('payment_orders','billing_state'),
  ('payment_orders','billing_pincode'),('payment_orders','order_notes'),
  -- rooms
  ('rooms','hotel_id'),('rooms','number'),('rooms','type'),('rooms','floor'),
  ('rooms','is_active'),('rooms','qr_token'),('rooms','guest_cleared_at'),('rooms','created_at'),
  -- food_items
  ('food_items','hotel_id'),('food_items','name'),('food_items','description'),('food_items','price'),
  ('food_items','category'),('food_items','is_veg'),('food_items','is_available'),
  ('food_items','image_emoji'),('food_items','sort_order'),
  ('food_items','name_ru'),('food_items','description_ru'),('food_items','category_ru'),
  -- food_orders
  ('food_orders','hotel_id'),('food_orders','room_id'),('food_orders','room_number'),
  ('food_orders','items'),('food_orders','total_amount'),('food_orders','guest_note'),
  ('food_orders','status'),('food_orders','created_at'),
  -- service_requests
  ('service_requests','hotel_id'),('service_requests','room_id'),('service_requests','room_number'),
  ('service_requests','type'),('service_requests','note'),('service_requests','status'),
  ('service_requests','scheduled_for'),('service_requests','created_at'),
  -- app_versions (migration 010)
  ('app_versions','version'),('app_versions','version_code'),('app_versions','notes'),
  ('app_versions','released_at'),('app_versions','created_at'),
  -- service_options (migration 011)
  ('service_options','hotel_id'),('service_options','icon'),('service_options','label'),
  ('service_options','sort_order'),('service_options','is_active'),('service_options','is_default'),('service_options','created_at'),
  -- email_templates (migration 013)
  ('email_templates','type'),('email_templates','subject'),('email_templates','heading'),
  ('email_templates','intro'),('email_templates','notice'),('email_templates','updated_at')
)
SELECT e.table_name, e.column_name AS missing_column
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name   = e.table_name
 AND c.column_name  = e.column_name
WHERE c.column_name IS NULL
ORDER BY e.table_name, e.column_name;
