# 신규 식별자 충돌 검토 — `spec/conventions/error-codes.md`

## 검토 범위 확인

- `--impl-done` 모드, scope=`spec/conventions/`, diff-base=`origin/main`.
- `git diff origin/main...HEAD -- spec/` 실측 결과 **`spec/` 전체에서 변경된 파일은
  `spec/conventions/error-codes.md` 단 하나**이며, diff 는 11줄 삽입 / 1줄 삭제.
- 프롬프트 번들에 포함된 `## 구현 변경 사항` diff(`spec-links.test.ts`,
  `stray-tool-tags.test.ts`, 253줄)는 이 세션의 다른 harness 작업분으로, `spec/conventions/`
  scope 와 무관 — 새 식별자 충돌 판단 대상에서 제외했다(경로가 `codebase/frontend/src/lib/docs/`
  이며 에러 코드·엔티티·API 어느 것과도 겹치지 않음).

## 변경 내용 요약

target 커밋은 `error-codes.md` §Overview 문단에 아래 서술을 **추가**했을 뿐이다:

- "대표 surface 는 둘이다 — 같은 파일(`nodes/core/error-codes.ts`)에 `ErrorCode` 와
  `EngineErrorCode` 가 자매 const 로 있다" 는 설명 3문단.

## 신규 식별자 존재 여부 확인

이 diff 가 **새로 도입**하는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV 변수·파일 경로는
**없다**. 유일하게 새로 등장하는 토큰은 `EngineErrorCode` 라는 이름인데, 이는 문서가 그
이름을 **새로 만드는 것이 아니라 기존 코드에 이미 존재하는 const 를 사후 명문화**하는
것이다. 실측:

- `codebase/backend/src/nodes/core/error-codes.ts:147` — `export const EngineErrorCode = {...}`
  (target 커밋 이전부터 존재, 이번 diff 로 신설된 것 아님).
- `EngineErrorCode` 참조처: `error-codes.spec.ts`,
  `repo-guards/__tests__/engine-error-code-anchor.spec.ts` /
  `engine-error-code-anchor-guard.ts`, `execution-engine.service.ts`,
  `shutdown/shutdown-state.service.ts` — 전부 동일한 의미(엔진 레벨 에러 코드 const)로만
  쓰이고 다른 의미의 동명 식별자는 발견되지 않았다.
- `grep -rn "EngineErrorCode" spec/` — target 문서 자신(§Overview 3곳)이 유일한 등장처.
  다른 spec 문서가 이 이름을 다른 의미로 선점하고 있지 않다.

## 발견사항

없음 — 위 실측대로 target 이 새로 명명하는 식별자가 존재하지 않으므로 6개 점검 관점
(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트명 / ENV·설정키 / 파일 경로) 모두
해당 사항 없음.

## 요약

target 커밋(`spec/conventions/error-codes.md`)은 이미 코드에 존재하던
`ErrorCode`/`EngineErrorCode` 자매 const 구조를 문서에 사후 명문화하는 순수 설명 보강이며,
새 요구사항 ID·엔티티·endpoint·이벤트·ENV·파일 경로를 전혀 도입하지 않는다. 유일한 신규
등장 토큰 `EngineErrorCode` 도 코드베이스에 사전 존재하는 단일 의미의 const 를 가리키며,
spec 전체를 grep 한 결과 다른 의미로 선점된 동명 식별자는 없다. 신규 식별자 충돌 관점에서
이 target 은 위험이 없다.

## 위험도

NONE
