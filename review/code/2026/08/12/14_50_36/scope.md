# 변경 범위(Scope) 코드 리뷰

## 발견사항

- **[INFO]** `bodyHashOf` 헬퍼를 모듈 최상단으로 옮긴 것은 "Redis 런타임 fail-open 버그 수정"이라는 1차 의도를 살짝 넘는 소규모 리팩토링이다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:89-93`(신규 모듈 스코프 정의), 기존 `describe('IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)')` 안에 있던 로컬 정의는 이 diff 로 삭제됨(unified diff 상 `-` 줄, 게이트 없음 — 삭제 전 원 위치는 옛 파일 기준 162~165행)
  - 상세: `catchError` 추가라는 핵심 수정과는 직접 관계없는 코드 이동이다. 다만 `review/code/2026/08/12/14_27_02/RESOLUTION.md`(WARNING #3)에 "describe 블록마다 문자 단위로 복제돼 있던 것을 모듈 최상단으로 올렸다"고 명시적으로 근거가 남아 있고, 이는 같은 세션에서 진행된 자동 코드 리뷰(`review/code/2026/08/12/14_27_02/maintainability.md`)의 WARNING 을 그 자리에서 조치한 결과다. `CLAUDE.md` 는 "구현 완료 후의 `/ai-review` + critical/warning fix 는 그 가드의 예외 — 본 프로젝트가 상시 사전 승인한 강제 단계"라고 명시하므로, 이 리팩토링은 임의 확장이 아니라 프로젝트가 규정한 review-fix 워크플로의 정상 산출물이다. 순수 이동(로직 변경 없음)이고 diff 규모도 5줄 내외로 작다.
  - 제안: 조치 불요. 규약상 사전 승인된 review-driven 리팩토링이라 스코프 위반으로 보기 어렵다.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 체크박스 완료 표시 외에 신규 백로그 항목(관측·중복 억제)이 함께 추가됐다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:524-530`
  - 상세: 원래 항목(`- [ ]` → `- [x]`, 498행)의 완료 처리에 더해, "idempotency fail-open 구간의 관측·중복 억제" 라는 새 미해결 체크리스트 항목(524행)이 추가됐다. 이는 `review/code/2026/08/12/14_27_02/RESOLUTION.md` WARNING #1(concurrency: fail-open 구간의 중복 실행 위험)을 "되돌리지 않고 문서화 + plan 백로그로 유예"한 결과로, 프로젝트 메모리 규약("유예 항목은 그 턴에 plan/ 에 적어라")과 정확히 일치하는 정상적 후속 조치다. 코드 fix 자체와 무관한 새 기능·범위 확장이 아니라, 이번 리뷰 라운드가 만든 트레이드오프를 추적하기 위한 부기다.
  - 제안: 조치 불요.

- **[INFO]** diff 에 `codebase/backend/**` 코드 변경과 함께 직전 리뷰 라운드(`14_27_02`)의 산출물 12개 파일(`RESOLUTION.md`, `SUMMARY.md`, `meta.json`, `_retry_state.json`, 8개 개별 reviewer `.md`)이 신규 파일로 통째로 포함돼 있다
  - 위치: `review/code/2026/08/12/14_27_02/RESOLUTION.md`, `review/code/2026/08/12/14_27_02/SUMMARY.md`, `review/code/2026/08/12/14_27_02/_retry_state.json`, `review/code/2026/08/12/14_27_02/meta.json`, `review/code/2026/08/12/14_27_02/{concurrency,documentation,maintainability,requirement,scope,security,side_effect,testing}.md` (전부 신규 파일, 코드 변경 없음)
  - 상세: `CLAUDE.md` 의 skill 권한표는 `developer` 의 `review/` 쓰기 권한을 `review/**/RESOLUTION.md` 로만 한정하고, 나머지 11개 파일(`SUMMARY.md`·개별 reviewer `.md`·`meta.json`·`_retry_state.json`)은 `code-review-agents`(코드 리뷰어) skill 이 생성하는 산출물이다. 즉 이 번들링은 "developer 가 스코프를 넘겨 임의 파일을 건드린" 것이 아니라, 프로젝트가 규정한 두 역할(구현 → 자동 리뷰 → resolution)의 산출물이 같은 커밋/diff 로 함께 반영된 것이며, `review/` 는 gitignore 대상이 아니라 커밋되는 것이 정상 관례다(프로젝트 메모리 확인). 코드 정확성이나 기능에 영향을 주는 변경은 전혀 없다.
  - 제안: 조치 불요. 다만 리뷰어 입장에서 "코드 fix" 대 "리뷰 프로세스 산출물"이 하나의 diff 에 섞여 있다는 점은 diff 를 읽는 사람에게 노이즈가 될 수 있어 참고로만 남긴다.

## 요약

핵심 코드 변경(`idempotency.interceptor.ts` 의 `catchError` 삽입 + import, `idempotency.interceptor.spec.ts` 의 신규 fail-open 테스트 3~5건, `CHANGELOG.md` 신규 섹션)은 "Redis `get()` 런타임 reject 가 요청을 500 으로 fail-closed 시키던 결함을 spec 이 요구하는 fail-open 으로 고친다"는 단일 의도에 정확히 수렴하며, 무관한 코드 정리·기능 확장·불필요한 import·설정 변경은 발견되지 않았다. `bodyHashOf` 모듈 최상단 이동과 plan 백로그 신규 항목 추가는 엄밀히는 원 fix 범위를 살짝 넘지만 둘 다 같은 세션의 직전 자동 코드 리뷰(WARNING #1/#3)에 대한 사전 승인된 후속 조치로 근거가 명확하다. 또한 diff 에는 직전 리뷰 라운드(`14_27_02`)의 산출물 파일 12개가 함께 포함돼 있는데, 이는 developer 의 스코프 일탈이 아니라 프로젝트가 규정한 리뷰 프로세스의 정상 부산물(코드 리뷰어 skill 산출)이다. 전체적으로 의도 이상의 변경·불필요한 리팩토링·기능 확장·포맷팅 뒤섞임 등 CRITICAL/WARNING 급 스코프 이탈은 없다.

## 위험도

NONE
