# 테스트(Testing) 리뷰 — error-codes-layer-split (2라운드, `20_27_29` RESOLUTION 이후 재검토)

## 리뷰 범위 요약

이번 diff 는 직전 라운드(`20_27_29`)의 RESOLUTION 반영분을 포함한다.

1. **기계적 리팩터**: `execution-engine.service.ts`(`markWebChatIdleTimeout`/`markQueueWaitTimeout`/
   `stalledError`) · `shutdown-state.service.ts`(`markRemainingAsInterrupted` ×2) ·
   `ai-turn-orchestrator.service.ts`(`classifyLlmError` 계열)에서 맨 문자열 에러 코드를
   `EngineErrorCode`/`ErrorCode` 상수 참조로 교체. 값 불변, 순수 anchor 교체.
2. **신규 정적 가드 3파일**(`repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}`).
3. **RESOLUTION 반영**: (a) `CHANGELOG.md` 항목 추가, (b) `findUnanchored` positive-path 테스트 신규
   추가(`relDir` 파라미터로 픽스처를 겨냥), (c) 픽스처의 불필요한 `eslint-disable` 제거.
4. 직전 라운드 review 산출물(`review/code/2026/08/31/20_27_29/*`) 자체가 이번 diff 에 신규 파일로
   포함돼 있음 — 코드가 아니라 리뷰 아카이브라 테스트 관점 평가 대상이 아니다.

## 검증 (직접 실행, read-only)

```
npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts     → 12 passed (직전 라운드 11 → 12, positive-path 1건 순증)
npx eslint <가드 3파일> --max-warnings 0                                  → 0 경고 (W1 라운드에서 지적된 CI 브레이커 해소 확인)
```

**뮤테이션으로 positive-path 테스트의 실효성을 직접 확인했다** — `findUnanchored` 내부에서
`collectBoundCodes(repoRoot, relDir)` 의 `relDir` 인자를 `undefined` 로 하드코딩하는 뮤턴트를
scratch 사본으로 만들어 적용한 뒤(원본은 `cp` 로 저장 → 뮤테이션 → 재실행 → `cp` 로 즉시 원복,
`git status --short` 로 클린 확인) 재실행하니 `[positive path] 앵커 없는 코드를 실제로 검출한다`
가 `Array []` vs 기대 `[FIXTURE_*, ...]` 로 정확히 RED 났다(11 passed / 1 failed). 직전 라운드
testing 리뷰가 지적한 "`findUnanchored` 의 위반-검출 경로가 저장소가 우연히 클린해서만 통과할
수도 있다"는 갭이 이 라운드에서 **설계상 확실히 닫혔음을 실측**으로 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 리팩터 대상 3서비스의 기존 회귀 테스트는 여전히 맨 문자열로 코드 값을 단언한다
  (예: `ai-turn-orchestrator.service.spec.ts:983` `expect(result.code).toBe('LLM_RATE_LIMIT')`,
  `execution-engine.service.spec.ts:9392` `expect(passedPayload?.code).toBe('LLM_RATE_LIMIT')`).
  - 상세: 직전 라운드에서 이미 지적됐고 `RESOLUTION.md` "미조치 (사유)" 표에 "값이 동일해 오늘은
    안전하고, 테스트를 상수 참조로 바꾸면 테스트가 구현과 같은 상수를 보게 되어 리네임 회귀를
    오히려 못 잡는다"는 근거로 **의도적으로 미조치** 처리됨. grep 으로 직접 재확인했고 여전히
    유효 — 값이 동일한 한 회귀는 안전(위 검증에서 가드 spec 자체는 GREEN). 이 근거는
    타당하다 — `code` 리터럴 대신 `EngineErrorCode.LLM_RATE_LIMIT` 을 assertion 에 쓰면 구현이
    잘못된 상수를 참조해도 assertion 이 같은 잘못된 값을 보게 돼 오히려 독립 검증력을 잃는다.
  - 새 결함으로 재상정하지 않음 — 근거가 반증되지 않았고 라운드 간 stale 재지적을 피하기 위해
    기록만 남긴다.
  - 위치: 신규 결함 아님 (참고 기록).

## 8개 관점 요약

1. 테스트 존재 여부 — 신규 가드 3파일(guard/fixture/spec)로 충분히 커버됨.
2. 커버리지 갭 — 직전 라운드 유일한 갭(`findUnanchored` positive-path)이 이번 라운드에 메워졌고
   뮤테이션으로 실효성 확인.
3. 엣지 케이스 — UPPER_SNAKE 아님/바인딩 이름 다름 대조군, 예외 목록 사유 길이·dead-entry 검증
   전부 커버.
4. Mock 적절성 — mock 미사용, 실제 fs/AST 를 읽는 repo-guard 성격에 적절.
5. 테스트 격리 — 각 `it` 는 read-only 파일시스템 접근만 하며 상호 의존 없음. 독립 실행 가능.
6. 가독성 — 각 테스트가 "왜 이렇게 설계했는가"(자멸 방지, vacuous 방지)를 주석으로 설명 — 우수.
7. 회귀 테스트 — 리다이렉트 대상 3서비스 spec 은 무변경이나 값 동일성으로 유효함을 실측 확인.
8. 테스트 용이성 — `collectBoundCodes`/`findUnanchored` 둘 다 `relDir` 파라미터를 열어 픽스처를
   주입할 수 있게 설계 — 테스트 용이성 관점에서 모범적.

## 요약

직전 라운드(`20_27_29`) testing 리뷰가 지적한 유일한 INFO(`findUnanchored` positive-path 미검증)
가 이번 라운드에 정확히 반영됐고, `relDir` 인자를 무력화하는 뮤테이션으로 새 테스트가 실제로 그
경로를 검증함을 직접 확인했다. CI 브레이커였던 불필요 `eslint-disable` 도 제거됨을
`eslint --max-warnings 0` 재실행으로 확인. 남은 것은 "기존 3서비스 spec 이 여전히 맨 문자열을
단언한다"는 단일 INFO 뿐이며, 이는 직전 라운드에서 이미 검토되어 타당한 근거로 의도적 미조치
처리된 항목이라 재상정하지 않는다. 새로운 결함 없음.

## 위험도

NONE
