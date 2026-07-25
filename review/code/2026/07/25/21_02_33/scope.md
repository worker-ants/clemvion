# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `describe` 블록 사이 빈 줄 누락 (cafe24 버전과의 미러 불일치)
  - 위치: `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts:167` (신규 `describe('abortSignal cascade ...)` 블록의 닫는 `});`)와 바로 다음 줄 168 (`describe('credentials validation', ...)`
  - 상세: 동일 패턴을 적용한 `cafe24-api.client.spec.ts`에서는 새 `describe` 블록과 다음 `describe('credentials validation', ...)` 사이에 빈 줄이 유지되어 있는데(gate 129 빈 줄, gate 130 `describe('credentials validation'...)`), makeshop 쪽은 그 빈 줄이 없이 바로 붙어 있다. 실질 코드에는 영향 없는 순수 스타일 사소한 차이이며, 두 파일이 의도적으로 미러 구조를 유지하는 이 코드베이스 관례(cafe24/makeshop 대칭 구현)에 비춰보면 사소한 불일치다.
  - 제안: 필요하면 `});` 다음에 빈 줄 1개를 추가해 cafe24 버전과 형태를 맞춘다. 리뷰를 막을 사안은 아니다.

## 요약

이번 변경은 `spec/conventions/node-cancellation.md` §4(cascade)·§2.2(사전 체크)를 cafe24·makeshop 두 커머스 노드에 대칭 적용하는 작업으로, 이미 잔여 항목으로 추적되던 plan(`node-cancellation-residual-signal-propagation.md`)의 정확히 그 항목을 구현한다. 변경 내용은 (1) `Cafe24CallOptions`/`MakeshopCallOptions`에 `signal?: AbortSignal` 필드 추가, (2) 각 client 의 기존 per-call timeout `AbortController`에 upstream signal 을 cascade 하는 블록 추가(기존 `http-request.handler.ts` 패턴과 동일), (3) 각 handler 에서 `context.abortSignal` 을 client 호출에 실어 보내는 한 줄 추가, (4) client/handler 양쪽에 대칭 테스트(cascade 발화·미발화·사전-aborted·no-signal 4종 × 2 client, forwarding 2종 × 2 handler) 추가로 구성된다. 모든 diff 는 순수 추가(additive)이며 기존 로직을 재작성하거나 무관한 코드를 정리한 흔적이 없고, import·설정 파일 변경도 없다. 두 client/spec 파일 간의 코드 중복은 이 프로젝트에서 의도된 미러 구조(cafe24/makeshop 대칭 구현 관례)이므로 DRY 위반으로 지적할 사안이 아니다. plan 파일 두 건(`node-cancellation-residual-signal-propagation.md` 체크박스 갱신 + 진행 기록 추가, 그리고 신규 `spec-update-node-cancellation-shutdown-classification.md`)은 동일 작업의 진행 상태 기록 및 범위 밖(workflow-timeout 통합) 항목을 project-planner 로 넘기는 절차적 산출물로, 작업 범위와 직접 연결되어 있어 무관한 수정이 아니다. 발견된 유일한 사항은 사소한 서식(빈 줄 1개) 불일치뿐이다.

## 위험도

NONE
