# 요구사항(Requirement) Review

## 검증 방법

프롬프트에 실린 diff/컨텍스트 외에, 잘린 파일(`error-codes.ts`, `execution-engine.service.ts`,
`ai-turn-orchestrator.service.ts`, `shutdown-state.service.ts`, `ai-conversation-helpers.ts`)은
`Read`로 저장소에서 직접 열어 대조했다. `codebase/backend`에서 다음을 실행했다(모두 read-only,
저장소 트리에 아무것도 쓰지 않음):

- `npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` → **12/12 통과**
- `npx tsc --noEmit -p tsconfig.json` → 변경 대상 파일(`error-codes.ts`·`execution-engine.service.ts`·
  `ai-turn-orchestrator.service.ts`·`shutdown-state.service.ts`·신규 guard 3파일)은 에러 0.
  (프로젝트 전체 tsc는 `carousel/chart/table` presentation 노드 spec 및
  `ai-turn-orchestrator.service.spec.ts`에서 무관한 기존 타입 에러를 냈으나, 이번 diff가 건드린
  파일과는 무관한 영역이라 이번 변경으로 인한 회귀가 아님)
- `grep`으로 `execution-engine` 모듈 전체를 스캔해 `code:`/`errorCode:` UPPER_SNAKE 바인딩이
  `ANCHORED_ELSEWHERE` 6개 항목과 신규 `EngineErrorCode` 4개 외에 잔존하지 않음을 확인
- `node`로 AST를 직접 파싱해 `ErrorCode`(36) + `EngineErrorCode`(4) = 40을 실측, 가드 spec의
  하한 `toBeGreaterThan(30)` 근거와 일치함을 확인

## 발견사항

- **[WARNING]** 가드의 "새 맨 문자열 코드가 생기면 RED" 완결성 주장이 실제 스캔 형태보다 넓다 —
  생성자/함수 **positional 인자**로 전달되는 코드는 탐지 범위 밖이며, 이 경계에 걸리는 실사례가
  이미 존재한다(`RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE`).
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts:137-138` (EngineErrorCode JSDoc —
    "형제 가드 … 가 이 구분을 강제한다 — 엔진 모듈에 새 맨 문자열 코드가 생기면 RED.");
    `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` 의
    `collectBoundCodes`(함수 전체) — `PropertyAssignment`/`VariableDeclaration`/
    `PropertyDeclaration`/대입(`BinaryExpression EqualsToken`) 4형태만 방문하고
    `CallExpression`(생성자·함수 호출 인자)은 방문하지 않음;
    실사례는 `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts:38-49`
    (`RehydrationError` 생성자의 `public readonly code: 'RESUME_CHECKPOINT_MISSING' | 'RESUME_FAILED' |
    'RESUME_INCOMPATIBLE_STATE'`)와 `execution-engine.service.ts`의 다수 `throw new
    RehydrationError('RESUME_CHECKPOINT_MISSING', …)` 호출부(예: 1354·1386·1405·1414·2061·2189 등,
    `new RehydrationError(...)`의 첫 인자로 바인딩).
  - 상세: `spec/1-data-model.md`(`error` 필드 설명)는 `SERVER_INTERRUPTED`·`WORKER_HEARTBEAT_TIMEOUT`·
    `EXECUTION_TIME_LIMIT_EXCEEDED`와 **같은 문장에서** `RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/
    `RESUME_INCOMPATIBLE_STATE`를 "엔진 인프라 차원의 코드"로 나열한다 — 즉 이 PR이 "맨 문자열이라
    앵커가 없었다"고 지목한 코드들과 **동일 카테고리**다. 다만 이 셋은 현재 `RehydrationError.code`
    생성자 파라미터 프로퍼티(리터럴 유니온 타입)로 이미 타입 앵커가 있어 `tsc`가 오탈자를 막고
    있으므로 오늘 당장 회귀는 아니다. 문제는 (1) `EngineErrorCode` JSDoc의 "여기 있는 것 / 없는 것"
    서술과 가드의 `ANCHORED_ELSEWHERE`(사유 등재 규약)가 정확히 `INVALID_EXECUTION_STATE`·
    `ERROR_PORT_FALLBACK`(클래스 필드)과 trigger 4종(유니온)만 "이미 타입 앵커가 있다"고 인정하면서
    같은 패턴인 `RehydrationError.code`는 전혀 언급하지 않아 감사 서술이 불완전하고, (2) 가드
    자체가 "값이 `code:`/`errorCode:` 식별자에 바인딩되는 4형태"만 보므로 향후 `RehydrationError.code`
    타입이 `string`으로 느슨해지거나 유사한 생성자 인자 패턴의 새 엔진 에러 클래스가 추가되면
    그 코드는 가드가 **조용히 놓친다** — 이 PR이 원래 반증한 "값이 이미 알려져 있으면 통과시키는
    구형 판정"과 같은 종류의 사각지대가 판정 형태를 바꿔도 여전히 남아 있다.
  - 제안: (a) `EngineErrorCode` JSDoc과 `ANCHORED_ELSEWHERE`(또는 새 레지스트리)에 `RehydrationError.code`
    생성자 파라미터 프로퍼티도 "이미 타입 앵커가 있음"으로 명시 등재해 감사를 완결시키거나,
    (b) 가드의 스캔 대상을 알려진 타입-앵커 에러 클래스의 생성자 호출까지 확장해 실질적 사각지대를
    좁힌다. 최소한 가드/JSDoc의 "새 맨 문자열 코드가 생기면 RED" 문구를 "4가지 식별자 바인딩 형태에
    한해"로 스코프를 명시해 완결성 주장을 실제 구현과 맞춘다.

## 요약

핵심 변경(엔진 레벨 에러 코드 9지점을 맨 문자열에서 `EngineErrorCode`/`ErrorCode` 상수 참조로
리다이렉트 + 신규 `EngineErrorCode` const 4종 + AST 기반 앵커 회귀 가드)은 실제 코드·spec
(`spec/conventions/error-codes.md §3`, `spec/1-data-model.md` error 필드, `spec/5-system/4-execution-engine.md`
§7.1/§8/§11)과 line-level로 정확히 일치하며, `ErrorCode`/`EngineErrorCode` 분리 근거(같은 파일 내
docstring 범위 충돌 회피 + SoT 유지)도 실측(코드:` 리터럴 201개 중 대다수가 API 예외 코드)과 부합한다.
가드 로직을 AST로 직접 실행해 12/12 통과, 엔진 모듈 전수 grep으로 `ANCHORED_ELSEWHERE` 6개 예외 외
잔존 맨 문자열이 없음을 확인했고, 변경 대상 파일의 `tsc --noEmit`도 0 에러였다. 유일한 발견사항은
가드의 완결성 주장(생성자 인자로 전달되는 코드는 탐지 밖)이 실제 스캔 형태보다 넓다는 점이며, 오늘
당장의 기능 결함은 아니고(현재 `RehydrationError.code`가 리터럴 유니온으로 타입 보호됨) 향후 유사
패턴이 늘어날 때의 잠재적 사각지대이므로 WARNING으로 분류했다. TODO/FIXME 등 미완성 표식은 없고,
모든 반환 경로·에러 시나리오·엣지 케이스(빈 declared set, 파서 실패 시 전수 위반으로 뒤집히는 설계)
가 의도대로 구현돼 있다.

## 위험도
LOW
