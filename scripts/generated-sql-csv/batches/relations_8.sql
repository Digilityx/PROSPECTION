INSERT INTO contacts_membres_relations (contact_id, membre_id, niveau_de_relation) VALUES
((SELECT id FROM contacts WHERE id_url_linkedin = 'ACwAAAvo_9QBWN8cCz_WJ6u2auefJS7sxpYUbXQ' LIMIT 1), (SELECT id FROM membres_digilityx WHERE full_name = 'Vincent Radicini' LIMIT 1), 'Connaissance'),
((SELECT id FROM contacts WHERE id_url_linkedin = 'ACwAAA3ioLkBhCBZR2whT_MvEt0uaTW9JtQrmBA' LIMIT 1), (SELECT id FROM membres_digilityx WHERE full_name = 'Vincent Radicini' LIMIT 1), 'Connaissance'),
((SELECT id FROM contacts WHERE id_url_linkedin = 'ACwAABtsxX4BXLqx7Ji9HBZtQUwmPOhsUpiHVdk' LIMIT 1), (SELECT id FROM membres_digilityx WHERE full_name = 'Vincent Radicini' LIMIT 1), 'Connaissance'),
((SELECT id FROM contacts WHERE id_url_linkedin = 'ACwAACjKyAABwWUfai5-vH0cnH_Lxsh2ETj5Qdc' LIMIT 1), (SELECT id FROM membres_digilityx WHERE full_name = 'Vincent Radicini' LIMIT 1), 'Connaissance')
ON CONFLICT DO NOTHING;