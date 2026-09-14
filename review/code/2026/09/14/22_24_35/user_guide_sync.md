# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` — `rows[]` 21건 (glob match 12건, semantic match 9건) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (155~239행, "자주 누락되는 항목" 포함) Read 완료.

## 변경 파일 식별

리뷰 대상(실제 변경 set, 파일 1~19 — 20번 이후는 이전 라운드 리뷰 산출물로 컨텍스트일 뿐 이번 changeset 이 아님):

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/schedules/schedules.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (+ `.spec.ts`, fixture) — 정적 가드/테스트 인프라
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규 e2e)
- `plan/in-progress/trigger-config-lost-update.md` (`spec_impact: none`)

## trigger 매칭 판정

21개 행 전수 대조 — 매칭 0건.

| trigger | 판정 | 근거 |
|---|---|---|
| 새 노드 추가 / 노드 schema 변경 | 불일치 | `codebase/backend/src/nodes/**` 변경 0건 |
| 신규 UI 문자열 (TSX) / 신규 위젯 chrome 문자열 | 불일치 | `codebase/frontend/**`, `codebase/channel-web-chat/**` 변경 0건 |
| 통합 신규/제공자 변경 (semantic) | 불일치 | `chat-channel-binder.service.ts`·`chat-channel-input-rules.ts` 변경은 신규 provider·신규 설정 필드가 아니라, 기존 `chatChannel.inboundSigningRef` 추출을 `extractInboundSigningRef()` 헬퍼로 중복 제거한 내부 리팩터 + 쓰기 경로를 `save()`→컬럼 한정 `update()`/락 안 재작성으로 바꾼 동시성 수정이다. provider 어댑터(`*-adapter.ts`) 자체·사용자 대면 설정 절차·필드는 불변 |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | `content/docs/*/` 신규 디렉토리 0건 |
| 백엔드 API 추가·변경 (`*.controller.ts`, `dto/**`) | 불일치 | controller·DTO 변경 0건 |
| 신규 BullMQ 큐 추가 | 불일치 | `system-status.constants.ts` 변경 없음 |
| 신규 warningCode / errorCode 발행 | 불일치 | `warningRules`·`error-codes.ts` 변경 없음 |
| 신규 cross-cutting enum / 신규 backend ui.label 값 / 신규 handler output field | 불일치 | 해당 표면 변경 없음 |
| 인증·권한·세션 흐름 변경 (`modules/auth/**`, semantic) | 불일치 (그레이존 인지 후 판단) | glob 자체가 불일치(변경 경로는 `modules/triggers`·`modules/hooks`). semantic 으로도 재검토: `chatChannel.inboundSigningRef` 는 **인입 웹훅 서명 검증**(외부 provider → 우리 서버) 키이지, 매트릭스가 지목하는 `07-workspace-and-team/`(워크스페이스 로그인·팀 초대·멤버 권한, 사용자 → 우리 앱) 흐름과는 다른 층의 개념이다. `modules/auth/**` 파일은 diff 에 전혀 등장하지 않는다 |
| AuthConfig type enum 변경 | 불일치 | 해당 enum 변경 없음 |
| 표현식 언어 변경 | 불일치 | `codebase/packages/expression-engine/**` 변경 없음 |
| 실행·디버깅 흐름 변경 (semantic) | 불일치 | `engine.execute()` 호출 방식·실행 결과 표현은 그대로이고, 바뀐 것은 트리거 저장 경로의 동시성/락뿐이다. 사용자가 보는 실행·디버그 화면 동작에 영향 없음 |
| 환경 변수·런타임 변경 | 불일치 | 해당 없음 |
| spec 신규/대규모 변경 | 불일치 | `spec/**` 변경 0건. plan frontmatter `spec_impact: none` 과 일치 |
| user-guide GUI 흐름 절 신규/변경 | 불일치 | `content/docs/02-nodes/**`, `06-integrations-and-config/**` 변경 0건 |
| spec 자체 결함 발견 | 불일치 | 해당 판단 없음 |

## 자주 누락 패턴 (PROJECT.md §자주 누락) 대조

- i18n key parity — dict 변경 0건이라 해당 없음
- backend warning/error code → ko 매핑 — `warningRules`/`error-codes.ts` 변경 0건이라 해당 없음
- 노드 schema 변경 vs FieldTable — 노드 변경 0건
- cross-cutting enum N개 분기 — 해당 없음
- 새 backend ui.label/hint/group — 해당 없음
- handler output 신규 field — 해당 없음
- 새 노드/새 섹션 디렉토리 — 해당 없음
- 인증·세션 흐름 vs 워크스페이스 가이드 — 위 표에서 판정한 대로, `auth/**` 밖의 웹훅 서명 검증 내부 동시성 수정이라 미적용
- API 추가 vs swagger jsdoc — controller/DTO 변경 0건

`CHANGELOG.md` 갱신은 이미 이 변경 set 안에 포함되어 있고(사용자 대상 변경 로그로서), 매트릭스가 요구하는 문서/사전/backend-labels 동반 갱신 대상과는 별도 항목이다 — CHANGELOG 자체가 매트릭스의 target 은 아니므로 이 리뷰의 판정에 영향 없음.

## 발견사항

없음 — 매트릭스 21개 trigger 중 어느 것에도 매칭되는 변경이 없다.

## 요약

이번 변경 set(`codebase/backend/src/modules/triggers/**` · `hooks/**` · `schedules/**` 의 `trigger.config` lost-update 동시성 수정 + `repo-guards` 정적 가드 보강 + 회귀 테스트 + `CHANGELOG.md`/`plan/in-progress/trigger-config-lost-update.md`)은 매트릭스 21개 trigger(glob 12 + semantic 9) 전수 대조 결과 매칭 0건이다. `codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `*.controller.ts`/`dto/**`, `spec/**` 어디에도 변경이 없어 docs MDX·i18n dict·`backend-labels.ts`·`locale.ts` 동반 갱신 대상 자체가 발생하지 않는다. 웹훅 인입 서명 검증(`inboundSigningRef`)이 개념적으로 "인증"과 인접해 보여 `auth-session-flow-change` semantic trigger 를 그레이존으로 재검토했으나, 대상 문서(`07-workspace-and-team/`, 워크스페이스/팀 흐름)와 실제 변경 대상(provider→서버 웹훅 서명 키의 동시성 보존)이 다른 층이라 불일치로 판단했다. 이 결론은 동일 changeset 계열에 대한 선행 리뷰 라운드들(`18_17_44`/`19_07_43`/`19_44_08`/`20_17_16`/`20_49_15`/`21_18_21`/`21_50_09`)의 동일 판정과도 일치한다. 유저 가이드 동반 갱신 관점의 누락은 0건.

## 위험도

NONE
