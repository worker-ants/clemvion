# 신규 식별자 충돌 검토 — `spec/5-system/` (`Execution.inputData` egress 마스킹 카브아웃 폐지)

## 점검 대상 요약

target diff(`origin/main...HEAD`)는 `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md` 4개 spec 문서와, 그에 대응하는 프런트/백엔드 구현(`codebase/frontend/src/lib/utils/masked-markers.ts` 신설, `rerun-modal.tsx`·`editor-toolbar.tsx`·`dynamic-form-ui.tsx`·`executions.service.ts` 변경)으로 구성된다. 새 요구사항 ID·API endpoint·이벤트명·ENV 변수는 도입되지 않았고, 확인된 신규 식별자는 아래와 같다.

## 발견사항

### 확인했지만 충돌 아님 (참고 기록)

- **frontend `MASKED_MARKERS`/`isMaskedMarker` 가 backend `sanitize-error-message.ts` 의 동명 상수/함수와 이름이 같다.**
  - target 신규 식별자: `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `export const MASKED_MARKERS`, `export function isMaskedMarker`
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` 의 (모듈-private) `const MASKED_MARKERS`, `:156` 의 `function isMaskedMarker`
  - 상세: 이름·시맨틱이 완전히 동일하다. 다만 이는 **의도된 미러**다 — frontend(CSR Next.js)가 backend NestJS 모듈을 직접 import 할 수 없어 상수를 복제해야 하고, 두 파일의 JSDoc 이 명시적으로 "이름을 backend 와 똑같이 둔다 — 미러 동기화는 결국 사람이 grep 으로 찾는다"고 근거를 남겼다. 각각 자신의 모듈 스코프(backend 쪽은 `export` 조차 없는 private const)에 갇혀 있어 동일 프로세스/번들에서 두 심볼이 동시에 보이는 경우가 없다. 이 관용구는 이번 PR 이전부터(`dynamic-form-ui.tsx` 안에 있던 것을 승격) 존재했던 선례를 그대로 잇는다.
  - 제안: 조치 불필요. (참고로 `MAX_MARKER_SCAN_DEPTH`(frontend) ↔ `MAX_REDACT_DEPTH`(backend)처럼 이름을 의도적으로 다르게 둔 상수도 있어, "미러링할 이름"과 "값만 맞추면 되는 상수"를 프로젝트가 이미 구분해 쓰고 있음을 확인했다.)

- **신규 i18n 키 `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`.**
  - 기존 `ko/en` 4개 dict 파일 전체를 grep 했으나 두 키 모두 이번 diff 이전에는 존재하지 않았고, 같은 네임스페이스(`editor.*`, `history.rerun.*`) 안에서 다른 의미로 재사용된 이력도 없다. 충돌 없음.

- **신규 파일 `codebase/frontend/src/lib/utils/masked-markers.ts` (+ `__tests__/masked-markers.test.ts`).**
  - `lib/utils/` 디렉터리의 기존 kebab-case 파일 명명 컨벤션(`edge-data-preview.ts`, `node-config-summary.ts` 등)을 따르고, 동명 파일이 사전에 존재하지 않았다. `dynamic-form-ui.tsx` 에 있던 구현을 옮기면서 원본 위치의 `export`는 완전히 제거됐다(중복 정의 잔존 없음, grep 으로 확인).

- **백엔드 `MASKED_INPUT_DATA_REASON` 앵커 상수 삭제.**
  - `executions.service.ts` 에서 상수 선언·JSDoc·참조 3곳이 모두 제거됐고, spec 쪽(`13-replay-rerun.md`, `14-external-interaction-api.md`)의 해당 상수 인용 문구도 함께 갱신돼 코드베이스 전체에 dangling 참조가 없다(grep 0건). 식별자 소멸이라 "충돌"은 아니지만 정합성 확인 차 기록.

- **모듈 로컬 헬퍼명(`splitMaskedParameters`, `isStructuredType`, `isStructuredField`, `blockedByMaskedInput`, `touchedKeys`) — `rerun-modal.tsx`/`editor-toolbar.tsx` 내부.**
  - 전체 `codebase/` grep 결과 각각 자신의 정의 파일(및 그 테스트 파일)에서만 나타나 모듈 스코프 밖 충돌 없음.

- **요구사항 ID / 정책 ID.** diff 전체에서 새 `XX-YY-NN` 형태 ID나 새 `§R` 번호가 도입된 곳이 없다 — 전부 기존 `EIA §R17`을 인용만 한다.
- **API endpoint / 이벤트명 / ENV 변수.** diff 에 `POST/GET/... /api/...` 신규 라우트, `socket.emit(...)` 신규 이벤트명, `process.env.*` 신규 키가 하나도 없다(grep 0건). 이번 변경은 순수하게 기존 REST/WS 표면의 마스킹 정책 전환 + 프런트 가드 추가이며 새 표면을 열지 않는다.

## 요약

target 은 새 요구사항 ID·API endpoint·이벤트명·ENV 변수를 전혀 도입하지 않았다. 유일하게 눈에 띄는 "동명 식별자"는 frontend `masked-markers.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 가 backend `sanitize-error-message.ts` 의 동명 심볼과 겹치는 것인데, 이는 언어/번들 경계를 넘는 상수를 grep 으로 동기화 가능하게 하려는 프로젝트의 기존 관용구(이번 PR 이전부터 있던 `dynamic-form-ui.tsx` 선례의 승격)이며 두 정의가 각자 모듈에 격리돼 있어 실질적 이름공간 충돌이 아니다. 신규 i18n 키·신규 파일 경로·로컬 헬퍼명도 기존 사용처와 겹치지 않음을 grep 으로 확인했다.

## 위험도

NONE
