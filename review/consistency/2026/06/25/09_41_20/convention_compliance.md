# 정식 규약 준수 검토 — web-chat-preview-improvements

검토 모드: `--impl-done`
Target: `plan/in-progress/web-chat-preview-improvements.md` + git diff `origin/main...HEAD`
검토 일시: 2026-06-25

---

## 발견사항

### [WARNING] `spec_impact` 는 완료(`complete/`) 이동 시점 필드 — in-progress 단계에 선언됨
- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` frontmatter, 7–9행 (`spec_impact:` 키)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — "`spec_impact` (완료 시점 필드, Gate C): in-progress 단계에선 의무 아님(완료 시점에만 `spec-plan-completion.test.ts` 가 강제)." §5 Gate C 항에서도 "완료 시 spec↔코드 정합 결정을 암묵에 두지 않고 frontmatter 에 명시" 로 완료-이동 시점 필드임을 명시.
- **상세**: 현재 plan 은 `status: in-progress` 이며 `plan/in-progress/` 에 위치한다. `spec_impact` 는 `plan/complete/` 이동 커밋 시점에 추가해야 하는 Gate C 선언이다. in-progress 단계에 미리 선언하는 것은 라이프사이클 규약과 어긋난다. 빌드 가드(`spec-plan-completion.test.ts`)는 `complete/` 로 이동한 plan 에만 발화하므로 현 시점엔 내용 정합성도 검증되지 않는다.
- **제안**: `spec_impact` 키를 현재 frontmatter 에서 제거하고, `plan/complete/` 이동 커밋(`chore(plan): mark web-chat-preview-improvements complete`) 시 추가한다. `related_spec` 이 이미 spec 연관 문서를 기록하고 있으므로 진행 중 참조는 충분하다.

### [INFO] `related_spec` 항목 중 디렉토리 경로 포함 — 파일 경로가 아님
- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` frontmatter 13행 (`spec/4-nodes/6-presentation`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 경로 필드(`spec_impact`, `pending_plans`)는 일관되게 파일 단위 경로 사용. `related_spec` 에 별도 스키마는 없으나, 링크 무결성 가드(`spec-link-integrity.test.ts`)가 frontmatter 경로를 검증할 경우 디렉토리 경로는 dangling 판정 대상이 될 수 있다.
- **상세**: `spec/4-nodes/6-presentation` 은 디렉토리이며 파일이 아니다.
- **제안**: `spec/4-nodes/6-presentation/_product-overview.md` 또는 해당 영역의 구체 진입 파일로 교체하거나, `related_spec` 이 링크 가드 검증 대상이 아님을 확인 후 현행 유지.

### [INFO] 구현 diff — `PRESENTATION_NODE_TYPES` 상수 명명 및 배치 정합 확인
- **target 위치**: `codebase/backend/src/common/constants/presentation.ts` (신설 파일)
- **위반 규약**: 해당 없음. 점검 목적으로 기술.
- **상세**: `PRESENTATION_NODE_TYPES` (UPPER_SNAKE_CASE), 경로(`common/constants/`), 파일명(`presentation.ts`) 모두 프로젝트 관행에 부합. 기존 로컬 Set 제거 + 공용 import 패턴 적용이 올바르다.
- **제안**: 이상 없음.

### [INFO] `ExecutionMessageEvent` 타입명 — DOM `MessageEvent` shadowing 회피 및 컨벤션 준수
- **target 위치**: `codebase/channel-web-chat/src/lib/eia-types.ts` — `ExecutionMessageEvent` interface
- **위반 규약**: 해당 없음.
- **상세**: `AiMessageEvent` 패턴(Event suffix)과 일관된 명명이며, JSDoc 에 DOM `MessageEvent` 와의 구분이 명기됐다. `EiaEventName` 유니언에 `"execution.message"` 추가도 기존 패턴(`"execution.ai_message"` 등)과 형식 일관.
- **제안**: 이상 없음.

---

## 요약

정식 규약 준수 관점에서 주된 지적은 하나다. Plan frontmatter 에 `spec_impact` 필드가 `in-progress` 단계에 선언됐는데, `plan-lifecycle.md §4·§5 Gate C` 상 이 필드는 `plan/complete/` 이동 커밋 시점에만 추가해야 한다. 구현 코드 diff 의 명명 규약(`EXECUTION_MESSAGE`, `ExecutionMessageEvent`, `PRESENTATION_NODE_TYPES`, `parseMessage` 등)과 파일·모듈 경로 배치는 프로젝트 관행에 부합하며 정식 규약 위반이 없다. `related_spec` 에 디렉토리 경로가 포함된 점은 링크 가드 발화 가능성이 있어 INFO 로 기술한다.

---

## 위험도

LOW
