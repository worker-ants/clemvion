# Rationale 연속성 검토 — trigger-workflow-ref-canary (impl-done, scope=spec/2-navigation/)

## 사전 고지 — 프롬프트 번들의 diff 섹션은 stale, 실제 HEAD 워킹트리로 재확인함

`_prompts/rationale_continuity.md` 에 실린 `## 구현 변경 사항`(`<git diff origin/main...HEAD -- code_areas>`) 섹션은 이 diff 의 **더 이른 초안**(해시 `4e66c321d`/`02bb31f19`/`ea5849dcf`, 94~200줄대)을 담고 있었다. 실제 HEAD 워킹트리(`git diff origin/main --`)의 최종본은 해시 `1499ef78c`/`c991e0e28`/`707ec1a4f` (135~248줄, `expectedWorkflowId`·`isUuidShaped`·`Object.hasOwn` null-가드·비밀 컬럼 혼입 테스트 등이 리뷰 반영으로 추가된 버전)이다. 아래 분석은 **HEAD 워킹트리의 최종본**을 대상으로 했다.

대상 diff (모두 신규 파일, 코드 전용, `spec/2-navigation/` 델타는 0):
- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`
- `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`

`plan/complete/trigger-workflow-ref-canary.md` 를 함께 읽어 이 작업이 이미 자체적으로 수행한 실측·반증·범위 조정을 대조했다.

## 발견사항

### [WARNING] 캐너리 case E 가 R-CC-10("Bot Token 변경 single-path") 위반 응답을 코드 주석 없이 200 으로 고정한다

- **target 위치**: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` — `it('E. PATCH /api/triggers/:id — chatChannel 포함 수정도 채운다 …')`. PATCH 바디에 `chatChannel: { provider: 'telegram', botToken: '111:e2eWfRefBotToken', uiMapping: {...} }` 를 실어 보내고 `expect(res.status).toBe(200)` 으로 성공을 단언한다.
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` `### R-CC-10. Bot Token 변경 single-path (rotate API only)` — "토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 이며 PATCH body 의 `botTokenRef` 변경은 차단한다." 이 invariant 는 `spec/2-navigation/2-trigger-list.md` §3(PATCH 본문 설명, line 169)과 §2.3.1 필드 권한 매트릭스(`botToken` 행)에서 직접 인용되어 본 target 영역(`spec/2-navigation/`)의 계약이기도 하다.
- **상세**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "**CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다**" 항목(line 1825~1891)이 이미 이 갭을 **판정 완료**로 등재했다 — `assertChatChannelInputSafe` 는 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 세 필드만 400 으로 막고, 값 자체를 나르는 `botToken` 은 `ChatChannelConfigDto` 에서 필수라 PATCH 로도 통과하며 `secrets.rotate()` 가 그대로 값을 덮어써 24h grace 백업·전용 audit action·`chatChannelRotatedAt` 갱신을 모두 건너뛴다는 것이 실측·판정됐다. 이는 이 PR 이 새로 만든 위반이 아니라 **사전 존재하는 프로덕션 결함**이며, `plan/complete/trigger-workflow-ref-canary.md` 도 이를 "이 PR 밖" CRITICAL 로 명시적으로 분리했다 — 그 처리 자체는 타당하다.
  다만 **case E 의 코드 자체에는 이 알려진 충돌에 대한 어떤 참조도 없다**(`grep -n "R-CC-10\|rotate-bot-token\|우회"` 결과 0건). 주석은 "botToken 은 생략할 수 없다"는 400 회피 사실만 설명하고, 그 우회가 R-CC-10 invariant 를 깨는 것이라는 맥락은 plan 문서(`plan/complete/**`, 이미 archive 성격)에만 남아 있다. 캐너리는 목적상 "지금의 응답 형태를 고정"하는 역할이라, 이 상태로 두면 향후 후속 처방(PATCH 전용 `ChatChannelConfigDto` 변형으로 `botToken` 제외)이 들어올 때 **왜 이 e2e 케이스의 payload 를 바꿔야 하는지**를 코드만 보고는 추적할 수 없고, 반대로 이 테스트가 "PATCH+botToken 200" 을 정상 계약처럼 보이게 할 위험이 있다.
- **제안**: `trigger-workflow-ref.e2e-spec.ts` 의 case E 근처(또는 파일 상단 JSDoc)에 "이 payload 는 R-CC-10 위반으로 판정된 기존 결함을 그대로 재현한다 — `spec-draft-nullable-notation-followups.md` 의 'bot token PATCH 우회' 항목이 해소되면 이 테스트의 요청 바디도 함께 바뀌어야 한다" 는 한 줄 참조를 남길 것. target(spec) 자체를 지금 고칠 필요는 없다 — 이미 별도 CRITICAL 항목으로 추적 중이므로 코드 쪽 참조 누락만 보완하면 된다.

### [INFO] spec §3 의 "이 축에는 캐너리가 아직 없다" 서술이 이 PR 로 이미 낡았음 — 처리는 적절히 범위 밖으로 이관됨

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §3, line 182 — "구현은 그 재조회에 `relations: ['workflow']` 를 실어 닫았지만, **자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다**"
- **과거 결정 출처**: 해당 문장은 이전 planner 턴(`spec-draft-schedule-trigger-ref-nav.md`, `owner: planner`)이 작성한 것이며, 이번 diff 로 `trigger-workflow-ref.e2e-spec.ts` 캐너리가 실제로 생겼으므로 이 문장은 이제 사실과 다르다.
- **상세**: 이는 "결정의 무근거 번복"이 아니라 **예고가 실측으로 반증된 사례**지만, `CLAUDE.md` §자기-반증형 소정정의 조건 1("대상 문장을 developer 자신이 그 문서에 썼다")이 성립하지 않는다 — `plan/complete/trigger-workflow-ref-canary.md` §T-4 가 바로 이 판단을 스스로 내려(--impl-prep 라운드에서 `rationale_continuity`·`plan_coherence`·`convention_compliance` 세 checker 가 독립적으로 CRITICAL 을 냈던 것에 대한 대응으로) 해당 문장 정정을 이번 PR에서 제외하고 후속 planner 턴(`plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 1)으로 명시적으로 이관했다. `spec_impact: none` 은 이 판단과 일치한다.
- **제안**: 조치 불필요 — 이미 올바르게 추적되고 있음을 확인하는 차원의 기록. 후속 planner 턴에서 §3 문장 정정 시 `3-schedule.md §4` 의 재검토 신호("optimistic update 로 create 응답 소비 시작 시 전제 붕괴") 한 줄도 트리거 축에 동기화해야 한다는 점만 상기.

### [INFO] 비밀 컬럼 3중 사본에 대한 하드닝 유예는 실제로 등재되어 있음 — 확인만

- **target 위치**: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 의 `TRIGGER_SECRET_COLUMNS` 상수 및 그 JSDoc ("이 목록은 정본의 세 번째 독립 사본이다 … repo-guard 로 세 목록 동일성을 강제하는 것이 처방이고 후속으로 등재했다")
- **확인 결과**: 실측 대조 결과 `triggers.service.ts::TRIGGER_RESPONSE_STRIP_COLUMNS`(비-export) · `schedule-trigger-ref.ts::TRIGGER_SECRET_COLUMNS` · 신규 `trigger-workflow-ref.ts::TRIGGER_SECRET_COLUMNS` 세 값이 현재 완전히 일치하며(`['notificationSecretV2', 'chatChannelTokenV2']`), 언급된 반증가능 근거("정본이 export 되지 않아 import 불가")도 사실과 일치한다. "후속으로 등재했다"는 주장도 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "**하드닝: 트리거 비밀 컬럼 목록이 3중 독립 사본이다**" 항목(2026-09-10 등재)으로 실제 확인된다. `CREATOR_PROJECTION` 선례 인용(동일 리터럴 다중 복사 → 단일 export 상수로 통합)도 `workflow-versions.service.ts` 의 실제 `export const CREATOR_PROJECTION` 존재로 뒷받침된다.
- **제안**: 없음 — target 이 근거를 지어내지 않았음을 확인하는 기록.

### 그 외 확인한 항목 — 문제 없음

- `PROJECT.md` §e2e 테스트 작성 가이드는 신규 e2e 헬퍼를 `codebase/backend/test/helpers/<name>.ts` 로 명시하지만, 이 diff 는 `src/shared/testing/trigger-workflow-ref.ts` 에 배치했다. 이는 규약과 다르지만 **선례가 실재**한다(`schedule-trigger-ref.ts`·`response-contract.ts`·`user-secret-absence.ts`·`swagger-probe.ts` 가 이미 같은 디렉터리에 self-spec 과 함께 존재) 그리고 이번 diff 의 JSDoc·plan 양쪽이 "왜 `test/helpers/` 가 아닌가"(unit jest 의 `rootDir:'src'`, `test/jest-e2e.json` 의 `.e2e-spec.ts$` regex 로 인해 `test/helpers/*.spec.ts` 가 영구히 안 돈다)를 근거와 함께 명시했다. PROJECT.md 규정 정정 자체는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 항목 3으로 이미 등재됨 — 합의된 원칙과의 거리감이 있으나 무근거 이탈이 아니라 **사유 명시 + 후속 등재**가 함께 있으므로 별도 지적 대상 아님.
- R-2(`hmacSecret` PATCH/rotate 분리, 폐기)·R-14(대체)의 인용 관계는 `spec/5-system/15-chat-channel.md` R-CC-10 문면과 정확히 일치했고, 이번 diff 는 이 폐기·대체 관계를 재도입하거나 왜곡하지 않는다.
- §5.4(부재 표현) 규칙 및 `TriggerDto.workflow` 의 "키 생략형" 근거(§5.4 기준 (b))는 이번 diff 의 헬퍼·테스트 판정 로직과 정확히 일치한다 — `present:false` 를 "키 자체 부재"로만 판정하고 `null` 을 별도로 거부하는 로직은 §5.4 규정을 정확히 반영한다.

## 요약

이번 diff 는 코드 전용(테스트 3파일, `spec/2-navigation/` 델타 0)이며, `plan/complete/trigger-workflow-ref-canary.md` 에 기록된 이력을 보면 이미 여러 라운드의 `/ai-review`·`--impl-prep`·`--impl-done` 을 거치며 근거 없는 선례 인용(“User 투영 상수 선례”)을 스스로 철회하고, 자기-반증형 소정정 오적용을 스스로 잡아 두 PR로 분리하는 등 Rationale 연속성 관점에서 매우 신중하게 처리되었다. 유일하게 실질적인 잔여 이슈는 **case E 캐너리가 R-CC-10(bot token 변경 single-path) invariant 를 위반하는 기존 프로덕션 동작을 200 성공으로 고정하면서도 코드 자체에는 그 충돌에 대한 참조가 없다**는 점이다 — 이 결함 자체는 이미 별도 CRITICAL 항목으로 추적 중이고 이 PR 의 스코프 밖이라는 판단은 타당하지만, 캐너리 코드에 그 연결고리를 남기지 않으면 향후 유지보수자가 이 응답 형태를 "의도된 계약"으로 오인할 위험이 있다. 그 외 spec §3 의 캐너리 부재 서술이 이 PR 로 낡아진 것, 비밀 컬럼 3중 사본 하드닝 유예는 모두 정상적으로 planner 후속 트래커에 등재되어 있음을 확인했다.

## 위험도

LOW
