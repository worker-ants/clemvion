STATUS=success naming_collision review complete (target=spec/5-system/, impl-prep, actual work=test-only / spec_impact:none)
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 조사 방법

1. 번들에 포함된 `spec/5-system/` 3개 전체 문서(`1-auth.md`, `2-api-convention.md`, `3-error-handling.md`) — 나머지 15개 파일은 컨텍스트 예산 초과로 헤더만 제공됨.
2. `plan/in-progress/masked-marker-test-gaps.md` (이 worktree 의 실제 작업 대상) 를 직접 읽어 **이 impl-prep 검토가 실제로 무엇을 구현하려는지** 확인.
3. 위 plan 이 참조하는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"마커 재제출 거부 PR 의 이월 항목" 확인.
4. 관련 식별자(`MASKED_VALUE_RESUBMITTED`, `findMaskedResubmissions`, `resolveTriggerParametersRejectingMasked`, `throwIfAny`)를 `codebase/`, `spec/` 전체에서 grep 하여 정의처 유일성·기존 사용 의미 확인.

## 핵심 판단 — 이번 target 은 "새 식별자 도입" 이 아니다

`plan/in-progress/masked-marker-test-gaps.md` 의 frontmatter 는 `spec_impact: none` 이고, 본문은
"트래커의 테스트 성격 항목 2건을 재판정 → ① phase 경계 회귀 테스트 추가, ② 유예 근거 교체(문서만),
③ 실측값 갱신(문서만)" 으로 명시한다. 즉 이번 작업은:

- 신규 요구사항 ID, 신규 엔티티/DTO, 신규 API endpoint, 신규 webhook/queue/SSE 이벤트명,
  신규 ENV var/config key, 신규 spec 파일을 **하나도 도입하지 않는다**.
- 유일한 산출물은 (a) 기존 함수 `throwIfAny`(`reject-masked-resubmission.ts`)의 phase 경계
  회귀 unit 테스트 추가, (b) `plan/` 트래커 문서 갱신뿐이다.

따라서 본 checker 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/config key·spec 파일 경로)에서
"target 문서가 새로 부여하는 식별자"는 **존재하지 않는다** — 리뷰 대상 자체가 이번 diff 범위 밖이라는 뜻은
아니고, 이번 변경이 이 6개 점검 관점이 다루는 종류의 식별자를 하나도 만들지 않는다는 뜻이다.

## 참고: 관련 기존 식별자의 충돌 여부 확인 (사전 검증)

이번 테스트가 고정하려는 동작이 참조하는 기존 식별자들을 grep 한 결과, 모두 **단일 정의처 +
일관된 의미**로 이미 spec·code 전역에 정착돼 있고 충돌 없음:

| 식별자 | 정의처 | 사용처(spec) | 비고 |
|---|---|---|---|
| `MASKED_VALUE_RESUBMITTED` | `codebase/backend/.../trigger-parameter.types.ts` | `spec/5-system/3-error-handling.md` §1.7, `13-replay-rerun.md`, `14-external-interaction-api.md`, `12-webhook.md`, `1-data-model.md`, `3-workflow-editor/3-execution.md`, `4-nodes/7-trigger/1-manual-trigger.md`, `conventions/error-codes.md` | 모두 동일 의미(마스킹 값 재제출 거부 필드 코드)로 일관. 다른 의미로 쓰인 곳 없음 |
| `findMaskedResubmissions` | `codebase/backend/.../reject-masked-resubmission.ts` (단일) | — | 함수 스코프, 다른 파일 재정의 없음 |
| `resolveTriggerParametersRejectingMasked` | `codebase/backend/.../reject-masked-resubmission.ts` (단일) | 소비처 3곳(controller/service) import 만, 재정의 없음 | — |
| `throwIfAny` | `codebase/backend/.../reject-masked-resubmission.ts` (단일) | — | 이번 PR 이 회귀 테스트를 붙이는 대상. 제네릭한 이름이지만 TS 모듈 스코프 내부 helper 라 export 충돌 없음(export 여부는 코드 열람 필요하나 동일 파일 유일 정의라 실질 충돌 없음) |

`spec/5-system/3-error-handling.md` §1.3 의 Note(라인 1445~1449, 1549~1553)가 오늘(2026-08-22) 자
기술 부채 기록과 정확히 일치한다 — `INVALID_TRIGGER_PARAMETERS` 로의 re-run 경로 통합, `MASKED_VALUE_RESUBMITTED`
필드 코드 도입 시점이 spec 문서 갱신 이력과 코드 실측이 서로 어긋나지 않음을 확인했다.

## 컨텍스트 누락 caveat

`spec/5-system/` 의 15개 파일(`4-execution-engine.md` 외)은 컨텍스트 예산 초과로 본문이 생략됐다.
이번 target 작업이 그 파일들에 새 식별자를 도입하지 않는다는 점은 plan 문서(`spec_impact: none`)로
교차 확인했으므로 생략이 판정에 영향을 주지 않는다고 판단한다.

## 발견사항

없음 — 이번 target 이 spec/5-system/ 영역에 새로 도입하는 요구사항 ID·엔티티/타입명·API endpoint·
이벤트명·ENV/config key·spec 파일 경로가 없다.

## 요약

이번 impl-prep 검토의 실제 target(`plan/in-progress/masked-marker-test-gaps.md`)은 `spec_impact: none`
으로 명시된 순수 테스트 추가 작업이며, `findMaskedResubmissions`/`throwIfAny` 등 참조하는 식별자는
모두 기존에 단일 정의처로 이미 정착돼 있어 신규 식별자 충돌 소지가 없다. spec/5-system/ 번들에
포함된 기존 스펙(1-auth.md·2-api-convention.md·3-error-handling.md)도 오늘 날짜(2026-08-22)로 갱신된
`MASKED_VALUE_RESUBMITTED`/`INVALID_TRIGGER_PARAMETERS` 관련 서술이 코드·다른 spec 문서와 모두
일관돼 충돌 징후가 없다.

## 위험도

NONE
