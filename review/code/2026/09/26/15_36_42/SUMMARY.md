# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(문서: 아직 존재하지 않는 `plan/complete/` 경로를 앞서 가리키는 시점 이른 교차 참조)이며, 나머지는 모두 이미 트리아지된 INFO. forced(router_safety) 7개 reviewer(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보 확인 — 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 시점 이른(premature) 교차 참조 — 아직 `plan/in-progress/`에 있는 플랜을 `plan/complete/forbidden-helper-sentences.md`로 인용. 같은 파일 44행은 이미 완료된 플랜을 정확히 `plan/complete/`로 가리키는 기존 패턴이 있어, 46행이 이를 깬다. 병합 전 이 경로를 여는 사람은 파일을 찾지 못한다 | `plan/in-progress/integration-personal-owner-followup.md:46` | 플랜이 실제로 `plan/complete/`로 이동(체크리스트 완주)할 때까지는 `plan/in-progress/forbidden-helper-sentences.md`를 가리키거나 "완료 시 이동" 단서를 붙인다. `--impl-done` 및 plan 이동이 같은 세션에서 이어지는지 병합 전 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Documentation | `spec/conventions/swagger.md` §5-4는 "서비스가 내는 403은 그 뒤에 덧붙인다"고만 하고, 구두점 형식(` 또는 `)과 이를 전담하는 헬퍼 `forbiddenWithService`의 이름 모두 spec 본문에는 없다 — 근거·이름 모두 코드 JSDoc에만 있음. 이미 `review/consistency/2026/09/26/15_08_57/rationale_continuity.md`(INFO #2) 및 plan "검토 경고 처리" 표에 비차단으로 처리됨 | `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (`forbiddenWithService` JSDoc), `spec/conventions/swagger.md` §5-4 | 조치 불요(이미 반영/유예). 다음에 §5-4를 편집할 기회에 헬퍼 이름과 구두점 규칙 한 줄 추가 검토 |
| 2 | Requirement / API Contract | `spec/conventions/swagger.md` §2-4 상태 코드 표에 202·410·429 행 누락 — 이번 PR 이전부터 있던 기존 spec 갭이며 이번 diff와 무관. `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 소관으로 이미 등재됨 | `spec/conventions/swagger.md` §2-4 (289~302행) | 조치 불요 — 이미 올바르게 위임됨 |
| 3 | Scope | `reRun`/`getChain` 두 곳의 서비스 문장이 단순 이음 구두점 치환을 넘어 코드 나열 순서·구분자·표지(`— 서비스 판정`)까지 바뀜 — plan "안 하는 것" 절의 "이음만 맞춘다"는 범위보다 한 걸음 넓다. 다만 plan 본문이 이 확장을 사전에 명시적으로 선언·정당화했음(은폐된 확장 아님) | `codebase/backend/src/modules/executions/executions.controller.ts:281-284`, `:313-316` | 차단 사유 아님 — 기록만 유지 |
| 4 | Maintainability | `forbiddenWithService(guard: string, service: string)`는 두 인자가 모두 `string`이라 호출 시 인자 순서를 바꿔도 타입체커가 잡지 못함. 현재 13개 호출부는 모두 올바른 순서 | `codebase/backend/src/common/swagger/forbidden-descriptions.ts:47` | 현재 규모에서는 과설계 우려로 즉시 조치 불필요. 필요 시 브랜드 타입 또는 "순서 바뀌면 실패" 단위 테스트 케이스 추가 |
| 5 | Maintainability | `integrations.controller.ts`의 `FORBIDDEN_MEMBER_OR_ORG_ADMIN`/`FORBIDDEN_EDITOR_OR_ORG_ADMIN` 두 모듈 상수가 동일 서비스 문장 텍스트를 반복 — 리팩터 이전부터 있던 중복이며 plan이 "서비스 문장 표기 전면 통일은 스코프 밖"으로 명시 defer | `codebase/backend/src/modules/integrations/integrations.controller.ts:96-103` | 조치 불요. 추후 재손질 시 지역 상수로 추출 고려 |
| 6 | Testing | 호출부가 실제로 `forbiddenWithService`를 거치는지 강제하는 자동 회귀 테스트 없음 — `forbidden-response-codes.spec.ts`는 코드 포함 여부만 검사, 이음 형식은 판정 대상 아님. 다음 사람이 새 라우트에서 다시 손으로 `, 또는`을 쓰면 어떤 테스트도 실패하지 않음. developer가 plan에서 이미 인지·수용(뮤턴트 M2 SURVIVED로 실측 기록) | `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts`, `plan/in-progress/forbidden-helper-sentences.md` "안 하는 것" | 조치 불요(이미 문서화된 트레이드오프). 재발 시 소스 텍스트 `, 또는` 리터럴을 잡는 가벼운 grep 기반 테스트 추가 옵션 |
| 7 | Side Effect | 신규 공개 함수 `forbiddenWithService` 추가 — 순수 함수, 기존 시그니처 변경 없음. 8개 라우트 파일의 module-level 상수 재정의도 순환참조·평가 순서 문제 없음. 미사용 import(`NOT_A_MEMBER`/`ROLE_REQUIRED` in `executions.controller.ts`) 제거는 정당(잔존 참조 0건 확인), `auth.controller.ts`의 `NOT_A_MEMBER` 잔존 import는 432행에서 실사용 중이라 정당 | `codebase/backend/src/common/swagger/forbidden-descriptions.ts:47`, `integrations.controller.ts:96-107`, `workspaces.controller.ts:68-71`, `workflow-test-datasets.controller.ts:40-43` | 없음 |
| 8 | API Contract | `reRun`/`getChain`의 서비스 문장 표기가 문자 그대로는 바뀌었으나(코드 나열 순서·구분자), 실려 있는 오류 코드 집합(`NOT_A_MEMBER`, `EDITOR_REQUIRED`, `RERUN_PERMISSION_DENIED`, `RR-PL-06`)은 정보 손실 없이 그대로 유지 | `codebase/backend/src/modules/executions/executions.controller.ts` `reRun()`, `getChain()` | 없음 |
| 9 | User Guide Sync | `backend-api-change`, `auth-session-flow-change` 두 doc-sync-matrix trigger가 glob 경로상 매칭되나, semantic 판단 결과 실질 API 노출·인증 흐름 변경이 아니어서(순수 403 설명 문자열 이음 통일) user-guide/e2e 동반 갱신 불필요 | `.claude/config/doc-sync-matrix.json` id=`backend-api-change`, `auth-session-flow-change` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인가 로직·입력 검증·시크릿·의존성 변경 없음, 문서 문자열만 교체 |
| requirement | NONE | §5-4 규칙과 line-level 일치, 부수적으로 테스트 훅 2곳의 실질 결함(`NOT_A_MEMBER` 코드 누락)도 함께 수정됨 |
| scope | NONE | 실측 표 13자리와 diff 정확히 일치, import 정리는 이번 변경이 직접 유발, reRun/getChain 확장은 plan이 사전 선언 |
| side_effect | NONE | 전역 상태/네트워크/파일시스템 영향 없음, 순수 함수 추가 |
| maintainability | LOW | 문자열 인자 순서 미강제(이론적), integrations 상수 중복(기존·defer됨) |
| testing | NONE | 관련 스펙 10개 PASS, 타입체크 클린. 호출부의 헬퍼 경유 여부는 회귀 가드 대상 밖(인지된 트레이드오프) |
| documentation | LOW | plan/complete 시점 이른 교차 참조(WARNING), 그 외 JSDoc/CHANGELOG/테스트 문서화 탄탄 |
| api_contract | NONE | HTTP 상태·바디·에러 코드·인증 로직 불변, 순수 설명 문자열 리팩터 |
| user_guide_sync | NONE | 매칭된 2개 trigger 모두 semantic 재검토 결과 갱신 불필요 |

## 발견 없는 에이전트

- security, requirement, scope, side_effect, testing, api_contract, user_guide_sync — CRITICAL/WARNING 없음 (INFO만 존재하거나 전무)

## 권장 조치사항

1. `plan/in-progress/integration-personal-owner-followup.md:46`의 `plan/complete/forbidden-helper-sentences.md` 참조를 병합 전 확인 — 실제로 해당 플랜이 `plan/complete/`로 이동했는지 확인 후, 안 됐다면 `plan/in-progress/` 경로로 정정하거나 "완료 시 이동" 단서를 붙인다.
2. (선택, 비차단) 향후 `spec/conventions/swagger.md` §5-4 편집 기회에 `forbiddenWithService`와 이음 구두점 규칙을 한 줄 명시.
3. (선택, 비차단) 호출부가 헬퍼를 계속 경유하는지 보장하는 경량 grep 기반 회귀 테스트 추가 검토 — 현재는 코드 리뷰에 의존.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보 확인됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단: 이번 diff(403 설명 문자열 이음 통일, 런타임 로직 무변경)와 무관 |
  | architecture | 라우터 판단: 신규 아키텍처 변경 없음, 기존 헬퍼 패턴 확장에 그침 |
  | dependency | 라우터 판단: 의존성 변경 없음 |
  | database | 라우터 판단: DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단: 동시성 관련 코드 변경 없음(순수 문자열 함수) |
