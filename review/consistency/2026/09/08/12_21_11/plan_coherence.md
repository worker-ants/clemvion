# Plan 정합성 검토 — target: `spec/5-system/` (--impl-prep)

## 검토 범위 및 방법

- 프롬프트 번들에 전문이 실린 target: `1-auth.md` · `2-api-convention.md` · `3-error-handling.md` (나머지 15개 `5-system/*` 파일은 컨텍스트 예산 초과로 절단됨 — 관련성 낮아 직접 Read 는 생략).
- 프롬프트 번들에 전문이 실린 plan: `spec-followups-batch-b.md`(현재 워크트리의 진행 작업) · `spec-draft-nullable-notation-followups.md` · `ai-agent-tool-connection-rewrite.md`. 나머지 62개 in-progress plan 은 절단됨.
- 절단된 plan 중 target 과 접점이 있을 만한 것(`spec-sync-auth-gaps.md`, `harness-review-gate-followups.md`, `backend-lint-gate-broken-on-main.md`, `deps-guard-hardening.md`)은 디스크에서 직접 Read 하여 보완.

## 발견사항

특이사항 없음 — CRITICAL/WARNING 없음. 아래는 확인 과정에서 남기는 INFO 성격의 메모.

- **[INFO]** 배치 B(B-1~B-8)와 등재 plan 의 1:1 대응 확인
  - target 위치: 해당 없음(target 자체는 변경되지 않음 — 이번 turn 은 `codebase/**` + harness 작업)
  - 관련 plan: `plan/in-progress/spec-followups-batch-b.md` (B-1~B-8) ↔ `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "developer/harness" 로 라벨된 8개 후속 항목
  - 상세: B-1(run-test.sh 타입체크 ratchet 누락) · B-2(`__test-utils__` dist 유출) · B-3(전역 예외 필터 `pg-error.ts` SoT 미사용) · B-4(`listMembers` 투영) · B-5(`integration-oauth.service.ts` 손-작성 constraint) · B-6(`endpointPath` save() 래핑 래칫) · B-7(트리거 409 e2e) · B-8(`WorkflowVersionDetail` 동명 미러)이 followups 문서의 동일 항목과 각각 정확히 대응한다. 8건 모두 followups 문서에서 이미 다른 방식으로 처리(선점)되거나 취소된 흔적이 없음을 확인했고, 배치 B 자신도 "착수 전 재판정(2026-09-08): 배치 A 이후 다른 세션의 머지 0건" 이라고 명시해 두었다.
  - 제안: 없음(정합).

- **[INFO]** target 의 §5.4 "검증 층" 4행 표·§5.3 "택일 기준" 소절·§1.10 트리거 `endpointPath` 세부 코드가 plan 이 "완료(2026-09-08, 배치 A-3/A-4)" 라고 주장하는 내용과 실제로 일치함을 대조 확인. B-6/B-7 이 강제하려는 계약(top-level `RESOURCE_CONFLICT` + `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`)이 이미 §1.10 에 정확히 문서화되어 있어, 구현 착수 전 선행 조건(§1.10 카탈로그 등재)이 이미 충족된 상태다 — 선행 plan 미해소 없음.

- **[INFO]** B-1 의 전제("두 typecheck ratchet 이 CI 에는 있으나 로컬 4단계 wrapper 에는 없다")를 `backend-lint-gate-broken-on-main.md`(backend, `backend-checks.yml` typecheck-ratchet 완료)와 `harness-review-gate-followups.md`(frontend, `frontend-checks.yml` typecheck-ratchet 완료, 2026-09-02)에서 직접 대조 확인 — 두 CI 잡이 실재하며 B-1 의 서술과 모순 없음. `PROJECT.md` 편집 권한도 과거 다수의 `fix(harness)`/`fix(deps)`/`feat(ci)` 커밋 선례로 뒷받침된다(governance 축이 아니라 developer 축).

- **[INFO]** `ai-agent-tool-connection-rewrite.md`(미착수, "결정 필요" 5건이 전부 TBD)은 `spec/5-system/14-external-interaction-api.md` §5.2 SSE `tool_call_*` payload 이름 규칙에 대한 forward cross-ref 를 갖고 있으나, 이번 target 번들에서 `14-external-interaction-api.md` 본문은 절단되어 직접 대조하지 못했다. 다만 이 cross-ref 는 그 plan 문서 자신이 이미 인지·등재해 둔 의존성이고, 이번 배치 B 작업은 EIA/도구 이름 표면을 전혀 건드리지 않으므로 이번 turn 과는 무관하다.

- **[INFO]** `spec-draft-nullable-notation-followups.md`에는 배치 B 범위 밖의 미해결 항목(예: `WorkflowVersionDto.creator`의 §5.4 금지 조합 잔존 부채, Flyway `mixed=true` 결정 대기, `INTERNAL_ERROR` 문구 3중 drift, §5.4 drift 배치 2·3단계)이 다수 남아 있으나, 전부 배치 B 의 8개 항목과 별개 축이며 배치 B 의 착수를 막는 선행 조건으로 걸려 있지 않다. 재-flag 불필요.

## 요약

target(`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)과 현재 진행 중인 `plan/in-progress/spec-followups-batch-b.md`(B-1~B-8) 사이에 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 중 어느 것도 발견되지 않았다. 배치 B의 8개 항목은 `spec-draft-nullable-notation-followups.md`가 이미 planner 턴에서 등재해 둔 "developer/harness" 후속 항목과 정확히 1:1 대응하며, 그 항목들이 전제하는 spec 상태(§5.4 검증 층·§5.3 택일 기준·§1.10 트리거 에러 코드)는 이미 target 문서에 반영되어 있다(2026-09-08 배치 A 완료분과 대조 확인). B-1의 CI/로컬 게이트 갭 전제도 별도 harness plan 파일 두 건(`backend-lint-gate-broken-on-main.md`, `harness-review-gate-followups.md`)의 실측과 모순 없이 정합한다. 컨텍스트 예산으로 절단된 다수의 다른 in-progress plan(특히 EIA/webhook/chat-channel 계열)은 이번 배치 B의 코드 변경 범위와 접점이 없어 재검토 대상에서 제외했다.

## 위험도

NONE
