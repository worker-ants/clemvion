# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 이번 changeset 의 선언된 범위(WS fanout 값-패턴 마스킹 §A + 내부 REST `inputData`/`outputData` 마스킹 §B + 흩어진 표면 수치 단일화 §D)와 무관한 plan-lifecycle 관리 작업이 같은 diff 에 묶여 있다.
  - 위치: `plan/complete/eia-internal-rest-error-masking.md` (신규 파일, 전체) / `plan/in-progress/eia-internal-rest-error-masking.md` (전체 삭제) / `plan/in-progress/spec-sync-external-interaction-api-gaps.md:187`, `:200`
  - 상세: PR #1179 로 이미 완료·머지된 이전 세션의 plan 문서(`eia-internal-rest-error-masking.md`)가 `plan/in-progress/` 에 남아 있던 걸 이번 세션이 `plan/complete/` 로 옮기고(내용은 git-mv 수준으로 동일), `spec-sync-external-interaction-api-gaps.md` 안의 상대링크 2곳(`./eia-internal-rest-error-masking.md` → `../complete/eia-internal-rest-error-masking.md`)을 함께 고쳤다. 이 작업은 금번 plan(`plan/in-progress/eia-fanout-and-internal-data-masking.md`)의 체크리스트·§A/§B/§D 어디에도 명시돼 있지 않다 — 즉 "발견해서 김에 고친" 부수 작업이다.
  - 제안: 코드 위험은 없다(문서 전용, 내용 변형 없는 순수 이동+링크 정정이라 실측 가능). 다만 PR 설명·커밋 메시지에 이 plan-lifecycle 정리가 이번 기능(A/B/D)과 별개 사유(이전 세션의 lifecycle 누락 정정)임을 한 줄 명시해, 리뷰어가 diff 크기를 기능 범위로 오판하지 않게 하는 것을 권장한다. 별도 커밋으로 분리할 필요까지는 없다(같은 developer 세션, `plan/**` 쓰기 권한 내, 저위험).

- **[INFO]** `codebase/backend/src/shared/utils/sanitize-error-message.ts` 에서 `deepRedactSecrets` 내부 캐시 로직을 `deepRedactCore`/`deepRedactObject` 로 분리하는 리팩터링이 있었다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`deepRedactCore`, `deepRedactObject` 함수)
  - 상세: 겉보기엔 "관련 없는 리팩터링"처럼 보일 수 있으나, 실제로는 신규 공개 API `deepRedactSecretsPreserving`(§A 의 `llmCalls` 보존 요구)이 기존 depth-0 캐시(객체 identity 만 키로 삼음)를 그대로 쓰면 `preserveKeys` 옵션이 다른 두 호출이 서로의 캐시 결과를 오염시키는 문제가 생겨, 캐시를 `deepRedactSecrets` 진입점 전용으로 옮기고 옵션 스레딩용 `deepRedactCore`/`DeepRedactOptions` 를 도입한 것이다. 이는 §A/§마커 요구사항의 직접적 귀결이라 scope 이탈이 아니다.
  - 제안: 없음 (범위 내로 판정).

## 요약

리뷰 대상 13개 파일의 코드 변경은 모두 plan(`plan/in-progress/eia-fanout-and-internal-data-masking.md`)이 명시한 세 항목 — §A(WS emit 값-패턴 마스킹, `maskWireEnvelope`/`toFanoutEnvelope` 헬퍼로 두 emit 경로 통합), §B(`Execution`/`NodeExecution`/`BackgroundRun` 의 `inputData`/`outputData` 마스킹을 `error` 와 동일한 관문으로 확장), §D(흩어진 "표면 수" 서술을 `toResponseExecution` JSDoc 표 하나로 단일화하고 나머지는 `{@link}` 참조로 교체) — 로 정확히 추적된다. `sanitize-error-message.ts` 의 마커-멱등(`MASKED_MARKERS`/`isMaskedMarker`)·`preserveKeys` 옵션 추가와 그에 수반된 내부 함수 분리도 §마커/§A 요구사항의 직접 파생이다. 새로 추가된 테스트(배경 실행·executions·websocket·sanitize-error-message 각 spec)는 전부 신규 프로덕션 코드 경로를 겨냥하며 기존 테스트의 기대값을 변경한 곳은 문서 주석(수치 서술 정리)뿐이다. 임포트·주석·포맷팅 변경은 모두 실질 변경에 종속적이며 드리프트성 정리는 발견되지 않았다. 유일하게 선언된 기능 범위 밖인 항목은 `plan/` 아래 완료된 이전 plan 파일을 `in-progress/`→`complete/` 로 옮기고 참조 링크 2곳을 고친 문서 전용 부수 작업으로, 위험은 낮지만(내용 무변형, 코드 영향 없음) 범위 순수성 관점에서는 별개 사유로 명시하는 편이 좋다.

## 위험도
LOW
