# 문서화(Documentation) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`), 3라운드 누적 diff

## 배경

이번 diff 는 원 변경 커밋(`adc4a3ff6`) + 1라운드(`20_27_29`) fix + 2라운드(`20_43_35`) fix + 두
라운드의 리뷰 산출물 22개 파일(신규 커밋)의 누적이다. 2라운드에서 `collectBoundCodes` 스캔을
"생성자 positional 인자"(5번째 형태)까지 넓히고 `ANCHORED_ELSEWHERE` 에 `RESUME_CHECKPOINT_MISSING`
/ `RESUME_INCOMPATIBLE_STATE` 두 항목을 추가하는 실질 코드 변경이 있었다. 이번 라운드는
**그 코드 변경이 상위 산문 문서(JSDoc·CHANGELOG·plan)에 정확히 반영됐는가**를 실측으로 검증했다.

## 검증 방법 (실제 실행/파싱, 저장소 뮤테이션 없음)

- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` 를 `Read` 로 직접
  열람(diff 가 프롬프트에서 생략된 파일이라 소스를 직접 확인).
- `ANCHORED_ELSEWHERE` 를 **TypeScript AST 로 직접 파싱**(손 계산 대신 실행 — `node -e` 로
  `ts.createSourceFile` 사용, `codebase/backend` 안에서 실행)해 8개 항목·각 `reason.length` 를
  실측: `64, 67, 67, 68, 68, 68, 68, 83`.
- `grep -c`/`grep -n` 으로 `engine-error-code-anchor.spec.ts` 의 `it()`/`it.each` 개수를 세어
  최종 테스트 수(14) 확인.
- `error-codes.ts`/`CHANGELOG.md` 의 관련 문단을 `Read` 로 재확인.

## 발견사항

- **[WARNING]** `EngineErrorCode` JSDoc 의 "여기 있는 것 / 없는 것" 열거가 실제
  `ANCHORED_ELSEWHERE` 레지스트리보다 한 카테고리 적다 — 2라운드에서 추가된
  `RehydrationError` 생성자 인자 그룹이 빠졌다
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts:132-135`
  - 상세: 132행은 *"반면 아래 **둘**은 이미 타입 앵커가 있어 옮기지 않았다"* 라 쓰고, 133~135행이
    그 둘을 나열한다 — ① 에러 클래스 `readonly code`(`INVALID_EXECUTION_STATE`/`ERROR_PORT_FALLBACK`),
    ② `TriggerParameterErrorDetail['code']` 유니온(trigger 파라미터 검증 4종). 그런데 실제
    `ANCHORED_ELSEWHERE`(`engine-error-code-anchor-guard.ts:30-53`, 직접 열람·확인)에는
    **세 번째 카테고리**가 존재한다 — `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`
    (`ai-conversation-helpers.ts` `RehydrationError.code` 리터럴 유니온, 생성자 positional 인자).
    이 두 항목은 2라운드 fix(리뷰 `20_43_35` W1 — "문서한 보장이 구현보다 넓었다")에서 신규
    추가된 것으로, 같은 JSDoc 블록의 **바로 다음 문단**(137~141행)은 이 fix 를 정확히 인용해
    "다섯 형태"·"리뷰 `20_43_35` W1" 이라 적고 있다 — 즉 **같은 docstring 안에서 아래 문단은
    2라운드 fix 를 알고 있는데 위 bullet list 는 그 fix 이전 상태("둘")에 멈춰 있다.** 다음
    사람이 "왜 `RESUME_CHECKPOINT_MISSING` 은 `EngineErrorCode` 에 없는가" 를 이 JSDoc 만 보고
    판단하면 답을 못 찾는다.
  - 제안: 133~135행 사이에 세 번째 bullet 추가
    (`RehydrationError.code` 생성자 positional 인자 — `RESUME_CHECKPOINT_MISSING`/
    `RESUME_INCOMPATIBLE_STATE`) 하고 "아래 둘" → "아래 셋" 으로 정정.

- **[WARNING]** `CHANGELOG.md` 의 "옮기지 않은 것도 있다" 단락도 동일하게 두 카테고리만
  나열해 `RESUME_*`/`RehydrationError` 그룹이 빠져 있다
  - 위치: `CHANGELOG.md:20-24`
  - 상세: 위 항목과 근본 원인이 같다 — 이 단락은 원 커밋(`adc4a3ff6`) 시점에 작성된 채 2라운드
    fix 이후 갱신되지 않았다. `ANCHORED_ELSEWHERE` 를 "이미 타입 앵커가 있다" 는 근거로
    **완결된 목록**처럼 서술("`INVALID_EXECUTION_STATE`·`ERROR_PORT_FALLBACK`… 와 trigger
    파라미터 검증 4종")하는데 실제로는 세 번째 그룹이 존재한다. 이 저장소는 가드/하드닝성
    변경도 `CHANGELOG.md` 에 정확히 기록하는 확립된 관례가 있고(1라운드 W1 이 바로 이 관례를
    근거로 지적됐다), 2라운드 fix 는 "형태 공간이 열려 있어 6번째(평범한 메서드 인자) 형태에서
    멈췄다" 는 별도의 유의미한 설계 결정까지 포함하는데 `CHANGELOG` 에는 이 결정이 전혀
    반영되지 않았다.
  - 제안: `CHANGELOG.md` 항목에 2라운드 fix(생성자 인자 스캔 확장, `RESUME_*` 앵커 추가,
    "6번째 형태에서 멈춘" 경계 결정)를 반영하는 문단을 추가하거나, 최소한 "옮기지 않은 것"
    목록에 세 번째 그룹을 보강한다.

- **[INFO]** 가드 spec 주석의 예시 수치("가장 짧은 것이 45 자")가 실측과 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts:140`
  - 상세: `expect(reason.length).toBeGreaterThan(20)` 옆 주석이 *"(실제 항목 중 가장 짧은 것이
    45 자)"* 라 적혀 있다. `ANCHORED_ELSEWHERE` 8개 항목을 AST 로 직접 파싱해 `reason.length`
    를 실측하면 `[64, 67, 67, 68, 68, 68, 68, 83]` 로, **가장 짧은 값은 45 가 아니라 64**
    (`ERROR_PORT_FALLBACK`)다. 테스트 자체는 `> 20` 이라 실측 64 로도 여전히 GREEN 이고 결론
    ("여유가 있다")도 더 강하게 참이지만, 주석에 박힌 구체적 숫자 자체가 틀렸다 — 이 저장소
    메모리에 기록된 "실측 근거는 검증 가능한 주장이고 틀린 근거가 다음 사람의 판단 기준을
    바꾼다" 유형의 소소하지만 실재하는 사례다.
  - 제안: "45 자" → "64 자"(또는 "20자보다 충분히 길다" 로 구체 수치 제거)로 정정. 우선순위 낮음
    — 테스트 통과 여부에 영향 없음.

- **[INFO]** `plan/complete/exec-intake-followups.md` 의 "완료" 서술이 인용하는 테스트 개수가
  최종 상태보다 적다
  - 위치: `plan/complete/exec-intake-followups.md:58`
  - 상세: *"뮤테이션 (예측 / 실측), 테스트 11건"* 이라 적혀 있으나, 이 plan 항목이 참조하는
    `engine-error-code-anchor.spec.ts` 는 (2라운드 fix 까지 포함된) 최종 상태 기준
    **14개 테스트**다(`grep`/직접 열람으로 개별 `it()` 7개 + `it.each` 5케이스 + positive-path·
    죽은-항목 등 나머지 2개 = 14, 2라운드 RESOLUTION.md 자체도 "가드 spec 14/14" 라 기록).
    "11건" 은 원 커밋 시점(2라운드 fix 이전)의 개수로 보이며, plan 의 "완료" 기록이 이후 라운드의
    fix 를 소급 반영하지 않았다. CHANGELOG/JSDoc 만큼 사용자 대면은 아니지만, 이 plan 문서는
    이 작업 항목의 **단일 완료 기록**이라 최종 실측과 다른 숫자가 남는 것은 향후 "그때 정말
    11개였나 14개였나" 를 역산하게 만든다.
  - 제안: "테스트 11건" → "테스트 14건"(2라운드 fix 반영)으로 갱신하거나, "1라운드 기준 11건,
    2라운드 fix 로 14건" 처럼 라운드별로 명시.

## 확인된 사항 (참고용 — 결함 아님)

- **README/API 문서/환경변수 문서**: 이번 변경은 순수 내부 리팩터(문자열 값 불변, API 계약·
  런타임 동작 무변경, 신규 env var/설정 없음)라 해당 없음 — grep 으로 `README*.md` 중
  `ErrorCode`/`error-codes` 참조 파일을 확인했으나 무관한 패키지(`expression-engine`,
  `masked-markers`)뿐이었다.
- `spec/conventions/error-codes.md` §1 "적용 범위" 는 이미 `error-codes.ts` 전체(어느 const 에
  있든)에 적용되도록 넓게 쓰여 있어 `EngineErrorCode` 신설 자체는 그 문서의 정정을 요구하지
  않는다.
- 위 발견사항 3·4 를 제외하면, 나머지 신규 JSDoc/주석(`EngineErrorCode` 필드별 doc, 가드
  파일의 "왜 AST 인가"·"왜 이 다섯 형태에서 멈추는가" 서술, SoT 링크)은 실제 코드·과거 리뷰
  라운드 기록과 전부 일치함을 직접 열람으로 재확인했다.
- 리뷰 산출물 22개 파일(`review/code/2026/08/31/{20_27_29,20_43_35}/**`)이 커밋된 것은 이
  저장소의 정착된 관례(`review/` 는 gitignore 대상 아님)에 부합하며 새로운 문서화 결함이 아니다.

## 요약

코드 자체(9지점 리다이렉트, `EngineErrorCode` 신설, AST 가드)의 문서화 밀도는 여전히 높지만,
**2라운드 fix(생성자 인자 스캔 확장 + `RESUME_*` 앵커 추가)가 상위 산문 문서 두 곳
(`error-codes.ts` JSDoc, `CHANGELOG.md`)에 역전파되지 않아 두 곳 모두 "옮기지 않은 것" 목록이
실제보다 한 카테고리 적게 서술**돼 있다 — 특히 `error-codes.ts` 는 같은 JSDoc 블록 안에서
아래 문단(2라운드 fix 를 정확히 인용)과 위 bullet list(2라운드 이전 상태)가 서로 어긋나는
자기모순 상태다. 이 외에 가드 spec 주석의 예시 수치 하나와 plan 완료 기록의 테스트 개수 하나가
실측과 어긋나 있으나 둘 다 결론 자체를 뒤집지는 않는 INFO 급이다.

## 위험도

LOW
