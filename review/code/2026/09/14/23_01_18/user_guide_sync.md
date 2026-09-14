# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` 의 `rows[]` (21개 trigger: glob 매칭 12 + semantic 판단 9)와
`PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(nuance 보조)을 Read 했다.

## 변경 파일 식별

`git diff origin/main...HEAD --name-only` 로 코드 변경 전수를 확인했다 (리뷰/plan 산출물 제외):

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/schedules/schedules.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` + `.spec.ts`
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` + `.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` + `.spec.ts` + `.web-chat.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` + `.spec.ts` + `fixtures/endpoint-path-save.fixture.ts`
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
- `plan/in-progress/trigger-config-lost-update.md`

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`,
`codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`,
`*.controller.ts`/`dto/**`, `codebase/backend/src/nodes/core/error-codes.ts`,
`system-status.constants.ts`, `spec/**` 어디에도 변경이 없다.

## trigger 매칭 결과 (21행 전수 대조)

| trigger (id) | 매칭 | 근거 |
| --- | --- | --- |
| new-node / node-schema-change | 불일치 | `codebase/backend/src/nodes/**` 변경 0건 |
| new-ui-string | 불일치 | `codebase/frontend/src/**/*.tsx` 변경 0건 |
| new-widget-chrome-string | 불일치 | `codebase/channel-web-chat/src/**/*.tsx` 변경 0건 |
| integration-provider-change (semantic) | 불일치 | `chat-channel-binder.service.ts`·`chat-channel-input-rules.ts` 변경은 신규 provider·신규 사용자 대면 설정 필드가 아니라, `chatChannel.inboundSigningRef` 추출을 `extractInboundSigningRef()` 로 중복 제거한 내부 리팩터 + 쓰기 경로를 `save()`→advisory-lock 재읽기/컬럼 한정 `update()` 로 바꾼 동시성 수정이다. provider 어댑터·사용자 설정 절차·필드는 불변 |
| new-userguide-section-dir | 불일치 | `content/docs/*/` 신규 디렉토리 0건 |
| backend-api-change | 불일치 | `*.controller.ts`/`dto/**` 변경 0건 |
| new-bullmq-queue | 불일치 | `system-status.constants.ts` 변경 없음 |
| new-warning-code / new-error-code | 불일치 | `warningRules`/`error-codes.ts` 변경 없음 |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | 불일치 | 해당 표면 변경 없음 |
| auth-session-flow-change (semantic, `modules/auth/**`) | 불일치 (그레이존 검토 후) | glob 자체가 불일치. semantic 재검토: `chatChannel.inboundSigningRef` 는 **인입 웹훅 서명 검증**(외부 provider → 서버) 키이지, 매트릭스가 지목하는 `07-workspace-and-team/`(로그인·팀 초대·멤버 권한, 사용자 → 앱) 흐름과는 다른 층이다. `modules/auth/**` 파일은 diff 에 등장하지 않는다 |
| auth-config-type-enum-change | 불일치 | 해당 enum 변경 없음 |
| expression-language-change | 불일치 | `codebase/packages/expression-engine/**` 변경 없음 |
| run-debug-flow-change (semantic) | 불일치 | `engine.execute()` 호출 방식·실행 결과 표현은 그대로이고, 바뀐 것은 트리거 저장 경로의 동시성/락뿐이다. 사용자가 보는 실행·디버그 화면 동작에 영향 없음 |
| env-runtime-change | 불일치 | 해당 없음 |
| spec-major-change | 불일치 | `spec/**` 변경 0건. plan frontmatter `spec_impact: none` 과 일치 |
| userguide-gui-flow-section | 불일치 | `content/docs/02-nodes/**`, `06-integrations-and-config/**` 변경 0건 |
| spec-defect-found | 불일치 | 해당 판단 없음 |

## 자주 누락 패턴 (PROJECT.md §자주 누락) 대조

- i18n key parity — dict 변경 0건, 해당 없음
- backend warning/error code → ko 매핑 — `warningRules`/`error-codes.ts` 변경 0건, 해당 없음
- 노드 schema 변경 vs FieldTable — 노드 변경 0건
- 새 노드/새 섹션 디렉토리 — 해당 없음
- 인증·세션 흐름 vs 워크스페이스 가이드 — 위 표 판정대로 `auth/**` 밖의 웹훅 서명 검증 내부 동시성 수정이라 미적용

`CHANGELOG.md` 갱신은 이 변경 set 안에 이미 포함되어 있으나(사용자 대상 변경 로그), 매트릭스가
요구하는 docs/dict/`backend-labels.ts` 동반 갱신 대상과는 별개 항목이라 이 판정에 영향 없음.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 중 `git status --short` 가 `M codebase/backend/src/modules/triggers/triggers.service.ts`
(5줄 diff)를 보고했고, 뒤이어 `git diff -- <그 파일>`(작업트리 vs 인덱스)을 뜬 시점에는 그
파일이 `update()`/advisory-lock 재읽기 다수 자리를 `save(trigger)`/`assertTriggerFound` 구버전으로
되돌린 훨씬 큰 diff로 관측됐다. 곧이어 재확인(`git diff --cached`, `git diff HEAD`,
`git hash-object`)했을 때는 파일이 HEAD(blob `c7b63b6f3`)와 정확히 일치하는 정상 상태였다.
병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 상황으로
보이며(이전 라운드 `18_17_44/api_contract.md` 도 유사 현상을 기록함), 지금 시점 저장소에
잔여 이상 상태는 없다. 이 변동은 코드 변경 파일 목록(`git diff origin/main...HEAD --name-only`)이나
위 매칭 결과에 영향을 주지 않는다 — 어느 시점의 `triggers.service.ts` 내용이든 프론트엔드/docs/
i18n 표면과는 무관한 backend 내부 파일이기 때문이다.

## 발견사항

없음 — 매트릭스 21개 trigger 중 어느 것에도 매칭되는 변경이 없다.

## 요약

이번 변경 set(`codebase/backend/src/modules/triggers/**` · `hooks/**` · `schedules/**` 의
`trigger.config` lost-update 동시성 수정 + `repo-guards` 정적 가드 보강 + 회귀 테스트 +
`CHANGELOG.md`/`plan/in-progress/trigger-config-lost-update.md`)은 매트릭스 21개 trigger
(glob 12 + semantic 9) 전수 대조 결과 매칭 0건이다. frontend/channel-web-chat/expression-engine/
nodes/auth/controller·DTO/spec 어디에도 변경이 없어 docs MDX·i18n dict·`backend-labels.ts`·
`locale.ts` 동반 갱신 대상 자체가 발생하지 않는다. 웹훅 인입 서명 검증(`inboundSigningRef`)이
개념적으로 "인증"과 인접해 보여 `auth-session-flow-change` semantic trigger 를 그레이존으로
재검토했으나, 대상 문서(`07-workspace-and-team/`, 워크스페이스/팀 흐름)와 실제 변경 대상
(provider→서버 웹훅 서명 키의 동시성 보존)이 다른 층이라 불일치로 판단했다. 이 결론은 동일
changeset 계열에 대한 선행 리뷰 라운드 7건(`18_17_44`~`22_24_35`)의 동일 판정과도 일치한다.
유저 가이드 동반 갱신 관점의 누락은 0건이며, 리뷰 중 관측된 일시적 파일 상태 변동은 병렬
리뷰어 뮤테이션으로 판단되고 현재는 해소되어 있다(위 "참고" 절 참조).

## 위험도

NONE
