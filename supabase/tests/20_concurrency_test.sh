#!/usr/bin/env bash
# 20. Simultaneous transactions from two cashiers (real parallel sessions).
set -euo pipefail
DB=$1
PSQL=${PSQL:-psql}
q() { $PSQL -qtAX -d "$DB" -c "$1"; }
as_user() { # $1 = auth uid, $2 = sql
  $PSQL -qtAX -d "$DB" -c "set role authenticated; select set_config('request.jwt.claim.sub', '$1', false);" -c "$2" 2>&1
}
C1=00000000-0000-0000-0000-0000000000c1
C2=00000000-0000-0000-0000-0000000000c2
# fresh customer
CID=$(as_user $C1 "select public.register_customer('Race Test')->>'customer_id'" | tail -1)

echo "--- 20a. 12 parallel paid-hour requests from two cashiers -> exactly 3 punches, 1 reward"
for i in $(seq 1 12); do
  if (( i % 2 )); then U=$C1; else U=$C2; fi
  as_user $U "select public.add_paid_hour('$CID', gen_random_uuid())->>'punch_count'" > /tmp/gzx_race_$i.out &
done
wait
OK=$(q "select count(*) from public.punch_transactions where customer_id = '$CID'")
RW=$(q "select count(*) from public.rewards where customer_id = '$CID' and status = 'available'")
PENDING=$(cat /tmp/gzx_race_*.out | grep -c REWARD_PENDING || true)
rm -f /tmp/gzx_race_*.out
[[ "$OK" == "3" && "$RW" == "1" && "$PENDING" == "9" ]] || { echo "FAILED: punches=$OK rewards=$RW pending=$PENDING"; exit 1; }

echo "--- 20b. two cashiers redeem the same reward at the same time -> exactly one redemption"
for U in $C1 $C2 $C1 $C2; do
  as_user $U "select public.redeem_reward('$CID', gen_random_uuid())->>'cycle_number'" > /tmp/gzx_redeem_$RANDOM.out &
done
wait
RED=$(q "select count(*) from public.reward_redemptions where customer_id = '$CID'")
CYC=$(q "select count(*) from public.loyalty_cycles where customer_id = '$CID'")
NOREWARD=$(cat /tmp/gzx_redeem_*.out | grep -c NO_REWARD_AVAILABLE || true)
rm -f /tmp/gzx_redeem_*.out
[[ "$RED" == "1" && "$CYC" == "2" && "$NOREWARD" == "3" ]] || { echo "FAILED: redemptions=$RED cycles=$CYC rejected=$NOREWARD"; exit 1; }

echo "--- 19/27. same idempotency key from two devices in parallel -> one punch"
KEY=$(q "select gen_random_uuid()")
for i in 1 2 3 4; do
  as_user $C1 "select public.add_paid_hour('$CID', '$KEY')->>'punch_count'" >/dev/null &
done
wait
N=$(q "select count(*) from public.punch_transactions where idempotency_key = '$KEY'")
P=$(q "select punch_count from public.loyalty_cycles where customer_id = '$CID' and status = 'active'")
[[ "$N" == "1" && "$P" == "1" ]] || { echo "FAILED: rows=$N progress=$P"; exit 1; }
echo "CONCURRENCY TESTS PASSED"
