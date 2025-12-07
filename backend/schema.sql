-- schema_fixed.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  street TEXT,
  city TEXT,
  postcode TEXT,
  region TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION
);

CREATE TABLE teachers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  bio TEXT,
  phone TEXT,
  email TEXT,
  photo_url TEXT
);

CREATE TABLE clubs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  phone TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  main_image_url TEXT,
  price_cents INTEGER,
  currency TEXT DEFAULT 'RUB',
  group_size INTEGER,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  is_cover BOOLEAN DEFAULT FALSE
);

CREATE TABLE schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  weekday SMALLINT,
  start_time TIME,
  end_time TIME,
  note TEXT
);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  author_name TEXT,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
