# 변경 범위(Scope) 리뷰

## 검토 대상 요약

커밋 `d60fc16d8 test(06-concurrency): admission gate 회귀 보강 (§8 PR2b)` — `git diff origin/main...HEAD --stat` 기준 10개 파일, 전부 신규 파일 또는 테스트 파일 diff:

1. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit 추가, +124)
2. `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (e2e 헬퍼 파라미터화 + 신규 e2e 1건, +81/-13)
3~10. `review/consistency/2026/07/04/20_09_53/**` (consistency-check 산출물 8개, 전부 신규)

커밋 메시지가 명시하는 의도: "production 코드 무변경, 회귀 방지 테스트만" — (a) admission deferred/cancelled/admitted 3-way 분기 unit 3건, (b) 원자 UPDATE 파라미터 순서·cap 매핑 unit 1건, (c) e2e 헬퍼 workspace 파라미터화 + workspace-cap 단독 gating e2e 1건. 실제 diff 는 이 설명과 정확히 일치한다 — production 코드(`.service.ts` 본체) 변경 0건.

## 발견사항

- **[INFO]** e2e 헬퍼 시그니처 확장이 하위호환 기본값으로 처리됨
  - 위치: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` — `createCapWorkflow`, `execute`, `getStatus`, `poll`
  - 상세: `createCapWorkflow(wsId = workspaceId, workflowCap = 1)`, `execute(workflowId, wsId = workspaceId)`, `getStatus(executionId, wsId = workspaceId)`, `poll(executionId, predicate, timeoutMs, wsId = workspaceId)` 로 파라미터가 추가됐다. 기존 3개 테스트(`cap 초과 → pending`, `cap 초과 지속 → cancelled`)는 인자 없이 호출 중이므로 회귀 없이 그대로 통과하며, 신규 workspace-cap 단독 gating 테스트만 새 파라미터를 사용한다. 헬퍼 확장이 "요청된 변경(workspace-level cap e2e 추가)"을 지원하기 위한 최소 범위이고, 기존 동작을 보존하는 방식(선택적 파라미터 + 뒤쪽 배치)이라 의도 이상의 변경으로 보기 어렵다.
  - 제안: 없음 — 현재 형태 적정.

- **[INFO]** `review/consistency/2026/07/04/20_09_53/**` 8개 신규 파일은 developer SKILL 이 의무화한 impl-prep 산출물
  - 위치: `review/consistency/2026/07/04/20_09_53/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: CLAUDE.md 규약상 developer 는 구현 착수 직전 `consistency-check --impl-prep` 을 의무 수행하고 그 산출물은 `review/consistency/**` 에 저장된다(정보 저장 위치 표 참조). 이번 커밋에 포함된 8개 파일은 test-only 변경 자체와 직접 관련된 코드는 아니지만, 워크플로가 요구하는 필수 부산물이며 "무관한 파일 수정"이 아니다. 커밋 메시지도 "impl-prep consistency BLOCK:NO(4/5 …)" 를 명시적으로 언급해 동일 작업 단위로 취급하고 있다.
  - 제안: 없음.

- **[WARNING]** convention_compliance checker 가 BLOCK:YES 를 냈으나 SUMMARY 에서 오탐으로 판정·override 됨 — 근거 문서화는 되어 있으나 override 자체가 이번 diff 범위 밖 이슈를 노출
  - 위치: `review/consistency/2026/07/04/20_09_53/SUMMARY.md` "convention_compliance BLOCK 판정 근거 (오탐)" 절, `convention_compliance.md` 발견사항 [CRITICAL]
  - 상세: `convention_compliance.md` 자체가 인정하듯, 해당 checker 에게 전달된 target 페이로드가 `spec/5-system/1-auth.md`·`10-graph-rag.md` 등 이번 작업(§8 admission gate)과 무관한 문서 번들이었다(오케스트레이터 target-collection 단계 문제로 자기 진단). SUMMARY 는 이를 "sibling checker(cross_spec·rationale_continuity)는 실제 §8 spec+코드로 fallback 해 정상 판정했다"는 근거로 오탐 처리했다. 이 자체는 스코프 리뷰 관점에서 이번 diff(test-only 코드 변경)의 문제는 아니며, 사용자 메모에도 "consistency-check payload mis-scope 는 반복 오탐" 으로 기록된 기지 이슈다. 다만 이 오탐 판정의 근거가 "다른 checker 가 fallback 했다"는 정황 추론이라, 재발 방지를 위한 오케스트레이터 target-collection 수정 자체는 이번 커밋 범위 밖에 남아있다는 점만 기록해둔다(이번 test-only diff 를 막을 사유는 아님).
  - 제안: 이번 커밋에 대한 조치 불필요. 별도로 consistency-check 오케스트레이터의 target 재수집 로직 개선을 백로그에 남길 것을 권고(스코프 외 후속 과제).

- 그 외 항목(의도 이상의 변경/불필요한 리팩토링/기능 확장/무관한 수정/포맷팅/주석/임포트/설정 변경) 관련 이슈 없음:
  - `execution-engine.service.spec.ts`: 추가된 4개 `it` 블록 모두 커밋 메시지가 명시한 "admission deferred/cancelled/admitted 3-way" + "원자 UPDATE 파라미터 순서·cap 매핑" 검증에 정확히 대응. 기존 테스트 삭제·수정 없음, import 변경 없음, production 코드 변경 없음.
  - `execution-concurrency-cap.e2e-spec.ts`: 신규 e2e 1건 + 헬퍼 파라미터화 외 다른 로직 변경 없음. 포맷팅성 diff나 주석 정리 diff는 실질 변경(파라미터 추가)에 수반되는 최소 폭만 존재.
  - 설정 파일(docker-compose, tsconfig, package.json 등) 변경 없음.

## 요약

이번 changeset 은 커밋 메시지가 선언한 대로 production 코드 변경 없이 테스트 커버리지만 추가한 test-only 변경이며, 실제 diff(unit 4건 추가, e2e 헬퍼 파라미터화 + e2e 1건 추가, consistency-check 의무 산출물 8건)가 그 선언과 정확히 일치한다. e2e 헬퍼 파라미터 확장은 하위호환 기본값을 사용해 기존 테스트를 깨지 않는 최소 범위이고, consistency 산출물은 프로젝트 규약이 의무화한 워크플로 부산물이라 무관한 파일 수정으로 볼 수 없다. convention_compliance checker 의 payload mis-scope 로 인한 BLOCK:YES → 오탐 override 는 기존에 반복적으로 관측된 별도 이슈이며 이번 diff 자체의 스코프 위반은 아니다.

## 위험도

NONE

STATUS: SUCCESS
