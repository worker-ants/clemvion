# 테스트(Testing) 리뷰 — error-codes-layer-split (3라운드, `20_43_35` RESOLUTION 이후 재검토)

## 리뷰 범위 요약

이번 diff(파일 1~8, 실제 코드/테스트)는 **`20_43_35` 2라운드 RESOLUTION(`eb65d3e6d`) 이후 변경이 없다.**
`git log`로 확인: HEAD 는 여전히 `eb65d3e6d`(2R W1 대응 커밋)이고, 그 이전 `4141c64e3`(1R W1+INFO
3건 대응) · `adc4a3ff6`(최초 구현)까지 3커밋 그대로다. 파일 9~32 는 두 차례 review 산출물
(`review/code/2026/08/31/{20_27_29,20_43_35}/*`)과 plan 이동(`exec-intake-followups.md`)이
새 파일로 diff 에 잡힌 것으로, 테스트 관점 평가 대상인 프로덕션/테스트 코드가 아니다.

핵심 구성은 직전 라운드와 동일:

1. **기계적 리팩터**: `execution-engine.service.ts`/`shutdown-state.service.ts`/
   `ai-turn-orchestrator.service.ts` 의 맨 문자열 에러 코드 9지점 → `EngineErrorCode`/`ErrorCode`
   상수 참조. 값 불변, 순수 anchor 교체.
2. **신규 정적 가드 3파일**(`engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}`) — AST 기반,
   5형태(객체 속성/변수 선언/대입/클래스 필드/`new XxxError(...)` positional 인자) 스캔.

## 검증 (직접 실행, read-only)

```
npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts                    → 14 passed
npx jest .../shutdown-state.service.spec.ts .../ai-turn-orchestrator.service.spec.ts   → 101 passed (2 suites)
git status --short (검증 전/후)                                                          → 본 리뷰 산출물 디렉터리 외 클린
```

가드 spec 테스트 수(14)와 `RESOLUTION.md`(`20_43_35`)의 "가드 spec 14/14" 기재가 일치함을 실측으로
재확인. 코드 변경이 없으므로 새 뮤테이션 실험은 수행하지 않았다 — 직전 라운드(`20_43_35` testing
리뷰)가 `relDir` 무력화 뮤턴트로 positive-path 테스트의 실효성을 이미 RED 로 확인했고, 그 대상
로직(`findUnanchored`/`collectBoundCodes`, `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`
함수 `findUnanchored`/`collectBoundCodes`)은 이번 diff 에서 바이트 단위로 불변이다.

## 발견사항

새 CRITICAL/WARNING/INFO 없음. 과거 두 라운드에서 이미 검토·처분된 항목만 남아 있고, 그 처분이
여전히 유효함을 확인했다.

- **[INFO] (재확인, 조치 불요)** 리팩터 대상 3서비스의 기존 회귀 테스트는 여전히 맨 문자열로 코드
  값을 단언한다 (`ai-turn-orchestrator.service.spec.ts:983` `expect(result.code).toBe('LLM_RATE_LIMIT')` 외).
  - 1라운드(`20_27_29`)에서 최초 지적, `RESOLUTION.md`(`20_27_29`)에서 "값이 동일해 오늘은 안전하고,
    테스트를 상수 참조로 바꾸면 테스트가 구현과 같은 상수를 보게 되어 리네임 회귀를 오히려 못
    잡는다"는 근거로 의도적 미조치. 2라운드(`20_43_35`)에서 재확인, 이번 라운드에도 코드 변경이
    없어 그 근거가 그대로 유효하다. 새 결함으로 재상정하지 않는다.
- **[INFO] (재확인, 완료됨)** `findUnanchored` positive-path 미검증 갭 — 1라운드 지적 → 2라운드에서
  `relDir` 파라미터 개방 + 픽스처 대상 positive-path 테스트 신설로 해소. 이번 라운드에서 해당 함수
  코드가 불변임을 `git log` 로 재확인, 회귀 없음.

## 8개 관점 요약

1. 테스트 존재 여부 — 가드 3파일로 충분히 커버, 변경 없음.
2. 커버리지 갭 — 직전 두 라운드에서 발견된 갭(positive-path, 생성자 positional 인자 형태) 모두
   메워졌고 이번 라운드에서 코드 불변 확인.
3. 엣지 케이스 — UPPER_SNAKE 아님/바인딩 이름 다름/`Error`로 안 끝나는 생성자 대조군, 예외 목록
   사유 길이·dead-entry 검증 전부 유지.
4. Mock 적절성 — mock 미사용, 실제 fs/AST 읽는 repo-guard 성격에 적절 (변경 없음).
5. 테스트 격리 — 각 `it` read-only 파일시스템 접근만, 상호 의존 없음 (변경 없음).
6. 가독성 — 설계 근거(자멸 방지·vacuous 방지·경계를 넓히다 멈춘 이유)가 주석/JSDoc 에 촘촘히 기록
   — 3라운드에 걸쳐 유지·보강됨.
7. 회귀 테스트 — 대상 서비스 3개 spec 무변경, 값 동일성으로 유효함을 이번 라운드에도 실행 확인
   (101 passed).
8. 테스트 용이성 — `collectBoundCodes`/`findUnanchored` 의 `relDir` 파라미터 설계는 변경 없이 유지
   — 모범적.

## 요약

이번 라운드는 코드(파일 1~8) 변경이 전혀 없는 재검토였다 — `git log` 로 HEAD 가 2라운드 종결
커밋(`eb65d3e6d`)과 동일함을 확인했고, diff 에 새로 잡힌 파일들은 이전 두 라운드의 review 산출물과
plan 이동뿐이라 테스트 관점 평가 대상이 아니다. 가드 spec 14/14, 영향받는 서비스 spec 101/101 을
직접 실행해 GREEN 을 재확인했고 저장소는 클린하다. 남은 INFO 1건(기존 서비스 spec 이 여전히 맨
문자열을 단언)은 1·2라운드에서 이미 타당한 근거로 의도적 미조치 처리됐고 이번에도 그 근거가
유효해 재상정하지 않는다. 신규 결함 없음.

## 위험도

NONE
