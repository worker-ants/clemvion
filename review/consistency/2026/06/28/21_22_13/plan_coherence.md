# Plan 정합성 검토 결과

검토 대상: `spec/5-system/` (diff-base origin/main, impl-done)
관련 plan: `plan/in-progress/webhook-public-ip-failopen-hardening.md` · `plan/in-progress/webhook-hardening-cleanup.md` · `plan/in-progress/spec-sync-auth-gaps.md`

---

## 발견사항

### 1. [WARNING] `webhook-public-ip-failopen-hardening.md` 의 "결정 필요" 항목 3개 중 일부가 spec 에 반영됨 — plan 갱신 필요

- **target 위치**: `spec/5-system/1-auth.md` §2.3 "클라이언트 IP" 행, Rationale 2.3.B; `spec/5-system/12-webhook.md` §6 Rate Limiting 단락, WH-SC-05 표 행; `spec/5-system/3-error-handling.md` §1.7 표
- **관련 plan**: `plan/in-progress/webhook-public-ip-failopen-hardening.md` §"결정 필요" 항목 1~3:
  1. "인프라 레벨 vs 앱 레벨" 처리 방향
  2. "`req.socket.remoteAddress` 를 IP 폴백으로 쓸지"
  3. "fail-closed 전환 여부 — IP 미식별 시 통과 대신 별도(완화) 한도 적용 또는 거부"
- **상세**: plan 은 이 세 결정을 "사용자/보안 합의 선행 후 spec 갱신 → 구현" 순서로 명시했다. 그러나 본 PR(webhook-hardening-cleanup 완료 PR, commit #765 후속)은 합의 기록 없이 spec 을 이미 결론 쪽으로 업데이트했다:
  - 결정 2("req.socket 폴백 불채택") → Rationale 2.3.B 에 "같은 이유로 공개 webhook rate-limit 의 IP 미식별 케이스도 req.socket.remoteAddress 폴백을 쓰지 않는다" 추가 (**기각 방향으로 확정**)
  - 결정 3("fail-closed 전환 여부") → "단일 공유 버킷 완화 한도" 방향으로 확정 (fail-closed 기각, fail-open 기각, 완화 버킷 채택)
  - 결정 1("인프라 레벨 vs 앱 레벨") → "인프라 권고(결정 1)" 형태로 4-security R6 에 포함되어 사실상 결론화(앱 레벨 기본선 + 인프라 권고 병행)
  - 이 변경은 이미 코드에도 반영된 상태(UNIDENTIFIED_IP_BUCKET 구현, #763/#765 커밋) — spec 이 구현을 事後 추적한 형태
- **제안**: `webhook-public-ip-failopen-hardening.md` 의 "결정 필요" 섹션을 **결정 확정** 형태로 갱신하거나, plan 을 `plan/complete/` 로 이동해야 한다. 현재 plan 이 "미결정 사항 — 결정 후 spec 반영" 으로 남아 있는데 spec 과 코드가 이미 결론을 반영했으므로, plan 상태가 실제 진행 상황과 불일치한다. plan 을 완료 이동하거나 후속 항목을 "인프라 레벨 강제(WAF/Ingress XFF 강제)는 별도 운영 가이드로 남음" 등으로 좁혀 잔여 항목만 남겨야 한다.

---

### 2. [INFO] `webhook-public-ip-failopen-hardening.md` "후속" 항목 중 `1-auth.md §2.3` 갱신이 이미 완료됨 — plan 체크 미반영

- **target 위치**: `spec/5-system/1-auth.md` §2.3 "클라이언트 IP" 행
- **관련 plan**: `plan/in-progress/webhook-public-ip-failopen-hardening.md` §"후속" 3번째 항목 — "결정 2·3 채택 시 해당 §2.3 행도 함께 갱신 필요"
- **상세**: plan 의 후속 항목이 조건부("결정 2·3 채택 시")로 기술되어 있는데, 실제 결정이 내려지고 §2.3 행도 갱신된 상태다. 단순 추적 메모 불일치이나 plan 을 읽는 사람이 "아직 갱신 안 됨" 으로 오해할 수 있다.
- **제안**: plan 완료 이동 시 자동 해소됨. plan 갱신만 한다면 "완료" 체크박스로 표시.

---

### 3. [INFO] `webhook-hardening-cleanup.md` 의 "범위 밖(별도)" C 항목 중 잔여 spec 묶음이 미반영 — 후속 plan 신설 또는 기존 plan 에 추적 항목 추가 검토

- **target 위치**: `spec/5-system/2-api-convention.md` §5.3, `spec/7-channel-web-chat/` §4 (plan 내 "api-convention §5.3 echo 금지 포인터·web-chat §4 fail-open 언급" 잔여)
- **관련 plan**: `plan/in-progress/webhook-hardening-cleanup.md` §"범위 밖" C 항목 — "잔여(api-convention §5.3 echo 금지 포인터·web-chat §4 fail-open 언급)는 별도 spec 묶음"
- **상세**: webhook-hardening-cleanup plan 이 "push + PR" 직전 단계인데, 잔여 spec 묶음에 대한 후속 추적 plan 이 현재 `plan/in-progress/` 에 별도로 존재하지 않는다. PR 머지 후 이 항목이 누락될 위험이 있다. 단, 이 변경은 단순 포인터/언급 추가라 긴급도가 낮다.
- **제안**: webhook-hardening-cleanup PR 머지 전 또는 직후에 잔여 spec 묶음을 기존 plan(예: `spec-sync-common-gaps.md` 또는 신규 `spec-sync-webhook-gaps-followup.md`)에 항목으로 추가한다.

---

## 요약

핵심 이슈는 `plan/in-progress/webhook-public-ip-failopen-hardening.md` 가 "결정 필요(사용자/보안 합의 선행)"로 열려 있음에도 이미 spec 과 코드 양쪽에서 그 결정이 완료된 상태라는 불일치다. 이 plan 은 `webhook-hardening-cleanup.md` 의 PR #765 후속으로 사실상 D-12 결정이 내려져 구현·spec 반영이 끝났으므로, plan 을 "결정 확정 → 완료 이동" 처리하거나 최소한 "결정 필요" 섹션을 "결정 완료" 로 갱신해야 한다. 미결 결정과 충돌하는 spec 변경 자체는 이미 코드가 선행한 상황을 spec 이 後追적한 형태라 CRITICAL 은 아니나, plan 정합성 관점에서 plan 상태 갱신이 필요하다. 다른 `plan/in-progress/` 항목(spec-sync-auth-gaps.md)과는 직접 충돌이 없다.

## 위험도

LOW
