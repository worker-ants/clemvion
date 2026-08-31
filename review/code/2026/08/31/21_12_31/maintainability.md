# 유지보수성(Maintainability) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`)

## 대상 요약

`error-codes.ts` 에 엔진 레이어 전용 `EngineErrorCode` const 를 신설하고, 맨 문자열이던 9개
지점(`ai-turn-orchestrator.service.ts` 4곳, `execution-engine.service.ts` 3곳,
`shutdown-state.service.ts` 2곳)을 `ErrorCode.*`/`EngineErrorCode.*` 참조로 리다이렉트했다.
재발 방지용 AST 기반 가드 3파일(`engine-error-code-anchor-guard.ts` + fixture + spec)이 신규
추가됐고, `CHANGELOG.md`·plan 문서(`exec-intake-followups.md` in-progress→complete 이동)가
동반 갱신됐다. 이번 diff 에는 이 작업의 세 리뷰 라운드(`20_27_29`/`20_43_35`/`20_59_14`)
산출물(SUMMARY/RESOLUTION/에이전트별 리포트)도 신규 파일로 함께 포함돼 있다 — 이는 생성된
검토 기록이라 코드 유지보수성 관점의 대상은 아니며, 본 리뷰는 실제 소스(파일 1~10)에 집중한다.

## 검증 방법

- `Read` 로 `error-codes.ts`, `engine-error-code-anchor-guard.ts`, `engine-error-code-anchor.spec.ts`
  전체를 직접 열어 diff 가 잘린 부분(가드/spec 파일)을 포함해 현재 소스 그대로 확인했다.
- 세 선행 라운드의 maintainability 리포트 + 각 RESOLUTION 을 먼저 읽고, 이미 지적·처분된 항목과
  신규 항목을 구분했다 — 특히 `20_59_14` 라운드가 `collectBoundCodes` 의 `record()` 우회 중복을
  이미 지적했고 "3번째 소비처가 생기면 착수" 근거로 의도적으로 미조치 처리한 상태다.
- 저장소 트리는 뮤테이션하지 않았다(읽기 전용).

## 발견사항

- **[INFO]** `ANCHORED_ELSEWHERE` 안에서 사유(reason) 문자열이 각각 4회·2회 완전히 동일하게
  반복된다 — 신규 발견(선행 3라운드 어디에서도 지적되지 않음)
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:38-45`
    (`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`
    네 항목이 전부 `"trigger-parameter.types.ts \`TriggerParameterErrorDetail['code']\` 유니온"`
    문자열을 그대로 반복), `:49-52`(`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 두
    항목이 `'ai-conversation-helpers.ts \`RehydrationError.code\` 리터럴 유니온 (생성자 인자)'`
    를 그대로 반복)
  - 상세: 같은 파일이 매직 넘버·중복 문서화 회피에 상당히 신경 쓴 것과 대조적으로, `Record<string,
    string>` 리터럴 안의 사유 문자열 자체는 손으로 4번/2번 복붙돼 있다. 한 그룹의 근거 서술을
    수정할 때(예: `trigger-parameter.types.ts` 가 파일을 옮기거나 유니온 이름이 바뀔 때) 4곳 중
    한두 곳만 고치고 나머지를 놓치면, `findUnanchored`/dead-entry 테스트는 이 drift 를 잡지
    못한다 — 사유 문자열의 *내용 일치*를 검증하는 테스트는 없고, 오직 `reason.length > 20` 과
    `dead entry` 여부만 본다.
  - 제안: 그룹별 사유를 상수로 한 번만 선언해 재사용한다. 예:
    ```ts
    const TRIGGER_PARAM_DETAIL_CODE_UNION =
      "trigger-parameter.types.ts `TriggerParameterErrorDetail['code']` 유니온";
    const REHYDRATION_ERROR_CODE_CTOR_ARG =
      'ai-conversation-helpers.ts `RehydrationError.code` 리터럴 유니온 (생성자 인자)';
    ```
    우선순위는 낮다 — 가드 전용 메타데이터이고 현재 값이 서로 어긋나 있지는 않다.

- **[INFO]** (재확인, 기존 처분 유지 — 상태 변화 없음) `collectBoundCodes` 안에서 hit 기록 로직이
  `record()` 클로저를 거치는 경로와 `NewExpression`(생성자 인자) 분기가 거치지 않고 동일 로직을
  복사한 경로 두 곳에 남아 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:174-183`
    (`record()` 정의부의 `hits.push({ code: literal.text, file: …, line: … })`)와
    `:197-210`(`NewExpression` 분기의 `hits.push({ code: arg.text, file: …, line: … })`) — 변수명만
    다르고 `hits.push({ code, file, line })` 구성식이 동일하다.
  - 상세: `20_59_14` 라운드 maintainability 리뷰가 이미 지적했고, 해당 RESOLUTION 이 "3번째
    소비처가 생기는 시점이 착수 지점"이라는 근거로 명시적으로 미조치 처리했다. 이번 라운드까지
    소비처는 여전히 2곳(`record()` 경로 3형태 + 생성자 인자 1형태)뿐이라 그 트리거 조건이 아직
    충족되지 않는다 — 새 지적이 아니라 기존 유예가 여전히 유효함을 재확인한 기록이다.
  - 제안: 조치 불요(기존 판단 유지). `pushHit(literal): void` 로 push 로직만 분리해 `record()` 와
    `NewExpression` 분기가 공유하는 방향은 여전히 유효한 후속 후보다.

이 외 CRITICAL/WARNING 급 발견은 없다. 확인한 긍정적 포인트:

- 서비스 3파일(`ai-turn-orchestrator`/`execution-engine`/`shutdown-state`)의 실제 변경은 모두
  `'LITERAL'` → `ErrorCode.X`/`EngineErrorCode.X` 한 줄 치환이며, 값이 byte-identical 하고 함수
  길이·중첩·복잡도에 전혀 영향이 없다.
- `EngineErrorCode` 신설 JSDoc(`error-codes.ts:116-146`)이 "왜 파일을 안 나눴는가"(SoT 분열
  방지)와 "왜 const 는 나눴는가"(기존 `ErrorCode` docstring 계약 범위 준수)를 근거와 함께 남겨,
  같은 질문이 반복되지 않도록 했다. 네이밍(`EngineErrorCode`/`EngineErrorCodeValue`)도 기존
  `ErrorCode`/`ErrorCodeValue` 컨벤션(UPPER_SNAKE 값, `as const`, `*Value` 파생 타입)을 그대로
  계승해 일관성이 높다.
- `collectBoundCodes` 의 `visit` 함수는 4개 AST 노드 종류를 분기하는 dispatcher 라 분기 수는
  있지만 각 분기가 짧고 독립적이며, JSDoc 이 "여기서 형태 넓히기를 멈춘 이유"(형태 공간이
  열려 있음, 타입이 이미 붙잡는 자리는 그 타입이 맡음)를 명시해 다음 사람이 같은 확장 시도를
  반복하지 않도록 경계를 남겼다.
- 매직 넘버(`declared.size > 30`, `reason.length > 20`)는 왜 그 값인지 실측치(`ErrorCode` 36 +
  `EngineErrorCode` 4 = 40, 가장 짧은 사유가 64자)와 함께 인라인 주석으로 근거가 남아 있다.
- `ANCHORED_ELSEWHERE` 는 사유 길이(>20자)·코드 형식·dead-entry 검증 테스트로 "봐주기" 도피처가
  되지 않도록 구조적으로 강제한다.
- 신규 가드 3파일(guard/fixture/spec) 구성이 저장소 기존 형제 패턴(`redis-fail-open-catalog-guard.ts`)
  을 그대로 따라 컨벤션 일관성이 높다.

## 요약

이번 diff 는 엔진 레벨 맨 문자열 에러 코드 9곳을 상수 참조로 리다이렉트하는 순수 기계적 치환과,
재발 방지용 AST 가드 신설로 구성돼 가독성·함수 길이·중첩·복잡도 어느 축에서도 새로운 위험이
없다. 새로 발견한 것은 `ANCHORED_ELSEWHERE` 사유 문자열의 4회/2회 리터럴 중복(신규, INFO)
하나뿐이며, 선행 라운드가 지적한 `record()`/생성자-인자 분기 중복은 상태 변화 없이 여전히
의도적으로 유예된 상태임을 재확인했다. 둘 다 가드/테스트 전용 코드의 지엽적 중복이라 실제
유지보수 비용에 미치는 영향은 작다. `EngineErrorCode` JSDoc·가드 docstring 은 설계 근거와
경계를 상세히 남겨 다음 사람의 판단 비용을 낮춘다.

## 위험도

NONE
