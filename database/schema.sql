DROP DATABASE IF EXISTS triptailor_db;

CREATE DATABASE triptailor_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE triptailor_db;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    travel_freq VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE preference_profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    budget VARCHAR(50),
    prefer_transportation VARCHAR(100),
    interest_tag VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    UNIQUE (city, district)
);

CREATE TABLE categories (
    cate_id INT AUTO_INCREMENT PRIMARY KEY,
    cate_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE attractions (
    att_id INT AUTO_INCREMENT PRIMARY KEY,
    att_name VARCHAR(255) NOT NULL,
    description TEXT,
    ticket_price DECIMAL(10,2) DEFAULT 0,
    avg_rating DECIMAL(2,1) DEFAULT 0.0,
    location_id INT,

    google_place_id VARCHAR(255) UNIQUE,
    formatted_address VARCHAR(500),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    google_rating DECIMAL(2,1) DEFAULT 0.0,

    image_url VARCHAR(1500),

    source VARCHAR(50) DEFAULT 'google',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (location_id) REFERENCES locations(location_id)
        ON DELETE SET NULL
);

CREATE TABLE attraction_categories (
    att_id INT NOT NULL,
    cate_id INT NOT NULL,
    PRIMARY KEY (att_id, cate_id),
    FOREIGN KEY (att_id) REFERENCES attractions(att_id)
        ON DELETE CASCADE,
    FOREIGN KEY (cate_id) REFERENCES categories(cate_id)
        ON DELETE CASCADE
);

CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    att_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edit_date TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (att_id) REFERENCES attractions(att_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
    UNIQUE (user_id, att_id)
);

CREATE TABLE favorites (
    favorite_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    att_id INT NOT NULL,
    favorite_name VARCHAR(100) DEFAULT 'My Favorite',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (att_id) REFERENCES attractions(att_id)
        ON DELETE CASCADE,

    UNIQUE (user_id, att_id)
);

CREATE TABLE recommendations (
    rec_id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    att_id INT NOT NULL,
    rec_score DECIMAL(5,2),
    reason TEXT,
    create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES preference_profiles(profile_id)
        ON DELETE CASCADE,
    FOREIGN KEY (att_id) REFERENCES attractions(att_id)
        ON DELETE CASCADE
);

CREATE TABLE transportations (
    trans_id INT AUTO_INCREMENT PRIMARY KEY,
    trans_type VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE trans_info (
    trans_info_id INT AUTO_INCREMENT PRIMARY KEY,
    att_id INT NOT NULL,
    trans_id INT NOT NULL,
    station_name VARCHAR(255),
    walking_time INT,
    parking VARCHAR(255),

    FOREIGN KEY (att_id) REFERENCES attractions(att_id)
        ON DELETE CASCADE,
    FOREIGN KEY (trans_id) REFERENCES transportations(trans_id)
        ON DELETE CASCADE
);