# Modelos de estrutura dos dados do mercado pago

## Refunded Payment

- This file is used to store the response of a payment that was refunded, so we can use it as an example when we implement the refund feature. The payment was made on February 3rd, 2026, and the refund was made on February 12th, 2026.

```json
{
    "accounts_info": null,
    "acquirer_reconciliation": [],
    "additional_info": {
        "items": [
            {
                "picture_url": "https://http2.mlstatic.com/D_NQ_NP_996450-MLB105801965664_022026-F.jpg",
                "quantity": "1",
                "title": "PEDIDO 7477",
                "unit_price": "119.13"
            }
        ],
        "tracking_id": "platform:v1-whitelabel,so:ALL,type:N/A,security:none"
    },
    "authorization_code": null,
    "binary_mode": false,
    "brand_id": null,
    "build_version": "3.141.0-rc-1",
    "call_for_authorize_id": null,
    "captured": true,
    "card": {},
    "charges_details": [
        {
            "accounts": {
                "from": "collector",
                "to": "mp"
            },
            "amounts": {
                "original": 4.75,
                "refunded": 4.75
            },
            "client_id": 0,
            "date_created": "2026-02-03T13:01:03.000-04:00",
            "external_charge_id": "01KGJ76MSHNCGR7S1E70E4Z8PK",
            "id": "144654396660-001",
            "last_updated": "2026-02-12T07:00:25.000-04:00",
            "metadata": {
                "reason": "",
                "source": "proc-svc-charges",
                "source_detail": "processing_fee_charge"
            },
            "name": "mercadopago_fee",
            "refund_charges": [
                {
                    "amount": 4.75,
                    "client_id": 6545177754635730,
                    "currency_id": "BRL",
                    "date_created": "2026-02-12T07:00:25.000-04:00",
                    "operation": {
                        "id": 2921580800,
                        "type": "refund_payment"
                    },
                    "reserve_id": null
                }
            ],
            "reserve_id": null,
            "type": "fee",
            "update_charges": []
        }
    ],
    "charges_execution_info": {
        "internal_execution": {
            "date": "2026-02-03T13:01:03.675-04:00",
            "execution_id": "01KGJ76MRR94SPN1SHJM3KJB5A"
        }
    },
    "collector_id": 1144556609,
    "corporation_id": null,
    "counter_currency": null,
    "coupon_amount": 0,
    "currency_id": "BRL",
    "date_approved": "2026-02-03T13:01:05.000-04:00",
    "date_created": "2026-02-03T13:01:03.000-04:00",
    "date_last_updated": "2026-02-12T07:00:34.000-04:00",
    "date_of_expiration": null,
    "deduction_schema": null,
    "description": "PEDIDO 7477",
    "differential_pricing_id": null,
    "external_reference": null,
    "fee_details": [
        {
            "amount": 4.75,
            "fee_payer": "collector",
            "type": "mercadopago_fee"
        }
    ],
    "financing_group": null,
    "id": 144654396660,
    "installments": 1,
    "integrator_id": null,
    "issuer_id": "12364",
    "live_mode": true,
    "marketplace_owner": null,
    "merchant_account_id": null,
    "merchant_number": null,
    "metadata": {},
    "money_release_date": "2026-02-12T07:00:26.000-04:00",
    "money_release_schema": null,
    "money_release_status": "released",
    "notification_url": null,
    "operation_type": "regular_payment",
    "order": {
        "id": "37861641598",
        "type": "mercadopago"
    },
    "payer": {
        "email": "tanitita_aninha@hotmail.com",
        "entity_type": null,
        "first_name": null,
        "id": "259325133",
        "identification": {
            "number": "34862877885",
            "type": "CPF"
        },
        "last_name": null,
        "operator_id": null,
        "phone": {
            "number": null,
            "extension": null,
            "area_code": null
        },
        "type": null
    },
    "payment_method": {
        "data": {
            "lender_id": 571062534
        },
        "forward_data": {
            "credits_pricing_id": "259325133-20260203170049075-SYC7jZt"
        },
        "id": "consumer_credits",
        "issuer_id": "12364",
        "type": "digital_currency"
    },
    "payment_method_id": "consumer_credits",
    "payment_type_id": "digital_currency",
    "platform_id": null,
    "point_of_interaction": {
        "application_data": {
            "name": null,
            "operating_system": null,
            "version": null
        },
        "business_info": {
            "branch": "Merchant Services",
            "sub_unit": "payment_link",
            "unit": "online_payments"
        },
        "location": {
            "source": null,
            "state_id": "NN"
        },
        "transaction_data": {
            "e2e_id": null
        },
        "type": "CHECKOUT"
    },
    "pos_id": null,
    "processing_mode": "aggregator",
    "refunds": [
        {
            "additional_data": null,
            "adjustment_amount": 0,
            "alternative_refund_mode": null,
            "amount": 119.13,
            "amount_refunded_to_other_user": 119.13,
            "amount_refunded_to_payer": null,
            "charges_details": [
                {
                    "amount": 4.75,
                    "external_charge_id": "01KGJ76MSHNCGR7S1E70E4Z8PK",
                    "id": "144654396660-001"
                }
            ],
            "date_created": "2026-02-12T07:00:25.000-04:00",
            "e2e_id": null,
            "expiration_date": null,
            "external_operations": [
                {
                    "id": 49056760,
                    "source": "credits",
                    "target_account": "lender"
                }
            ],
            "external_refund_id": 49056760,
            "funder": null,
            "id": 2921580800,
            "labels": [],
            "metadata": {
                "status_detail": null
            },
            "partition_details": [],
            "payment_id": 144654396660,
            "reason": null,
            "refund_mode": "standard",
            "request_id": "833bacee-0416-43fd-bf25-01fec9901995",
            "source": {
                "id": "1144556609",
                "name": "MANI ALIMENTOS SAUDAVEIS LTDA ",
                "type": "collector"
            },
            "status": "approved",
            "unique_sequence_number": null
        }
    ],
    "release_info": null,
    "shipping_amount": 0,
    "sponsor_id": null,
    "statement_descriptor": null,
    "status": "refunded",
    "status_detail": "refunded",
    "store_id": null,
    "tags": null,
    "taxes_amount": 0,
    "transaction_amount": 119.13,
    "transaction_amount_refunded": 119.13,
    "transaction_details": {
        "acquirer_reference": null,
        "external_resource_url": null,
        "financial_institution": null,
        "installment_amount": 0,
        "net_received_amount": 114.38,
        "overpaid_amount": 0,
        "payable_deferral_period": null,
        "payment_method_reference_id": "1286560672",
        "total_paid_amount": 119.13
    }
}
```

## Money to be released

- This file is used to store the response of a payment that is going to be released in the future, so we can use it as an example when we implement the money release feature. The payment was made on February 8th, 2026, and the money release date is February 22nd, 2026.

```json
{
    "accounts_info": null,
    "acquirer_reconciliation": [],
    "additional_info": {
        "items": [
            {
                "description": "KIT Degustação Combo 16",
                "id": "KIT16-8XTAM",
                "quantity": "1",
                "title": "KIT Degustação Combo 16",
                "unit_price": "95.8"
            }
        ],
        "payer": {
            "first_name": "Marina",
            "last_name": "Bopsin",
            "phone": {
                "area_code": "51",
                "number": "997979716"
            }
        },
        "shipments": {
            "receiver_address": {
                "street_name": "Acesso Terra Nova",
                "street_number": "502",
                "zip_code": "94857550"
            }
        },
        "tracking_id": "platform:v1-whitelabel,so:ALL,type:N/A,security:none"
    },
    "authorization_code": "720037",
    "binary_mode": false,
    "brand_id": null,
    "build_version": "3.141.0-rc-1",
    "call_for_authorize_id": null,
    "captured": true,
    "card": {
        "bin": "49840721",
        "cardholder": {
            "identification": {
                "number": "028.224.22010",
                "type": "CPF"
            },
            "name": "MARINA BOPSIN"
        },
        "country": "BRA",
        "date_created": "2026-02-08T11:38:17.000-04:00",
        "date_last_updated": "2026-02-08T11:38:17.000-04:00",
        "expiration_month": 1,
        "expiration_year": 2031,
        "first_six_digits": "498407",
        "id": null,
        "last_four_digits": "9493",
        "tags": [
            "debit",
            "credit"
        ]
    },
    "charges_details": [
        {
            "accounts": {
                "from": "collector",
                "to": "mp"
            },
            "amounts": {
                "original": 5.09,
                "refunded": 0
            },
            "client_id": 0,
            "date_created": "2026-02-08T11:38:17.000-04:00",
            "external_charge_id": "01KGYYENTKDRP5TZ7WW8RXN5D9",
            "id": "145377190682-001",
            "last_updated": "2026-02-08T11:38:17.000-04:00",
            "metadata": {
                "reason": "",
                "source": "proc-svc-charges",
                "source_detail": "processing_fee_charge"
            },
            "name": "mercadopago_fee",
            "refund_charges": [],
            "reserve_id": null,
            "type": "fee",
            "update_charges": []
        }
    ],
    "charges_execution_info": {
        "internal_execution": {
            "date": "2026-02-08T11:38:17.308-04:00",
            "execution_id": "01KGYYENSNDBTSNDZCP1WQN599"
        }
    },
    "collector_id": 1144556609,
    "corporation_id": null,
    "counter_currency": null,
    "coupon_amount": 0,
    "currency_id": "BRL",
    "date_approved": "2026-02-08T11:38:19.000-04:00",
    "date_created": "2026-02-08T11:38:17.000-04:00",
    "date_last_updated": "2026-02-08T11:38:27.000-04:00",
    "date_of_expiration": null,
    "deduction_schema": null,
    "description": "Marina Ramos Bopsin | crilancha",
    "differential_pricing_id": null,
    "external_reference": "hWN8Y6s4F1bCkY7UU1c1dDEI",
    "fee_details": [
        {
            "amount": 5.09,
            "fee_payer": "collector",
            "type": "mercadopago_fee"
        }
    ],
    "financing_group": null,
    "id": 145377190682,
    "installments": 1,
    "integrator_id": null,
    "issuer_id": "194",
    "live_mode": true,
    "marketplace_owner": null,
    "merchant_account_id": null,
    "merchant_number": null,
    "metadata": {
        "seller_website": "manialimentos.com.br"
    },
    "money_release_date": "2026-02-22T11:38:19.000-04:00",
    "money_release_schema": null,
    "money_release_status": "pending",
    "notification_url": "https://pay.yampi.com.br/postbacks/gateways/mercadopago?store_token=rBJi0lwPOmnb8V4lAdytOt7IIlQsnz0Z9W0eUT6c",
    "operation_type": "regular_payment",
    "order": {},
    "payer": {
        "email": "marina.bopsin@gmail.com",
        "entity_type": null,
        "first_name": null,
        "id": "1521948234",
        "identification": {
            "number": "02822422010",
            "type": "CPF"
        },
        "last_name": null,
        "operator_id": null,
        "phone": {
            "number": null,
            "extension": null,
            "area_code": null
        },
        "type": null
    },
    "payment_method": {
        "data": {
            "routing_data": {
                "merchant_account_id": "2036"
            }
        },
        "id": "visa",
        "issuer_id": "194",
        "type": "credit_card"
    },
    "payment_method_id": "visa",
    "payment_type_id": "credit_card",
    "platform_id": null,
    "point_of_interaction": {
        "business_info": {
            "branch": "Merchant Services",
            "sub_unit": "default",
            "unit": "online_payments"
        },
        "transaction_data": {
            "ticket_id": "57081191533_7d7f717e6f75777b737f_P"
        },
        "type": "UNSPECIFIED"
    },
    "pos_id": null,
    "processing_mode": "aggregator",
    "refunds": [],
    "release_info": null,
    "shipping_amount": 0,
    "sponsor_id": 297074808,
    "statement_descriptor": "MP*CRILANCHA             ",
    "status": "approved",
    "status_detail": "accredited",
    "store_id": null,
    "tags": null,
    "taxes_amount": 0,
    "transaction_amount": 113.29,
    "transaction_amount_refunded": 0,
    "transaction_details": {
        "acquirer_reference": null,
        "external_resource_url": null,
        "financial_institution": null,
        "installment_amount": 113.29,
        "net_received_amount": 108.2,
        "overpaid_amount": 0,
        "payable_deferral_period": null,
        "payment_method_reference_id": null,
        "total_paid_amount": 113.29
    }
}
```

## Charged-back > Reimbursed

- This file is used to store the response of a payment that was charged-back by the buyer, but the seller won the dispute

```json
{
    "accounts_info": null,
    "acquirer_reconciliation": [],
    "additional_info": {
        "items": [
            {
                "description": "KIT Degustação Crilancha",
                "id": "KITDEG8-20G",
                "quantity": "1",
                "title": "KIT Degustação Crilancha",
                "unit_price": "39.9"
            }
        ],
        "payer": {
            "first_name": "Giuliana",
            "last_name": "Pinho",
            "phone": {
                "area_code": "11",
                "number": "947010560"
            }
        },
        "shipments": {
            "receiver_address": {
                "street_name": "Rua Particular II",
                "street_number": "38",
                "zip_code": "07145075"
            }
        },
        "tracking_id": "platform:v1-whitelabel,so:ALL,type:N/A,security:none"
    },
    "authorization_code": "847624",
    "binary_mode": false,
    "brand_id": null,
    "build_version": "3.135.0-rc-1",
    "call_for_authorize_id": null,
    "captured": true,
    "card": {
        "bin": "53310000",
        "cardholder": {
            "identification": {
                "number": "360.538.91800",
                "type": "CPF"
            },
            "name": "Giuliana Pinho "
        },
        "country": "BRA",
        "date_created": "2025-12-22T06:30:55.000-04:00",
        "date_last_updated": "2025-12-22T06:30:55.000-04:00",
        "expiration_month": 3,
        "expiration_year": 2031,
        "first_six_digits": "533100",
        "id": null,
        "last_four_digits": "7466",
        "tags": [
            "credit",
            "debit"
        ]
    },
    "charges_details": [
        {
            "accounts": {
                "from": "collector",
                "to": "mp"
            },
            "amounts": {
                "original": 1.79,
                "refunded": 0
            },
            "client_id": 0,
            "date_created": "2025-12-22T06:30:55.000-04:00",
            "external_charge_id": "01KD2SSCNHRGJWB4SZM3DMGCXW",
            "id": "138982880892-001",
            "last_updated": "2025-12-22T06:30:55.000-04:00",
            "metadata": {
                "reason": "",
                "source": "proc-svc-charges",
                "source_detail": "processing_fee_charge"
            },
            "name": "mercadopago_fee",
            "refund_charges": [],
            "reserve_id": null,
            "type": "fee",
            "update_charges": []
        }
    ],
    "charges_execution_info": {
        "internal_execution": {
            "date": "2025-12-22T06:30:55.930-04:00",
            "execution_id": "01KD2SSCMTAVR5HRC7FW2YKG5T"
        }
    },
    "collector_id": 1144556609,
    "corporation_id": null,
    "counter_currency": null,
    "coupon_amount": 0,
    "currency_id": "BRL",
    "date_approved": "2025-12-22T06:30:58.000-04:00",
    "date_created": "2025-12-22T06:30:55.000-04:00",
    "date_last_updated": "2026-01-06T10:55:54.000-04:00",
    "date_of_expiration": null,
    "deduction_schema": null,
    "description": "Giuliana Pinho | crilancha",
    "differential_pricing_id": null,
    "external_reference": "hWN6inJ0d3Zv3nlvTXsouyNW",
    "fee_details": [
        {
            "amount": 1.79,
            "fee_payer": "collector",
            "type": "mercadopago_fee"
        }
    ],
    "financing_group": null,
    "id": 138982880892,
    "installments": 1,
    "integrator_id": null,
    "issuer_id": "24",
    "live_mode": true,
    "marketplace_owner": null,
    "merchant_account_id": null,
    "merchant_number": null,
    "metadata": {
        "seller_website": "manialimentos.com.br"
    },
    "money_release_date": "2025-12-22T06:30:58.000-04:00",
    "money_release_schema": null,
    "money_release_status": "released",
    "notification_url": "https://pay.yampi.com.br/postbacks/gateways/mercadopago?store_token=rBJi0lwPOmnb8V4lAdytOt7IIlQsnz0Z9W0eUT6c",
    "operation_type": "regular_payment",
    "order": {},
    "payer": {
        "email": "pvsilva.giuliana@gmail.com",
        "entity_type": null,
        "first_name": null,
        "id": "1655028201",
        "identification": {
            "number": "36053891800",
            "type": "CPF"
        },
        "last_name": null,
        "operator_id": null,
        "phone": {
            "number": null,
            "extension": null,
            "area_code": null
        },
        "type": null
    },
    "payment_method": {
        "data": {
            "routing_data": {
                "merchant_account_id": "39"
            }
        },
        "id": "master",
        "issuer_id": "24",
        "type": "credit_card"
    },
    "payment_method_id": "master",
    "payment_type_id": "credit_card",
    "platform_id": null,
    "point_of_interaction": {
        "business_info": {
            "branch": "Merchant Services",
            "sub_unit": "default",
            "unit": "online_payments"
        },
        "transaction_data": {
            "ticket_id": "55978875379_777a393777776d7e3f7f_P"
        },
        "type": "UNSPECIFIED"
    },
    "pos_id": null,
    "processing_mode": "aggregator",
    "refunds": [],
    "release_info": {
        "advance_provider": "mc",
        "advance_provider_user": null,
        "events": null,
        "new_payments_release_model": false
    },
    "shipping_amount": 0,
    "sponsor_id": 297074808,
    "statement_descriptor": "MP *CRILANCHA",
    "status": "charged_back",
    "status_detail": "reimbursed",
    "store_id": null,
    "tags": [
        "release_advance_by_mc"
    ],
    "taxes_amount": 0,
    "transaction_amount": 35.91,
    "transaction_amount_refunded": 0,
    "transaction_details": {
        "acquirer_reference": null,
        "external_resource_url": null,
        "financial_institution": null,
        "installment_amount": 35.91,
        "net_received_amount": 34.12,
        "overpaid_amount": 0,
        "payable_deferral_period": null,
        "payment_method_reference_id": null,
        "total_paid_amount": 35.91
    }
}
```
