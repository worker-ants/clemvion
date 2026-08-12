# 변경 범위(Scope) Review

## 검토 방법

`git diff origin/main...HEAD` 로 실제 9개 커밋(`779a6e240`~`567c1919d`)의 변경 파일 전량을 직접
대조했다(72개 파일, `git diff --stat` 실측: `7 실질 파일 + 65 review 아티팩트, 5433(+)/67(-)`).
프롬프트의 diff 가 5차례 코드리뷰 라운드(`16_29_45`~`18_37_45`) + 1차례 consistency-check
(`18_27_29`) 산출물이 함께 커밋돼 부풀어 있는 점, 그리고 그 실질 파일 목록·내용이 프롬프트와
정확히 일치하는 점을 `git show`/`git diff` 로 재확인했다.

## 변경 의도

Spec EIA §R8("idempotency 캐시 대상은 `2xx`·`409`·`410` 의 닫힌 목록, `400 VALIDATION_ERROR`
만 예외")과 어긋나던 선재 결함 — 캐시 제외 조건이 `statusCode >= 400` 이라 409·410 까지 캐시에서
함께 빠지던 것을 정정. 1차 조건식 교체가 dead code(RxJS error 채널 미포착, `@HttpCode(202)` 로
성공 채널 statusCode 선고정)였다는 CRITICAL 이 자체 리뷰에서 나왔고, `catchError` 기반 재설계로
해소한 뒤에도 자매 케이스(400 mock 잔존, 5xx 가드 우회, 410 replay/e2e 누락, warn 단언 누락,
plan 미기록)를 4차례 더 거쳐 처분한 전체 이력이 이번 diff(브랜치 base 대비 누적)에 담겨 있다.

## 발견사항

### 검토한 항목 (문제 없음)

- **핵심 런타임 변경 — `idempotency.interceptor.ts`**: `HttpException`/`throwError` import 추가,
  `cacheTapped()` 를 `tap({next})` 단일 경로에서 `tap({next}) + catchError` 로 재설계, 캐시 히트
  시 `409`/`410` 예외 재현 블록 추가, `storeEntry()` 프라이빗 메서드 추출(직렬화 실패를 삼켜
  원 예외 보존 + `logger.warn`), `isErrorStatusCacheable()` named 함수 신설. `git diff` 로 직접
  대조한 결과 전부 "§R8 닫힌 목록을 실제 error 채널까지 포괄해 적용" 이라는 단일 목적에 대응하며,
  `storeEntry` 추출은 `next`/`catchError` 두 분기가 공유해야 하는 적재 로직을 한 곳에 두기 위한
  이 fix 가 요구하는 구조이지 무관한 개선성 리팩토링이 아니다. 갱신된 JSDoc(클래스 필드 주석,
  `cacheTapped`/`isErrorStatusCacheable`/`storeEntry` docstring)도 방금 바뀐 로직 설명과 1:1
  대응한다.
- **테스트 변경 — `idempotency.interceptor.spec.ts`**: `makeThrowingHandler()` 헬퍼, `409`/`410`/
  `5xx`(가드 앞·뒤 분리)/`404`/`400`/`3xx`/직렬화-실패(에러·성공 두 채널, `logger.warn` 단언 포함)
  회귀 케이스가 전부 같은 계약(§R8 닫힌 목록 + error 채널 재현 + fail-open 로그)을 검증한다. 다른
  `describe` 블록(W-4 provider 경로, Redis 장애 fail-open 기존 케이스)은 diff 밖.
- **e2e 신설 — `external-interaction.e2e-spec.ts`**: `redis` 클라이언트 셋업(`beforeAll`/`afterAll`,
  기존 파일의 다른 e2e 스위트와 동일 env-var 패턴)과 `IDEM-1`/`IDEM-2`/`IDEM-3` 3건만 추가, 기존
  테스트(`A`~`J` 등)는 컨텍스트로만 표시되고 실제로는 무변경(`grep it\(` 로 확인 — 신규 3건 외
  추가/수정 없음). 단위 mock 이 반복적으로 놓친 "mock 상태 ≠ 실제 파이프라인 상태" 결함 클래스를
  다른 층위에서 재확인하려는 plan 상의 명시적 후속 조치와 정확히 대응한다.
- **`CHANGELOG.md`**: 단일 hunk(`@@ -1,5 +1,33 @@`, 실측 28행 순증가 = `git diff --stat` 의
  `28 ++` 와 일치)로 파일 맨 위에 새 절 하나만 삽입. 기존 방대한 본문(웹채팅·auth guard 등)은
  diff 밖(전체 파일 컨텍스트로만 표시, 오인 주의).
- **`plan/in-progress/backend-lint-gate-broken-on-main.md`**: `git diff` 로 직접 대조한 결과 이
  fix 가 처분한 백로그 항목(§R8 캐시 조건, `Idempotency-Key` e2e 부재, `responseJson` 손상 무방비)
  주변으로 국한된 hunk 뿐이다. 체크박스 전환 + 완료 근거(뮤테이션 실측 표, 1~5차 시도 경위·교훈)를
  인용구로 남겼고, 다른 백로그 섹션·항목은 무변경 — `developer` 의 `plan/**` 쓰기 권한 범위 내
  정상 추적 갱신이다.
- **`plan/in-progress/spec-draft-eia-r8-alignment.md`**: `git show 02e80d699` 로 커밋 저자·내용을
  직접 확인했다. 이 plan 은 frontmatter 상 `owner: project-planner` 이지만, CLAUDE.md skill 표는
  `developer` 의 쓰기 권한을 `plan/**` 전체로 규정하지 특정 plan 소유자로 제한하지 않는다. 이번
  9행 추가는 직전 라운드 consistency-check(`18_27_29` plan_coherence WARNING)가 "developer 턴이
  §2.2 caveat 을 코드와 같은 커밋에서 지웠는데 그 사실이 이 plan 체크리스트에 없다" 고 지적한
  것에 대한 사후 기록으로, 그 리뷰어가 제안한 조치(가장 저비용안: 체크리스트 1줄 추가)를 그대로
  수행한 것 — 새로운 스코프 확장이 아니라 같은 diff 안의 다른 WARNING 을 닫는 정상 후속 작업이다.
- **`spec/data-flow/15-external-interaction.md`**: 표 한 행에서 "⚠️ 현행 구현은
  `statusCode >= 400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)" caveat 문구만 삭제 —
  갭이 실제로 닫혔으므로 SoT 를 실제 상태와 동기화하는 narrow 편집이다. 커밋 메시지가 이 경계를
  스스로 인지("spec 쓰기는 원칙적으로 planner 권한이지만…")하고 근거를 남겼으며, 뒤이은
  consistency-check(`18_27_29`)가 "내용 자체는 §R8 SoT 와 정합 · 이번 PR 을 막을 필요 없음" 으로
  독립 검증했고 그 검증에서 나온 유일한 WARNING(plan 미기록)도 바로 위 항목에서 해소됐다. 표의
  다른 행·본문은 무변경.
- **리뷰/consistency 산출물 65개 신규 파일**(`review/code/2026/08/12/{16_29_45,16_53_26,17_07_45,
  18_07_36,18_37_45}/**`, `review/consistency/2026/08/12/18_27_29/**`): `developer` 가 직접 작성한
  드라이브바이가 아니라, 이번 fix 를 대상으로 실행된 `code-review-agents`/`consistency-checker`
  스킬(및 그 sub-agent)의 실제 산출물이 각 라운드의 fix 커밋에 1:1 로 동봉된 것이다(`git show
  --stat` 으로 각 커밋을 확인 — 예: `567c1919d` 는 `18_37_45/` 전체를 그 라운드의 fix 와 같은
  커밋에 포함). CLAUDE.md 의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규약과
  `review/code/**`·`review/consistency/**` 산출물 저장 규약에 정확히 부합하는 표준 워크플로
  산출물이며, 이 diff 특유의 무관한 추가가 아니다.

### 포맷팅 · 임포트 · 설정

- import 변경은 `HttpException`(`@nestjs/common`), `throwError`(`rxjs`), 테스트 쪽
  `BadRequestException`/`GoneException`/`NotFoundException`/`InternalServerErrorException`
  (`@nestjs/common`) 뿐 — 전부 재설계·회귀 테스트에 직접 필요한 심볼이고 미사용 임포트나
  드라이브바이 정리는 없다.
- 순수 포맷팅-only 변경 없음. 설정 파일(`.env.example`, `package.json`, lint config, CI 워크플로
  등) 변경 없음(`git diff --stat` 잔여 확인 — 위 7개 실질 파일 + review 아티팩트 외 파일 0건).

## 요약

`git diff origin/main...HEAD` 로 9개 커밋의 실제 변경분을 직접 대조한 결과, 72개 파일 전부가
"idempotency 캐시가 Spec EIA §R8 의 닫힌 목록(2xx/409/410)과 어긋나던 선재 결함을, dead code
재설계와 그 뒤 5차례에 걸친 자매 케이스 처분까지 포함해 완전히 고친다" 는 단일 의도로 수렴한다.
핵심 3파일(source·unit test·e2e)의 변경은 그 재설계에 필요한 최소 범위를 벗어나지 않고,
`plan/**`·`spec/` 갱신도 이 fix 의 완료 사실과 그 과정에서 나온 consistency-check WARNING 을
SoT 에 동기화하는 권한 범위 내 후속 기록이다. `review/code/**`·`review/consistency/**` 하위 65개
신규 파일은 developer 의 드라이브바이가 아니라 이 PR 자체를 반복 검토한 리뷰/일관성 서브에이전트의
산출물이 각 라운드 fix 커밋에 동봉된 표준 워크플로 이력이다. 무관한 리팩토링·기능 확장
(over-engineering)·드라이브바이 파일 수정·의미 없는 포맷팅·불필요한 주석/임포트 변경·의도치 않은
설정 변경은 발견되지 않았다.

## 위험도

NONE
