# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
검토 범위: `spec/5-system/4-execution-engine.md` / diff origin/main...HEAD (exec-park B-1)
검토일: 2026-06-06

---

## 발견사항

### [WARNING] spec §7.5 / §6.2(frame-by-frame) — 새 `dispatchResumeTurn` 레이어 미반영
- **target 위치**: `spec/5-system/4-execution-engine.md` L905 (`driveResumeAwaited` 다이어그램) 및 L922 (`driveResumeFrame` §6.2 최내 frame 설명)
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 기술 명세는 `spec/<영역>/*.md` 본문" + SDD 원칙(코드가 바뀌면 spec 이 따라와야 함)
- **상세**: 두 위치 모두 turn dispatch 를 `form → processFormResumeTurn`, `button → processButtonResumeTurn`, `AI → processAiResumeTurn` 의 직접 if/else 분기로 서술한다. 그러나 이번 PR 이 이 분기를 `resumeTurnRegistry`(ordered registry) + `dispatchResumeTurn`(단일 진입점)으로 추출해 `driveResumeAwaited`·`driveResumeFrame` 양쪽이 해당 중간 계층을 통해 처리기를 선택하도록 바꿨다. spec 은 이 새 레이어를 언급하지 않아 구현과 서술이 어긋난다(직접 호출 → registry first-match-wins 방식으로 변경).
- **제안**: `spec/5-system/4-execution-engine.md` §7.5 다이어그램(L905 영역)과 §6.2 최내 frame 설명(L922 영역)에 `dispatchResumeTurn`(→ `resumeTurnRegistry` first-match-wins: form/buttons/ai_conversation) 의 역할을 한 줄 추가한다. 기존 `processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn` 은 registry 항목의 `handle` 구현으로 계속 언급해도 무방하다. 이 수정은 project-planner 도메인(spec write)이며 현 PR 과 같은 세션에서 처리하거나 후속 spec-sync plan 으로 추적한다.

### [WARNING] `interaction-type-registry.md` §1.2 처리 분기 매트릭스 — `resume-turn-dispatch.ts` 미등재
- **target 위치**: `spec/conventions/interaction-type-registry.md` §1.2 "값 → 처리 분기 매트릭스" (Backend emit 위치 컬럼)
- **위반 규약**: `spec/conventions/interaction-type-registry.md §1.2` 규칙 1 — "표의 모든 위치를 한 PR 안에서 동시 갱신"; §1.1 SoT 표에 `execution-engine.service.ts` 만 등재
- **상세**: 새 `resume-turn-dispatch.ts` 는 `WaitingInteractionType` 값(`form` / `buttons` / `ai_conversation`)을 `ResumeTurnSelector` 필드(`blockingInteraction`, `persistedInteractionType`, `isAiConversation`)로 번역해 처리기를 선택하는 **처리 분기 위치**다. interaction-type-registry.md §1.1 SoT 표 및 §1.2 매트릭스에는 이 파일이 언급되지 않는다. 단, 해당 분기가 **새 enum 값을 추가한 것이 아니라** 기존 4값의 라우팅 경로를 리팩토링한 것이라, exhaustiveness guard 나 AST guard 가 fail 하지는 않는다. 그러나 "enum 값별 처리 분기 위치 매트릭스"를 완전하게 유지한다는 convention 목적(단일 진실)에서는 누락이다.
- **제안**: `interaction-type-registry.md` §1.1 SoT 표의 Backend 행에 `resume-turn-dispatch.ts`(또는 상위 glob `execution-engine/**`) 를 추가 언급하거나, §1.2 매트릭스 `Backend emit 위치` 컬럼 비고로 "resumeTurnRegistry 에서 dispatch (resume-turn-dispatch.ts)" 를 부기한다. enum 값을 새로 추가하지 않았으므로 CRITICAL 등급이 아니나, 다음에 blocking 노드 타입이 추가될 때 참조할 매트릭스가 stale 하면 분기 누락 위험이 있다. 규약 자체를 "enum 값 추가 시 라우팅 계층도 등재" 로 명확히 갱신하는 것도 적절하다.

### [INFO] `process-turn-result.ts` — spec frontmatter `code:` glob 으로 커버됨 (확인 완료)
- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `code:` 필드
- **위반 규약**: 해당 없음
- **상세**: 신규 파일 `codebase/backend/src/shared/execution-resume/process-turn-result.ts` 는 frontmatter `code: - codebase/backend/src/shared/execution-resume/**` glob 으로 커버된다. `spec-code-paths.test.ts` 가드 통과 예상.

### [INFO] `resume-turn-dispatch.ts` — spec frontmatter `code:` glob 으로 커버됨 (확인 완료)
- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `code:` 필드
- **위반 규약**: 해당 없음
- **상세**: 신규 파일 `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` 는 frontmatter `code: - codebase/backend/src/modules/execution-engine/**` glob 으로 커버된다.

### [INFO] 에러 코드 명명 — `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` 기존 등록 코드, 신규 발행 없음
- **target 위치**: `resume-turn-dispatch.ts` JSDoc `@throws` 및 `execution-engine.service.ts` `dispatchResumeTurn` / `handleAiResumeTurn`
- **위반 규약**: `spec/conventions/error-codes.md §1` — 의미 기반 명명 (UPPER_SNAKE_CASE)
- **상세**: 이번 PR 이 사용하는 에러 코드는 모두 기존에 `spec/5-system/3-error-handling.md` 에 등록된 코드다(`RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`). 신규 코드 없음, 명명 위반 없음.

---

## 요약

정식 규약 준수 관점에서 이번 변경(exec-park B-1 — resume dispatch registry)은 대부분 규약에 부합한다. 파일 명명(kebab-case), 식별자 명명(PascalCase 인터페이스, UPPER_SNAKE_CASE 에러 코드), spec frontmatter `code:` 글로브 커버리지, 기존 에러 코드 재사용 모두 정상이다. 주된 미흡은 **spec 서술 동기화 부재**다: spec §7.5 다이어그램과 §6.2 최내 frame 서술이 여전히 "processFormResumeTurn / processButtonResumeTurn / processAiResumeTurn 직접 호출" 로 남아 있어, 새 `dispatchResumeTurn` + `resumeTurnRegistry` 중간 계층이 반영되지 않았다. 이는 developer 도메인이 spec 직접 수정 없이 구현만 완료한 데서 비롯한 전형적 spec-impl drift 로, `project-planner` 가 spec 을 갱신해야 한다. 아울러 `interaction-type-registry.md` §1.2 매트릭스가 새 dispatch 계층 파일을 열거하지 않아 향후 blocking 노드 타입 추가 시 매트릭스 참조 부정확 위험이 있다.

---

## 위험도

MEDIUM
