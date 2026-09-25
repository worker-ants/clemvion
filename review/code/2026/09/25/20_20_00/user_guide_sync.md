# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 범위

`.claude/config/doc-sync-matrix.json`(`rows[]`, 21행) 을 SSOT 로 적재하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑(155~223행) 을 nuance 보조로 확인했다. 실제 변경 file 목록(`git diff --name-only origin/main...HEAD` 로 교차 확인)은 다음과 같다:

- `codebase/backend/README.md` (수정)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (테스트 추가)
- `plan/in-progress/canary-readme-recheck-test.md` (신규 plan)
- `review/consistency/2026/09/25/20_01_21/*.md`, `meta.json`, `_retry_state.json` (consistency 산출물)

`git diff -- codebase/backend/src/modules/workspaces/workspaces.service.ts` 는 빈 결과 — **production 코드(서비스 로직) 자체는 이번 diff 에 포함되지 않는다.** plan 문서(`canary-readme-recheck-test.md`) 도 명시: "동작 변경 없음 — 운영자 문서 정정과 테스트 보강이다(`spec_impact: none`)". 대상 기능(경로 파라미터 워크스페이스 가드, `@WorkspaceParam()`)은 `#1399`(`5ba95e4b8`)·`#1400`(`bcc0402bb`) 커밋에서 이미 구현·머지되어 `origin/main` 에 포함돼 있고, 본 diff 범위 밖이다.

## 매트릭스 매칭 검토

21개 trigger 를 전수 대조했다:

| trigger | 매칭 여부 | 근거 |
|---|---|---|
| 새 노드 추가 / schema 변경 | 불일치 | `codebase/backend/src/nodes/**` 변경 없음 |
| 신규 UI 문자열(TSX) / widget chrome | 불일치 | frontend·channel-web-chat `.tsx` 변경 없음 |
| 통합/제공자 변경 | 불일치 | provider 코드 변경 없음 |
| 신규 유저가이드 섹션 디렉토리 | 불일치 | `content/docs/*/` 변경 없음 |
| 백엔드 API 추가·변경 | 불일치 | `*.controller.ts`/`dto/**` 변경 없음 (변경 파일은 `.service.spec.ts`) |
| 신규 BullMQ 큐 | 불일치 | `system-status.constants.ts` 변경 없음 |
| 신규 warning/error code | 불일치 | `error-codes.ts`/warningRules 변경 없음 |
| cross-cutting enum / zod ui.label / handler output field | 불일치 | 해당 파일 변경 없음 |
| **인증·권한·세션 흐름 변경** (`modules/auth/**`, semantic) | **불일치(경계 케이스로 검토함)** | 변경 파일은 `modules/workspaces/workspaces.service.spec.ts` 이며 `modules/auth/**` 자체는 diff 에 없음. 게다가 이 diff 는 **테스트만** 추가했고 `workspaces.service.ts` 의 실제 인가 로직(트랜잭션 재검사 분기)은 사전에 이미 존재하던 코드를 새 테스트로 "고정(pin)"한 것 — 신규 흐름 변경이 아니다. 흐름 자체를 바꾼 `#1399`/`#1400` 은 이미 `origin/main` 에 병합되어 이번 diff 범위 밖. `spec_impact: none` 도 이를 뒷받침 |
| AuthConfig type enum 변경 | 불일치 | 해당 없음 |
| 표현식 언어 변경 | 불일치 | `packages/expression-engine/**` 변경 없음 |
| 실행·디버깅 흐름 변경 | 불일치 | 해당 없음 |
| **환경 변수·기동 방법·런타임 변경 → `README.md`** | **매칭(자기충족, 갭 아님)** | 이 행은 "런타임/기동 변경 시 README 를 갱신하라" 는 방향이며, 이번 변경은 README **자체**가 대상이자 갱신 내용이다. 코드(캐너리 로직) 변경 없이 이미 `#1399` 로 바뀐 캐너리 동작(합계 카운트·`workspaceParamNamesOf`)에 맞춰 README 서술을 사후 정정한 것 — 별도 동반 갱신 위치가 필요한 "trigger" 가 아니라 그 자체가 target 이행. 누락 아님 |
| spec 신규/대규모 변경 | 불일치 | `spec/**` 변경 없음 |
| user-guide GUI 흐름 절 신규/변경 | 불일치 | `02-nodes/**.mdx`/`06-integrations-and-config/**.mdx` 변경 없음 |

## 발견사항

없음. 위 표와 같이 21개 trigger 중 확정 매칭이 없고, 유일하게 검토가 필요했던 "인증·권한·세션 흐름 변경" 행도 (a) 실제 production 인가 로직 변경 없음(테스트 전용), (b) 흐름을 바꾼 실제 커밋(`#1399`/`#1400`)은 이번 diff 범위 밖(이미 `origin/main` 병합), (c) plan 문서가 `spec_impact: none` 로 명시한 근거와 부합해 "동반 갱신 누락" 으로 분류하지 않았다. `codebase/backend/README.md` 변경은 그 자체로 "환경 변수·기동 방법·런타임 변경 → README.md" 행의 target 이행이지 위반이 아니다.

참고로 이미 별도 채널(consistency-check, `review/consistency/2026/09/25/20_01_21/SUMMARY.md`)에서 `data-flow/12-workspace.md` Owner 라우트 수 불일치·`9-user-profile.md §4.2` 스코프 모호성이 WARNING 으로 잡혀 있으나, 이는 `spec/**` 정합성 이슈로 본 리뷰(유저 가이드 docs MDX/i18n/backend-labels 동반 갱신) 스코프 밖이며 이미 다음 작업으로 트래킹돼 있다(중복 보고 생략).

## 요약

매트릭스 21개 trigger 전수 대조 결과 매칭 0건 — 이번 changeset(백엔드 `README.md` 문서 정정 + `workspaces.service.spec.ts` 유닛 테스트 추가, `spec_impact: none`)은 production 코드·노드·frontend UI·docs·i18n·backend-labels 어느 것도 건드리지 않는 test/doc-only 변경이다. 유저 가이드 동반 갱신 관점에서 해당 없음.

## 위험도

NONE
