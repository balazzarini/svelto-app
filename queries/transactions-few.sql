SELECT 
	"gatewayId", 
	"amountGross",
	"gatewayStatus",
	"moneyReleaseDate",
	"moneyReleaseStatus",
	"matchDescription",
	"financialStatus"
FROM public.transactions
where "dateEvent" > '2026-01-29'
order by "dateEvent" desc


