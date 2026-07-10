# Plan 정합성 검토 — catalog-residual-codes.md

## 검토 범위
- Target: `plan/in-progress/catalog-residual-codes.md` (NOT_A_MEMBER·INVALID_PASSWORD·PASSWORD_REQUIRED 3코드 등재)
- 대조: `plan/in-progress/**` 전체 (grep: `3-error-handling`·`1-auth.md`·3코드명·`verifyPasswordForUser`·`§1.2` 등으로 관련 후보 선별 후 개별 확인)

## 확인한 사실관계 (검증됨)

1. **base 신선도**: `git log`/`git merge-base HEAD origin/main` 확인 결과 현재 HEAD(`10e511a`, #892)가 origin/main 과 일치하고 target 이 전제하는 #887(`3186420`)·#888(`5ee0c69`) 를 포함한다. target 의 "base 교정 완료" 서술과 실측이 일치 — 이전 회차(plan_coherence WARNING#1, stale 스택)는 실제로 해소됨.
2. **`error-codes-catalog-sot.md` 와의 관계**: 해당 plan `## 후속` 섹션 L56 `- [ ] NOT_A_MEMBER·INVALID_PASSWORD 도 §1 미등재 — 동일 완결성 pass 에서 흡수`가 target 이 정확히 흡수하려는 대상이며, target 워크플로에 "L56 체크박스 갱신" 이 명시적 항목으로 포함돼 있다. `PASSWORD_REQUIRED` 는 이 파일의 8코드 목록엔 없으나(의도적 제외 — 파일 자체가 "spec 에 이미 문서화된 8코드만" 이라 명시), target 이 인용하는 출처는 `3-error-handling.md §1.2.1` 하단 각주(실측: 현재 스펙 파일에 해당 문장 존재, target 인용과 일치) — 두 소스가 서로 다른 3코드를 가리키는 게 아니라 상호 보완적으로 동일 3코드를 지목함. 충돌 없음.
3. **다른 in-progress plan 과의 중복/충돌 부재**: `PASSWORD_REQUIRED`/`NOT_A_MEMBER`/`INVALID_PASSWORD`/`PASSWORD_INVALID`/`verifyPasswordForUser`/`§1.2` 키워드로 전체 `plan/in-progress/**` grep 시 매칭된 문서(`spec-update-manual-trigger-save-time-error-code.md`, `suggestions-prefix-dry.md`, `spec-sync-websocket-protocol-gaps.md`, `exec-intake-followups.md`, `http-ssrf-all-auth-followups.md`, `competitive-analysis-n8n-flowise.md`, `cafe24-backlog-residual.md`)는 모두 무관한 문맥(다른 에러코드·일반 cross-ref·이미 해소된 항목 언급)이었고, target 이 다루는 3코드나 §1.2/§1.2.1 배치 결정과 겹치거나 충돌하는 미해결 결정을 갖고 있지 않았다.
4. **workspace 직접-추가 경로 코드**(`ALREADY_A_MEMBER` 등, target "범위 밖" 명시)를 다루는 다른 in-progress plan 없음 — 범위 제외가 다른 plan 의 기대와 충돌하지 않음.
5. `ai-agent-tool-connection-rewrite.md`(TBD 다수) 등 대형 미해결-결정 plan 들은 도메인이 달라(AI 도구 연결) target 과 무관.

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** 자매 plan 종결 순서 확인 필요
  - target 위치: `## 워크플로` 마지막 두 항목 (`error-codes-catalog-sot.md §후속 L56 체크박스 갱신` → `plan complete 이동`)
  - 관련 plan: `plan/in-progress/error-codes-catalog-sot.md` L56
  - 상세: target 이 L56 을 갱신하면 `error-codes-catalog-sot.md` 의 `## 후속` 두 항목이 모두 완료 상태가 된다. 이 시점에 `error-codes-catalog-sot.md` 자체도 (본문 워크플로 3항목 기완료 + 후속 2항목 완료로) complete 이동 대상이 되는지 target 워크플로 문구("(전 항목 완료 시) complete 이동")가 어느 문서를 가리키는지 다소 모호하다.
  - 제안: target 실행 시 L56 갱신과 함께 `error-codes-catalog-sot.md` 자신의 plan-lifecycle 이동 여부도 같은 PR 에서 판단해 명시(두 plan 문서를 동시에 complete/ 로 옮길지, 대상 명확화).

## 요약

Target(`catalog-residual-codes.md`)은 `error-codes-catalog-sot.md §후속`이 명시적으로 "동일 완결성 pass 에서 흡수" 하도록 남겨둔 미해결 후속 항목을 정확히 흡수하고 있으며, 그 자매 plan 의 체크박스 갱신까지 자신의 워크플로에 포함해 후속 반영 누락이 없다. base freshness(이전 WARNING#1)는 `reset --hard origin/main` 으로 실측 해소됐고, `plan/in-progress/**` 전수 grep 상 3코드나 §1.2/§1.2.1 배치 결정과 충돌하는 미해결 결정을 가진 다른 plan은 없다. 유일한 메모는 자매 plan(`error-codes-catalog-sot.md`) 자체의 plan-lifecycle 이동 시점을 target 워크플로 문구가 다소 모호하게 남겨둔 점(INFO, 비차단)이다.

## 위험도

NONE
