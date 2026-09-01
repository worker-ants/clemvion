# 부작용(Side Effect) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`, 5라운드 `21_23_45`)

## 배경 및 검증 방법

이번 라운드는 `origin/main` 대비 누적 55개 파일 diff다. 실질 코드/문서 변경은 **파일 1~11**
(`CHANGELOG.md`, 엔진 서비스 3파일, `error-codes.ts`/`.spec.ts`, 신규 repo-guard 3파일,
`plan/{in-progress,complete}/exec-intake-followups.md`)뿐이고, 나머지(파일 12~55)는 이전
4라운드(`20_27_29`/`20_43_35`/`20_59_14`/`21_12_31`)의 리뷰 산출물(`RESOLUTION.md`/`SUMMARY.md`/
`meta.json`/`_retry_state.json`/7개 reviewer 리포트)이 그대로 커밋된 것이다.

`git log --oneline -6` 로 확인한 결과 파일 1~11 의 실질 코드 diff 는 **4라운드 fix 커밋
(`e6f2b5c8c`)까지 반영된 상태 그대로**이며, 4라운드 side_effect 리뷰(파일 54,
`21_12_31/side_effect.md`)가 이미 동일한 diff 를 상세히 검증(NONE)했다. 본 라운드에서는 그
결론을 재사용하지 않고 저장소를 직접 열어 독립적으로 재확인했다(저장소 뮤테이션 없음 — `Read`/
`grep`/`git diff`만 사용, 종료 시 `git status --short` 로 이번 세션 산출물 디렉터리
(`review/code/2026/08/31/21_23_45/`) 외 변경 없음 확인):

- `grep -n "^export" codebase/backend/src/nodes/core/error-codes.ts` → 신규 `EngineErrorCode`/
  `EngineErrorCodeValue` 는 기존 `ErrorCode`/`ErrorCodeValue`/`buildErrorEnvelope`/
  `truncateForErrorDetails`/`maskEmailForErrorDetails` 뒤에 **순수 추가**로만 존재.
- `markWebChatIdleTimeout(executionId: string): Promise<boolean>` /
  `markQueueWaitTimeout(executionId: string): Promise<void>` /
  `markRemainingAsInterrupted(...)` / `classifyLlmError`/`extractAiTurnErrorPayload` 시그니처가
  변경 전과 동일함을 직접 grep 으로 재확인 — 함수 본문 안 `code:` 리터럴만 상수 참조로 바뀌었다.
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` 의 `fs.` 호출
  3곳(`readFileSync`×2, `readdirSync`×1) 전부 읽기 전용. 쓰기·삭제·`process.env`·네트워크 호출
  없음.
- `grep -rn "from.*engine-error-code-anchor-guard"` → 유일한 소비처는
  `engine-error-code-anchor.spec.ts` 뿐, 프로덕션 코드 경로에서 import 되지 않음.
- `grep -n "error-codes\|EngineErrorCode" codebase/backend/src/nodes/core/index.ts` → **매치 없음**
  (barrel 재수출 없음). `error-codes.ts` 안의 `engine-error-code-anchor-guard.ts` 언급은 JSDoc
  산문 인용일 뿐 실제 import 아님(직접 확인).
- `git diff origin/main --find-renames -- plan/` → `rename from plan/in-progress/...` /
  `rename to plan/complete/...` (similarity 55%) 로 정상 인식 — delete+add 로 이력이 끊기는
  형태 아님.

## 발견사항

- **[INFO]** (4라운드 재확인, 신규 아님) `ANCHORED_ELSEWHERE`/`CODE_BINDING_NAMES` 가 freeze
  없이 mutable 상태로 export 됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:21`
    (`export const CODE_BINDING_NAMES = new Set(['code', 'errorCode']);`), `:30`
    (`export const ANCHORED_ELSEWHERE: Record<string, string> = {`) — 게이트 없는 파일이라
    실제 소스를 직접 열어 확인한 줄 번호.
  - 상세: 두 값 모두 `as const`/`Object.freeze`/`ReadonlySet` 없이 export 된다. 유일한 소비처인
    `engine-error-code-anchor.spec.ts` 는 `Object.keys(ANCHORED_ELSEWHERE)` /
    `Object.entries(ANCHORED_ELSEWHERE)` 형태로 **읽기만** 하는 것을 직접 grep 으로 재확인했다
    (`grep -n "ANCHORED_ELSEWHERE\|CODE_BINDING_NAMES" .../engine-error-code-anchor.spec.ts`).
    현재 실질 위험은 없으나, 향후 다른 테스트/스크립트가 이를 import 해 `.add(...)`나 프로퍼티
    대입으로 모듈 레벨 공유 상태를 변형할 이론적 여지는 여전히 남아 있다.
  - 제안: 조치 불요(4라운드째 동일 결론). 소비처가 늘면 `Object.freeze`/`ReadonlySet` 로 굳히는
    것을 고려.

- **[INFO]** 이번 라운드에서 추가된 실질 파일 없음 — 파일 12~55 는 전부 이전 라운드
  (`20_27_29`/`20_43_35`/`20_59_14`/`21_12_31`) 자신의 리뷰 산출물
  - 위치: `review/code/2026/08/31/{20_27_29,20_43_35,20_59_14,21_12_31}/**` (전부 신규 파일,
    이번 라운드 diff 에 처음 등장)
  - 상세: 전부 마크다운/JSON 리포트로, 런타임에 로드·실행되지 않는다. `CLAUDE.md` 의 "코드 리뷰
    산출물 → `review/code/**`" 저장 관례에 정확히 부합하는 **의도된** 파일시스템 부작용이며,
    은닉되거나 무관한 기능의 파일이 섞여 들어온 흔적은 없다(전부 이번 `error-codes-layer-split`
    작업의 fix→재리뷰 사이클 산출물).
  - 제안: 조치 불요.

- **[INFO]** 값 치환은 여전히 byte-identical — DB 영속값·이벤트 페이로드 무변경 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1147,2873,3336`,
    `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts:194,222`,
    `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1298,1301,1304,1311`
  - 상세: 9개 지점 모두 `EngineErrorCode.X`/`ErrorCode.X` 값이 원래 리터럴과 `KEY: 'KEY'` 자기거울
    패턴으로 동일함을 `error-codes.ts` 소스 대조로 재확인. `Execution.error.code`/
    `NodeExecution.error.code` 로 영속되는 값, 이벤트 emit 페이로드 어느 쪽도 이번 diff 로 달라지지
    않는다.
  - 제안: 조치 불요.

## 요약

이번(5라운드) diff 의 실질 코드/문서 변경분(파일 1~11)은 4라운드까지 반영된 상태 그대로이며,
직접 소스를 열어 함수 시그니처·export 표면·fs 호출·barrel 재수출·plan 파일 rename 여부를
독립적으로 재검증한 결과 이전 4개 라운드의 side_effect 리뷰 결론(NONE)과 완전히 일치한다.
전역 상태·환경 변수·네트워크 호출·이벤트/콜백 발행 방식에 변화가 없고, 유일한 인터페이스 변화는
`EngineErrorCode`/`EngineErrorCodeValue` 순수 추가 export 뿐이다. 이번 라운드에 새로 늘어난
44개 파일은 전부 이전 라운드 자신의 리뷰 산출물(문서/JSON, 비실행)로 프로젝트 저장 관례에 부합하는
의도된 파일시스템 쓰기다. 4라운드째 반복 확인된 `ANCHORED_ELSEWHERE`/`CODE_BINDING_NAMES` mutable
export 하나만 이론적 여지로 남아 있으며 실질 위험은 여전히 없다.

## 위험도

NONE
