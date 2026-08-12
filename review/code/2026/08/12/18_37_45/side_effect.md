# 부작용(Side Effect) Review — EIA §R8 idempotency 캐시 스코프 (5차 라운드, 누적 확인)

## 검토 방법

프롬프트 diff 는 4차례 선행 코드리뷰(`16_29_45`→`18_07_36`) + 1차례 consistency-check(`18_27_29`)
산출물이 함께 커밋돼 크게 부풀어 있다. 실질 런타임 표면은 `codebase/backend/src/modules/
external-interaction/idempotency.interceptor.ts`(+`.spec.ts`) 와 `codebase/backend/test/
external-interaction.e2e-spec.ts` 3개 파일뿐이라, `git log --oneline origin/main..HEAD` 로
7개 커밋을 확인하고 직전 side_effect 라운드(`18_07_36`, 커밋 `147075a51` 시점)가 검토를 마친
지점 이후 실제로 무엇이 바뀌었는지 `git diff 147075a51 HEAD --stat` 로 대조했다. 그 결과 이후
1개 커밋(`02e80d699`)뿐이며, 변경 파일은 `plan/in-progress/spec-draft-eia-r8-alignment.md`
9줄 추가와 `review/consistency/2026/08/12/18_27_29/**` 신규 파일 8개뿐 — **런타임 코드 변경은
0건**이다. 따라서 3개 소스/테스트 파일은 `Read` 로 직접 최종 상태를 열어 처음부터 다시
확인했다.

## 발견사항

- **[INFO]** 직전 라운드(`18_07_36`)가 지적한 갭 — `storeEntry` 의 직렬화-실패 fail-open 경로를
  행사하는 테스트가 없었던 것 — 이 이후 커밋(`147075a51`)에서 실제로 닫혔음을 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:676-718`
    (`'직렬화 불가 payload 여도 원 예외가 그대로 나간다…'`, `'성공 채널에서도 직렬화 불가
    응답이 요청을 죽이지 않는다'`)
  - 상세: 순환 참조 객체(`circular.self = circular`)를 error 채널(`ConflictException`)과 성공
    채널(`tap({next})`) 양쪽에 흘려, `storeEntry`(`idempotency.interceptor.ts:214-233`)의
    `try { … JSON.stringify … } catch { logger.warn; return; }` 가 두 채널 모두에서 원 응답/예외를
    보존하는지 고정한다. 이 방어는 "부수효과(캐시 적재)의 실패가 주효과(응답 전달)를 대체하면
    안 된다"는 불변식을 지키는 코드라, 방어 자체를 검증하는 테스트가 없으면 그 불변식이 조용히
    깨질 수 있었다 — 지금은 양쪽 다 캐너리가 있다.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 함수 시그니처·공개 인터페이스·전역 상태·환경 변수(운영 코드)·파일시스템 변경 없음
  재확인
  - 위치: `idempotency.interceptor.ts` — `intercept(context, next)`(`:88`) 및 생성자(`:77-86`)
    무변경, `cacheTapped`/`storeEntry`/`isErrorStatusCacheable`(`:255-257`) 모두 `private` 또는
    모듈 비공개 함수라 외부 호출자(`interaction.controller.ts:65-66,111-112` 의
    `@UseInterceptors(IdempotencyInterceptor)`)에 영향 없음을 컨트롤러 소스로 직접 재확인.
    새 import(`HttpException`, `throwError`)는 프로젝트 기존 의존성 범위 내.
  - 제안: 없음.

- **[INFO]** 이번 라운드의 유일한 실질 diff(커밋 `02e80d699`)는 `plan/**`·`review/**` 문서
  파일뿐이며 런타임 부작용 표면이 없음
  - 위치: `plan/in-progress/spec-draft-eia-r8-alignment.md` (§2.2 caveat 삭제 편집을 developer
    턴이 planner plan 에 사후 기록), `review/consistency/2026/08/12/18_27_29/**` (consistency
    checker 산출물)
  - 상세: `plan/**` 쓰기는 CLAUDE.md 표상 `developer` 권한 범위 내 정상 추적 갱신이고,
    `review/consistency/**` 는 `/consistency-check` 스킬이 그 소관으로 생성한 산출물이 커밋에
    동봉된 것 — 이 세션의 표준 워크플로 부산물이며 예상 밖의 파일시스템 부작용이 아니다(선행
    scope 리뷰(`16_53_26`/`18_07_36`)가 같은 패턴을 이미 확인).
  - 제안: 없음.

- **[INFO]** (누적 재확인) 캐시 SET 빈도 증가·캐시-히트 시 409/410 을 예외로 재현하는 클라이언트
  관측 가능 인터페이스 변경은 여전히 유효하고 문서화됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:135-140`
    (`isErrorStatusCacheable` true → `throw new HttpException(...)`), `:186-201`(`catchError` 의
    `storeEntry` 호출), `CHANGELOG.md:19-29`("클라이언트 영향" 절, `requestId` 비재현 caveat 포함)
  - 상세: 이는 이번 PR 의 **의도된** 목적(§R8 정합화)이자 4개 선행 라운드가 각각 코드·테스트·
    CHANGELOG·spec(`data-flow/15`) 대조로 이미 검증한 사실이며, 이번 라운드에서 코드 변경이
    없었으므로 상태가 재확인됐을 뿐 새 정보는 아니다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** `storeEntry` 의 Redis `SET` 이 여전히 fire-and-forget(`void this.redis.set(...).catch(...)`) 이라, 응답이 클라이언트에게 반환되는 시점과 캐시 적재가 실제로 완료되는 시점 사이에 이론적 틈이 있음 — 새로 도입된 패턴 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:234-240`
  - 상세: 이 fire-and-forget 자체는 4차 라운드(`18_07_36`) INFO #2 로 이미 "e2e 즉시 조회와의
    이론적 레이스, 실 flaky 미관측 · 조치 불요"로 트리아지됐고, 이번 라운드에서 관련 코드가
    바뀌지 않아 재지적하지 않는다. side_effect 관점에서 "응답 반환 후에도 백그라운드에서 Redis
    쓰기가 계속 진행 중"이라는 사실 자체만 기록해 둔다(로그 관찰 가능성 외 외부 부작용 없음).
  - 제안: 없음(이미 유예 확정).

## 요약

직전 side_effect 라운드(`18_07_36`) 이후 실제로 바뀐 것은 `plan/in-progress/
spec-draft-eia-r8-alignment.md` 9줄과 consistency-check 산출물 8개 파일뿐이며 둘 다 문서/추적
기록이라 런타임 부작용 표면이 없다 — `git diff 147075a51 HEAD --stat` 로 직접 확인했다. 3개
런타임 파일(`idempotency.interceptor.ts`/`.spec.ts`, `external-interaction.e2e-spec.ts`)을
`Read` 로 처음부터 다시 열어 확인한 결과, 함수 시그니처·전역 상태·환경 변수(운영 코드)·
파일시스템에는 변화가 없고, 새 네트워크 연결(e2e 의 `new Redis(...)`)은 이 저장소의 기존
e2e 컨벤션과 동일한 형태다. 직전 라운드가 갭으로 지적했던 "직렬화-실패 fail-open 방어를
검증하는 테스트 부재"는 이후 커밋(`147075a51`)에서 error/성공 두 채널 모두에 대해 실제로
닫혔음을 코드로 재확인했다. 이 diff 전체(누적 7커밋)의 핵심 부작용 — 캐시 SET 이 더 많은
상태코드에서 발생하고, 캐시 히트 시 409/410 을 예외로 재현해 클라이언트가 관측하는 응답이
바뀌는 것 — 은 4차례 선행 라운드에 걸쳐 이미 CHANGELOG·spec·테스트로 충분히 문서화·검증된
**의도된** 변경이며, 이번 라운드는 그 상태를 훼손하지 않았다. 신규 CRITICAL/WARNING 없음.

## 위험도

LOW
