# Requirement Review — 17_35_49

## 발견사항

- **[INFO]** `.claude/docs/plan-lifecycle.md` 의 "실측(2026-08-16): spec 레벨 17건 · plan 레벨
  3건" 이 같은 PR 체인 안에서 곧바로 stale 이 된다.
  - 위치: `.claude/docs/plan-lifecycle.md:88`
  - 상세: 이 문장은 커밋 `fafb57e46`(plan-lifecycle.md 편집) 시점 기준으로는 정확했다(그 시점
    실제 plan-level `pending_plans:` frontmatter 보유 파일은
    `spec-draft-eia-error-masking-catalog.md` · `spec-draft-ws-types-canonical-location.md` ·
    `spec-draft-eia-notification-payload-contract.md` 3건 — `spec-draft-web-chat-console.md` 는
    본문 예시 텍스트일 뿐 frontmatter 가 아니라 grep 오탐이었음, 직접 확인함). 그런데 같은 PR
    체인의 다음 커밋(`4f27fe5ba`)이 새 plan `plan/in-progress/eia-internal-rest-error-masking.md`
    를 만들면서 그 frontmatter 에 `pending_plans:` 를 선언해, PR 종료 시점 기준 실제 값은
    4건이다. "PR 안의 정량 기록은 PR 이 닫히는 시점의 값이어야 한다" 는 이 저장소의 반복 교훈과
    같은 형태의 staleness 다. 기능 결함은 아니고 문서 카운트 정밀도 문제.
  - 제안: 코드 수정 불요. 다음에 이 문서를 만지는 턴에 "3건" 을 "4건"(또는 실측 시점 수)으로
    갱신하거나, 정확한 시점 스냅샷임을 명시하는 캡션을 추가.

## 점검한 항목과 결과 (문제 없음 확인)

아래는 diff 전반에 걸쳐 "요구사항 충족" 관점에서 명시적으로 검증했고 결함을 찾지 못한 항목들이다.

1. **기능 완전성 / spec fidelity**: `redactStoredErrorForResponse` 가 `ExecutionsService` 의
   독립 반환 경로 4곳(`findById` · `toExecutionDto` · `getChain` · `stop`)과
   `BackgroundRunsService.toBodyNodeExecutionDto` 에 실제로 적용돼 있음을 코드로 직접 확인.
   `spec/5-system/14-external-interaction-api.md` §R17 새 불릿의 서술("독립 표면 4곳", "형태는
   바꾸지 않는다", "DB 는 원문 보존")과 `codebase/backend/src/modules/executions/executions.service.ts`
   구현이 line-level 로 일치한다.
2. **형제 필드 우회 방지**: `spec/1-data-model.md:561` 이 `Execution.error` 를 "최초 failed
   NodeExecution 의 에러 정보를 복사" 로 정의하는 것을 확인했고, `findById` 의
   `reconciledNodeExecutions` 맵이 `nodeExecutions[].error` 도 동일 마스킹을 거는 것을 확인 —
   spec §R17 새 불릿의 "nodeExecutions[].error 도 함께 마스킹" 서술과 일치.
3. **에러 시나리오 / 반환값**: `redactStoredErrorForResponse(null|undefined)` → `null` 정규화,
   `toResponseExecution` 반환 타입이 `error: Record<string,unknown> | null` 로 명시돼 이전의
   `as Execution` 무단 캐스트가 숨기던 null 가능성을 드러냄(테스트 `redact-stored-error.spec.ts`
   로 고정). 모든 반환 경로(`findById` 캐시 hit/miss, `stop` 의 4개 반환 지점 등)가 관문을 통과.
4. **데이터 유효성 / 경계값**: `ne.error == null ? ne : {...}` 형태의 copy-on-change 로 대다수
   정상 종료 행은 원본 참조를 유지하고, 값이 있는 행만 얕은 복사 — 자매 함수
   `reconcilePreParkWaitingStatus` 관례와 일치. 레거시 문자열/숫자 형태의 `error` 값(jsonb 이므로
   가능)도 캐너리 테스트로 고정돼 있음.
5. **egress-only 불변식**: `redact-stored-error.spec.ts` 의 "입력 객체를 변이하지 않는다" 테스트와
   `executions.service.spec.ts` 의 "DB 원문은 건드리지 않는다" 테스트가 `deepRedactSecrets` 의
   copy-on-change 를 근거로 실제로 원본 미변이를 검증. §R17 의 "DB 는 원문 보존" egress-only
   원칙과 일치.
6. **비즈니스 로직 / 권한 게이트 근거**: `GET /api/executions/:id`(`executions.controller.ts:63`),
   `GET /executions/:id/background-runs/:id`(`background-runs.controller.ts:24`) 모두 실제로
   `@Roles` 데코레이터가 없음을 코드로 확인 — CHANGELOG·plan·spec 이 공통으로 주장하는 "viewer
   포함 워크스페이스 멤버 전원 노출" 전제가 사실과 일치.
7. **소비자 영향 범위**: `stop()` 반환값을 버리는 두 내부 호출자(`interaction.service.ts:226,248`,
   `hooks.service.ts:407`)를 grep 으로 확인 — JSDoc 의 "영향은 HTTP 응답 표면 하나뿐" 주장과
   일치.
8. **잔여 갭 처리(#7 replan)**: `explore-tools.service.ts:464,484` 가 `maskSensitiveFields`
   (키 이름 기반)만 걸어 `error.message` 안 자격증명 값-패턴을 통과시키는 것을 실측 확인.
   RESOLUTION 이 "처방을 실측이 반증해 되돌리고 트래커에 등재"로 처리한 것은 코드 변경 없이
   spec 서술을 총칭→열거로 좁힌 것과 일관되며, 회색지대를 감추지 않고 명시했다.
9. **테스트 실행/타입체크**: 대상 3개 spec 파일 (`redact-stored-error.spec.ts`,
   `executions.service.spec.ts`, `background-runs.service.spec.ts`) 을 직접
   `npx jest` 로 실행해 66/66 PASS 확인. `tsc --noEmit` 도 대상 파일에 대해 오류 0 확인 — 문서상
   주장(RESOLUTION 의 "29 suites/535 tests", "tsc 오류 0")이 재현 가능함.
10. **TODO/FIXME**: 신규·수정 파일에 미완성을 시사하는 TODO/FIXME/HACK/XXX 주석 없음.

## 요약

이번 diff 는 `Execution.error`/`nodeExecutions[].error` 응답 egress 마스킹을 읽기 경로 전면에
확장하는 보안 수정과, 그에 따른 문서(CHANGELOG·spec 5곳·plan 다수)·리뷰 산출물 동기화로
구성된다. 핵심 코드(`redact-stored-error.ts`, `executions.service.ts`,
`background-runs.service.ts`)는 spec §R17/§2.14/§R-5 캐비엇과 line-level 로 일치하고, 주장된
표면 전수·권한 게이트 부재·소비자 영향 범위를 모두 코드로 직접 재확인했으며 결함을 찾지
못했다. 테스트는 실행해 통과를 확인했고 타입체크도 클린하다. 유일하게 지적할 점은 새로
작성된 `plan-lifecycle.md` 의 "plan 레벨 pending_plans 3건" 이라는 실측 문구가 같은 PR 체인의
다음 커밋이 4번째 사례를 만들며 곧바로 stale 해진다는 문서 정밀도 문제로, 기능적 영향은 없다
(INFO).

## 위험도

NONE
