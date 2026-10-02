-- Kinpin Arts CRM schema (MySQL 5.7+ / MariaDB 10.3+).
-- Safe to run more than once. Apply with `pnpm db:migrate`, or paste into phpMyAdmin.

CREATE TABLE IF NOT EXISTS records (
  id INT NOT NULL AUTO_INCREMENT,
  kind VARCHAR(20) NOT NULL,
  data LONGTEXT NOT NULL,
  source INT NULL,
  -- lower(trim(docNumber)) for quotations and invoices; NULL for everything else.
  doc_number_key VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY records_source_unique (source),
  UNIQUE KEY records_kind_document_number_unique (kind, doc_number_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS counters (
  kind VARCHAR(20) NOT NULL,
  value INT NOT NULL,
  PRIMARY KEY (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  name VARCHAR(120) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
