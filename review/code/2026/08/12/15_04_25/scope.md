# 변경 범위(Scope) 코드 리뷰

## 발견사항

- **[INFO]** `bodyHashOf` 헬퍼를 모듈 최상단으로 이동한 것은 "Redis 런타임 fail-open 버그 수정"이라는 1차 의도를 살짝 넘는 소규모 리팩토링
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:94`(신규 모듈 스코프 정의). 기존 `IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)` describe 내부 로컬 정의는 삭제(unified diff `-` 줄, 게이트 없음)
  - 상세: 직접 확인 결과(`grep -n bodyHashOf`) 정의는 파일 전체에서 94행 한 곳뿐이고 나머지는 전부 호출부 — 실제로 두 곳 복제가 한 곳으로 통합됐다. 이 이동은 핵심 수정(`catchError` 삽입)과 직접 관계는 없으나, `review/code/2026/08/12/14_27_02/RESOLUTION.md` WARNING #3(같은 세션의 자동 코드 리뷰가 지적한 중복)을 그 자리에서 조치한 결과로 근거가 명확히 남아 있다. `CLAUDE.md` 가 "구현 완료 후 `/ai-review` + critical/warning fix 는 상시 승인된 강제 단계"라고 명시하므로 임의 확장이 아니라 규정된 review-fix 워크플로의 정상 산출물이다. 순수 이동(로직 변경 없음), diff 규모도 작다.
  - 제안: 조치 불요. 사전 승인된 review-driven 리팩토링.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 체크박스 완료 표시 외 신규 백로그 항목(관측·중복 억제)이 함께 추가됨
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:524`-`530`
  - 상세: 원래 항목(`- [ ]` → `- [x]`, 498행)의 완료 처리에 더해 "idempotency fail-open 구간의 관측·중복 억제"라는 새 미해결 항목이 추가됐다. `review/code/2026/08/12/14_27_02/RESOLUTION.md` WARNING #1(concurrency: fail-open 구간 중복 실행 위험)을 "되돌리지 않고 문서화 + plan 백로그로 유예"한 결과로, 코드 fix 자체와 무관한 신규 기능·범위 확장이 아니라 이번 라운드가 만든 트레이드오프를 추적하는 정상적 부기다.
  - 제안: 조치 불요.

- **[INFO]** diff 에 `codebase/backend/**` 코드 변경과 함께 직전 두 리뷰 라운드(`14_27_02`, `14_50_36`)의 산출물 24개 파일(`RESOLUTION.md`·`SUMMARY.md`·`meta.json`·`_retry_state.json`·8개 개별 reviewer `.md` × 2라운드)이 신규 파일로 통째로 포함됨
  - 위치: `review/code/2026/08/12/14_27_02/*`, `review/code/2026/08/12/14_50_36/*` (전부 신규 파일, 코드 변경 없음)
  - 상세: `CLAUDE.md` skill 권한표는 `developer` 의 `review/` 쓰기 권한을 `review/**/RESOLUTION.md` 로만 한정하고, 나머지(`SUMMARY.md`·개별 reviewer `.md`·`meta.json`·`_retry_state.json`)는 `code-review-agents` skill 이 자동 생성하는 산출물이다. 즉 developer 가 스코프를 넘겨 임의 파일을 건드린 것이 아니라, 프로젝트가 규정한 "구현 → 자동 리뷰(강제) → resolution" 파이프라인의 산출물이 같은 브랜치 diff 로 누적 반영된 것이다(`git log` 확인: 3개 커밋 — `5d79dc123`(원 fix) → `f933f2cf6`(라운드1 resolution) → `1fb233eca`(라운드2 resolution 정정)). `review/` 는 gitignore 대상이 아니라 커밋이 정상 관례다. 코드 정확성·기능에 영향 없음. 직전 두 라운드의 scope 리뷰(`14_27_02/scope.md`, `14_50_36/scope.md`) 모두 이 항목을 동일하게 INFO/조치 불요로 판정했으며, 이번 라운드에서 독립적으로 재확인해도 동일 결론이다.
  - 제안: 조치 불요. diff 를 읽는 사람에게 노이즈가 될 수 있다는 점만 참고로 남긴다.

- **[없음 — 확인 결과 문제 없음]** 핵심 코드 변경의 정합성 재확인
  - 상세: `idempotency.interceptor.ts` 를 직접 열어 확인(`grep -n "catchError|switchMap"`) — `catchError` 는 107행, `switchMap` 은 113행으로 여전히 올바른 순서다(직전 라운드 documentation 리뷰어의 CRITICAL 오탐 — 공유 worktree 뮤테이션 아티팩트 — 이 이번 조회 시점엔 재현되지 않음). `CHANGELOG.md` 상단에 이번 fix 섹션이 실제로 존재함을 확인. 테스트 헤더 docstring 도 세 번째 describe 를 이제 명시(`idempotency.interceptor.spec.ts:15-17`, 라운드2 커밋 `1fb233eca` 로 반영). `git status --porcelain` 는 이번 리뷰 세션 산출 디렉터리(`review/code/.../15_04_25/`)만 untracked 로 표시해 작업 트리가 clean 하다.

## 요약

핵심 코드 변경(`idempotency.interceptor.ts` 의 `catchError` 삽입 + import, `idempotency.interceptor.spec.ts` 의 신규 fail-open 테스트, `CHANGELOG.md` 신규 섹션)은 "Redis `get()` 런타임 reject 가 요청을 500 으로 fail-closed 시키던 결함을 spec 이 요구하는 fail-open 으로 고친다"는 단일 의도에 3개 커밋(원 fix + 2회 review-fix) 내내 일관되게 수렴하며, 무관한 코드 정리·기능 확장·불필요한 import·설정 변경은 발견되지 않는다. `bodyHashOf` 모듈 최상단 이동과 plan 백로그 신규 항목 추가는 엄밀히는 원 fix 범위를 살짝 넘지만 둘 다 같은 세션의 사전 승인된 자동 review-fix 워크플로 산출물로 근거가 명확하다. diff 에 포함된 직전 두 리뷰 라운드의 산출물 24개 파일은 developer 의 스코프 일탈이 아니라 프로젝트가 규정한 리뷰 프로세스의 정상 부산물이며, 이는 이번 라운드까지 3회 연속 독립 재확인된 결론이다. 스코프 관점에서 CRITICAL/WARNING 급 이탈은 없다.

## 위험도

NONE
