CREATE UNIQUE INDEX `records_kind_document_number_unique` ON `records` (`kind`, lower(trim(json_extract(`data`, '$.docNumber'))));
