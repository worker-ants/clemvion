# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 사전 점검

- SSOT 적재: `.claude/config/doc-sync-matrix.json` (`rows[]` 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 21행, 표-JSON 1:1) — 정상 로드.
- 변경 파일 목록: orchestrator 프롬프트 번들의 파일 1~44 + `git diff --name-only origin/main...HEAD` 로 교차 확인 — 일치.

## 변경 셋 개요

이번 라운드는 `trigger-deletion-release` 작업의 **2회차**다. 1라운드 리뷰(`review/code/2026/09/17/18_45_09/`)가 지적한 Critical 1건·Warning 다수를 커밋 `097e583e1`(fix) + `a11889086`(test) 로 처분하고, `048ddc271`(docs)로 RESOLUTION·plan 기록을 남긴 것이 diff 의 나머지 절반이다. 실제 애플리케이션 코드 변경은 여전히 다음 범주뿐이다.

1. `codebase/backend/src/modules/{schedules,secret-store,triggers,workflows,workspaces}/**` — 트리거 행을 없애는 네 경로(트리거 직접 삭제·스케줄 삭제·워크플로 삭제·워크스페이스 삭제)가 자신이 만든 외부 자원(BullMQ schedule job, chat-channel provider 등록/콜백, `secret_store` 항목)을 정리하도록 하는 백엔드 내부 리팩터 + 1라운드 지적 처분(스케줄 job 배치 해제 부분실패 롤백, 워크스페이스/워크스페이스↔트랜스퍼 잠금 순서 통일, `secret-ref.ts` 의 `buildSecretRefPrefix` 신설, binder 로그 접두 정정 등)
2. `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts`, `codebase/backend/jest.config.ts` — e2e/설정 주석
3. `CHANGELOG.md`, `plan/in-progress/trigger-deletion-release.md`, `review/code/2026/09/17/18_45_09/**`, `review/consistency/2026/09/17/18_00_19/**` — changelog·plan·이전 라운드 리뷰/consistency 산출물(리뷰 대상 코드 아님)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 는 이번 변경 set 에 전혀 포함되지 않는다 (`plan/in-progress/trigger-deletion-release.md` 의 `spec_impact: none` 과 일치).

## 매트릭스 매칭 결과

매트릭스 21개 행을 전수 대조했다. 1라운드 리뷰가 이미 0/21 로 판정했고, 2라운드에서 새로 들어온 변경(스케줄 job 롤백, `buildSecretRefPrefix`, binder 로그 접두 정정, 워크스페이스/트랜스퍼 잠금 순서 통일)도 같은 결론을 바꾸지 않는다.

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 변경 파일 중 `src/nodes/**` 아래는 0건. 미매칭.
- **신규 UI 문자열(TSX) / 신규 위젯 chrome 문자열** — `*.tsx` 글롭 매칭 0건. 미매칭.
- **통합 신규/제공자 변경** — `chat-channel-binder.service.ts` 변경은 기존 provider(텔레그램 등)의 teardown 호출 시점·보상 로직·로그 접두만 바꾼 내부 리팩터다. provider 신설·스키마·사용자 설정 흐름 변경이 아니어서 `06-integrations-and-config/` 대상 아님. 미매칭.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/*/` 신규 0건. 미매칭.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 변경 파일에 controller·DTO 없음(서비스 계층·모듈·spec·e2e 뿐). 미매칭.
- **신규 BullMQ 큐 추가** — `system-status.constants.ts` 미변경, `@Processor` 신설 없음(`schedules.module.ts` 는 기존 `SCHEDULE_QUEUE` 에 `SecretStoreModule` import 를 더한 것뿐). 미매칭.
- **신규 warningCode / errorCode 발행** — `error-codes.ts`, warningRules 미변경. 새 실패 경로(job scheduler 재등록 실패, `deleteByPrefix` 실패)는 전부 서버 error 로그/500 이지 사용자 노출 warningCode·errorCode 신설이 아니다. 미매칭.
- **신규 cross-cutting enum / 신규 backend zod ui.label 값 / 신규 handler output field** — 해당 없음. 미매칭.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`, semantic) — `workspaces.service.ts` 의 `deleteWorkspace` 가 "권한 검사를 외부 해제보다 먼저" 하도록, 그리고 `deleteWorkspace`↔`transferOwnership` 잠금 순서(워크스페이스→멤버십)를 통일하도록 리팩터됐지만, (a) 변경 위치가 `modules/auth/**` 가 아니고 (b) **인가 결정 자체**(owner 만 삭제 가능, `OWNER_REQUIRED`/`CANNOT_DELETE_PERSONAL`/`WORKSPACE_NOT_FOUND` 에러 코드)는 이전과 동일 — 검사 호출 시점·잠금 순서만 동시성 안전성을 위해 재배치한 것이다. `07-workspace-and-team/` 가이드가 서술하는 사용자 가시 동작(누가 삭제할 수 있는가, 어떤 에러를 받는가)에 변화가 없어 회색지대 INFO 로도 올리지 않는다.
- **AuthConfig type enum 변경 / 표현식 언어 변경 / 실행·디버깅 흐름 변경 / 환경 변수 변경 / spec 신규·대규모 변경 / user-guide GUI 흐름 절 변경 / spec 결함 발견** — 전부 미매칭(해당 경로·개념 변경 없음).

## 발견사항

없음 — 매칭된 trigger 가 없어 동반 갱신 누락을 판정할 대상 자체가 없다.

## 요약

매트릭스 21개 trigger 전수 대조 결과, 이번 변경(트리거/스케줄/워크플로/워크스페이스 삭제 시 secret_store·chat-channel provider·BullMQ schedule job 정리를 공용 정책 함수로 통합한 백엔드 내부 리팩터 + 1라운드 리뷰 처분 커밋 2건 + 리뷰 기록 커밋 1건, 총 44개 변경 파일 — 전부 `codebase/backend/**` 서비스 계층·spec·e2e·`CHANGELOG.md`·`plan/**`·이전 라운드 `review/**` 산출물)은 어떤 trigger 에도 매칭되지 않았다(매칭 0/21). 신규 노드·API·통합 provider·UI 문자열·docs 섹션·warning/error 코드·cross-cutting enum 발행이 없고, 워크스페이스 삭제 권한 검사·잠금 순서 리팩터도 인가 정책 변경 없이 동시성 안전성만 강화해 `07-workspace-and-team/` 갱신 대상이 아니다. 유저 가이드 동반 갱신 관점에서는 해당 없음.

## 위험도

NONE
