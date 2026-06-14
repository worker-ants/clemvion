# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] chat-channel.dispatcher.ts — IIFE 패턴 인라인 주석 충분하나 스프레드 패턴 의도 설명 부족
- 위치: `chat-channel.dispatcher.ts` 라인 311–315
- 상세: `...(() => { const title = ...; return title ? { title } : {}; })()` 형태의 IIFE 스프레드 패턴은 기능적으로 올바르지만, 왜 단순 `if (title) state.pendingFormModal.title = title;` 대신 이 패턴을 선택했는지 설명이 없다. 인라인 주석 `// §3.3 — formConfig.title ...` 은 무엇(what)은 설명하지만 이 형태를 선택한 이유(왜 스프레드·IIFE)는 없다.
- 제안: 주석에 "pendingFormModal 이 이미 확정된 object literal 이라 조건부 key spread 로 정의" 정도 1줄 추가.

### [INFO] form-mode.ts — `extractFormTitle` JSDoc 은 충분하나 `extractFormFields` 의 기존 JSDoc 에 §3.3 validation 추가 사항 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` 라인 547–552 (extractFormFields JSDoc)
- 상세: `extractFormFields` 의 기존 JSDoc 은 fields[] 정규화, 두 shape 수용, 빈 배열 반환 규칙만 서술한다. 이번 변경으로 `field.validation.{minLength,maxLength}` 를 정규화해 `FormModalField.minLength/maxLength` 로 내보내는 새 동작이 추가됐으나 JSDoc 에는 반영되지 않았다.
- 제안: JSDoc 에 `@param formConfig.fields[].validation.minLength/maxLength — §3.3 TEXT_INPUT 길이 제약. 유효 시(minLength≥0, maxLength>0) FormModalField 에 전달.` 한 줄 추가.

### [INFO] discord.adapter.ts — `openFormModal` JSDoc 에 §3.3 title/min_length/max_length 동작 미기술
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` 라인 1874–1879 (`openFormModal` JSDoc)
- 상세: 기존 JSDoc 은 "TEXT_INPUT only — custom_id = field name" 수준의 설명이다. 이번 변경으로 (a) `params.title` 우선 → `languageHints.formModalTitle` → `'양식'` fallback, (b) 45자 truncate, (c) `min_length`/`max_length` 조건부 부여 등 세 가지 동작이 추가됐으나 JSDoc 에 누락됐다.
- 제안: JSDoc 마지막 줄에 `title: params.title → languageHints.formModalTitle → '양식' (≤45자 truncate). min_length/max_length: field.minLength/maxLength 가 있을 때만 부여 (Discord 0–4000 cap).` 추가.

### [INFO] types.ts — `languageHints` 주석에 `formModalTitle` 키 미등록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/types.ts` `ChatChannelConfig.languageHints` JSDoc (라인 2862–2873)
- 상세: `languageHints` 필드의 JSDoc 은 "기타 안내 키" 목록에 `formOpenLabel`, `sessionExpired` 를 명시하나, 이번 변경에서 Discord `openFormModal` 이 참조하는 `formModalTitle` 및 `replyModalTitle`/`replyModalLabel` 키가 목록에 없다. 새 키를 사용하는 어댑터 개발자나 설정자는 이 목록만 보면 해당 키가 존재한다는 것을 알 수 없다.
- 제안: `기타 안내 키` 목록에 다음 추가:
  - `formModalTitle` — Discord native form modal 제목 (§3.3, 미설정 시 '양식')
  - `replyModalTitle` — Discord reply modal 제목 (§5.1(b), 미설정 시 '답변')
  - `replyModalLabel` — Discord reply modal TEXT_INPUT 라벨 (미설정 시 '메시지')

### [INFO] discord.adapter.spec.ts — 테스트 파일 최상위 JSDoc 이 변경사항 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts` 라인 1134–1137 (최상위 JSDoc)
- 상세: 최상위 주석 `DiscordAdapter 단위 테스트 — provider 식별자 + 6함수 wiring + setupChannel + parseUpdate + sendMessage 핵심 분기.` 는 이번에 추가된 `openFormModal` §3.3 케이스(title, truncate, min/max length)와 `setupChannel` publicKey 캐시 검증 케이스를 열거하지 않는다.
- 제안: `+ openFormModal §3.3 (title 동적화, 길이 제약)` 을 한 줄 추가하거나, 테스트 모듈 설명 수준이라 영향 낮음.

### [INFO] discord-message.renderer.spec.ts — 최상위 JSDoc 이 ai_message 섹션 추가를 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.spec.ts` 라인 584–587 (최상위 JSDoc)
- 상세: `Discord renderer 단위 테스트 — execution.failed CCH-ERR-* 분기 위주. 기존 discord.adapter.spec.ts 가 happy path 를 커버. 본 spec 은 신규 §5.6 분기.` 로 시작하나, 이번에 ai_message §5.1(b) reply 버튼 테스트가 추가됐고, 이미 presentations·node.completed 케이스도 포함됐다. "CCH-ERR-* 분기 위주" 와 "§5.6 분기" 서술은 실제 범위보다 좁다.
- 제안: JSDoc 을 `Discord renderer 단위 테스트 — CCH-ERR-* (§5.6), ai_message §5.1(b) reply 버튼, execution.node.completed (CCH-MP-06), presentations[] (CCH-MP-01) 분기` 로 갱신.

### [INFO] spec/discord.md — §5.1(b) 현재 구현 상태 설명 스타일 불일치 (minor)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/spec/4-nodes/7-trigger/providers/discord.md` 라인 3517
- 상세: 변경 후 "계획상 v1 default UX = (b) modal … 현재는 (a) `/<prefix> reply` slash 만 동작한다. (b) 도입 시 (a) 는 power user 보조 옵션으로 병존." 문장이 남아 있다. 그런데 §5.1(b) 는 이제 구현됐으므로 "현재는 (a) slash 만 동작한다" 는 stale 이다. 이미 plan 파일과 위 §5.1(b) 설명은 구현 완료를 반영했으나 결론 단락은 미반영.
- 제안: 해당 문장을 "v1 에서 (a) slash command 와 (b) Reply 버튼 모달이 모두 동작한다. (b) 가 default UX, (a) 는 power user 보조 옵션." 으로 정정.

### [NONE] plan/in-progress/spec-sync-discord-gaps.md — plan 체크박스 및 구현 진척 narration 업데이트 완료
- 위치: `plan/in-progress/spec-sync-discord-gaps.md`
- 상세: §3.1, §3.3, §5.1(b) 완료 체크, 보류 항목(이미지/embeds) 분리, 진척 narration 추가. 형식·내용 모두 적절하며 추가 액션 불필요.

## 요약

이번 변경은 Discord 어댑터의 §3.1(publicKey 캐시), §3.3(modal title 동적화 + TEXT_INPUT 길이 제약), §5.1(b)(reply 버튼 확인) 구현을 포함하며, spec 문서(`discord.md`)와 plan 파일이 동반 갱신됐다. 새로 추가된 공개 함수 `extractFormTitle` 에는 적절한 JSDoc 이 있고, 인라인 `§3.3` 주석도 일관되게 부여됐다. 다만 `extractFormFields` 기존 JSDoc 에 신규 validation 정규화 동작, `ChatChannelConfig.languageHints` 목록에 Discord 전용 3개 안내 키(`formModalTitle`, `replyModalTitle`, `replyModalLabel`), `openFormModal` JSDoc 에 title/길이 제약 동작이 반영되지 않아 설정자·어댑터 개발자가 공개 인터페이스만 보고 새 기능을 발견하기 어렵다. 또한 `discord.md` 결론 단락 한 문장이 "현재는 (a) slash 만 동작한다"는 stale 서술로 남아 있다. 전체적으로 문서화 품질은 양호하나 상기 4–5곳의 소규모 보완이 권장된다.

## 위험도

LOW
