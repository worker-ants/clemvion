# 문서화(Documentation) 코드 리뷰

리뷰 일시: 2026-05-24
대상 브랜치: form-resubmit-fix-b1caa8
관련 spec: spec/4-nodes/3-ai/1-ai-agent.md §12.6, spec/4-nodes/6-presentation/0-common.md §10.9

---

## 발견사항

### [INFO] `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수의 JSDoc — SoT 링크는 적절하나 사용처 열거 미흡
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 205–215
- 상세: JSDoc 이 존재하며 `SoT: spec/4-nodes/3-ai/1-ai-agent.md §12.6` 를 명시하고 있다. 단일 상수 추출 이유("두 위치의 표현이 어긋나면 LLM 이 충돌 신호로 해석")도 기록되어 있다. 그러나 이 상수가 실제로 사용되는 위치(tool_result content 직렬화, 라인 163)가 JSDoc 에 언급되지 않아 미래 독자가 사용처를 grep 없이 파악하기 어렵다.
- 제안: `@see` 태그 또는 "사용처: `processMultiTurnMessage` 의 `form_submitted` 분기 — tool_result content JSON" 한 줄 추가.

---

### [INFO] `PRESENTATION_TOOLS_GUIDANCE` 상수 — 신규 `form_submitted` 라인 추가가 JSDoc 미반영
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 186–203
- 상세: `PRESENTATION_TOOLS_GUIDANCE` 에는 module-level JSDoc 이 없다. 이미 기존 코드에서 JSDoc 이 없는 상수이므로 이번 변경의 단독 책임은 아니다. 그러나 `form_submitted` 처리 안내 라인이 추가된 이번 기회에 이 상수의 목적(LLM system prompt 주입용 안내문)과 spec 근거(`§12.6`, `§6.1.d.ii`)를 JSDoc 으로 명시했다면 일관성이 높아졌을 것이다.
- 제안: 블록 주석으로 `/** LLM system prompt 의 표현 도구 호출 결과 해석 가이드라인. SoT: spec/4-nodes/3-ai/1-ai-agent.md §12.6 (form_submitted 케이스 포함). */` 추가.

---

### [INFO] 테스트 인라인 주석 — spec 앵커 정확성 양호, 단 `§12.6` 신규 절 추가 이전 커밋 참조 유의
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` 라인 43–44, 62, 72–75
- 상세: 테스트 케이스 상단 주석이 `spec §12.6`, `PR #299`, 날짜(2026-05-24)를 정확히 참조하고 있어 회귀 차단 맥락을 이해하기 좋다. `// spec §12.6 — LLM 재호출 가드 필드 … 동일 form 재호출 회귀 차단 (2026-05-24 회귀, PR #299)` 형태는 히스토리로서의 가치가 높다. 개선 여지는 없다.

---

### [INFO] e2e 픽스처 헬퍼 함수 `setupDiscordTrigger` / `setupSlackTrigger` — JSDoc 없음 (기존 문제, 변경으로 악화 없음)
- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` 라인 23, `codebase/backend/test/chat-channel-slack.e2e-spec.ts` 라인 44
- 상세: `setupDiscordTrigger` / `setupSlackTrigger` 는 DB fixture 셋업 헬퍼로 반환 타입이 `Promise<{triggerId, endpointPath}>` 이다. 이번 변경은 INSERT 쿼리의 컬럼 목록 및 값을 DB 스키마 변경(`role` → `email_verified`, `workflow.is_active/current_version/created_by`, `trigger.name` 추가)에 맞춰 동기화한 것으로, 기능 변경이 아닌 픽스처 정합성 수정이다. JSDoc 은 원래 없었으며 이번 변경이 그 상태를 악화시키지는 않는다. 다만 `email_verified`, `is_active`, `current_version`, `created_by`, `name` 같은 신규 필드가 추가된 배경(스키마 마이그레이션)을 설명하는 짧은 주석이 픽스처 함수 상단에 있었다면 후속 개발자가 스키마 기대값을 파악하기 더 쉬웠을 것이다.
- 제안: 필수 아님. 선택적으로 `// DB schema: user.email_verified (not null), workflow.is_active/current_version/created_by, trigger.name (not null)` 한 줄 추가.

---

### [WARNING] spec 갱신 체크리스트 항목이 아직 미완료 상태 — spec 과 코드가 동시 PR 에 포함됐는지 확인 필요
- 위치: `plan/in-progress/form-resubmit-fix.md` 체크리스트 항목 4 (`[ ] project-planner 위임`)
- 상세: plan 체크리스트 항목 4(`project-planner 위임 — spec 본문 + Rationale 보강`)가 `[ ]` (미완료)로 표시된 채 코드 변경이 진행됐다. 실제 spec 파일(`spec/4-nodes/3-ai/1-ai-agent.md §12.6`, `spec/4-nodes/6-presentation/0-common.md §10.9 §Changelog`)은 이미 업데이트되어 있음을 확인했다 — spec §12.6 Rationale 신설, §4.1 표의 tool_result shape 갱신, §6.1.d.ii 및 §6.2 step 2.c 의 가드 필드 명시, §10.9 (4)layer 업데이트, §Changelog 행 추가가 모두 반영되어 있다. 따라서 실질적인 spec-code drift 는 없다. 그러나 plan 의 체크리스트 항목 4가 `[x]` 로 표시되지 않아 문서 상태와 실제 상태가 불일치한다.
- 제안: `plan/in-progress/form-resubmit-fix.md` 의 체크리스트 항목 4를 `[x]` 로 갱신하고, 항목 5(`consistency-check --impl-prep`) 도 실행 여부에 따라 상태 업데이트.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md §12.6` — Rationale 신설 절 품질 우수
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 1181–1207
- 상세: §12.6 Rationale 이 회귀 시점(커밋 해시, PR 번호, 날짜), 원인 2가지(가드 신호 소실 + user input 오독), 채택/기각 옵션 표, `rendered:false` 기각 이유, `status:'form_submitted'` 기각 이유, §12.5 의 reasoning autonomy 원칙과의 정합 설명을 모두 포함하고 있다. 문서화 관점에서 이 수준의 Rationale 기록은 모범 사례이다. 추가 개선 사항 없음.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md §Changelog` — 업데이트 확인
- 위치: `spec/4-nodes/6-presentation/0-common.md` 라인 427
- 상세: §Changelog 에 `2026-05-24` 항목이 추가되어 있으며 변경 사유("재호출 가드 필드 `ok: true` + `message` 추가, 다른 layer 변경 없음, 결정 근거 링크")가 명시되어 있다. 변경 이력 문서화가 적절히 완료되어 있다.

---

### [INFO] README / API 문서 업데이트 불필요
- 상세: 이번 변경은 내부 LLM 프롬프트 가드 로직 수정이다. 외부 API 엔드포인트 시그니처 변경이 없고, 설정값(환경변수, 옵션)도 추가되지 않았다. 공개 README 나 API 문서 업데이트는 불필요하다.

---

## 요약

이번 변경(`render_form` submit 후 LLM 재호출 가드 필드 보강)은 문서화 관점에서 전반적으로 양호하다. `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수에 JSDoc 이 제공되어 있고, 테스트 케이스에는 spec 앵커·커밋 해시·날짜가 명확히 기록되어 있으며, spec 파일(`1-ai-agent.md §12.6`, `0-common.md §10.9 §Changelog`)도 코드와 정합하게 업데이트되어 있다. 주요 우려 사항은 plan 체크리스트 항목 4가 `[x]` 로 표시되지 않아 문서 상태와 실제 상태가 불일치하는 점(WARNING 1건)이다. `PRESENTATION_TOOLS_GUIDANCE` 상수의 JSDoc 부재와 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 의 사용처 미기술은 개선 권장이나 필수는 아닌 INFO 수준이다. e2e 픽스처 헬퍼의 JSDoc 부재는 기존 문제로 이번 변경이 악화시키지 않았다.

## 위험도

LOW
