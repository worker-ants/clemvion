### 발견사항

없음.

검토한 diff (`origin/main...HEAD`, 4개 파일)는 전부 **주석/JSDoc/Swagger 설명 문자열만 변경**하는 cosmetic follow-up이며 런타임 동작 변경이 없다:

- `trigger-parameter.types.ts` — `REASON_TO_DETAIL` 각 항목에 "이 reason이 왜 존재하는가/사용자가 취할 행동" JSDoc 추가.
- `resolve-trigger-parameters.ts` — 함수 JSDoc을 영→한 번역 + "Manual 실행 경로는 base 를 직접 부르지 않는다" 설명 확장.
- `re-run.dto.ts` — Swagger `description`에 마스킹 마커 3종이 `inputOverride` 필드의 예약어라는 설명 추가.
- `workflows.controller.ts` — 인라인 코드 주석을 영→한 번역(`details` vs `errors` 배선 설명).

이 네 변경 각각을 대상 spec의 기존 `## Rationale`과 대조했다:

1. `resolve-trigger-parameters.ts`의 새 JSDoc("Manual 경로는 wrapper `resolveTriggerParametersRejectingMasked`를 부르고, base 에 검사를 넣지 않은 것은 의도 — Webhook/Schedule 도 공유하는 base 에 넣으면 무관한 경로가 오염된다")는 `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 노트 및 `spec/5-system/14-external-interaction-api.md` §R17("공유 프리미티브를 넓히면 무관한 경로가 오염된다")과 문구까지 정확히 일치. 재도입·번복 없음.
2. `re-run.dto.ts`의 마커 예약어 설명은 EIA §R17의 "마스킹 마커 세 문자열은 Manual 파라미터에서 예약어가 된다 … 부분 일치(`a***b`)는 통과" 결정과 정확히 부합.
3. `workflows.controller.ts` 주석 개정("`details`가 아니라 `errors`면 GlobalExceptionFilter가 못 읽는다")은 manual-trigger.md §6의 "re-run이 목록에 들어온 것은 2026-08-20" 노트와 같은 배선 결정을 재확인하는 서술이며 새 결정을 도입하지 않음.
4. `trigger-parameter.types.ts`의 reason별 JSDoc은 순수 설명 보강으로 §6 표의 기존 분류(구조 위반=`invalid_schema` 단일화 등)와 충돌 없음.

기각된 대안 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 — 4가지 관점 모두 해당 사항 없음. `masked_value_resubmitted`/`inputData` 카브아웃 폐지/base-vs-wrapper 분리 등 이 영역의 확립된 Rationale(§R17, manual-trigger.md `## Rationale`)은 이미 2026-08-16~21에 걸쳐 다회 라운드로 정착된 상태이며, 이번 diff는 그 결정을 코드 주석에 **더 명시적으로 반영**하는 방향일 뿐 결정 자체를 건드리지 않는다.

### 요약
target 변경분은 masked-marker 재제출 거부 기능(PR #1188~#1191)에 대한 순수 주석/문서화 후속 작업으로, 기존에 확립된 EIA §R17·manual-trigger.md §6 Rationale의 결정(base/wrapper 분리, 마커 예약어, 응답 봉투 배선)을 코드 레벨 주석으로 재진술할 뿐 새로운 설계 결정이나 대안 재도입이 없다. Rationale 연속성 관점에서 문제가 될 소지가 없다.

### 위험도
NONE
