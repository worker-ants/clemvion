# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위에 대한 메모

이번 changeset(`origin/main`..HEAD, 91개 파일)의 대다수는 `review/code/**`·`review/consistency/**`
하위의 과거 라운드(23_08_19 / 23_50_03 / 00_23_57 / 00_22_23) 산출물이거나 `plan/**` 추적 문서로,
실제 프로덕션 코드가 아니다. 실질 코드 변경은 아래 13개 파일에 집중돼 있고, 그중
`executions.service.ts` / `websocket.service.ts` / `sanitize-error-message.ts` 는 이미 3차례의
`/ai-review` 라운드(각 라운드 maintainability 포함)를 거치며 CRITICAL·WARNING 이 전부 해소된
상태다. 이번 라운드의 실질 코드 델타(마지막 커밋 `81c9fcd60`)는 `executions.service.spec.ts` 의
JSDoc 문구 정정 하나뿐이고(개수 서술 오류를 스스로 잡은 자기수정), 그 외에는 spec 문서뿐이다.
따라서 아래는 누적 diff 전체를 독립적으로 재검토한 결과이며, 이미 이전 라운드에서 다뤄지고
"조치 불요"로 처분된 항목은 중복 지적을 피하기 위해 참고로만 남긴다.

## 발견사항

- **[INFO]** (기존 라운드에서 이미 확인·"조치 불요"로 처분됨, 변경 없이 그대로 존재) JSDoc 블록이
  실제 심볼과 분리돼 있다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95`~`122`
    (95~116: 마커-계층 대응표를 담은 상세 설명 블록, 바로 다음 117/119/121 줄에 각각
    한 줄짜리 개별 JSDoc 이 끼어들고 118/120/122 에 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
    `DEPTH_MASK_MARKER` 선언이 옴)
  - 상세: TSDoc/IDE hover 등 대부분의 문서화 툴링은 심볼 바로 위의 **마지막** 주석 블록만
    그 심볼에 연결하므로, 95~116 의 풍부한 컨텍스트(웹훅 ingestion·WS 키-마스킹·깊이 상한이
    각각 남기는 마커와 그 계약 설명)는 세 상수 중 어디에도 공식적으로 연결되지 않는다.
    `review/code/2026/08/17/00_23_57/maintainability.md` 가 이미 같은 항목을 지적했고, 해당
    RESOLUTION 이 "typedoc 미도입이라 무해"로 조치 불요 처분했다 — 이번 라운드에서 코드가
    바뀌지 않아 상태도 그대로다.
  - 제안: 추가 조치 불요(기존 처분 유지). 향후 typedoc 류를 도입하게 되면 그때 큰 설명 블록을
    `MASKED_MARKERS` 선언 또는 `isMaskedMarker` 함수 위로 옮기는 것을 고려.

- **[INFO]** (기존 라운드에서 이미 확인·의도로 처분됨) 런타임 미참조 상수를 `void` 로 앵커링하는
  비관용적 패턴.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:83`(`MASKED_INPUT_DATA_REASON`
    선언), `:87`(`void MASKED_INPUT_DATA_REASON;`)
  - 상세: 여러 파일에서 `{@link MASKED_INPUT_DATA_REASON}`으로만 인용되는 "문서 앵커"용 상수라
    unused-var 경고를 피하려 `void` 로 살려뒀다. 이 저장소에 흔치 않은 패턴이라 향후 편집자가
    죽은 코드로 오인해 삭제할 위험이 바로 위 주석(`// 이 상수는 JSDoc 앵커 전용이다 — 런타임
    참조가 없어도 제거하지 않는다.`)으로 완화돼 있다. 이번 라운드에서도 코드 변경 없음.
  - 제안: 추가 조치 불요(기존 처분 유지).

## 확인했으나 문제 없음 (양호한 지점)

- **자매 표면 누락 방지 구조**: `toResponseExecution`(`executions.service.ts`)이 읽기 표면
  전체(6곳)를 표 하나로 정본화하고 다른 호출부·주석은 `{@link}` 로만 참조하도록 리팩터해,
  이 저장소가 반복 겪은 "수치가 소스 여러 곳에 흩어져 갈린다" 결함 클래스를 구조적으로
  차단했다.
- **중복 억제 헬퍼**: `maskIfPresent`(3회 반복되던 삼항 마스킹 로직 축약), `deepRedactCore`(두
  공개 진입점 `deepRedactSecrets`/`deepRedactSecretsPreserving` 이 마스킹 규칙을 공유),
  `toFanoutEnvelope`(`emitExecutionEvent`/`emitNodeEvent` 공용 조립) 모두 실제 반복 로직을
  적절한 단위로 추출했고, 각 함수의 존재 이유·비제네릭 선택 이유(`maskIfPresent` 의 `<T>` 미사용
  근거)까지 문서화돼 있어 다음 편집자가 같은 실수를 반복하지 않도록 설계됐다.
- **네이밍**: `maskIfPresent`/`toFanoutEnvelope`/`isMaskedMarker`/`redactStoredDataForResponse`/
  `WIRE_PRESERVED_FIELDS` 등 새 식별자가 목적을 명확히 드러내고, 기존 `redactStoredErrorForResponse`
  네이밍 컨벤션과 일관된다.
- **마커 상수 공유**: `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 를 export 상수로
  승격해 `sanitize-error-message.ts` 와 `websocket.service.ts` 가 리터럴이 아니라 같은 상수를
  참조하게 했다 — 한쪽만 바뀌어 재마스킹 방지가 조용히 깨지는 경로를 없앴다(과거 라운드
  WARNING 을 실제로 해소한 흔적).
- **함수 길이·중첩**: 이번 diff 로 신설된 함수(`maskIfPresent`, `redactStoredDataForResponse`,
  `deepRedactCore`, `maskWireEnvelope`, `toFanoutEnvelope`) 는 모두 10줄 내외이고 중첩 깊이도
  2단을 넘지 않는다. 조건 분기(`opts.preserveKeys?.has(k)` 등)도 평탄하다.
- **매직 넘버 없음**: 새로 추가된 마스킹 마커 문자열이 전부 named export 상수로 나가고,
  DTO Swagger 설명 등 나머지는 리터럴이 아니라 서술문이다.
- **테스트 중복은 의도된 방어**: `redact-stored-error.spec.ts`/`sanitize-error-message.spec.ts`
  등에서 자매 함수별로 거의 동형인 describe 블록을 반복하는 것은, 이 저장소가 과거 "자매 중
  하나만 검증돼 다른 쪽이 조용히 깨지는" 결함을 반복해 겪은 데 대한 명시적 대응(RESOLUTION.md
  에도 "강제 통합 지양"으로 기록)이라 중복이 아니라 방어로 판단, 별도 지적하지 않는다.

## 요약

실질 코드 변경분(`executions.service.ts`·`websocket.service.ts`·`sanitize-error-message.ts`·
`redact-stored-error.ts`·`background-runs.service.ts`·관련 DTO/spec 파일)은 이미 3차례의 리뷰
라운드를 거치며 유지보수성 관점 CRITICAL·WARNING 이 모두 해소된 상태이고, 이번 라운드의 실질
델타는 테스트 JSDoc 문구 정정 1건과 spec 문서뿐이다. 공통 관문(`toResponseExecution`,
`maskWireEnvelope`/`toFanoutEnvelope`, `maskIfPresent`, `deepRedactCore`)으로의 수렴, 마커 상수
공유, 표 하나로의 수치 단일화 등 이 프로젝트가 반복 겪은 "자매 표면 하나만 누락" 결함 클래스를
구조적으로 차단하려는 설계 의도가 코드·주석 양쪽에 일관되게 드러난다. 남은 항목은 이미 이전
라운드에서 검토·처분된 INFO 2건(툴링 미도입 상태에서 무해한 JSDoc 배치, 의도적 `void` 앵커
패턴)뿐이며 추가 조치가 필요한 새로운 결함은 발견하지 못했다.

## 위험도

LOW
