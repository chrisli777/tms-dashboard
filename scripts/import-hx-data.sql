-- Import HX and TJJSH supplier shipments for Genie (excluding Clark)

-- First, insert the HX/TJJSH shipments
INSERT INTO public.shipments (id, invoice, bol, supplier, customer, etd, eta, status, container_count, sku_count, total_value, total_weight, po_numbers, incoterm, currency, folder_name)
VALUES
  -- HX Terex shipments for Genie
  ('01d826a7-6be5-4904-b0bd-e312107edcd5', 'Terex2026-0104RD', 'MEDUWA518481', 'HX', 'Genie', '2026-01-26', '2026-02-25', 'On Water', 1, 1, 22232.00, 14794, ARRAY['739'], 'EXW', 'USD', 'Terex2026-0104RD'),
  ('079ff066-1945-48b8-9fd2-978046644ff2', 'Terex2026-0101ML', 'SMLMTAYH5D536200', 'HX', 'Genie', '2026-01-01', '2026-01-31', 'On Water', 2, 2, 38460.55, 33585, ARRAY['740'], 'EXW', 'USD', 'Terex2026-0101ML'),
  ('0fb89251-5566-4d46-91fc-82a9c3419264', 'Terex2026-0203ML', 'HDMUTAOZ05384500', 'HX', 'Genie', '2026-02-15', '2026-03-17', 'On Water', 2, 2, 51006.40, 33585, ARRAY['747'], 'EXW', 'USD', 'Terex2026-0203ML'),
  ('2a623137-6722-4cf3-bbf6-56a57099fb58', 'Terex2026-0104ML', 'MEDUWA518499', 'HX', 'Genie', '2026-01-26', '2026-02-25', 'On Water', 2, 2, 51006.40, 33585, ARRAY['740'], 'EXW', 'USD', 'Terex2026-0104ML'),
  ('477aa587-b5b8-4592-be70-96aa6d7b9e1c', 'Terex2026-0201RD', 'HDMUTAOZ76143100', 'HX', 'Genie', '2026-02-03', '2026-03-05', 'On Water', 1, 1, 22232.00, 14794, ARRAY['746'], 'EXW', 'USD', 'Terex2026-0201RD'),
  ('519f3a98-fe86-480c-893d-b64f183bf323', 'Terex2026-0102ML', 'HDMUTAOZ75797000', 'HX', 'Genie', '2026-01-10', '2026-02-09', 'On Water', 2, 2, 51006.40, 33585, ARRAY['740'], 'EXW', 'USD', 'Terex2026-0102ML'),
  ('58ad7073-cae1-4659-9517-54a2f2ccfd51', 'Terex2025-1202', 'SMLMTAYH5D512300', 'HX', 'Genie', '2025-12-09', '2026-01-08', 'Customs Cleared', 2, 2, 50636.70, 33000, ARRAY['730'], 'EXW', 'USD', 'Terex2025-1202'),
  ('626ec7c1-1024-40d4-93c3-bc3f4fbf18ef', 'Terex2026-0201ML', 'HDMUTAOZ30523500', 'HX', 'Genie', '2026-02-03', '2026-03-05', 'On Water', 2, 2, 51006.40, 33585, ARRAY['747'], 'EXW', 'USD', 'Terex2026-0201ML'),
  ('6385225f-4b2c-43a8-975d-aa4a7e405038', 'Terex2025-1204', 'HDMUTAOZ82714300', 'HX', 'Genie', '2025-12-21', '2026-01-20', 'Customs Cleared', 2, 2, 50636.70, 33585, ARRAY['730'], 'EXW', 'USD', 'Terex2025-1204'),
  ('651a69c3-9817-4658-ae3c-01df240f16b8', 'Terex2025-1202A', 'ONEYTAOFM7066800', 'HX', 'Genie', '2025-12-06', '2026-01-05', 'Customs Cleared', 0, 1, 22086.56, 0, ARRAY['729'], 'EXW', 'USD', 'Terex2025-1202A'),
  ('66dc802e-e16f-4622-beda-e6e55ec0e75b', 'Terex2025-1203', 'HDMUTAOZ91196400', 'HX', 'Genie', '2025-12-13', '2026-01-12', 'Customs Cleared', 0, 2, 63778.90, 0, ARRAY['730','740'], 'EXW', 'USD', 'Terex2025-1203'),
  ('808ff92b-d224-4b3d-8b97-236b0ca1b3df', 'Terex2026-0203RD', 'HDMUTAOZ00637500', 'HX', 'Genie', '2026-02-16', '2026-03-18', 'On Water', 1, 1, 22232.00, 14794, ARRAY['746'], 'EXW', 'USD', 'Terex2026-0203RD'),
  ('83b1c8b1-4e05-49a4-90b3-2e361967ae70', 'Terex2025-1203A', 'ONEYTAOFM8248400', 'HX', 'Genie', '2025-12-14', '2026-01-13', 'Customs Cleared', 0, 1, 22086.56, 0, ARRAY['729'], 'EXW', 'USD', 'Terex2025-1203A'),
  ('85947c9f-e720-443b-be96-812acb81569d', 'Terex2026-0102RD', 'HDMUTAOZ28489500', 'HX', 'Genie', '2026-01-10', '2026-02-09', 'On Water', 1, 1, 22232.00, 14794, ARRAY['739'], 'EXW', 'USD', 'Terex2026-0102RD'),
  ('88626c66-b755-4549-ae03-ea6d26411cdb', 'Terex2026-0103RD', 'MEDUWA301623', 'HX', 'Genie', '2026-01-23', '2026-02-22', 'On Water', 1, 1, 22232.00, 14794, ARRAY['739'], 'EXW', 'USD', 'Terex2026-0103RD'),
  ('8905adeb-4267-449c-8500-b1dbe0e3e759', 'Terex2026-0103ML', 'HDMUTAOZ23975700', 'HX', 'Genie', '2026-01-21', '2026-02-20', 'On Water', 2, 2, 38743.15, 33585, ARRAY['740'], 'EXW', 'USD', 'Terex2026-0103ML'),
  ('9d3482ad-6e86-4102-8632-8f734d59d98d', 'Terex2025-1205A', 'HDMUTAOZ94972300', 'HX', 'Genie', '2025-12-28', '2026-01-27', 'Customs Cleared', 0, 1, 24352.30, 0, ARRAY['740'], 'EXW', 'USD', 'Terex2025-1205A'),
  ('c00fd89e-c00e-4103-a8f6-3526694eb446', 'Terex2026-0202ML', 'HDMUTAOZ54243300', 'HX', 'Genie', '2026-02-07', '2026-03-09', 'On Water', 2, 2, 64246.35, 33585, ARRAY['747'], 'EXW', 'USD', 'Terex2026-0202ML'),
  ('c0776f41-676d-434e-b5c3-15f7058e648b', 'Terex2025-1201A', 'HDMUTAOZ97037500', 'HX', 'Genie', '2025-12-06', '2026-01-05', 'Customs Cleared', 0, 1, 22086.56, 0, ARRAY['729'], 'EXW', 'USD', 'Terex2025-1201A'),
  ('c6c3f21f-bf3c-4931-a141-177cbcaf73da', 'Terex2026-0202RD', 'HDMUTAOZ05944000', 'HX', 'Genie', '2026-02-07', '2026-03-09', 'On Water', 1, 1, 33348.00, 14794, ARRAY['746'], 'EXW', 'USD', 'Terex2026-0202RD'),
  ('e308508a-0c1d-43d0-8694-d62cd0a68fb8', 'Terex2025-1204A', 'HDMUTAOZ98935400', 'HX', 'Genie', '2025-12-21', '2026-01-20', 'Customs Cleared', 0, 1, 22086.56, 0, ARRAY['729'], 'EXW', 'USD', 'Terex2025-1204A'),
  ('ecc94738-8857-4f62-8420-29765163250b', 'Terex2026-0101RD', 'HDMUTAOZ03038500', 'HX', 'Genie', '2026-01-04', '2026-02-03', 'On Water', 1, 1, 22232.00, 14794, ARRAY['729'], 'EXW', 'USD', 'Terex2026-0101RD'),
  ('ef972476-f543-4fe2-81c6-7f79b343c7db', 'Terex2025-1205', 'HDMUTAOZ40444000', 'HX', 'Genie', '2025-12-28', '2026-01-27', 'Customs Cleared', 0, 2, 62812.85, 0, ARRAY['730','740'], 'EXW', 'USD', 'Terex2025-1205'),
  -- TJJSH shipments for Genie
  ('9e09219b-b83b-4770-86f9-a37ba14f543e', 'TJLT20260101KZ', 'FA2985', 'TJJSH', 'Genie', '2026-01-16', '2026-02-15', 'On Water', 1, 10, 7692.40, 1753, ARRAY['TJJSH-0000737'], 'EXW', 'USD', 'TJLT20260101KZ'),
  ('dbfec9b7-3ed4-4bca-8ec1-f017be9168c3', 'TJLT20260201KZ', 'FA3215', 'TJJSH', 'Genie', '2026-01-30', '2026-03-01', 'On Water', 1, 18, 27541.80, 6465, ARRAY['TJJSH-0000737'], 'EXW', 'USD', 'TJLT20260201KZ')
ON CONFLICT (id) DO NOTHING;

-- Insert HX/TJJSH orders
INSERT INTO public.orders (po_number, supplier, customer, order_date, status) VALUES
  ('729', 'HX', 'Genie', '2025-11-15', 'Completed'),
  ('730', 'HX', 'Genie', '2025-11-20', 'Completed'),
  ('739', 'HX', 'Genie', '2025-12-20', 'In Progress'),
  ('740', 'HX', 'Genie', '2025-12-25', 'In Progress'),
  ('746', 'HX', 'Genie', '2026-01-15', 'In Progress'),
  ('747', 'HX', 'Genie', '2026-01-20', 'In Progress'),
  ('TJJSH-0000737', 'TJJSH', 'Genie', '2025-12-01', 'In Progress')
ON CONFLICT DO NOTHING;

-- Insert HX/TJJSH containers
INSERT INTO public.containers (id, shipment_id, container, type, status)
VALUES
  -- Terex2026-0104RD
  ('2d5237c1-2e59-40d2-a5e5-2cc73cd6d9bc', '01d826a7-6be5-4904-b0bd-e312107edcd5', 'DRYU2497537', '20GP', 'On Water'),
  -- Terex2026-0101ML  
  ('175d49f8-7689-4fe7-bab3-520de9f4e9a4', '079ff066-1945-48b8-9fd2-978046644ff2', 'CAIU6430470', '20GP', 'On Water'),
  ('76c5895a-8636-4a13-b2c4-1dc5c586714a', '079ff066-1945-48b8-9fd2-978046644ff2', 'CAIU6465917', '20GP', 'On Water'),
  -- Terex2026-0203ML
  ('0f52128b-ac95-4b23-8922-a0cdf752d5d2', '0fb89251-5566-4d46-91fc-82a9c3419264', 'MSOU2676087', '20GP', 'On Water'),
  ('3fb2b5f2-e955-4de0-962c-e19713e17b43', '0fb89251-5566-4d46-91fc-82a9c3419264', 'TCLU3819398', '20GP', 'On Water'),
  -- Terex2026-0104ML
  ('2da3f690-49ff-45b1-91be-014a9b3e381e', '2a623137-6722-4cf3-bbf6-56a57099fb58', 'MEDU500798', '20GP', 'On Water'),
  ('dca61fa5-46f7-42de-8bcb-55859354b3f9', '2a623137-6722-4cf3-bbf6-56a57099fb58', 'CAIU2943319', '20GP', 'On Water'),
  -- Terex2026-0201RD
  ('3cb8835a-fcfe-482b-baeb-f5a2be55c0a5', '477aa587-b5b8-4592-be70-96aa6d7b9e1c', 'TGBU2515633', '20GP', 'On Water'),
  -- Terex2026-0102ML
  ('cae655bd-63df-482e-8b46-a4062004d652', '519f3a98-fe86-480c-893d-b64f183bf323', 'MSOU7579069', '20GP', 'On Water'),
  ('fafe9a2d-f1ab-4c12-bf2c-8ba2a210c5c8', '519f3a98-fe86-480c-893d-b64f183bf323', 'TEMU1631500', '20GP', 'On Water'),
  -- Terex2025-1202
  ('d79eb369-bb0a-4fcf-8fe0-c67a7d5cc45e', '58ad7073-cae1-4659-9517-54a2f2ccfd51', 'TEMU1632471', '20GP', 'Customs Cleared'),
  ('af6d2db8-d982-4da6-bfd9-74032db36878', '58ad7073-cae1-4659-9517-54a2f2ccfd51', 'KOCU2225851', '20GP', 'Customs Cleared'),
  -- Terex2026-0201ML
  ('7696b5ae-9885-4dc0-a442-728fec0bcf38', '626ec7c1-1024-40d4-93c3-bc3f4fbf18ef', 'HMMU2109270', '20GP', 'On Water'),
  ('c227a834-88d1-4f1f-bac8-abb451a639f5', '626ec7c1-1024-40d4-93c3-bc3f4fbf18ef', 'TLLU2592435', '20GP', 'On Water'),
  -- Terex2025-1204
  ('58dfa71e-db3c-47c0-a84d-5cd60d901bb6', '6385225f-4b2c-43a8-975d-aa4a7e405038', 'TGBU2501012', '20GP', 'Customs Cleared'),
  ('6f7e93bb-9cc3-4aa7-a7cd-36f2466e618f', '6385225f-4b2c-43a8-975d-aa4a7e405038', 'HMMU2218183', '20GP', 'Customs Cleared'),
  -- Terex2026-0203RD
  ('9fa0d112-8f8d-407e-90c8-1eb5908124b8', '808ff92b-d224-4b3d-8b97-236b0ca1b3df', 'KOCU2142464', '20GP', 'On Water'),
  -- Terex2026-0102RD
  ('dd25ca09-da71-4e43-ac4e-b3ceca9d4ebb', '85947c9f-e720-443b-be96-812acb81569d', 'MSOU7579074', '20GP', 'On Water'),
  -- Terex2026-0103RD
  ('84af21ad-7ae9-4122-ae4d-53b509aacb7c', '88626c66-b755-4549-ae03-ea6d26411cdb', 'MSBU2792785', '20GP', 'On Water'),
  -- Terex2026-0103ML
  ('4f074b6f-bde3-4466-8224-8bfd4b7e1038', '8905adeb-4267-449c-8500-b1dbe0e3e759', 'TLLU2586237', '20GP', 'On Water'),
  ('7d927bfb-984b-466a-bdf1-384b55653d38', '8905adeb-4267-449c-8500-b1dbe0e3e759', 'KOCU2078703', '20GP', 'On Water'),
  -- Terex2026-0202ML
  ('b9ce370e-9e87-4c32-8614-e79ecabd8762', 'c00fd89e-c00e-4103-a8f6-3526694eb446', 'TGBU2224788', '20GP', 'On Water'),
  ('c6f69d14-80a5-4416-834f-fab0d026003e', 'c00fd89e-c00e-4103-a8f6-3526694eb446', 'GAOU2137708', '20GP', 'On Water'),
  -- Terex2026-0202RD
  ('8ab7d3bc-50f9-4279-85d0-831db77c4eb6', 'c6c3f21f-bf3c-4931-a141-177cbcaf73da', 'KOCU2137914', '20GP', 'On Water'),
  -- Terex2026-0101RD
  ('e45b148e-5278-46ed-a258-b64b8ee7a838', 'ecc94738-8857-4f62-8420-29765163250b', 'HMMU2289633', '20GP', 'On Water'),
  -- TJLT20260101KZ
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '9e09219b-b83b-4770-86f9-a37ba14f543e', 'MSMU3961625', '20GP', 'On Water'),
  -- TJLT20260201KZ
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', 'dbfec9b7-3ed4-4bca-8ec1-f017be9168c3', 'MSNU6916198', '40HQ', 'On Water')
ON CONFLICT (id) DO NOTHING;

-- Insert HX/TJJSH container items
INSERT INTO public.container_items (container_id, sku, qty, gw_kg, unit_price_usd, amount_usd, whi_po)
VALUES
  -- Terex2026-0104RD - DRYU2497537
  ('2d5237c1-2e59-40d2-a5e5-2cc73cd6d9bc', '1282199GT', 16, 14794, 1389.50, 22232.00, '739'),
  -- Terex2026-0101ML
  ('175d49f8-7689-4fe7-bab3-520de9f4e9a4', '824433GT', 5, 16500, 2435.23, 12176.15, '740'),
  ('76c5895a-8636-4a13-b2c4-1dc5c586714a', '61415GT', 10, 17085, 2628.44, 26284.40, '740'),
  -- Terex2026-0203ML
  ('0f52128b-ac95-4b23-8922-a0cdf752d5d2', '61415GT', 10, 17085, 2647.99, 26479.90, '747'),
  ('3fb2b5f2-e955-4de0-962c-e19713e17b43', '824433GT', 10, 16500, 2452.65, 24526.50, '747'),
  -- Terex2026-0104ML
  ('2da3f690-49ff-45b1-91be-014a9b3e381e', '824433GT', 10, 16500, 2452.65, 24526.50, '740'),
  ('dca61fa5-46f7-42de-8bcb-55859354b3f9', '61415GT', 10, 17085, 2647.99, 26479.90, '740'),
  -- Terex2026-0201RD
  ('3cb8835a-fcfe-482b-baeb-f5a2be55c0a5', '1282199GT', 16, 14794, 1389.50, 22232.00, '746'),
  -- Terex2026-0102ML
  ('cae655bd-63df-482e-8b46-a4062004d652', '61415GT', 10, 17085, 2647.99, 26479.90, '740'),
  ('fafe9a2d-f1ab-4c12-bf2c-8ba2a210c5c8', '824433GT', 10, 16500, 2452.65, 24526.50, '740'),
  -- Terex2025-1202
  ('d79eb369-bb0a-4fcf-8fe0-c67a7d5cc45e', '824433GT', 5, 16500, 2435.23, 12176.15, '730'),
  ('af6d2db8-d982-4da6-bfd9-74032db36878', '824433GT', 5, 16500, 2435.23, 12176.15, '730'),
  -- Terex2026-0201ML
  ('7696b5ae-9885-4dc0-a442-728fec0bcf38', '61415GT', 10, 17085, 2647.99, 26479.90, '747'),
  ('c227a834-88d1-4f1f-bac8-abb451a639f5', '824433GT', 10, 16500, 2452.65, 24526.50, '747'),
  -- Terex2025-1204
  ('58dfa71e-db3c-47c0-a84d-5cd60d901bb6', '824433GT', 10, 16500, 2435.23, 24352.30, '730'),
  ('6f7e93bb-9cc3-4aa7-a7cd-36f2466e618f', '61415GT', 10, 17085, 2628.44, 26284.40, '730'),
  -- Terex2026-0203RD
  ('9fa0d112-8f8d-407e-90c8-1eb5908124b8', '1282199GT', 16, 14794, 1389.50, 22232.00, '746'),
  -- Terex2026-0102RD
  ('dd25ca09-da71-4e43-ac4e-b3ceca9d4ebb', '1282199GT', 16, 14794, 1389.50, 22232.00, '739'),
  -- Terex2026-0103RD
  ('84af21ad-7ae9-4122-ae4d-53b509aacb7c', '1282199GT', 16, 14794, 1389.50, 22232.00, '739'),
  -- Terex2026-0103ML
  ('4f074b6f-bde3-4466-8224-8bfd4b7e1038', '61415GT', 10, 17085, 2647.99, 26479.90, '740'),
  ('7d927bfb-984b-466a-bdf1-384b55653d38', '824433GT', 5, 16500, 2452.65, 12263.25, '740'),
  -- Terex2026-0202ML
  ('b9ce370e-9e87-4c32-8614-e79ecabd8762', '824433GT', 10, 16500, 2452.65, 24526.50, '747'),
  ('c6f69d14-80a5-4416-834f-fab0d026003e', '61415GT', 15, 17085, 2647.99, 39719.85, '747'),
  -- Terex2026-0202RD
  ('8ab7d3bc-50f9-4279-85d0-831db77c4eb6', '1282199GT', 24, 14794, 1389.50, 33348.00, '746'),
  -- Terex2026-0101RD
  ('e45b148e-5278-46ed-a258-b64b8ee7a838', '1282199GT', 16, 14794, 1389.50, 22232.00, '729'),
  -- TJLT20260101KZ - MSMU3961625
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1287173', 10, 42, 79.96, 799.60, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1287172', 20, 83, 79.96, 1599.20, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1288944', 100, 417, 3.08, 308.00, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-227164', 100, 417, 0.93, 93.00, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1287329', 20, 83, 27.20, 544.00, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1287190', 20, 83, 54.74, 1094.80, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1287189', 10, 42, 52.92, 529.20, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1287693', 20, 83, 48.07, 961.40, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1287191', 20, 83, 64.01, 1280.20, 'TJJSH-0000737'),
  ('5526f4fd-9711-4878-8f75-29aec5eb36a7', '8803-1291397', 100, 417, 4.83, 483.00, 'TJJSH-0000737'),
  -- TJLT20260201KZ - MSNU6916198
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1287189', 50, 229, 52.92, 2646.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1287172', 60, 275, 79.96, 4797.60, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1287173', 50, 229, 79.96, 3998.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1294839', 100, 458, 5.49, 549.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1287325', 60, 275, 27.40, 1644.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1287191', 40, 183, 64.01, 2560.40, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1296913', 150, 688, 16.08, 2412.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1284781', 100, 458, 5.48, 548.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-214375', 100, 458, 5.22, 522.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1294067', 100, 458, 4.06, 406.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1288550', 100, 458, 1.53, 153.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1294814', 100, 458, 5.49, 549.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1306370', 40, 183, 85.35, 3414.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1287693', 40, 183, 48.07, 1922.80, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1295212', 100, 458, 3.89, 389.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-228362', 100, 458, 0.56, 56.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1288549', 100, 458, 4.31, 431.00, 'TJJSH-0000737'),
  ('9defac5e-d344-4e0b-8b4d-17dac772dd73', '8803-1287329', 20, 92, 27.20, 544.00, 'TJJSH-0000737')
ON CONFLICT DO NOTHING;

-- Link container_items to orders based on whi_po
UPDATE public.container_items ci
SET order_id = o.id
FROM public.orders o
WHERE ci.whi_po = o.po_number AND ci.order_id IS NULL;
