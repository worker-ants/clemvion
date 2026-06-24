# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep`
검토 범위: `system-prompt.ts` Self-review skip 안내 정합화 — `prompts/system-prompt.ts` 의 `PLAN_NOT_COMPLETE already fired this turn` clause 제거 후 코드·spec·프롬프트 3자 정합 확인

---

## 발견사항

### **[CRITICAL]** spec §10 "review skip 조건" 목록에 제거된 `finishBlockCount > 0` 조건이 잔존

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/3-workflow-editor/4-ai-assistant.md` §10 (line 958)
  ```
  - `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
  ```
- **위반 규약**: 동 spec 문서 §10 line 954 자체 규약 — "시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지 (프롬프트·구현 drift 가 곧 LLM 혼란으로 이어짐)" + CLAUDE.md 단일 진실 원칙
- **상세**:
  - spec §5 Rationale (line 1072-1088, "Review guard 항상 발동") 은 `finishBlockCount > 0` skip 조건을 **명시적으로 제거**하기로 결정했고, 현재 코드(`assistant-finish-guard.service.ts` `shouldSkipReview`, lines 322-341)도 해당 조건이 없다.
  - `system-prompt.ts` line 382 의 현행 프롬프트 문구("a prior `PLAN_NOT_COMPLETE` this turn does NOT skip review — plan completeness and workflow-quality review are independent layers, so review can still fire after the plan guard passes")는 코드 및 §5 Rationale 결정과 **정합**되어 있다.
  - 그러나 spec §10 의 `shouldSkipReview` 조건 열거 목록(line 956-961)은 갱신되지 않아 `finishBlockCount > 0` 가 그대로 남아 있다. 이 목록은 spec 자체의 SoT 단락이므로 이를 읽는 개발자·일관성 검토자·LLM 이 "현재도 유효한 skip 조건" 으로 오독할 위험이 있다. spec 이 스스로 "동기화 유지" 를 강제하는 구조임에도 spec 내부에서 두 단락이 상충하고 있다.
- **제안**: spec §10 "review skip 조건 (`shouldSkipReview`)" 목록(line 958)에서 `state.finishBlockCount > 0` 항목을 삭제한다. 대신 §5 Rationale 의 결정 참조 링크(예: `§5 "Review guard 항상 발동" 결정으로 제거`)를 인라인 주석으로 추가하면 이력 추적에 도움이 된다.

---

### **[INFO]** 문서 구조 — 3섹션 권장 (Overview / 본문 / Rationale) 준수 여부

- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` 전체
- **위반 규약**: CLAUDE.md "정보 저장 위치 / Spec 문서 3섹션 구성" 권장
- **상세**: 본 spec 은 §1(개요)·본문(§2~§13)·§5 Rationale 구조를 갖추고 있어 3섹션 권장을 충족한다. 이번 변경 범위(system-prompt.ts 프롬프트 문구 수정)는 spec 구조 자체를 건드리지 않으므로 별도 조치 불필요.
- **제안**: 없음.

---

### **[INFO]** API 문서 규약 — 해당 없음

- 이번 변경은 `prompts/system-prompt.ts` 의 LLM 안내 문구(순수 TypeScript 문자열)를 수정하는 것으로, OpenAPI/Swagger 데코레이터·DTO 명명 패턴 규약(`spec/conventions/swagger.md`)의 적용 대상이 아니다.

---

## 요약

이번 변경의 핵심인 `system-prompt.ts` 프롬프트 문구(line 382)는 코드(`shouldSkipReview` 구현)·spec §5 Rationale 결정과 이미 정합되어 있어 behavior-neutral 수정 목표가 달성되어 있다. 단, spec §10 의 `shouldSkipReview` 조건 열거 목록(line 958)이 §5 결정을 반영하지 않은 채 `finishBlockCount > 0` 를 여전히 유효 조건으로 기재하고 있어, spec 내부 두 단락이 상충하는 CRITICAL 불일치가 존재한다. 이 단락은 spec 자신이 "시스템 프롬프트와 반드시 동기화 유지" 를 강제하는 SoT 목록임에도 불구하고 갱신이 누락된 것이다. 구현 착수 전에 spec §10 해당 항목 제거가 필요하다.

## 위험도

**MEDIUM** — spec §10 의 stale 조건은 구현(코드·프롬프트)과 이미 달라졌으므로 런타임 동작에는 영향이 없다. 그러나 이후 개발자·검토자가 §10 목록을 보고 코드에 조건을 재삽입하거나 spec 을 "구현과 다르다"고 판단해 불필요한 되돌리기를 시도할 위험이 중간 수준으로 존재한다.

STATUS: OK
