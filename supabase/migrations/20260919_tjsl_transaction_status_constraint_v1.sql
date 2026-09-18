alter table public.tjsl_transactions
  drop constraint if exists tjsl_transactions_status_check;

alter table public.tjsl_transactions
  add constraint tjsl_transactions_status_check
  check (
    status = any (array[
      'NEW','PAID','SCHEDULED','PROCESSING','FULFILLMENT_CHECK',
      'FULFILLMENT_ISSUE','READY','WAITING_PICKUP','PICKUP_VERIFIED',
      'HANDED_OVER_TO_DELIVERY','SUCCESS','PO_SUCCESS'
    ])
  );
