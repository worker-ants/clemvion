# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `sanitize-error-message.ts` 신설 `MASKED_MARKERS`(및 그 사용처 `isMaskedMarker`)를 설명하는 긴 JSDoc 블록이 실제로는 **그 상수에 붙지 않고 고아(orphan) 상태**다 — 왜 마커를 보존해야 하는지 설명하는 문서가 정작 가장 필요한 심볼에서 안 보인다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 함수/블록명: `MASKED_MARKERS` 선언부 직전의 대형 JSDoc(`앞선 마스킹 층이 이미 남긴 마커들...`, `## 왜 필요한가 — 마커를 덮으면 계약이 깨진다` 섹션, 앞선 층 3종 표, 12-webhook §5.3 인용 포함)
  - 상세: JSDoc/TSDoc 관례상 주석은 **바로 다음에 오는 선언**에만 귀속된다. 소스를 실제로 열어 확인한 결과, 순서가 다음과 같다 — (1) 위 대형 JSDoc 블록 → (2) 한 줄짜리 별도 주석 `/** 값-패턴 마스커가 남기는 마커. */` → (3) `export const VALUE_MASK_MARKER = '***';` → (4) 한 줄 주석 + `KEY_MASK_MARKER` → (5) 한 줄 주석 + `DEPTH_MASK_MARKER` → (6) 빈 줄 → (7) **주석 없이** `const MASKED_MARKERS: ReadonlySet<string> = new Set([...])`. 즉 대형 블록과 `VALUE_MASK_MARKER` 선언 사이에 별개의 주석이 끼어 있어 TypeDoc 등 표준 파서는 이 블록을 어느 심볼에도 귀속시키지 못하고(가장 가까운 다음 요소가 선언이 아니라 또 다른 주석이므로), 정작 이 문서가 설명하는 대상인 `MASKED_MARKERS` 상수(`isMaskedMarker`의 조회 대상, 마스킹 재적용 방지의 핵심 불변식)는 어떤 독스트링도 없이 노출돼 있다. 결과적으로 IDE 호버·자동 생성 API 문서 어느 경로로도 "왜 이 세 마커를 재마스킹하지 않는가"라는 핵심 근거(12-webhook §5.3 계약·문서 4곳이 전제 공유 등)에 도달할 수 없고, `VALUE_MASK_MARKER`를 호버하면 짧은 한 줄(`값-패턴 마스커가 남기는 마커.`)만 보인다.
  - 제안: 대형 블록을 `MASKED_MARKERS` 선언 바로 위로 옮기거나(권장 — 실제 로직 근거가 그 상수에 있음), 최소한 `VALUE_MASK_MARKER` 앞의 개별 한 줄 주석들을 제거하고 대형 블록이 세 상수 전체를 아우르는 하나의 JSDoc으로 붙게 재배치한다.

- **[INFO]** CHANGELOG 신규 항목(`## Unreleased — 자유 텍스트 안의 자격증명이 WS emit 과 내부 REST 두 컬럼으로 나가고 있었다`)이 서술하는 성능·표면 수·wire 변화 캐비엇은 실제 diff(`websocket.service.ts`의 `maskWireEnvelope`/`toFanoutEnvelope` JSDoc, `executions.service.ts`의 `toResponseExecution` 표, `spec/5-system/14-external-interaction-api.md`/`6-websocket-protocol.md`의 대응 서술)와 대조해 수치·표면 목록·예외(`llmCalls`)가 모두 정합했다. 별도 조치 불요.

- **[INFO]** `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`의 `outputData`/`inputData` JSDoc과 `background-run-response.dto.ts`의 Swagger `description`, 그리고 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`/`.en.mdx`의 사용자 가이드가 셋 다 "`outputData`만 마스킹, `inputData`는 재제출 경로 보호를 위해 의도적으로 비대상"이라는 동일한 정책을 일관되게 반영하고 있다(Input 행은 건드리지 않고 Output 행에만 캐비엇 추가). KO/EN 두 mdx도 문구가 대칭이다. 문서-코드 정합성 양호.

- **[INFO]** `executions.service.ts`의 `toResponseExecution` JSDoc에 "읽기 표면 여섯 곳" 표를 단일 정본으로 두고 `background-runs.service.ts`·`redact-stored-error.ts`·CHANGELOG·spec(EIA §R17)이 모두 그 표를 `{@link}`/링크로 참조하는 구조(§D 단일화)가 실제로 지켜지고 있다. 표면 수를 여러 곳에 하드코딩해 두었다가 표면이 늘 때마다 어긋나던(과거 "자매 넷 중 하나만") 패턴을 이번 변경이 실제로 제거했다.

## 요약

이번 changeset은 egress 마스킹 관문을 `inputData`/`outputData`/WS emit까지 확장하면서 JSDoc·Swagger description·spec(§R17, WS §4.1, 12-webhook §5.3)·CHANGELOG·사용자 가이드(run-results.mdx)를 이례적으로 촘촘하게 동반 갱신했다. 결정의 배경(왜 `inputData`는 마스킹 대상이 아닌지, 왜 마커를 재마스킹하지 않는지, wire까지 마스킹을 확장한 근거)이 코드 인접 주석에 직접 남아 있고 정본(SoT) 링크가 대부분 정확하다. 유일한 실질적 결함은 `sanitize-error-message.ts`의 `MASKED_MARKERS` 상수를 설명하려던 대형 JSDoc 블록이 중간에 낀 별도 한 줄 주석 때문에 실제로는 그 상수에 귀속되지 않는 고아 주석이 된 것으로, 툴링(IDE 호버/TypeDoc) 관점에서 문서 발견 가능성을 떨어뜨린다. README·CHANGELOG·API 문서(Swagger)·설정 문서 갱신 필요성은 이번 diff 범위에서 추가로 발견되지 않았다.

## 위험도
LOW
