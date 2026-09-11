# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 이 target(`impl-chat-channel-binder-t2`, `spec_impact: none` 순수 코드 이동)을 막을 사유 없음.

## 전체 위험도
**LOW** — spec 본문(target scope `spec/5-system/`)은 무변경이고 이동 자체는 동작 보존이 실측으로 확인됐다. 남은 이슈는 전부 plan/문서 bookkeeping 층(귀속 서술 stale화, frontmatter 갭, 체크박스 stale)이며, 다수가 이전 `--impl-prep`(`17_39_32`) 라운드에서 이미 발견돼 `plan/in-progress/spec-draft-nullable-notation-followups.md` durable 트래커에 등재된 항목의 재확인이다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 이 없으므로 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `spec-draft-nullable-notation-followups.md` 의 `spec_impact` frontmatter 가 같은 커밋(`7e9aaa736`)에서 신규 등재한 본문 항목(W2, "setupChatChannel 귀속 표기 3곳")의 편집 대상 파일 2개를 누락 — 이 파일 자신이 이미 한 번 겪은 실패 모드(`review/consistency/2026/09/06/16_29_00` INFO#2)의 재발 | `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter `spec_impact`(8~26행) vs 본문 2313~2333행 | `spec/conventions/chat-channel-adapter.md`, `spec/data-flow/14-chat-channel.md` (본문은 이 둘+`secret-store.md` 3곳을 정정 대상으로 명시하나 frontmatter 엔 `secret-store.md` 만 있음) | planner 가 이 트래커를 다음에 열 때 `spec_impact` 에 위 2줄 추가. developer(이 PR)는 `spec/` 쓰기 권한이 없어 직접 고칠 수 없음 — 다음 planner 턴 대기 |
| 2 | plan_coherence | T2 plan 체크리스트가 이미 완료된 후속 등재 작업(`--impl-prep` W1~W4, 커밋 `7e9aaa736` 로 완료 확인)을 미완료(`[ ]`)로 표시 — `plan/complete/` 이동 시 "후속 등재 안 됨" 오독 위험 | `plan/in-progress/impl-chat-channel-binder-t2.md:184` | `spec-draft-nullable-notation-followups.md`(2213·2313·2335·2344행, 완료된 W1~W4 항목) | 마무리 커밋에서 이 항목을 `[x]` 로 갱신(근거: `7e9aaa736` 커밋 해시 인용). developer 의 `plan/**` 쓰기 권한 범위 내 — 이 PR 세션에서 즉시 처리 권장 |
| 3 | convention_compliance (cross_spec 도 독립 지적, INFO) | `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록과 §7 파일 구조가 T1+T2 신설 구현 경로(누적 8개: 이번 T2 의 `chat-channel-binder.service.ts`·`trigger-callback-url.ts` 포함)를 반영하지 못함 | `spec/5-system/15-chat-channel.md` frontmatter(6~9행), §7(528~538행) | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`, `trigger-callback-url.ts` (신규, 이번 diff) | 이미 `spec-draft-nullable-notation-followups.md` 에 8개 갭으로 정확히 재갱신 등재됨(glob 전환 대안 병기) — 새 조치 불요, planner 턴 대기 중임을 기록만 |
| 4 | cross_spec (rationale_continuity 가 "처분 확인"으로 재확인, convention_compliance 도 INFO 로 독립 지적) | `setupChatChannel`/`teardownChatChannel` 이 신규 `ChatChannelBinderService` 로 이동했으나 관련 문서 3곳이 여전히 `TriggersService`/`triggers.service.ts` 를 정의처로 서술(심볼 귀속만 stale, 규칙의 실질은 불변) | (target 밖 참조 문서) `spec/conventions/secret-store.md:146`, `spec/conventions/chat-channel-adapter.md:369`, `spec/data-flow/14-chat-channel.md:29` | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (실제 정의처, `triggers.service.ts` 는 호출만) | 이미 `spec-draft-nullable-notation-followups.md` 에 정확한 3곳·처방 문구와 함께 planner 항목으로 등재됨(단, 위 WARNING #1 이 그 등재의 frontmatter 누락을 지적) — 새 조치 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | `buildTriggerCallbackUrl` 이 `getAppBaseUrl()`(`common/utils/app-base-url.ts`)과 개념적으로 겹침(APP_URL fallback) — 이름 충돌은 아님. `--impl-prep` WARNING 의 권고(중복·통합 대상임을 docstring 에 명시)가 실제 코드(`trigger-callback-url.ts:24-30`)에 반영된 것을 확인해 INFO 로 재평가 | `codebase/backend/src/modules/triggers/trigger-callback-url.ts:24-30` vs `codebase/backend/src/common/utils/app-base-url.ts:12` | 조치 불요 — 별도 PR 통합 과제로 이미 문서화됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec_impact: none` 실측 일치. 유일 영향은 심볼 귀속 서술 3곳 stale(이미 planner 등재) |
| rationale_continuity | NONE | 발견 없음 — R-CC-21 등 Rationale invariant 모두 이동 전후 동일 유지 확인, 직전 WARNING 처분도 정확히 확인 |
| convention_compliance | LOW | 명명·DI·secret-store 의미론 전부 준수. `code:` frontmatter 갭(누적 8개, 이미 등재) + 귀속 표기 3곳(이미 등재) |
| plan_coherence | LOW | 이전 라운드 WARNING/INFO 는 트래커로 정확히 이관 확인. 다만 이관 자체의 `spec_impact` 2개 누락 + T2 plan 체크박스 stale, 신규 발견 |
| naming_collision | NONE | 신규 식별자 4개 전수 grep, 이름 충돌 0건. `buildTriggerCallbackUrl` 개념 중복은 이미 문서화 확인돼 INFO 하향 |

## 권장 조치사항
1. (developer, 이 세션에서 즉시 가능) `plan/in-progress/impl-chat-channel-binder-t2.md:184` 체크박스를 `[x]` 로 갱신 — 근거: 커밋 `7e9aaa736` 이 W1~W4 를 트래커에 이미 등재함.
2. (planner 다음 턴) `spec-draft-nullable-notation-followups.md` 의 `spec_impact` frontmatter 에 `spec/conventions/chat-channel-adapter.md`, `spec/data-flow/14-chat-channel.md` 2줄 추가.
3. (planner 다음 턴, 기존 등재분 처리) `spec/5-system/15-chat-channel.md` frontmatter `code:` 재갱신(누적 8개 파일 반영 또는 `modules/triggers/**` glob 전환) + `secret-store.md`·`chat-channel-adapter.md`·`data-flow/14-chat-channel.md` 3곳의 `setupChatChannel` 귀속 서술을 `ChatChannelBinderService` 로 정정.
4. 이 PR(`impl-chat-channel-binder-t2`) 자체는 위 3항목 모두 developer 권한 밖(자기-반증형 소정정 조건 1 불성립)이거나 이미 완료 가능한 bookkeeping 이라 병합을 막을 사유가 없음.
