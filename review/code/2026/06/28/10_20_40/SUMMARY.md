# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `system-status.e2e-spec.ts` 의 `workspace-invitations-pruner` 항목이 diff 후에도 잔류하여 `MONITORED_QUEUES` 와 불일치, e2e 큐 목록 검증 실패 예상. SPEC-DRIFT(WH-MG-02 수정 DTO UUID 강제 미명시) 및 JSDoc 인용 부정확 WARNING 2건 추가. 나머지 발견사항은 모두 INFO 수준.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `system-status.e2e-spec.ts` 의 `workspace-invitations-pruner` 항목이 diff 후에도 line 36 에 잔류. `MONITORED_QUEUES` (15개) 와 `EXPECTED_QUEUE_NAMES` (16개) 불일치로 e2e 큐 목록 검증(`expect(names).toEqual(...)`) 실패 예상. plan 의 "중복 2회 제거" 체크리스트가 완전 이행되지 않은 상태. | `codebase/backend/test/system-status.e2e-spec.ts` line 36 | `EXPECTED_QUEUE_NAMES` 에서 `'workspace-invitations-pruner'` 를 완전 제거(line 36 삭제). `MONITORED_QUEUES` 와 항목 수 일치 확인 후 e2e 재실행. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] WH-MG-02 spec 본문이 "생성 시" 자동 생성만 명시 — 수정 DTO 에서 v4 UUID 형식 강제 요건 누락. 코드의 `@IsUUID('4')` 는 보안상 옳고 WH-SC-01 취지에도 맞으므로 **코드가 옳고 spec 이 낡은** SPEC-DRIFT 상황. | `spec/5-system/12-webhook.md` line 90 (WH-MG-02), `update-trigger.dto.ts` JSDoc | 코드 유지. project-planner 를 통해 `spec/5-system/12-webhook.md` §3.4 WH-MG-02 에 "수정 DTO 도 v4 UUID 형식을 강제한다" 내용 추가. |
| 2 | 요구사항 | `UpdateTriggerDto` JSDoc 의 "Spec Webhook WH-MG-02" 인용 문구가 "서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제"라고 기술하나 현재 spec WH-MG-02 는 그렇게 명시하지 않음. 독자 혼란 및 리뷰어 오탐 원인. | `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` JSDoc | spec 갱신 후 JSDoc 인용도 정확한 spec 언어로 조정. |
| 3 | 보안 | JWT_SECRET 폴백 리터럴 `'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 이 소스코드 git history 에 영구 노출. e2e 전용 파일이며 "do-not-use-in-prod" 경고 포함, PR 신규 도입 아닌 pre-existing 이슈. | `codebase/backend/test/external-interaction.e2e-spec.ts` line 1179-1180 | 폴백 리터럴 대신 환경변수 미주입 시 명시적 실패 처리. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | 데이터베이스 | V102 `NOT VALID` CHECK 는 신규 write 만 적용, 레거시 행 미검증. 추후 `VALIDATE CONSTRAINT` 승격 추적 필요. | V102 |
| 2 | 요구사항 | `ALTER TABLE trigger` 따옴표 없이 사용 (예약어). 기존 패턴 통일 확인. | V102 lines 59,61 |
| 3 | 테스트 | `triggers.service.spec.ts` `endpointPath` 픽스처가 슬러그 형식(`'hook-abc'` 등). | service.spec |
| 4 | 테스트 | `PATCH /api/triggers/:id` 비-UUID endpointPath → 400 e2e 케이스 없음(POST 만). | webhook-trigger.e2e |
| 5 | 테스트 | V102 정규식 동작 DB-level 직접 검증 테스트 없음. | V102 |
| 6 | 범위 | `system-status.e2e-spec.ts` 변경은 pre-existing drift 수정(핵심 목적 외, plan 명시). | system-status.e2e |
| 7 | API 계약 | Swagger description 에 schedule 거부 HTTP 상태코드 미명시(에러코드는 명시). | update-trigger.dto |
| 8 | 보안 | `trigger-dto-validation.spec.ts` SLACK/DISCORD 테스트 리터럴(허용 가능). | dto-validation.spec |
| 9 | 테스트 | v5 UUID 벡터 variant nibble `a` 우연 유효(version nibble 거부 의도엔 부합). | dto-validation.spec |
| 10 | 문서화 | plan 체크리스트 미완료 항목 잔존(리뷰 시점). | plan |

## 라우터 결정

`routing=done` — 실행 9명(전원 forced/router_safety): security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract. 제외 5명: performance, architecture, dependency, concurrency, user_guide_sync.

> *재시도 필요: maintainability 1건 — output_file 미존재로 결과 미확인.*
