# 변경 범위(Scope) Review

## 검토 방법

프롬프트에 실린 diff 는 5차례 리뷰 라운드(`16_29_45`~`18_07_36`) + consistency-check(`18_27_29`)
산출물이 그대로 포함돼 61개 파일로 부풀어 있다. 실물 저장소에서 `git log --oneline
origin/main..HEAD`(7개 커밋) 및 `git diff origin/main...HEAD -- <핵심 파일>` 을 직접 실행해
프롬프트 생략분(소스·테스트·e2e diff)까지 전량 대조했다.

## 변경 의도

Spec EIA §R8("idempotency 캐시 대상은 `2xx`·`409`·`410` 의 닫힌 목록, `400 VALIDATION_ERROR`
만 예외")과 어긋난 선재 결함 — 캐시 제외 조건이 `statusCode >= 400` 이라 409·410 까지 캐시에서
함께 빠지던 것을 정정. 1차 조건식 교체가 dead code(RxJS error 채널 미포착)였던 것을 자체
리뷰 라운드가 잡아 재설계했고, 이후 3라운드에 걸쳐 "자매 케이스 누락"(400, 5xx 가드 우회,
410 replay, 410 e2e, try/catch 미검증)을 순차적으로 닫은 전체 이력이 이번 diff(브랜치 base
대비 누적, 7개 커밋)에 담겨 있다.

## 발견사항

### 검토한 항목 (문제 없음)

- **`idempotency.interceptor.ts`**: `git diff` 로 직접 대조. `HttpException`/`throwError`
  import 추가, `cacheTapped()` 를 `tap({next}) + catchError` 로 재설계, `storeEntry()` 프라이빗
  메서드 추출(직렬화 실패 시 fail-open), `isErrorStatusCacheable()` named 함수 신설. 전부 "§R8
  닫힌 목록을 error 채널까지 포괄" 이라는 단일 결함 수정에 필요한 최소 구조 변경이며, 갱신된
  JSDoc(클래스 필드 주석·`cacheTapped`·`isErrorStatusCacheable` docstring)도 방금 바뀐 로직과
  1:1 대응한다. 클래스 상단 요약 bullet(약 49-57행)은 이번 diff 로 건드리지 않아, "에러 채널
  캐시 재현"을 요약하지 않는다는 점은 이전 라운드가 이미 INFO 로 트리아지하고 유예한 항목과
  동일 — 새 스코프 이슈 아니다.
- **`idempotency.interceptor.spec.ts`**: `makeThrowingHandler()` 헬퍼 신설, 기존 성공-채널
  mock 기반 409 테스트를 error-채널로 교체, 410/5xx/404/400/non-HttpException/3xx/직렬화-실패
  2건 케이스 추가. 전부 같은 계약(§R8 닫힌 목록 + error 채널 재현)의 회귀 테스트이며, 무관한
  `describe` 블록(W-4 provider 경로, Redis fail-open 나머지)은 diff 밖.
- **`external-interaction.e2e-spec.ts`**: `IDEM-1`/`IDEM-2`/`IDEM-3` 3건과 `redis` 클라이언트
  셋업(`beforeAll`/`afterAll`)만 추가. 기존 테스트(A~J)는 무변경. 과거 라운드에서 지적됐던
  `I-2` ID 충돌(617행 기존 `getStatus wire` 테스트와의 중복)은 `IDEM-` prefix 로 이미 정정돼
  있음을 직접 확인 — 재발 없음.
- **`CHANGELOG.md`**: `git diff` 상 `@@ -1,5 +1,33 @@` 단일 hunk — 파일 맨 위에 이번 fix 경위
  (1차 dead-code 실패 → 재설계, 클라이언트 영향, `requestId` 비재현 caveat)를 설명하는 절
  하나만 삽입. 나머지 방대한 본문(웹채팅·auth guard 등)은 diff 밖(컨텍스트로만 표시).
- **`plan/in-progress/backend-lint-gate-broken-on-main.md`**: `git diff` 확인 결과 이번 fix
  가 처분한 백로그 항목 2건(`idempotency 캐시 제외 조건…`, `Idempotency-Key e2e 부재`)의
  체크박스만 `[ ]`→`[x]` 전환하고 완료 근거(뮤테이션 실측표, 1~4차 실패 경위)를 인용구로
  추가했다. 다른 체크박스·섹션은 무변경 — `developer` 의 `plan/**` 쓰기 권한 범위 내 정상 추적.
- **`plan/in-progress/spec-draft-eia-r8-alignment.md`**: 체크리스트 끝에 9줄 추가 — developer
  턴이 `spec/data-flow/15` §2.2 caveat 을 코드 수정과 원자적으로 지운 사실을 planner 관점에서
  사후 기록. `02e80d699` 커밋(`chore(plan): --impl-done BLOCK:NO...`)이 이 항목만 다루며 함께
  consistency-check 산출물(`review/consistency/2026/08/12/18_27_29/**`)을 동봉 — 무관한 추가
  아니다.
- **`spec/data-flow/15-external-interaction.md`**: 표 한 행에서 "⚠️ 현행 구현은 `statusCode >=
  400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)" caveat 문구만 삭제(`git diff` 상
  1줄 교체). `developer` 의 `spec/` read-only 원칙과 문자상 경계에 있으나, ① 직전 커밋
  (`779a6e240`)이 이 편집의 근거("구현이 바뀌는 커밋과 원자적으로 지워지지 않으면 spec 이
  거짓이 된다")를 명시했고 ② 동일 narrow exception 이 이 저장소에 선례가 있으며 ③ 이번
  changeset 자체가 그 편집을 `spec-draft-eia-r8-alignment.md` 에 사후 기록해 planner 인지
  간극을 닫았다(위 항목). 새 제품 결정이 아니라 "현재 구현이 이렇다"는 서술을 실제 상태에
  동기화한 기계적 편집이다.
- **`review/code/2026/08/12/{16_29_45,16_53_26,17_07_45,18_07_36}/**` (43개 신규 파일) +
  `review/consistency/2026/08/12/18_27_29/**` (9개 신규 파일)**: `git show --stat` 으로 각
  라운드 산출물이 해당 라운드의 fix 커밋에 1:1 동봉되어 있음을 확인(`fcdf40194`→`16_29_45`,
  `384815fe6`→`16_53_26`, `ac8dd03ee`→`17_07_45`, `0f7907ec4`/`147075a51`→`18_07_36`,
  `02e80d699`→consistency). CLAUDE.md 의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제
  의무" 규약과 `review/code/**`·`review/consistency/**` 산출물 저장 규약에 정확히 부합하는
  표준 워크플로 산출물이며, 이 diff 특유의 드라이브바이가 아니다. 사람이 유지보수하는 소스가
  아니라 리뷰 시점의 이력 기록이라 통상적 스코프 판단 대상도 아니다.

### 포맷팅 · 임포트 · 설정

- import 변경은 `HttpException`(nestjs/common), `throwError`(rxjs), `Redis`(ioredis, e2e),
  테스트 쪽 `BadRequestException`/`GoneException`/`InternalServerErrorException`/
  `NotFoundException`(nestjs/common) 뿐 — 전부 재설계·회귀 테스트에 직접 필요한 심볼이고
  미사용 임포트나 드라이브바이 정리는 없다.
- 순수 포맷팅-only 변경 없음. 설정 파일(`.env.example`, `package.json`, lint config, CI
  워크플로 등) 변경 없음 — `git diff --stat origin/main...HEAD` 61개 파일 전량에 해당 파일
  없음을 확인.

## 요약

`git log`/`git diff` 로 origin/main 대비 실제 7개 커밋·61개 파일 전량을 직접 대조한 결과,
소스 1(`idempotency.interceptor.ts`)·테스트 2(`idempotency.interceptor.spec.ts`,
`external-interaction.e2e-spec.ts`)·CHANGELOG·plan 추적 2·spec SoT 1 — 실질 파일 7개 전부가
"idempotency 캐시가 Spec EIA §R8 의 닫힌 목록(2xx/409/410)과 어긋나던 선재 결함을, dead-code
재설계와 4차례의 자매-케이스 누락 보강까지 포함해 완전히 고친다"는 단일 의도에 정확히
대응한다. 나머지 52개 파일은 developer 의 드라이브바이 추가가 아니라 이 changeset 자체를
대상으로 5차례 실행된 리뷰/일관성 서브에이전트의 산출물이 각 라운드 fix 커밋에 동봉된
표준 워크플로 결과다. 무관한 리팩토링·기능 확장(over-engineering)·드라이브바이 파일 수정·
의미 없는 포맷팅·불필요한 주석/임포트 변경·의도치 않은 설정 변경은 발견되지 않았다.
`spec/data-flow/15` 의 developer 편집은 문자상 권한 경계에 있으나 근거·선례·사후 planner
기록이 모두 갖춰져 있어 이번 diff 가 새로 도입한 스코프 확장이 아니다.

## 위험도

NONE
