# 변경 범위(Scope) Review

대상 Plan: `plan/in-progress/trigger-create-multi-provider-ui.md`
선언된 범위: Commit 0 (spec drift 정정) + Commit 1 (DTO/service) + Commit 2 (modal/UI) + Commit 3 (i18n) + Commit 4 (guide/ImplAnchor) + Commit 5 (e2e) + spec drift catch-up

---

## 발견사항

### [WARNING] 파일 4/5 — ai-agent 영역 코드 삭제 (capFormDataBytes / FORM_SUBMITTED_MAX_BYTES / formData cap 로직)

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` + `ai-agent.handler.spec.ts`
- 상세: 이 두 파일에서 `capFormDataBytes` 헬퍼, `FORM_SUBMITTED_MAX_BYTES` 상수, formData 10KB cap 로직, 관련 테스트 3건이 **전부 삭제**되었다. 이 코드는 별도 plan `ai-agent-formdata-size-limit.md` (완료됨, `plan/complete/` 에 존재)의 결과물이며, 해당 plan 이 이미 `plan/complete/` 로 이동되어 있다는 사실 자체가 "구현 완료 + 머지됨"을 의미한다. 그런데 본 plan (`trigger-create-multi-provider-ui`)의 어디에도 "ai-agent formData cap 롤백/제거"가 작업 항목으로 포함되어 있지 않다.

  삭제가 의도적이라면(예: `ai-agent-formdata-size-limit` PR 이 아직 실제 머지 전 상태이고 이 worktree 가 rebase/병합 과정에서 제거하기로 결정한 경우), plan 에 해당 결정 근거가 명시되어야 한다. 현재 plan 에는 이 제거에 대한 언급이 전혀 없다.

- 제안: (a) 이 삭제가 의도적이라면 plan Commit 경계 또는 별도 Commit 으로 명시하고 사유를 기록. (b) 의도치 않은 삭제라면 `capFormDataBytes` 헬퍼와 관련 테스트를 복구해야 한다.

---

### [WARNING] 파일 43 — spec/4-nodes/6-presentation/0-common.md 의 formDataTruncation 항목 삭제

- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 LLM tool_result content layer 설명, §Changelog
- 상세: `ai-agent-formdata-size-limit` plan 이 추가한 두 항목이 이 PR 에서 삭제되었다.
  1. §10.9 (4) layer 셀에서 `data` 크기 10KB cap + `formDataTruncation` 메타 관련 문구 제거.
  2. §Changelog 에서 2026-05-24 `formDataTruncation` 보강 기록 행 삭제.

  이는 별도 완료된 plan 의 spec 반영분을 본 PR 에서 원복하는 것으로, 본 plan 의 선언된 범위(spec drift catch-up은 CCH-AD-01 및 `2-trigger-list.md` 한정)에 속하지 않는다.

- 제안: 이 삭제의 의도를 명확히 해야 한다. `ai-agent-formdata-size-limit` plan 이 아직 머지되지 않은 상태에서 이 worktree 가 분기했을 가능성이 있다. 의도치 않은 범위 이탈이라면 해당 spec 변경분을 복구해야 한다.

---

### [WARNING] 파일 42 — spec/4-nodes/3-ai/1-ai-agent.md 의 §12.7 삭제

- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.7 전체
- 상세: `ai-agent-formdata-size-limit` plan 에서 신설한 §12.7 ("render_form submit 후 formData 크기 cap") 의 전체 내용이 삭제되었다. 이는 위의 코드 삭제와 짝을 이루는 변경이지만, 역시 본 plan 의 선언된 범위 밖이다.
- 제안: ai-agent 영역 삭제들이 모두 동일한 원인(worktree 분기 시점 기준 `ai-agent-formdata-size-limit` commit 이 미반영)에서 비롯된 것으로 판단된다. 의도적 롤백이 아니라면 복구 필요.

---

### [WARNING] 파일 6/8/19 — chat-channel-unverified-owner e2e 케이스 삭제 및 fixture ownerEmailVerified 옵션 제거

- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts`, `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts`, `plan/complete/chat-channel-unverified-owner-e2e.md`
- 상세:
  1. `chat-channel-discord.e2e-spec.ts` 에서 "owner.emailVerified=false trigger 의 inbound (PING) → 200" 케이스가 삭제됨.
  2. `e2e-chat-channel-fixture.ts` 에서 `ownerEmailVerified?: boolean` 파라미터와 관련 쿼리 분기가 제거되어 `email_verified = true` 하드코딩으로 단순화됨.
  3. `plan/complete/chat-channel-unverified-owner-e2e.md` plan 문서가 삭제됨.

  `chat-channel-unverified-owner-e2e` plan 은 PR #301 ai-review security INFO #2 의 후속 hardening 이었으며 완료된 별개 plan 이다. 이 케이스 삭제는 본 plan 의 선언된 범위("e2e 3 provider round-trip 신설")와 무관하다. `ownerEmailVerified=false` 케이스 제거는 regression guard 를 약화시키는 방향이다.

- 제안: 이 삭제가 의도적이라면 명확한 사유가 필요하다(예: 동일 내용을 다른 e2e 파일에서 커버). 의도치 않은 삭제라면 해당 케이스와 fixture 파라미터를 복구해야 한다. plan/complete 의 문서 삭제도 함께 복구 대상이다.

---

### [WARNING] 파일 18/21–32 — ai-agent-formdata-size-limit 관련 plan/complete 및 review/consistency 문서 삭제

- 위치: `plan/complete/ai-agent-formdata-size-limit.md`, `review/consistency/2026/05/24/18_00_25/` 하위 5개 파일, `review/consistency/2026/05/24/18_09_04/` 하위 9개 파일
- 상세: 완료된 plan 문서와 두 consistency-check 세션의 산출물 전체가 삭제되었다. 이 문서들은 이미 완료·아카이브된 히스토리 레코드로, 본 plan 의 어떤 commit 경계에도 삭제 대상으로 선언되어 있지 않다.
- 제안: 완료된 plan 과 review 산출물은 레포의 역사 기록이므로 무관한 PR 에서 삭제하는 것은 부적절하다. 이 삭제가 의도적인 정리 작업이라면 별도 `chore/cleanup` PR 로 분리해야 한다.

---

### [INFO] 파일 1 — chat-channel-config.dto.ts 주석 확장 (범위 내)

- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- 상세: SoT 주석에 slack/discord spec 문서 참조 추가, `inboundSigning` 관련 JSDoc 갱신, `inboundSigningPlaintext` 신규 필드 추가. 모두 Commit 1 의 선언된 범위에 해당한다. `@IsEmpty` 필드 에러 메시지가 slack/discord 를 언급하도록 갱신된 것도 정합하다.
- 제안: 없음. 범위 적합.

---

### [INFO] 파일 9 — frontend triggers/page.tsx (범위 내이나 diff 미표시)

- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx`
- 상세: diff 가 prompt size limit 으로 생략됨. plan Commit 2 의 선언된 변경(provider dropdown, inboundSigningPlaintext state, createMutation 확장)이 포함된 것으로 추정.
- 제안: 실제 diff 확인 불가로 세부 평가 불가. 그러나 이 파일은 핵심 scope 에 포함되므로 별도 확인 권장.

---

### [INFO] 파일 10–15 — 사용자 가이드 mdx 갱신 (범위 내)

- 위치: `triggers.{mdx,en.mdx}`, `slack.{mdx,en.mdx}`, `discord.{mdx,en.mdx}`
- 상세: Commit 4 의 선언된 범위에 해당. Telegram-only 표현을 3 provider 로 일반화, GUI 흐름 격상, `<ImplAnchor>` 추가, `<Callout>` 신설 모두 plan 에 기술된 내용과 일치한다.
- 제안: 없음. 범위 적합.

---

### [INFO] 파일 16–17 — i18n dict 갱신 (범위 내)

- 위치: `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`, `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
- 상세: Commit 3 의 선언된 범위에 해당. `addChatChannelToggle` 일반화 + `inboundSigning*` 키 분리(Slack/Discord) 신설. naming-collision-checker I-10 결정("provider별 분리 키 채택") 을 반영한 결과이기도 하다.
- 제안: 없음. 범위 적합.

---

### [INFO] 파일 44 — spec/5-system/15-chat-channel.md CCH-AD-01 갱신 (범위 내)

- 위치: `spec/5-system/15-chat-channel.md`
- 상세: Commit 0 의 선언된 spec drift 정정 범위에 해당. "impl pending" 문구 제거 및 R-CC-14 Rationale 추가.
- 제안: 없음. 범위 적합.

---

### [INFO] 파일 34–40 — review/consistency/2026/05/24/18_21_47/ 신규 생성 (범위 내)

- 위치: `review/consistency/2026/05/24/18_21_47/` 하위 파일들
- 상세: 이 PR 의 consistency-check (`--impl-prep`) 세션 결과물이다. 본 PR 의 진행 체크리스트 의무(구현 착수 직전 consistency-check)에 따른 정상 산출이다.
- 제안: 없음. 정상 절차 산출.

---

## 요약

본 변경은 DTO/service/modal/i18n/guide/e2e + spec drift catch-up 이라는 선언된 범위를 대체로 올바르게 이행하고 있으나, 선언된 범위를 크게 벗어나는 **4건의 WARNING** 이 존재한다. 가장 심각한 문제는 이미 완료된 별개 plan(`ai-agent-formdata-size-limit`)의 구현물 — `capFormDataBytes` 헬퍼, `FORM_SUBMITTED_MAX_BYTES` 상수, formData 10KB cap 로직, 관련 spec(`1-ai-agent.md §12.7` + `0-common.md §10.9` `formDataTruncation` 항목) — 이 이 PR 에서 전부 삭제된 점이다. 마찬가지로 `chat-channel-unverified-owner-e2e` 의 regression guard e2e 케이스와 fixture 옵션도 삭제되었다. 이 삭제들은 worktree 분기 시점 이슈(이 worktree 가 해당 commit 들이 반영되기 전 분기한 후 리베이스/머지 과정에서 덮어쓰인 것으로 추정)에서 비롯된 것으로 보이지만, 어떤 경우에든 완료된 plan 의 성과물을 본 plan 범위에서 제거하는 것은 **의도 이상의 변경**에 해당하며 복구 또는 명시적 결정 기록이 필요하다.

---

## 위험도

HIGH

STATUS: OK
