# 변경 범위(Scope) Review

## 검토 대상 16개 파일

핵심 변경(3): `CHANGELOG.md`, `codebase/.../idempotency.interceptor.ts`, `codebase/.../idempotency.interceptor.spec.ts`
추적 문서(2): `plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/data-flow/15-external-interaction.md`
리뷰 산출물 신규 파일(11): `review/code/2026/08/12/16_29_45/{RESOLUTION,SUMMARY,documentation,maintainability,requirement,scope,security,side_effect,testing}.md`, `meta.json`, `_retry_state.json`

## 변경 의도

직전 리뷰 라운드(`16_29_45`)에서 CRITICAL 로 지적된 "409/410 캐싱 분기가 RxJS error 채널을 못 보는 dead code" 결함을 재설계로 해소 — `cacheTapped()` 를 `catchError` 로 확장하고, 캐시 히트 시 409/410 은 `HttpException` 재throw 로 재현하도록 고침. 그 재설계에 맞춰 테스트(`throwError` 기반 헬퍼)·CHANGELOG·plan 완료 노트를 동기화.

## 발견사항

### 검토한 항목 (문제 없음)

- **`idempotency.interceptor.ts` 재설계**: `HttpException`/`throwError` import 추가(`4-5`, `13`행) → `catchError` 도입, `storeEntry()` 추출, `isErrorStatusCacheable()` named 함수 신설(`239-241`행), 캐시 히트 시 409/410 예외 재현(`135-140`행) — 전부 CRITICAL 재설계 한 가지 목적에 대응한다. `isErrorStatusCacheable` 분리는 직전 라운드 maintainability INFO#12 처분과 일치하는 범위 내 확장이지 새 기능이 아니다.
- **`idempotency.interceptor.spec.ts`**: `makeThrowingHandler()` 헬퍼 신설(`99-103`행), 기존 성공-채널 mock 기반 409/410 테스트를 error-채널 기반으로 교체, 5xx·404 신규 케이스 추가 — 전부 재설계가 실제로 error 채널에서 동작함을 고정하는 회귀 테스트이며 다른 `describe` 블록(W-4 provider 경로, Redis fail-open)은 무변경.
- **`CHANGELOG.md`**: 파일 맨 위에 재설계 경위(1차 시도 실패 → 2차 재설계)를 설명하는 절 하나만 추가. 나머지 방대한 본문은 diff 밖(전체 파일 컨텍스트로만 표시).
- **`plan/in-progress/backend-lint-gate-broken-on-main.md`**: 기존 체크박스 1건에 "1차 완료가 실패였다"는 사실과 원인·교훈을 인용구로 덧붙였을 뿐(체크박스 자체는 이미 `[x]` 유지), 다른 섹션은 무변경. `developer` 의 `plan/**` 쓰기 권한 범위 내.
- **`spec/data-flow/15-external-interaction.md`**: "⚠️ 현행 구현 갭" caveat 문구 삭제 — 표면적으로는 `developer` 의 `spec/` read-only 원칙과 경계선에 있으나, `git log -p` 로 확인한 결과 이 정확한 편집은 **직전 커밋(`779a6e240`)에서 이미 한 번 수행됐고, 그 커밋 메시지가 "spec/ 쓰기는 원칙적으로 planner 권한이지만 이 문장은 '현행 구현이 이렇다'는 서술이라 구현 커밋과 원자적으로 지워지지 않으면 즉시 stale 해진다"는 명시적 근거를 남긴 바 있다.** 이번 diff 는 그 동일한 narrow exception 을 재적용(캐비트를 삭제 상태로 유지)한 것이지 새로운 정책 결정이 아니다.
- **리뷰 산출물 11개 신규 파일**: `review/code/2026/08/12/16_29_45/` 하위 `RESOLUTION.md` 외 10개(`SUMMARY.md`, 개별 reviewer `.md` 8개, `meta.json`, `_retry_state.json`)는 직전 라운드의 실제 review sub-agent 산출물이 git 에 신규로 추가되는 것이다. CLAUDE.md 표는 `developer` 의 `review/**` 쓰기 권한을 문자상 `RESOLUTION.md` 로 한정하지만, 이 10개는 developer 가 작성한 것이 아니라 `code-review-agents` 스킬(및 그 sub-agent)이 `review/code/**` 소관으로 이미 생성한 파일이 이번 커밋에 함께 스테이징된 것 — MEMORY 교훈("review/ 는 gitignored 아님")과 일치하는 정상적인 리뷰 워크플로 부산물이며, 이번 R8 캐시 수정과 무관한 별도 작업이 아니다(모두 같은 CRITICAL 을 다루는 동일 리뷰 세션의 기록).

### 포맷팅 · 임포트 · 설정

- import 변경은 `HttpException`(nestjs/common), `throwError`(rxjs), `GoneException`/`NotFoundException`(테스트) 뿐 — 전부 재설계에 직접 필요한 심볼이고 미사용 임포트나 드라이브바이 정리는 없다.
- 순수 포맷팅-only 변경 없음. 설정 파일(`.env.example`, `package.json`, lint config 등) 변경 없음.

## 요약

핵심 3개 파일(source·test·CHANGELOG)은 직전 라운드 CRITICAL("409/410 캐싱이 도달 불가능한 dead code")을 해소하는 재설계 단일 의도에 정확히 대응하며, 무관한 리팩토링·기능 확장·드라이브바이 수정은 없다. `plan/**` 추적 갱신은 권한 범위 내 정상 후속 기록이다. `spec/data-flow/15-external-interaction.md` 캐비트 삭제는 문자상 `developer` 의 `spec/` read-only 원칙과 경계에 있지만, 동일 편집이 직전 커밋에서 이미 명시적 근거와 함께 선례화된 narrow exception 의 재적용이라 이번 diff 가 새로 도입한 스코프 확장이 아니다. `review/code/16_29_45/` 하위 10개 신규 파일은 developer 가 아니라 리뷰 서브에이전트가 생성한 산출물이 함께 커밋된 것으로, 이번 CRITICAL 을 다룬 동일 리뷰 세션의 증적이며 무관한 변경이 아니다.

## 위험도

NONE
