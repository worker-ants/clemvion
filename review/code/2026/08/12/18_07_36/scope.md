# 변경 범위(Scope) 리뷰

## 검토 방법

프롬프트의 diff 가 여러 리뷰 라운드 아티팩트(`review/code/2026/08/12/{16_29_45,16_53_26,17_07_45}/**`)
때문에 크게 부풀어 있어, 원본 저장소에서 `git diff origin/main...HEAD` 로 실제 5개 커밋
(`779a6e240`, `fcdf40194`, `384815fe6`, `ac8dd03ee`, `0f7907ec4`)의 변경 파일 전량과 각 커밋
메시지를 직접 대조했다.

## 발견사항

### 검토한 항목 (문제 없음)

- **핵심 런타임 변경**: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  — `cacheTapped()` 를 `tap({next})` 단일 경로에서 `tap({next}) + catchError` 파이프라인으로
  재설계하고, `isErrorStatusCacheable(statusCode)` named 함수를 추출했다. 새로 추가된
  `storeEntry()` 프라이빗 메서드(직렬화 실패를 삼켜 원 예외를 보존)까지 전부 "§R8 캐시 대상이
  dead code 였다"는 단일 결함을 고치는 데 필요한 범위다. import 추가(`HttpException`,
  `throwError`)도 이 재설계가 요구하는 최소 추가다.
- **테스트 변경**: `idempotency.interceptor.spec.ts` — `makeThrowingHandler()` 헬퍼 추가와
  409/410/5xx/404/400/3xx/non-HttpException 7개 회귀 케이스가 전부 같은 계약(§R8 닫힌 목록 +
  error 채널 재현)을 검증한다. 무관한 describe 블록(W-4 provider 경로, Redis 장애 fail-open)은
  diff 밖.
- **e2e 신설**: `codebase/backend/test/external-interaction.e2e-spec.ts` — `I-1`/`I-2` 2건과
  `redis` 클라이언트 셋업뿐이며, 기존 테스트(G-2 등)는 무변경. 4차 라운드까지 단위 mock 이
  반복적으로 놓친 "mock 상태 ≠ 실제 파이프라인 상태" 결함 클래스를 다른 층위에서 재확인하려는
  plan 상의 명시적 후속 조치(`Idempotency-Key e2e 부재` 항목)와 정확히 대응한다.
- **CHANGELOG.md**: `@@ -1,5 +1,33 @@` 단일 hunk로 새 절 하나만 파일 맨 위에 삽입. 기존 방대한
  본문(웹채팅·auth guard 등)은 diff 에 포함되지 않은 전체 컨텍스트일 뿐이다.
- **`plan/in-progress/backend-lint-gate-broken-on-main.md`**: 이번 작업이 처분한 백로그 항목
  2건(`idempotency 캐시 제외 조건…`, `Idempotency-Key e2e 부재`)의 체크박스만 `[ ]`→`[x]` 전환하고
  완료 근거(뮤테이션 실측, 1~4차 실패 경위)를 인용구로 남겼다. 다른 체크박스·섹션은 무변경 —
  `developer` 역할의 `plan/**` 쓰기 권한 범위 내 정상 추적 갱신.
- **`spec/data-flow/15-external-interaction.md`**: 표 한 행에서 이미 해소된 "⚠️ 현행 구현은
  `statusCode >= 400`…" caveat 문구만 삭제. 커밋 메시지(`779a6e240`)에 이 spec 동기화가
  "구현이 바뀌는 커밋과 원자적으로 지워지지 않으면 그 사이 spec 이 거짓이 된다"는 근거로 명시돼
  있고, `--impl-done` consistency 검증 대상으로 남겨졌다고 밝힘 — 임의의 spec drift 가 아니다.
- **`review/code/2026/08/12/{16_29_45,16_53_26,17_07_45}/**`**: 각각 해당 라운드의 fix 커밋에
  1:1로 동봉되어 있다(`git show --stat` 확인 — `fcdf40194`가 `16_29_45/`를,
  `384815fe6`가 `16_53_26/`를, `ac8dd03ee`가 `17_07_45/`를 각각 함께 커밋). CLAUDE.md 의
  "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규약과 `review/code/**` 산출물 저장
  규약에 정확히 부합하는 표준 워크플로 산출물이며, 이 diff 특유의 드라이브바이가 아니다.

### 포맷팅 · 임포트 · 설정

- 포맷팅-only 변경, 사용하지 않는 임포트, `.env.example`/`package.json`/lint config 등 설정
  파일 변경은 발견되지 않았다(`git diff --stat` 을 review/**, CHANGELOG.md, plan/**, spec/**,
  대상 3개 소스/테스트 파일로 exclude 한 결과 잔여 0건).

## 요약

원본 저장소에서 실제 5개 커밋의 diff 전량을 직접 대조한 결과, 소스 1(`idempotency.interceptor.ts`)·
테스트 2(`idempotency.interceptor.spec.ts`, `external-interaction.e2e-spec.ts`)·CHANGELOG·plan
추적·spec SoT 6개 실질 파일 전부가 "`Idempotency-Key` 캐시가 Spec EIA §R8 의 닫힌 목록(2xx·409·410)과
어긋나던 선재 결함을, dead code 재설계까지 포함해 완전히 고친다"는 단일 의도에 정확히 대응한다.
프롬프트가 부풀려 보인 이유는 리뷰 워크플로 자체가 산출하는 `review/code/**` 아티팩트가 각 라운드
fix 커밋에 동봉됐기 때문이며, 이는 이 저장소의 표준 관행(개발자 SKILL §REVIEW WORKFLOW)이지 이번
작업 특유의 범위 이탈이 아니다. 무관한 리팩토링·기능 확장(over-engineering)·드라이브바이 수정·
불필요한 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
