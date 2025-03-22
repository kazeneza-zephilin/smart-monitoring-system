CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('monitoring', 'agronomist') NOT NULL
);

CREATE TABLE agronomist_profiles (
    user_id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    cv_path VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
);