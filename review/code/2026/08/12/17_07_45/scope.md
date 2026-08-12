# 변경 범위(Scope) Review

## 검토 대상 27개 파일

핵심 변경(3): `CHANGELOG.md`, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
추적 문서(2): `plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/data-flow/15-external-interaction.md`
리뷰 산출물 신규 파일(22): `review/code/2026/08/12/16_29_45/**`(11개), `review/code/2026/08/12/16_53_26/**`(11개)

## 변경 의도

Spec EIA §R8("idempotency 캐시 대상은 `2xx`·`409`·`410` 의 닫힌 목록, `400 VALIDATION_ERROR` 만 예외")과
어긋나던 선재 결함 — 캐시 제외 조건이 `statusCode >= 400` 이라 409·410 까지 캐시에서 함께
빠지던 것을 닫힌 목록으로 정정. 1차 조건식 교체 시도가 `409`/`410` 이 서비스에서 예외로
throw 되는 사실을 못 봐 dead code 였다는 CRITICAL 이 자체 리뷰 라운드(`16_29_45`)에서 나왔고,
`catchError` 기반 재설계로 해소(`16_53_26` 라운드에서 잔여 WARNING 1건도 처분)한 전체 이력이
이번 diff(브랜치 base 대비 누적)에 담겨 있다.

## 발견사항

### 검토한 항목 (문제 없음)

- **`idempotency.interceptor.ts` 핵심 변경**: `HttpException`/`throwError` import 추가 →
  캐시 히트 시 `409`/`410` 예외 재현 블록, `cacheTapped()` 를 `tap({next}) + catchError` 로
  재설계, `storeEntry()` 추출, `isErrorStatusCacheable()` named 함수 신설. 전부 "§R8 닫힌
  목록을 실제 error 채널까지 포괄해 적용" 이라는 단일 목적에 직접 대응한다. `storeEntry` 추출은
  새 기능이 아니라 `next`/`catchError` 두 분기가 공유해야 하는 적재 로직을 물리적으로 한 곳에
  두기 위한 불가피한 리팩터링이다(무관한 개선성 리팩토링이 아니라 이 fix 가 요구하는 구조).
  함께 갱신된 JSDoc(클래스 필드 주석, `cacheTapped` docstring, `isErrorStatusCacheable` docstring)도
  모두 방금 바뀐 로직 설명으로 1:1 대응하며 무관한 주석 정리가 아니다.
- **`idempotency.interceptor.spec.ts`**: `makeThrowingHandler()` 헬퍼 신설, 기존 성공-채널
  mock 기반 409 테스트를 error-채널 기반으로 교체, `410`/`5xx`/`3xx`/`404`/`400`(2차 라운드에서
  마저 교체) 신규·수정 케이스, 캐시 재현이 예외로 나가는지 확인하는 테스트 1건. 전부 위 재설계가
  실제 error 채널에서 동작함을 고정하는 회귀 테스트다. 다른 `describe` 블록(W-4 provider 경로,
  캐시 히트 typeof 가드, Redis 런타임 장애 fail-open)은 무변경.
- **`CHANGELOG.md`**: `@@ -1,5 +1,33 @@` 단일 hunk — 파일 맨 위에 이번 fix 의 경위(1차 시도
  실패 → 재설계, 클라이언트 영향, `requestId` 재현 예외)를 설명하는 절 하나만 삽입. 기존 항목
  본문은 diff 밖(전체 파일 컨텍스트로만 표시, 오인 주의).
- **`plan/in-progress/backend-lint-gate-broken-on-main.md`**: 두 개 hunk 모두 이 fix 와 직접
  관련된 단일 백로그 항목 주변으로 국한된다. (1) `[ ]`→`[x]` 체크박스 전환 + 완료 근거(뮤테이션
  실측 표, 1차 실패 경위, 교훈)를 인용구로 추가, (2) 같은 CRITICAL 의 후속 권고("`Idempotency-Key`
  e2e 부재")를 별도 미체크 항목으로 신규 등재 — "미룬 항목은 그 턴에 plan/ 에 적는다" 는 이
  저장소 컨벤션과 일치하는 정상적 트래킹이며, 다른 백로그 항목·섹션은 컨텍스트로만 표시되고
  실제로는 무변경.
- **`spec/data-flow/15-external-interaction.md`**: 표 한 행에서 "⚠️ 현행 구현은 `statusCode >=
  400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)" caveat 문구만 삭제 — 갭이 실제로
  닫혔으므로 SoT 를 실제 상태와 동기화하는 narrow 편집이다(직전 라운드 scope 리뷰가 `git log`
  로 동일 패턴의 선례를 이미 확인함). 표의 다른 행·본문은 무변경.
- **리뷰 산출물 22개 신규 파일**(`review/code/2026/08/12/{16_29_45,16_53_26}/**`): `developer`
  가 직접 작성한 것이 아니라 이번 fix 를 대상으로 실행된 `code-review-agents` 스킬(및 그
  sub-agent, `review/code/**` 소관)의 실제 산출물이 브랜치에 함께 커밋된 것이다. 두 라운드
  모두 이번과 동일한 §R8 캐시 fix 를 다룬 리뷰 세션의 기록(CRITICAL 발견→해소, WARNING
  발견→해소)이므로 무관한 별도 작업이 아니라 이 PR 자체의 증적이다. MEMORY 교훈("review/ 는
  gitignored 아님")과 이 저장소의 표준 워크플로(구현 완료 후 `/ai-review` 강제, `RESOLUTION.md`
  로 fix 기록)에 부합한다.

### 포맷팅 · 임포트 · 설정

- import 변경은 `HttpException`(nestjs/common), `throwError`(rxjs), 테스트 쪽 `BadRequestException`
  /`GoneException`/`NotFoundException`(nestjs/common) 뿐 — 전부 재설계에 직접 필요한 심볼이고
  미사용 임포트나 드라이브바이 정리는 없다.
- 순수 포맷팅-only 변경 없음. 설정 파일(`.env.example`, `package.json`, lint config, CI 워크플로
  등) 변경 없음.

## 요약

27개 파일 전부 "idempotency 캐시가 Spec EIA §R8 의 닫힌 목록(2xx/409/410)과 어긋나던 선재
결함을 실제 error 채널까지 포괄해 정합화" 라는 단일 의도로 수렴한다. 핵심 3파일(source·test·
CHANGELOG)의 변경은 그 재설계에 필요한 최소 범위(조건 판정 함수 추출, catchError 확장,
예외 기반 재현, 대응 회귀 테스트)를 벗어나지 않고, `plan/**`·`spec/` 갱신도 이 fix 의 완료
사실을 SoT 에 동기화하는 권한 범위 내 후속 기록이다. `review/code/**` 하위 22개 신규 파일은
developer 의 드라이브바이 추가가 아니라 이 PR 자체를 대상으로 두 차례 실행된 리뷰 서브에이전트의
산출물이며, 그 두 라운드가 각각 CRITICAL(dead code)·WARNING(자매 테스트 케이스 누락)을
찾아 같은 diff 안에서 해소한 이력을 그대로 반영한다. 무관한 리팩토링·기능 확장(over-engineering)·
드라이브바이 파일 수정·의미 없는 포맷팅·불필요한 주석/임포트 변경·의도치 않은 설정 변경은
발견되지 않았다.

## 위험도

NONE
