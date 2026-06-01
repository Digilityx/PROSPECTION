INSERT INTO entreprises (company_name, company_id_linkedin, company_location) VALUES
('IKATAN', '87228905', 'Paris, Île-de-France, France'),
('Vianeos', '701113', 'Issy-les-Moulineaux, Île-de-France, France'),
('Ellipse Animation', '25191820', 'Paris, Île-de-France, France'),
('Yeets', '66305047', 'Paris, Île-de-France, France'),
('Ginseng Web', '10552912', 'Maisons-Laffitte, Île-de-France, France'),
('The Hungry Family', '86667606', 'Paris, Île-de-France, France'),
('FusionIQ Agency', '101454354', NULL),
('Inop''s', '407999', 'Puteaux, Île-de-France, France'),
('Guerlain', '10328', 'Paris, Île-de-France, France'),
('Ask for the moon', '11154443', 'Paris, Île-de-France, France'),
('Herder', '105092013', 'Valenciennes, Hauts-de-France, France'),
('Roundesk', '54096700', 'Paris, Île-de-France, France')
ON CONFLICT (company_id_linkedin) DO NOTHING;