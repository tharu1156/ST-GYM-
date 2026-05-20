CREATE DATABASE IF NOT EXISTS gym_management;
USE gym_management;

CREATE TABLE IF NOT EXISTS membership_plans (
  membership_plan_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description VARCHAR(400) NOT NULL DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  member_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  membership_type VARCHAR(80) NOT NULL DEFAULT '',
  join_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  contact_number VARCHAR(40) NOT NULL DEFAULT '',
  membership_status VARCHAR(40) NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(40) NOT NULL DEFAULT 'Paid',
  method VARCHAR(40) NOT NULL DEFAULT 'Card',
  CONSTRAINT fk_payments_members FOREIGN KEY (member_id) REFERENCES members(member_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  attendance_log_id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  check_in_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(40) NOT NULL DEFAULT 'CheckedIn',
  CONSTRAINT fk_attendance_members FOREIGN KEY (member_id) REFERENCES members(member_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_tickets (
  support_ticket_id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  message VARCHAR(600) NOT NULL,
  response VARCHAR(600) NOT NULL DEFAULT '',
  rating TINYINT NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'Support',
  status VARCHAR(40) NOT NULL DEFAULT 'Open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_support_members FOREIGN KEY (member_id) REFERENCES members(member_id)
    ON DELETE CASCADE
);
