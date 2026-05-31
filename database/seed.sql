USE triptailor_db;

INSERT INTO locations (city, district) VALUES
('台北市', '中正區'),
('台北市', '信義區'),
('台北市', '大安區'),
('台北市', '士林區'),
('台北市', '文山區'),
('台北市', '大同區'),
('新北市', '瑞芳區'),
('新北市', '淡水區'),
('桃園市', '中壢區'),
('台中市', '西屯區'),
('台南市', '安平區'),
('高雄市', '鹽埕區'),
('南投縣', '魚池鄉'),
('嘉義縣', '阿里山鄉'),
('花蓮縣', '秀林鄉');

INSERT INTO categories (cate_name) VALUES
('Museum'),
('Nature'),
('Historical'),
('Family'),
('Shopping'),
('Landmark'),
('Food'),
('Culture'),
('View'),
('Outdoor'),
('Temple'),
('Park'),
('Night Market'),
('Beach'),
('Mountain');

INSERT INTO transportations (trans_type) VALUES
('MRT'),
('Bus'),
('Train'),
('HSR'),
('Car'),
('Walk'),
('Bike'),
('Scooter');

USE triptailor_db;

SELECT * FROM attractions;
ALTER TABLE attractions
ADD COLUMN google_user_rating_count INT DEFAULT 0;