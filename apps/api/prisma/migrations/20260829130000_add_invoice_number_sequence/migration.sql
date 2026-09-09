-- Create a sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Set the sequence to the highest existing invoice number if there are any invoices
DO $$
DECLARE max_num BIGINT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING("invoiceNumber", 5) AS BIGINT)), 0) INTO max_num
  FROM "Invoice"
  WHERE "invoiceNumber" ~ '^INV-[0-9]+$';

  IF max_num > 0 THEN
    PERFORM setval('invoice_number_seq', max_num);
  END IF;
END $$;
