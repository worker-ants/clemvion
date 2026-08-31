# 부작용(Side Effect) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`)

## 검증 방법

- 저장소 뮤테이션 없이 `Read`/`grep`/`git diff`만 사용. 종료 시 `git status --short` 확인 —
  이번 리뷰 세션 산출 디렉터리(`review/code/2026/08/31/21_12_31/`) 외 변경 없음.
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`,
  `…-anchor.spec.ts` 전문을 직접 열어 확인(프롬프트에서 생략된 두 파일).
- `EngineErrorCode`/`ErrorCode` 신규·기존 값 문자열이 원래 맨 문자열과 byte-identical 한지
  소스 대조로 확인(`LLM_RATE_LIMIT`/`LLM_CALL_FAILED`/`WEBCHAT_IDLE_TIMEOUT`/
  `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`).
- `grep -rn "EngineErrorCode"` 로 신규 export 의 소비처가 정확히 3개 서비스 파일 + 신설 정의
  파일뿐임을 확인, 기존 심볼과 이름 충돌 없음(`ai-turn-orchestrator.service.ts` 의 `ErrorCode`
  import 도 기존 중복 import 없음을 확인).
- `plan/in-progress/exec-intake-followups.md` → `plan/complete/exec-intake-followups.md` 이동이
  `git diff origin/main`에서 `rename from/rename to`(유사도 59%)로 정상 인식됨을 확인 — delete+add
  로 쪼개져 파일 이력이 끊기는 형태가 아님.

## 발견사항

- **[INFO]** 신규 공개 export 표면 추가 (`EngineErrorCode`, `EngineErrorCodeValue`)
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`
  - 상세: 기존 `ErrorCode`/`ErrorCodeValue` 옆에 새 `export const EngineErrorCode = {...} as const`
    와 `export type EngineErrorCodeValue = …`가 추가됐다. 이는 인터페이스 확장(공개 API 표면
    증가)이지만 **순수 additive** — 기존 `ErrorCode`/`ErrorCodeValue`의 이름·값·구조는 전혀
    건드리지 않았고, 새 이름이 기존 어떤 export/import 심볼과도 충돌하지 않음을 grep 으로
    확인했다. 기존 호출자에 대한 하위 호환성 영향 없음.
  - 제안: 조치 불요 — 정보 제공 목적.

- **[INFO]** 값 치환이 런타임 동작·DB 영속 값·이벤트 페이로드를 바꾸지 않음(의도된 무변경 확인)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`markWebChatIdleTimeout`, `markQueueWaitTimeout`, `finalizeStalledExhausted`),
    `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
    (`OnApplicationShutdown` 핸들러 두 곳), `ai-turn-orchestrator.service.ts`
    (`extractAiTurnErrorPayload` 인접 분류 로직)
  - 상세: 9개 지점 모두 `code: '리터럴'` → `code: EngineErrorCode.X` / `ErrorCode.X` 로 바뀌었고,
    상수 값은 원래 리터럴과 완전히 동일하다(`WEBCHAT_IDLE_TIMEOUT`→`'WEBCHAT_IDLE_TIMEOUT'` 등,
    소스 대조 완료). `finalizeStalledExhausted`의 `stalledError` 객체는 DB `UPDATE … RETURNING`과
    이후 이벤트 emit 이 **같은 객체 참조**를 공유하는 구조라(코드 주석에 명시), `code` 값이
    바뀌지 않았으므로 emit 되는 이벤트 페이로드 내용도 동일하다. "값이 아니라 형태만 바뀌었다"는
    plan/리뷰 서술이 실측과 일치한다.
  - 제안: 조치 불요 — 결함 아님, 확인 목적으로 기록.

- **[INFO]** 신규 repo-guard 3파일은 순수 파일시스템 **읽기** 전용, 프로덕션 런타임과 무관
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`
    (`readDeclaredCodes`, `walkTsFiles`, `collectBoundCodes`)
  - 상세: `fs.readFileSync`/`fs.readdirSync`로 저장소 소스를 읽어 AST 를 파싱할 뿐, 파일 쓰기·삭제·
    환경 변수 접근·네트워크 호출은 없다. `jest` 테스트 실행 시에만 동작하고 프로덕션 앱 부팅
    경로(`main.ts`, 모듈 등록 등)에는 전혀 배선되지 않는다(grep 으로 확인 — production import
    그래프에 `repo-guards/__tests__/*`를 참조하는 곳 없음). 즉 이번 변경은 배포된 서버의 동작에
    어떤 부작용도 새로 만들지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 가드 모듈에서 `ANCHORED_ELSEWHERE`(mutable `Record`)와 `CODE_BINDING_NAMES`
  (mutable `Set`)가 `readonly`/freeze 없이 그대로 export 됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:21,30`
  - 상세: 두 값 모두 `as const` 없이 일반 `Record`/`Set`로 export 되어, 이를 import 하는 어떤
    코드든 `.add(...)`나 프로퍼티 대입으로 **모듈 레벨 공유 상태를 변형**할 수 있는 형태다.
    현재 유일한 소비처인 `engine-error-code-anchor.spec.ts`는 읽기만 하므로 실제 부작용은
    관측되지 않았고, Jest 는 기본적으로 테스트 파일마다 모듈 레지스트리를 새로 만들어 교차
    오염 위험도 낮다. 다만 이 파일이 앞으로 다른 테스트/스크립트에서도 import 될 경우
    (`ANCHORED_ELSEWHERE`에 항목을 런타임에 push 하는 헬퍼 테스트 등) 조용히 예외 목록이
    변형될 여지가 이론상 남는다.
  - 제안: 현재는 실질 위험 없음(조치 불요). 향후 소비처가 늘면 `Object.freeze`/`ReadonlySet`
    타입으로 방어적으로 굳히는 것을 고려할 만하다.

- **[INFO]** plan 문서 이동이 git rename 으로 정상 처리됨(과거 "git mv + multi-pathspec add"
  침묵 stale 커밋 패턴 아님)
  - 위치: `plan/in-progress/exec-intake-followups.md` → `plan/complete/exec-intake-followups.md`
  - 상세: `git diff origin/main`에서 `rename from`/`rename to`(유사도 59%)로 정확히 인식됨을
    직접 확인했다. 프롬프트 페이로드 상으로는 파일 9(신규 add, 생략)/파일 10(delete)로 갈라져
    보이지만 이는 프롬프트 렌더링 방식일 뿐, 실제 git 히스토리는 파일 이력을 보존하는 rename
    이다. 상대경로 링크(`../in-progress/update-returning-tuple-shape.md`)도 이동 후 기준으로
    올바르게 조정되어 있다.
  - 제안: 조치 불요 — 확인 목적으로 기록(과거 반복 패턴에 대한 방어적 재검증).

## 요약

이번 변경은 엔진 레이어 에러 코드 9지점의 맨 문자열을 신설된 `EngineErrorCode`/기존 `ErrorCode`
상수 참조로 교체하는 순수 리팩터와, 그 회귀를 막는 읽기 전용 AST 가드(테스트 전용, 프로덕션
비배선) 도입이 전부다. 모든 치환값이 원래 리터럴과 byte-identical 함을 직접 대조했고, DB 영속
값·이벤트 페이로드·함수 시그니처·공개 API 계약 어느 것도 실질적으로 변경되지 않았다. 유일한
인터페이스 변화는 `error-codes.ts`에 새 export(`EngineErrorCode`/`EngineErrorCodeValue`)가
추가된 것인데 순수 additive 라 기존 호출자에 영향이 없다. 환경 변수 읽기/쓰기, 네트워크 호출,
전역 변수 신설/변경, 이벤트·콜백 발행 방식 변경은 관측되지 않았다. 신규 가드 모듈이 export 하는
`ANCHORED_ELSEWHERE`/`CODE_BINDING_NAMES`가 mutable 한 점만 이론적 방어 여지로 남아 있으나
현재 소비처(단일 spec, 읽기 전용)에서는 실질 위험이 없다.

## 위험도

NONE
