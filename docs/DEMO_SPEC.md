# Reference spec — upstream demo ERP (staging)

Source: `https://www-staging.dpweventlogistics.tech` (Odoo 15/16 based, product title "SearatesERP").
Captured 2026-11-05 via `/web/dataset/call_kw` introspection of `ir.ui.menu`,
`ir.actions.act_window` and `fields_get`.

This file is a *reference*, not generated code. It records what the upstream app
exposes so the CargoFlo clone can be checked against it without re-authenticating.

## Top-level apps (12)

| App | Leaves | Status in CargoFlo |
|---|---|---|
| Dashboard | Shipment, Quote, Carrier Booking | Carrier Booking missing |
| Operations | House Shipment, Master Shipment (Consol), Service Job, Container Number, 9 reports | 4 reports missing |
| Sales & CRM | Prospect, Leads, Opportunity, Quotes, Rate Requests, Targets, Sales Dashboard, 5 config, 5 reports | module missing |
| Schedules | Air Schedules, Sailing Schedules | Air separate model missing |
| Accounting | Customers, Vendors, Management, PDC, Reporting (18), Configuration (24) | PDC + 6 reports missing |
| Organizations | res.partner | present |
| Administration | Companies & Users, Freight Masters (17), Manage (30), Tariff, Document Reports | ~14 masters missing |
| ETL | Importer, Configuration, Reporting (16) | module missing |
| Contacts | Contacts + Configuration (Tags, Titles, Industries) | missing |
| Settings | General, Technical (Charge Lines, Security, ...) | Charge Lines missing |
| Website / Apps / Discuss | Odoo platform — intentionally out of scope | n/a |

## Portals

- Vendor portal: `/vendor_dashboard` — "Vendor Rate Request Overview". Vendors bid on
  `rate.request` records; submitted lines flow back into `shipment.quote.line`
  with `charge_source = vendor_portal`.
- Customer portal: `/dashboard`.

## Key structural differences from CargoFlo

1. **Charge lines, not flat charge fields.** `shipment.quote.line`,
   `house.shipment.charge.cost` / `.revenue`, `service.job.charge.cost` / `.revenue`
   each carry their own cost currency + rate, sell currency + rate, margin,
   measurement basis, taxes, creditor/debtor partner and billing status.
   CargoFlo's `Quotation.freightCharges`/`originCharges`/... are flat scalars.
2. **Multimodal quotes.** `shipment.quote.is_multimodal` +
   `shipment.quote.multimodal.line` (one row per leg, each with its own
   transport mode, route, carrier, cargo, schedule and charge lines).
   `shipment.quote.line.mode_type_sequence` is `1|2|3|4` — leg order.
   `selected_multimodal_mode` is `sea|air|road|courier`.
3. **Vendor rate requests.** `rate.request` + `rate.request.line` drive
   `shipment.quote.quote_rate_request_state`.
4. **CRM funnel.** `crm.prospect` -> `crm.prospect.lead` -> `crm.prospect.opportunity`
   -> `shipment.quote` -> `freight.house.shipment` / `freight.service.job`.

## Field specs

Selections are shown as `[a|b|c]`, required as `*`, relations as `->model`.
Odoo plumbing fields (`message_*`, `activity_*`, `website_message_*`, `image_*`,
`create_uid`, `write_date`, computed non-stored) are omitted.

### crm.prospect
```
name:char* street1:char* street2:char* state_id->res.country.state
country_id->res.country* city_id->res.city zip:char phone_no:char
contact_name:char designation:char department:char email:char mobile:char
active:boolean company_id->res.company* related_partner_id->res.partner
category_ids:many2many->res.partner.type prospect_lead_ids:one2many->crm.prospect.lead
```

### crm.prospect.lead
```
name:char* date:date* target_id->crm.sale.target prospect_id->crm.prospect*
street:char street2:char state_id->res.country.state country_id->res.country
city_id->res.city zip:char contact_name:char designation:char department:char
email:char mobile:char phone_no:char user_id->res.users*
lead_source:[db|social|customer_ref|trade_show|inbound] lead_source_id->lead.source
stage_id->crm.prospect.lead.stage* nature_of_business:char
company_turnover:monetary turnover_currency_id->res.currency remarks:text
company_id->res.company* port_of_loading_id->freight.port
port_of_discharge_id->freight.port transport_mode_id->transport.mode
mode_type:[sea|land|air] business_service_id->res.partner.industry
expected_annual_revenue:monetary annual_revenue_currency_id->res.currency
expected_annual_volume:float volume_uom_id->uom.uom
commodity_id->freight.commodity target_date:date shipment_type_id->shipment.type
lead_category:[hot|warm|cold] notes:text is_create_opportunity:boolean
origin_country_id->res.country destination_country_id->res.country
team_id->crm.prospect.team pickup_country_id->res.country
pickup_location_type_id->freight.location.type
pickup_location_id->freight.un.location delivery_country_id->res.country
delivery_location_type_id->freight.location.type
delivery_location_id->freight.un.location
```

### crm.prospect.opportunity
```
name:char* date:date* location_id->freight.un.location lead_id->crm.prospect.lead
opportunity_type:[new|existing] opportunity_for:[shipment|job]
opportunity_source:[online|offline] user_id->res.users* company_id->res.company*
stage_id->crm.prospect.opportunity.stage*
customer_type:[consignor|consignee|agent] prospect_id->crm.prospect
partner_id->res.partner street1 street2 state_id city_id country_id zip
contact_name designation department email mobile phone
commodity_id->freight.commodity cargo_description:text
cargo_status:[ready|later] shipment_due_date:date
transport_mode_id->transport.mode mode_type:[sea|land|air]
shipment_type_id->shipment.type incoterm_id->account.incoterms
service_mode_id->freight.service.mode
additional_service_ids:many2many->product.product
origin_country_id origin_un_location_id port_of_loading_id
destination_country_id destination_un_location_id port_of_discharge_id
cargo_type_id->cargo.type
package_ids:one2many->crm.prospect.opportunity.package
container_ids:one2many->crm.prospect.opportunity.container
is_create_from_lead:boolean team_id->crm.prospect.team
pricing_team_id->res.users customer_id->res.partner agent_id->res.partner
pickup_address:text delivery_address:text
customer_visit_ids:one2many->customer.visit.lines client_tag_id->client.tag
quotation_ids:one2many->shipment.quote
road_customer_type:[sending_forwarder|receiving_forwarder]
pickup_location_type_id delivery_location_type_id
road_origin_un_location_id road_destination_un_location_id
pickup_zipcode delivery_zipcode agent_ids:many2many->res.partner
shipping_provider_url:char access_token:char rate_approver->res.users
rate_request_email_sent:boolean rate_request_approved:boolean
opportunity_pricing_approval:boolean rate_request_ids:one2many->rate.request
transit_days:integer current_rate_request_id->rate.request
service_job_type_id->freight.job.type add_transportation_details:boolean
transportation_detail_ids:one2many->opportunity.transportation.details
```

### crm.prospect.lead.stage
```
name:char* sequence:integer is_create_opportunity:boolean
```

### crm.prospect.opportunity.stage
```
name:char* sequence:integer allow_quote_creation:boolean
```

### crm.prospect.team
```
name:char* sequence:integer active:boolean company_id->res.company
user_id->res.users member_ids:many2many->res.users
```

### crm.sale.target
```
name:char* user_id->res.users* manager_id->res.users date_from:date* date_to:date*
transport_mode_id->transport.mode shipment_type_id->shipment.type
company_id->res.company* cargo_type_id->cargo.type is_package_group:boolean
target_parameter:[weight|volume|gross_revenue|gross_margin|quotation|teu]*
target_value:float target_weight_uom_id->uom.uom target_volume_uom_id->uom.uom
target_currency_id->res.currency incentive_type:[amount|percentage]
incentive_currency_id->res.currency incentive_unit:float
incentive_unit_type:[net|gross|freight] remarks:text
sale_target_line_ids:one2many->crm.sale.target.line is_fields_mandatory:boolean
```

### lead.source
```
name:char sequence:integer allow_source_creation:boolean
```

### rate.request
```
name:char* agent_id->res.partner opportunity_id->crm.prospect.opportunity
company_id->res.company* rate_line_ids:one2many->rate.request.line
currency_id->res.currency access_token:char rate_total_words:char email:char
quote_status:[draft|done|cancel|renegotiate] rate_request_to:[vendor]
validity_date:date submitted_on:datetime rate_total:monetary
is_rate_selected:boolean quote_option_name:char request_date:date
requested_by->res.users ocr_response:text quote_id->shipment.quote
vendor_rate_status:[pending|submitted|renegotiate_pending|renegotiate_submitted|renegotiate_rejected]
is_renegotiate:boolean renegotiate_status:[pending|accepted|rejected]
```

### rate.request.line
```
rate_id->rate.request rate_agent_id->res.partner rate_vendor_group_name:char
rate_submitted_on:datetime rate_summary_name:char product_id->product.product
product_template_id->product.template
measurement_basis_id->freight.measurement.basis quantity:float*
currency_id->res.currency target_currency_id->res.currency exchange_rate:float
converted_buy_rate:float buy_rate:monetary min_amount:monetary
line_total:monetary rate_received_by:[email|manual]* remarks:char
source:[ocr|edited|manual] check_status:[high|unmapped|low]
charge_description:char source_file:char active:boolean counter_rate:monetary
source_quote_line_id->shipment.quote.line is_counter_line:boolean
```

### shipment.quote (header — see notes for the full 200+ field list)
```
name:char* date:date quote_expiry_date:date
state:[draft|renegotiate|to_approve|approved|sent|expire|cancel|pricing_approval|accept|reject]
opportunity_id->crm.prospect.opportunity client_id->res.partner*
client_address_id->res.partner client_tag_id->client.tag
shipper_id consignee_id agent_id co_loader_id (+ _address_id each)
transport_mode_id->transport.mode mode_type:[sea|land|air]
shipment_type_id->shipment.type cargo_type_id->cargo.type
consolidation_type_id->consolidation.type service_mode_id->freight.service.mode
packaging_mode:[container|package] is_package_group:boolean
origin_country_id origin_un_location_id port_of_loading_id
destination_country_id destination_un_location_id port_of_discharge_id
pickup_location_type_id delivery_location_type_id
road_origin_un_location_id road_destination_un_location_id
pickup_zipcode delivery_zipcode pickup_address:text delivery_address:text
carrier_id->freight.carrier incoterm_id->account.incoterms
transit_time:char transit_days:integer estimated_pickup:datetime
expected_delivery:datetime reference_number:char free_day:char
pack_unit:integer net_weight_unit:float gross_weight_unit:float
volume_unit:float weight_volume_unit:float chargeable:float
chargeable_kg:float chargeable_volume:float total_teu:integer
(each *_unit has a matching *_uom_id->uom.uom)
goods_value:monetary insurance_value:monetary
is_dangerous_good:boolean dangerous_good_note:text
haz_class_id->haz.sub.class.code haz_un_number:char
is_stackables:boolean is_temperature_control:boolean temperature_details:char
is_courier_shipment:boolean service_type:[Standard|Priority]
flight_number:char aircraft_type:[coa|pax] add_flight_details:boolean
add_vessel_details:boolean add_transportation_details:boolean
schedule_ids:many2many->freight.schedule
air_schedule_ids:many2many->freight.air.schedule
quote_container_line_ids:one2many->shipment.quote.container.lines
quote_cargo_line_ids:one2many->shipment.quote.cargo.lines
quotation_line_ids:one2many->shipment.quote.line
transportation_detail_ids:one2many->quote.transportation.details
transportation_pack_detail_ids:one2many->quote.transportation.package.details
route_ids:one2many->freight.quote.route enable_quote_routing:boolean
document_ids:one2many->freight.quote.document
carrier_amount_ids:one2many->shipment.quote.carrier.charges
status_history_ids:one2many->shipment.quote.status.history
is_multimodal:boolean multimodal_line_ids:one2many->shipment.quote.multimodal.line
multimodal_air_line_ids / multimodal_road_line_ids / multimodal_courier_line_ids
selected_multimodal_mode:[sea|air|road|courier]
converted_multimodal_line_id->shipment.quote.multimodal.line
quote_rate_request_state:[draft|vendor_rate_requested|vendor_rate_submitted|renegotiate|vendor_rate_renegotiate_requested|vendor_rate_renegotiate_submitted|to_approve|approved|sent|expire|cancel|pricing_approval|accept|reject]
rate_request_ids:one2many->rate.request current_rate_request_id->rate.request
agent_ids:many2many->res.partner pricing_team_id->res.users
quote_currency_id->res.currency quote_exchange_rate:float quote_rate_date:date
estimated_total_quote_currency_revenue:monetary
freight_shipment_ids:one2many->freight.house.shipment
service_job_ids:one2many->freight.service.job
cancelled_quote_id->shipment.quote revised_in_quote_ids:one2many->shipment.quote
original_quote_id->shipment.quote supplementary_ids:one2many->shipment.quote
is_supplementary:boolean supplementary_last_no:integer
change_reason_id->change.reason decline_message:text
quote_for:[shipment|job] shipment_count:[single|multiple]
service_job_type_id->freight.job.type team_id->crm.prospect.team
shipment_quote_template_id->shipment.quote.template
multi_carrier_quote:boolean selected_carrier_id->freight.carrier
selected_incoterm_id->account.incoterms
selected_carrier_service_type_id->carrier.service.type
selected_transit_time:integer
selected_quotation_line_ids:many2many->shipment.quote.line
source:[system|customer] generated_from_portal:boolean
is_renegotiated:boolean portal_cancel_reason:char
is_group_similar_charge:boolean divide_value:float
tag_ids:many2many->freight.shipment.tag signed_by:char signed_on:datetime
hbl_number:char service_job_number:char document_attached:[yes|no]
include_total_amount:monetary all_include_sell_amount_rate:monetary
hide_total_in_words:boolean show_incl_single_line:boolean
allow_approval:boolean approving_user_id->res.users approver_reject_reason:char
import_file:binary import_file_name:char upload_file_message:text
```

### shipment.quote.line (charge line — the costing core)
```
sequence:integer product_id->product.product* service_name:char*
charge_description:char charge_note:char
uom_id->uom.uom* quantity:float*
measurement_basis_id->freight.measurement.basis*
container_type_id->freight.container.type
cost_currency_id->res.currency* cost_conversion_rate:float
cost_amount_rate:monetary creditor_partner_id->res.partner
creditor_address_id->res.partner cost_remarks:text
sell_currency_id->res.currency* sell_conversion_rate:float
sell_amount_rate:monetary debtor_partner_id->res.partner
debtor_address_id->res.partner sell_remarks:text
total_cost_amount:monetary total_cost_amount_incl:monetary
total_sell_amount:monetary total_sell_amount_incl:monetary
estimated_margin:monetary estimated_margin_percentage:float
margin_type:[amount|percentage] margin_percentage:float margin_amount:float
use_margin:boolean exchange_rate:float show_exchange_rate:boolean
supplier_tax_ids:many2many->account.tax tax_ids:many2many->account.tax
include_charges:boolean quotation_id->shipment.quote
rate_request_line_id->rate.request.line
house_shipment_id->freight.house.shipment
shipment_cost_charge_id->house.shipment.charge.cost
shipment_revenue_charge_id->house.shipment.charge.revenue
service_job_id->freight.service.job
service_job_cost_charge_id->service.job.charge.cost
service_job_revenue_charge_id->service.job.charge.revenue
buy_tariff_line_id->tariff.buy.line sell_tariff_line_id->tariff.sell.line
multi_carrier_quote:boolean carrier_id->freight.carrier
incoterm_id->account.incoterms
carrier_service_type_id->carrier.service.type transit_time:integer
transport_mode_id->transport.mode mode_type:[sea|air|land]
mode_type_sequence:[1|2|3|4] multimodal_line_id->shipment.quote.multimodal.line
is_multimodal:boolean
group_similar_charge:boolean is_grouped:boolean selected:boolean
shipment_group_name:char shipment_group_sequence:integer
multi_carrier_combo_name:char
chargeable_weight:float
total_sell_amount_chargeable:monetary total_cost_amount_chargeable:monetary
sea_charge_pol_id / sea_charge_pod_id / air_charge_pol_id / air_charge_pod_id
  ->freight.port
charge_pickup_city_id / charge_delivery_city_id ->freight.un.location
origin_port_id destination_port_id origin_airport_id destination_airport_id
  ->freight.port
origin_un_location_id destination_un_location_id ->freight.un.location
origin_country_id destination_country_id ->res.country
charge_source:[erp|vendor_portal]
quote_currency_id->res.currency quote_conversion_rate:float
total_sell_amount_quote_currency:float
total_sell_amount_incl_quote_currency:float
```

### shipment.quote.multimodal.line (one leg of a multimodal quote)
```
mode_type:[sea|air|land] active_tab:boolean transport_mode_code:char
transport_mode_id->transport.mode consolidation_type_id->consolidation.type
is_rail_transport_mode:boolean shipment_type_id->shipment.type
cargo_type_id->cargo.type remarks:text quote_id->shipment.quote
quotation_id->shipment.quote
state:[draft|renegotiate|to_approve|approved|sent|expire|cancel|pricing_approval|accept|reject]
service_job_type_id->freight.job.type company_id->res.company
shipper_id consignee_id agent_id co_loader_id (+ _address_id each)
service_mode_id->freight.service.mode estimated_pickup:datetime
expected_delivery:datetime transit_time:char
origin_country_id origin_un_location_id port_of_loading_id
destination_country_id destination_un_location_id port_of_discharge_id
pickup_location_type_id delivery_location_type_id
road_origin_un_location_id road_destination_un_location_id
pickup_zipcode delivery_zipcode pickup_address:text delivery_address:text
pickup_location:char pickup_contact:char pickup_datetime:datetime
delivery_location:char delivery_contact:char delivery_datetime:datetime
incoterm_id->account.incoterms carrier_id->freight.carrier
reference_number:char free_day:char note:html
is_courier_shipment:boolean is_courier_line:boolean
flight_number:char aircraft_type:[coa|pax]
add_flight_details:boolean add_vessel_details:boolean
add_transportation_details:boolean
pack_unit gross_weight_unit net_weight_unit volume_unit weight_volume_unit
chargeable:float chargeable_volume:float (+ matching *_uom_id)
goods_value:monetary insurance_value:monetary
is_dangerous_good:boolean dangerous_good_note:text
haz_class_id->haz.sub.class.code haz_un_number:char
is_stackables:boolean is_temperature_control:boolean temperature_details:char
cargo_spec:char cargo_is_package_group:boolean is_package_group:boolean
auto_update_weight_volume:boolean
cargo_line_ids / quote_cargo_line_ids ->shipment.quote.cargo.lines
container_line_ids / quote_container_line_ids ->shipment.quote.container.lines
charge_line_ids / quotation_line_ids ->shipment.quote.line
transportation_pack_detail_ids->quote.transportation.package.details
route_ids->freight.quote.route
schedule_ids:many2many->freight.schedule
air_schedule_ids:many2many->freight.air.schedule
product_ids:many2many->product.product
carrier_amount_ids->shipment.quote.carrier.charges
selected_carrier_id->freight.carrier selected_incoterm_id->account.incoterms
selected_carrier_service_type_id / selected_service_type_id
  ->carrier.service.type
selected_transit_time:integer
selected_quotation_line_ids:many2many->shipment.quote.line
shipment_quote_template_id->shipment.quote.template
include_total_amount:monetary all_include_sell_amount_rate:monetary
show_incl_single_line:boolean signed_by:char signed_on:datetime
decline_message:text portal_cancel_reason:char
converted_shipment_id->freight.house.shipment is_converted:boolean
```

### shipment.quote.template
```
name:char* body_html:html* transport_mode_id->transport.mode
shipment_type_id->shipment.type cargo_type_ids:many2many->cargo.type
template_for:[shipment|job] service_job_type_id->freight.job.type
```

### house.shipment.charge.cost
```
name:char sequence:integer product_id->product.product*
charge_description:char* company_id->res.company currency_id->res.currency
uom_id->uom.uom quantity:float*
measurement_basis_id->freight.measurement.basis*
container_type_id->freight.container.type
amount_currency_id->res.currency* amount_conversion_rate:float*
amount_rate:monetary* partner_id->res.partner
partner_address_id->res.partner remarks:text
amount_currency_mismatch:boolean
total_currency_amount:monetary total_amount:monetary
due_by:[agent|carrier] charge_type:[ppx|ccx]
margin_type:[amount|percentage] margin_percentage:float margin_amount:float
quote_line_id->shipment.quote.line
house_shipment_id->freight.house.shipment*
master_shipment_id->freight.master.shipment
transport_mode_id->transport.mode mode_type:[sea|land|air]
domain_measurement_ids:many2many->freight.measurement.basis
tax_ids:many2many->account.tax property_account_id->account.account
move_line_ids:one2many->account.move.line
bill_currency_id->res.currency bill_conversion_rate:float
bill_currency_amount:monetary actual_billed_amount:monetary
amount_residual:monetary amount_currency_residual:monetary
total_residual_amount:monetary total_bill_amount:monetary
total_credit_note_amount:monetary total_credit_note_qty:integer
count_credit_note:integer status:[no|partial|fully_billed]
master_shipment_cost_charge_id->master.shipment.charge.cost
master_shipment_cost_charge_has_bill:boolean
revenue_line_id->house.shipment.charge.revenue
buy_tariff_line_id->tariff.buy.line
charge_source:[erp|vendor_portal] from_vendor_invoice:boolean
invoice_request_ids:many2many->vendor.invoice.request
```

### house.shipment.charge.revenue
Same shape as `house.shipment.charge.cost`, with the billing half swapped:
```
partner_id->res.partner*  (debtor, required)
invoice_currency_id->res.currency invoice_conversion_rate:float
invoice_currency_amount:monetary company_currency_amount:monetary
actual_invoiced_amount:monetary invoiced_amount:monetary
invoice_received_amount:monetary
status:[no|partial|fully_invoiced|pro_forma|pro_forma_cancel]
master_shipment_revenue_charge_id->master.shipment.charge.revenue
cost_line_id->house.shipment.charge.cost
part_bl_id->freight.house.shipment.part.bl
air_charge_type:[ppx|ccx|other]
pro_forma_invoice_line_ids:one2many->pro.forma.invoice.line
sell_tariff_line_id->tariff.sell.line
```

### service.job.charge.cost / service.job.charge.revenue
Same shape as the house-shipment charge pair, with
`service_job_id->freight.service.job*` in place of `house_shipment_id`
and no master-shipment / transport-mode fields.

### freight.service.job
```
name:char display_name:char booking_nomination_no:char service_job_number:char
service_job_type_id->freight.job.type date:date*
client_id->res.partner* client_address_id->res.partner
client_tag_id->client.tag consignee_id shipper_id (+ _address_id)
company_id->res.company* country_id->res.country
user_id->res.users* sales_agent_id->res.users*
transport_mode_id->transport.mode mode_type:[sea|land|air]
shipment_type_id->shipment.type cargo_type_id->cargo.type
cargo_is_package_group:boolean packaging_mode:[container|package]
origin_country_id origin_un_location_id origin_port_un_location_id
destination_country_id destination_un_location_id destination_port_un_location_id
origin_port_name:char destination_port_name:char
etd_time atd_time eta_time ata_time :datetime
pack_unit net_weight_unit gross_weight_unit volume_unit weight_volume_unit
chargeable_kg:float (+ matching *_uom_id)
is_hazardous:boolean haz_class_id->haz.sub.class.code haz_un_number:char
haz_remark:text
has_customs:boolean customs_ad_code:char
customs_location_id->freight.custom.location
customs_declaration_number:char customs_declaration_date:date
customs_clearance_datetime:datetime tariff_determination_number:char
value_determination_number:char customs_procedure_code:char
boe_number:char boe_date:date customs_be_type_id->custom.master.be.type
customs_document_ids:one2many->freight.service.job.customs.document
ownership:[self|third_party] ownership_id->res.partner
service_job_partner_ids:one2many->freight.service.job.partner
event_ids:one2many->freight.service.job.event
terms_ids:one2many->freight.service.job.terms
document_ids:one2many->freight.service.job.document
state:[created|cancelled|completed|job_close]
tag_ids:many2many->freight.shipment.tag remarks:text
pickup_address:text delivery_address:text incoterm_id->account.incoterms
branch_name:char shipment_status:char account_status:char
currency_id->res.currency
estimated_revenue estimated_cost estimated_margin :monetary
estimated_margin_percentage:float
received_revenue paid_cost received_margin :monetary
received_margin_percentage:float due_revenue due_cost :monetary
revenue_charge_ids->service.job.charge.revenue
cost_charge_ids->service.job.charge.cost
revenue_charge_count / cost_charge_count :integer
revenue_charge_amount / cost_charge_amount :monetary
revenue_charge_state_info / cost_charge_state_info :char
move_line_ids->account.move.line move_ids:many2many->account.move
invoice_count vendor_bill_count credit_note_count debit_note_count
pro_forma_invoice_count :integer
pro_forma_invoice_ids->pro.forma.invoice
service_job_quote_id->shipment.quote access_token:char
```

### pdc.payment
```
name:char* cheque_ref:char payment_date:date* date:date*
move_ids:many2many->account.move move_id->account.move move_count:integer
payment_id->account.payment journal_id->account.journal*
partner_id->res.partner amount:monetary
state:[registered|returned|deposited|bounced|done]
clearing_date:date is_reconciled:boolean
company_id->res.company company_currency_id->res.currency
```

### freight.schedule (sailing)
```
name:char carrier_id->freight.carrier* vessel_id->freight.vessel
source:[manual|inttra] transport_mode_id->transport.mode*
transport_mode_type:[sea|land|air]
origin_port_id->freight.port* destination_port_id->freight.port*
origin_country_id destination_country_id ->res.country
estimated_departure_date actual_departure_date
estimated_arrival_date actual_arrival_date :datetime
transit_time:integer si_cutoff:datetime scac_number:char service_name:char
voyage_number:char vessel_cut_off:datetime vgm_cut_off:datetime
parent_id->freight.schedule leg_ids:one2many->freight.schedule
multimodal_line_id->shipment.quote.multimodal.line
```

### freight.air.schedule
```
name:char carrier_id->freight.carrier* vessel_id->freight.vessel
source:[manual] transport_mode_id->transport.mode*
transport_mode_type:[sea|land|air]
origin_port_id->freight.port* destination_port_id->freight.port*
origin_country_id destination_country_id ->res.country
estimated_departure_date actual_departure_date
estimated_arrival_date actual_arrival_date :datetime
transit_time:integer si_cutoff:datetime onboarding_cut_off:datetime
flight_number:char icoa_number:char iata_number:char
aircraft_type:[coa|pax] flight_status:char service_name:char
parent_id->freight.air.schedule leg_ids:one2many->freight.air.schedule
```

## Lookup models still to mirror

`carrier.service.type`, `client.tag`, `freight.location.type`,
`custom.master.be.type`, `freight.job.type`, `change.reason`,
`shipment.change.reason`, `mawb.stock`, `freight.truck.number`,
`freight.sequence`, `freight.vessel`, `freight.vessel.category`,
`freight.warehouse.depot`, `freight.un.location`, `harmonized.system.code`,
`freight.commodity`, `freight.custom.location`, `freight.container.category`,
`freight.container.type`, `freight.measurement.basis`,
`freight.adjustment.ratio.type`, `volumetric.divided.value`, `res.city`,
`res.partner.industry`, `res.partner.title`, `res.partner.category`,
`invoice.terms.template`, `account.fiscal.year`, `account.type.sequence`,
`account.journal.group`, `account.fiscal.position`,
`account.analytic.account|group|tag|default|line`,
`res.currency.rate.provider`, `payment.acquirer`.

## Report models

Operations: `customer.status.report`, `customer.volume.report`,
`customer.wise.shipment.report`, `shipper.shipment.report`,
`shipment.profit.report`, `chargewise.estimated.actual.report`,
`shipment.document.analysis`, `report.house.shipment.consolidated`.

Accounting: `invoice.charge.report`, `wizard.customer.due.report`,
`wiz.balance.confirmation.report`, `account.finance.report`,
plus client-side Outstanding Customer/Vendor Statement and
Depreciation Schedule.

Sales: `charges.wise.quotation.report.wizard`, `customer.visit.report`,
`opportunity.detail.report`, `shipment.quote.status.history`,
`wiz.sales.agent.report`.

ETL: `etl.model.mapper`, `etl.data.mapping.create`, `etl.data.operation`,
`etl.field.mapper`, `etl.report.downloader.wizard`,
`etl.account.downloader.wizard`, `report.download`,
`charge.wise.cost.report`.
