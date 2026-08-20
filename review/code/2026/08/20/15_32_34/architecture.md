STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 닫고, 재제출 소비처 3곳(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드)에 마커 가드를 신설한다. 이미 같은 diff 에 대해 세 라운드(`14_08_45`, `14_44_08`, `15_10_25`)의 코드 리뷰가 CRITICAL 2건을 잡아 조치했고, 직전 라운드(`15_10_25`)는 CRITICAL 0 으로 수렴했다. 이번 라운드는 아키텍처 관점(SOLID/결합도/레이어/패턴/순환의존/추상화/모듈경계/확장성)으로 같은 최종 상태를 재검토했다.

## 발견사항

- **[INFO]** 마스킹 관문이 backend 에 4곳 이상 분산돼 있고, 이번 PR 로 그 수가 늘었다 (이미 트래커 등재된 기존 부채)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 의 `toResponseExecution`(1068행 부근)·`toExecutionDto`(977행 부근)·`findById` 의 `nodeExecutions[]` map(`maskIfPresent` 루프, 690행대) 3곳 + `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` 의 별도 관문(300행대)
  - 상세: `redactStoredDataForResponse`/`redactStoredErrorForResponse` 호출이 서비스 클래스 두 곳에 걸쳐 4개 이상의 지점에서 각자 걸린다 — DIP 관점에서 "마스킹 정책"이라는 하나의 횡단 관심사가 단일 지점(interceptor·공유 헬퍼)으로 역전되지 않고 각 호출부가 직접 의존한다. `toResponseExecution` JSDoc 이 이 fragmentation 을 인지해 "읽기 표면 목록" 표를 SoT 로 못박아 두었고(1037행 부근), `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합" 항목(2026-08-20 등재)으로 이미 트래커에 올라 있다 — 직전 라운드 리뷰(`14_08_45` C2)가 실제로 이 fragmentation 때문에 자매 DTO JSDoc 갱신이 빠지는 CRITICAL 을 낸 전례가 있어, 근본 원인(호출부 분산)은 남아 있다는 지적이 정확하다.
  - 제안: 이번 PR 의 스코프는 아니다(트래커 항목으로 이미 defer 됨). 후속 리팩터에서 `redactExecutionFields(row)` 공유 헬퍼 또는 응답 직전 interceptor 로 통합해, 신규 표면 추가 시 "표에 한 줄 추가"가 아니라 "자동으로 걸리는" 구조로 전환할 것을 재확인.

- **[INFO]** frontend `MASKED_MARKERS` 가 backend `sanitize-error-message.ts` 상수를 손으로 복제한 cross-runtime 미러이고, 동기화 보장은 리터럴 스냅샷 테스트뿐이다 (이미 트래커 등재된 기존 부채)
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:18-22` (`MASKED_MARKERS` 정의) ↔ `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`
  - 상세: frontend(CSR Next.js)는 backend NestJS 모듈을 직접 import 할 수 없어(빌드/번들 분리) 값을 문자열 리터럴로 재선언한다 — 두 런타임 경계를 넘는 결합이 "타입/빌드 시스템이 강제하는 계약"이 아니라 "사람이 같은 3개 문자열을 양쪽에 정확히 옮겨 적었는가"에 의존한다. 이번 PR 이 추가한 `masked-markers.test.ts` 는 `[...MASKED_MARKERS]` 가 하드코딩된 배열과 같은지만 단언해(파일 24 diff 13-19행) backend 측 실제 값과는 대조하지 않으므로, backend 상수가 바뀌어도 이 테스트는 여전히 그린이다 — 즉 이 테스트는 프런트 내부 회귀만 잡고 cross-runtime drift 는 잡지 못한다. 어긋나면 프리필 가드가 새 마커 형태에 대해 조용히 fail-open 한다(마스킹된 값이 프리필돼 재제출됨) — 이 시리즈가 반복 겪은 정확히 그 실패 형태다.
  - 참고: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "마커 미러 계약 테스트 — backend SoT ↔ frontend 미러를 기계가 대조하게 한다" 항목(2026-08-17 등재, 이 시리즈에서 반복 지적)이 이미 있고, 이번 PR 은 그 항목 자체를 닫지 않았지만 이름을 양쪽 동일하게(`MASKED_MARKERS`/`isMaskedMarker`) 맞춰 최소한 grep 동기화는 가능하게 해 두었다. 새 결함이 아니라 기존에 인지·등재된 아키텍처 부채의 재확인이다.
  - 제안: 조치 불요(트래커 추적 중). 후속에서 backend 값을 빌드타임에 JSON 으로 export 하거나, e2e 레벨에서 실제 마스킹된 응답 문자열을 프런트 상수와 대조하는 계약 테스트를 추가하는 편이 근본적이다.

## 긍정적으로 확인한 아키텍처 개선

- `codebase/frontend/src/lib/utils/masked-markers.ts` 신설은 실제 의존 방향 결함을 고친다: 종전엔 `MASKED_MARKERS`/`isMaskedMarker` 가 `dynamic-form-ui.tsx`(폼 렌더 컴포넌트) 안에 있어, 무관한 `rerun-modal.tsx`·`editor-toolbar.tsx` 가 순수 상수를 얻으려고 폼 UI 컴포넌트 전체를 import 해야 하는 잘못된 결합이 있었다. 이번 승격으로 세 소비처가 `lib/utils/` 라는 공용 도메인 유틸 레이어에서 대칭적으로 의존하는 구조로 바뀌었다 — 순환 의존 가능성도 제거됐고(컴포넌트 → lib/utils 단방향), 레이어 책임도 명확해졌다(마스킹 판별=도메인 유틸, 프리필/차단 UX=각 컴포넌트).
- `hasMaskedMarkerLeaf` 의 재귀 순회는 backend 의 깊이-캡(`DEPTH_MASK_MARKER`) 마스킹을 거친 이미 depth-bounded JSON 만 입력으로 받으므로(egress 마스킹이 항상 선행), 순환 참조·과深도 우려 없이 안전하게 동작한다 — 두 레이어(backend depth cap, frontend leaf scan)가 서로의 불변식에 기대는 설계이지만 그 의존 방향이 문서화돼 있어(JSDoc "순환 참조는 JSON.parse 산물에 존재할 수 없다") 암묵적 결합이 아니다.
- Re-run 모달(필드 단위 비우기+차단)과 에디터 히스토리 로드(JSON 전체 표시+차단)가 서로 다른 차단 UX 를 쓰는 것은 중복 로직이 아니라 표면의 granularity 차이(필드 개별 편집 가능 vs JSON 텍스트 통짜 편집)에 따른 의도된 분기이며, 두 표면 모두 공통 primitive(`isMaskedMarker`/`hasMaskedMarkerLeaf`)만 재사용하고 판정 정책은 각자 소유한다 — 적절한 추상화 경계다.
- spec 변경(`spec/1-data-model.md`, `spec/5-system/6-websocket-protocol.md` 등)이 "레벨이 가른다"는 기존의 특수 규칙(Execution 레벨만 카브아웃)을 폐기하고 Execution/NodeExecution 두 레벨을 단일 규칙으로 통합한 것도 아키텍처적으로 바람직한 단순화다 — 향후 새 레벨/표면이 추가돼도 예외 규칙을 다시 만들 필요가 없다.

## 요약

이번 changeset 의 핵심 아키텍처 변경은 프런트엔드 마스킹-판별 유틸을 잘못된 소비 방향(모달/툴바가 무관한 폼 컴포넌트를 import)에서 올바른 공용 레이어(`lib/utils/masked-markers.ts`)로 승격한 것이며, 이는 결합도·레이어 책임·모듈 경계 세 축 모두에서 개선이다. SOLID·순환의존·디자인 패턴 관점에서 새로 도입된 결함은 찾지 못했다. 남은 두 가지는 이번 PR 이 만든 것이 아니라 이미 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 등재돼 추적 중인 기존 아키텍처 부채의 재확인이다 — (1) backend 마스킹 관문이 4곳 이상으로 분산돼 SRP/DIP 상 단일 지점이 아니고, (2) frontend `MASKED_MARKERS` 미러가 backend SoT 와 기계적으로 대조되지 않는다. 둘 다 사람이 읽는 SoT 주석/명명 규약으로 완화돼 있고 이번 PR 을 막을 사안은 아니다.

## 위험도

LOW
