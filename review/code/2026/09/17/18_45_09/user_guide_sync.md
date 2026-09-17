# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 사전 점검

- SSOT 적재: `.claude/config/doc-sync-matrix.json` (`rows[]` 21건, 매트릭스 존재) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 21행, 표-JSON 1:1 확인) — 정상 로드.
- 변경 파일 목록: orchestrator 프롬프트 번들의 파일 1~27 + `git diff --name-only origin/main...HEAD` 로 교차 확인, 완전히 일치(27개 파일, 추가 파일 없음).

## 변경 셋 개요

이번 변경(`trigger-deletion-release`)은 트리거 행을 없애는 네 경로(트리거 직접 삭제·스케줄 삭제·워크플로 삭제·워크스페이스 삭제)가 각각 자신이 만든 외부 자원(schedule job, chat-channel provider 등록, secret_store 항목, listener registry)을 정리하도록 공용 정책 함수(`trigger-resource-release.ts`)와 배선 서비스(`TriggerResourceReleaserService`)를 도입한 백엔드 내부 리팩터다. 변경 파일은 전부 다음 세 범주에 속한다.

1. `codebase/backend/src/modules/{schedules,triggers,workflows,workspaces}/**` — 서비스 로직·모듈 배선·unit spec (16개)
2. `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts`, `codebase/backend/jest.config.ts` — e2e/설정 주석
3. `plan/in-progress/trigger-deletion-release.md`, `review/consistency/2026/09/17/18_00_19/**` — plan·consistency-check 산출물

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 는 이번 변경 set 에 전혀 포함되지 않는다 (plan 의 `spec_impact: none` 과 일치).

## 매트릭스 매칭 결과

매트릭스 21개 행을 전수 대조했다. 아래 순서로 배제 근거를 남긴다.

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**` glob) — 변경 파일 중 `src/nodes/**` 아래는 0건. 미매칭.
- **신규 UI 문자열 (TSX)** / **신규 위젯 chrome 문자열** — `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx` 글롭에 매칭되는 파일 0건. 미매칭.
- **통합 신규/제공자 변경** — chat-channel provider(텔레그램 등) 자체의 신규/스키마 변경이 아니라, 기존 provider 의 teardown 호출 시점·순서만 바꾼 내부 리팩터. `06-integrations-and-config/` 대상 provider 신설·변경 아님. 미매칭.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/*/` 신규 생성 0건. 미매칭.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 변경 파일에 controller·DTO 없음(서비스 계층·모듈·spec 뿐). 미매칭.
- **신규 BullMQ 큐 추가** — `system-status.constants.ts` 미변경, `@Processor` 신설 없음. 미매칭.
- **신규 warningCode / errorCode 발행** — `error-codes.ts` 미변경, warningRules 변경 없음. 새로 도입된 실패 경로(`TRIGGER_RESOURCE_RELEASER` 미해석 시 throw, `deleteByPrefix` 실패 로그)는 전부 서버 로그/500 이지 신규 warningCode·errorCode 발행이 아니다. 미매칭.
- **신규 cross-cutting enum / 신규 backend zod ui.label 값 / 신규 handler output field** — 해당 없음. 미매칭.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**` semantic) — `workspaces.service.ts` 의 `deleteWorkspace`/`assertWorkspaceDeletable` 이 owner 권한 검사를 리팩터했지만, 검사 위치가 `modules/auth/**` 가 아니며 **인가 결정 자체(owner만·team 타입만 삭제 가능)는 바뀌지 않았다** — 트랜잭션 안팎에 걸쳐 같은 검사를 두 번(선검사+잠금 재검사) 호출하도록 동시성 안전성만 강화한 것이다. 사용자에게 보이는 정책·에러 코드(`OWNER_REQUIRED`, `CANNOT_DELETE_PERSONAL`, `WORKSPACE_NOT_FOUND`)도 기존과 동일. `07-workspace-and-team/` 가이드가 서술하는 사용자 가시 동작에 변화가 없어 회색지대 INFO 로도 올리지 않는다.
- **AuthConfig type enum 변경 / 표현식 언어 변경 / 실행·디버깅 흐름 변경 / 환경 변수 변경 / spec 신규·대규모 변경 / user-guide GUI 흐름 절 변경 / spec 결함 발견** — 전부 미매칭 (해당 경로·개념 변경 없음).

## 발견사항

없음 — 매칭된 trigger 가 없어 동반 갱신 누락을 판정할 대상 자체가 없다.

## 요약

매트릭스 21개 trigger 전수 대조 결과 이번 변경(트리거/스케줄/워크플로/워크스페이스 삭제 시 secret_store·provider·BullMQ job 정리를 공용 정책 함수로 통합한 백엔드 내부 리팩터, 27개 변경 파일 — 전부 `codebase/backend/**` 서비스 계층·spec·e2e·plan·consistency 산출물)은 어떤 trigger 에도 매칭되지 않았다(매칭 0/21). 신규 노드·API·통합 provider·UI 문자열·docs 섹션·warning/error 코드·cross-cutting enum 발행이 없고, 워크스페이스 삭제 권한 검사 리팩터도 정책 변경 없이 동시성 안전성만 강화해 `07-workspace-and-team/` 갱신 대상이 아니다. 유저 가이드 동반 갱신 관점에서는 해당 없음.

## 위험도

NONE
