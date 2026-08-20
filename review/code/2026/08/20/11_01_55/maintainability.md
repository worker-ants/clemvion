# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** `token` 계열 회귀 테스트가 두 "미러" 파일 사이에서 서로 다른 패턴으로 작성됐다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` (`redacts the full credential key pattern set` 테스트, `secrets` 객체 리터럴 + `for...of` 단언) vs `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:369-377` (`FAMILY` 배열 + `it.each`)
  - 상세: 두 파일은 코드 쪽에서 "의도된 미러"로 명시적으로 묶여 있고(각 `CREDENTIAL_KEY_PATTERN` JSDoc 이 서로를 가리킴), 이번 diff 가 추가한 `token` 계열 커버리지도 같은 축(`x-auth-token`·`csrf_token`·`csrfToken`·`session_token`·`id_token`)을 겨눈다. 그런데 `sanitize-error-message.spec.ts` 는 신규 `FAMILY` 배열 + `it.each` 로 값 축·키 축을 "같은 표"로 고정한 반면, `websocket.service.spec.ts` 는 기존에 있던 단일 객체 리터럴(`secrets`)에 신규 키 5개를 끼워 넣는 기존 패턴을 그대로 따랐다. 기능적으로는 둘 다 회귀를 잡지만(실제로 RESOLUTION.md 가 뮤테이션으로 검증함), "미러" 관계인 두 파일의 테스트 표현 방식이 갈려 있어 다음에 계열을 한 번 더 넓힐 때 어느 파일을 기준으로 맞출지 판단 비용이 생긴다.
  - 제안: 필수 아님(기능 결함 없음). 다음에 이 축을 다시 건드릴 일이 생기면 `websocket.service.spec.ts` 쪽도 공유 `FAMILY` 상수를 가져다 쓰거나 최소한 같은 이름의 로컬 배열로 정렬하는 것을 고려.

## 확인했으나 문제 없다고 판단한 것

- 이 diff 는 동일 코드베이스에 대한 **직전 라운드**(`review/code/2026/08/17/14_00_15/maintainability.md`)의 WARNING/INFO 를 그대로 이어받는 변경분을 포함한다. 세 항목 모두 실제로 반영됐음을 소스에서 직접 대조 확인했다:
  - WARNING(`/* */` vs `/** */` 스타일 불일치) → `websocket.service.ts:59-75` 가 이제 단일 `/** */` JSDoc 블록 안에 문단으로 병합돼 있다(개별 `/* */` 블록 소멸).
  - INFO(plan "설계" 절 정규식이 shipped 코드와 비동치) → `plan/in-progress/eia-secret-pattern-token-family.md:83-95` 가 실제 두 정규식(`[A-Za-z0-9_-]*token` / `[a-z0-9_-]*token`)을 그대로 적고 "초안을 구현에서 단순화했다"는 이유까지 남겼다.
  - INFO(MCP `MCP_EXTRA_SECRET_PATTERNS` no-op 루프)는 RESOLUTION.md 가 "선택 항목"으로 명시적으로 미반영 처리했고 이번 diff 에도 그 상태 그대로다 — 이미 판정이 끝난 사안이라 재지적하지 않는다.
- `CREDENTIAL_KEY_PATTERN`/`SECRET_LEAK_PATTERNS`/`MCP_EXTRA_SECRET_PATTERNS` 세 곳의 정규식 "삼중 미러"는 크로스-레이어 import 를 피하기 위한 의도된 중복이며, 각 선언부 JSDoc 이 SoT·동기화 대상 범위(`x-api-key` 는 REST 전용이라 WS 미러 대상 아님 등)를 명시적으로 못박아 다음 편집자가 헷갈릴 여지를 최소화했다.
- 문자 클래스가 `[A-Za-z0-9_-]*token`(값 패턴)과 `[a-z0-9_-]*token`(키 패턴, 양쪽 파일 공통)로 갈리는 점은 `/i` 플래그로 기능상 동일하고, 각 패턴군의 기존 로컬 컨벤션(값 패턴군은 대소문자 명시, 키 패턴군은 소문자만 + `^...$` 앵커)을 그대로 따른 것이라 이번 diff 가 새로 도입한 비일관성이 아니다.
- 함수 길이·중첩 깊이·순환 복잡도: 이번 diff 로 로직이 늘어난 함수는 없다 — 모두 정규식 상수 값 교체, 배열 비우기, JSDoc 확장, 테스트 케이스/설명 추가 수준이다. 신규 매직 넘버 없음.
- 신규 테스트(`sanitize-error-message.spec.ts` 의 `token 계열 — 값 축과 키 축을 같은 표로 고정` describe 블록)는 오탐 경계(`tokenizer`)와 받아들이는 오탐(`nextPageToken`)을 캐너리로 명시적으로 고정해, 이후 누군가 패턴을 부주의하게 넓히거나 좁힐 때 의도를 재발견하지 않고 바로 결정 근거를 보게 한다 — 좋은 패턴.
- `CHANGELOG.md`/`plan/in-progress/*.md` 신규 산문은 가독성·근거 서술 관점에서 이 저장소 평균 수준이며, 조립 diff 에 포함된 `review/code/.../14_00_15/*`·`review/consistency/.../14_00_50/*` 는 AI 리뷰 세션의 산출물(생성된 보고서 마크다운/JSON)로, `review/` 폴더 규약상 정상적으로 보관되는 아티팩트다. 애플리케이션 코드가 아니므로 가독성/네이밍/복잡도 같은 유지보수성 기준을 적용할 대상이 아니라고 판단해 별도 지적하지 않았다.

## 요약

이번 diff 의 실질 코드 변경(`sanitize-error-message.ts`/`.spec.ts`, `mcp-error-codes.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`)은 세 곳의 자격증명 정규식 SoT 를 `token` 계열 단일 대안으로 통합하고 MCP 전용 보충 패턴을 흡수해 비우는 저위험 변경이며, 직전 라운드 리뷰가 지적한 주석 스타일 불일치·plan-코드 정규식 drift 는 모두 반영·정정된 상태로 소스에서 직접 확인됐다. 남은 것은 "미러" 관계인 두 스펙 파일이 같은 `token` 계열 커버리지를 서로 다른 테스트 표현 방식(공유 `FAMILY` 배열+`it.each` vs 로컬 객체 리터럴)으로 작성했다는 점 하나뿐이며, 기능적 결함은 아니고 다음 확장 시 판단 비용을 약간 늘리는 수준이다. 전반적으로 가독성·네이밍·함수 길이·중첩·매직 넘버·복잡도 측면에서 새로 도입된 문제는 없다.

## 위험도

LOW
