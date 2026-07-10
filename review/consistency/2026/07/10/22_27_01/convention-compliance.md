---
reviewer: convention-compliance
target: plan/in-progress/spec-draft-pr874-deferred-docs.md
scope: >
  spec/7-channel-web-chat/1-widget-app.md ## Rationale R7 신설,
  spec/conventions/conversation-thread.md §9 스코프 예외 blockquote + frontmatter code: 추가 + §4 표 보강
convention_refs:
  - spec/conventions/spec-impl-evidence.md
  - CLAUDE.md (문서 구조·명명 컨벤션)
  - .claude/skills/project-planner/SKILL.md (3섹션 규약)
---

# 정식 규약 준수 검토 — PR #874 defer 문서 보강 3건 draft

## 검토 방법

- draft (`plan/in-progress/spec-draft-pr874-deferred-docs.md`) 전문을 읽고, 대상 두 파일(`spec/7-channel-web-chat/1-widget-app.md`, `spec/conventions/conversation-thread.md`)의 **적용 지점 실제 컨텍스트**를 읽어 draft 제안이 그 문맥에 정합한지 대조.
- `spec/conventions/spec-impl-evidence.md` (frontmatter 스키마 SoT) 와 build-time 가드 소스(`spec-code-paths.test.ts`, `spec-link-integrity.test.ts`)를 직접 읽어 gate 조건 확인.
- draft 가 제시한 상대 링크 3종 + 인접 앵커를 파일시스템·헤더 텍스트 기준으로 실측(`grep`/`ls`).
- `codebase/channel-web-chat/src/lib/conversation.ts`, `eia-types.ts`, `codebase/backend/.../interaction.service.ts` 를 읽어 draft 서술과 실제 구현이 부합하는지 대조.

---

## 발견사항

- **[WARNING] §9 스코프 예외 blockquote 의 "6-way" 표현이 위젯의 실제 wire 도메인(5값)과 어긋남**
  - target 위치: draft (2) `spec/conventions/conversation-thread.md` §9 서두 삽입 blockquote, "§9.1 의 source 별 **6-way** 시각 매핑과 §9.2 의 3중 구분 신호를 따르지 않고" 문장
  - 위반 규약: 직접적인 규약 조문 위반은 아니나, 본 문서가 "스코프 예외의 SoT" 임을 스스로 선언(draft Rationale: "convention 이 강제를 선언하는 쪽이므로 예외 스코프도 같은 문서가 SoT")한 만큼 정확성이 곧 규약 준수의 일부.
  - 상세: `conversation-thread.md §1.1` 은 backend `ConversationTurnSource` 를 **5값**(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`)으로 명시하고, `system_error` 는 §1.1.1 에서 **frontend(에디터) 전용 합성 6번째 값**이라고 못박는다. 실제로 `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `TurnSource` 유니온과 `conversation.ts` 의 주석은 명시적으로 "**백엔드 5값**" 만 다룬다고 적고 있고, `system_error` 리터럴이 아예 union 에 없다 — 위젯은 `system_error` 를 wire 로 받을 일이 구조적으로 없다(에디터 프런트 store 가 WS 에러 이벤트로 합성하는 값이며, 위젯 코드베이스에는 그 합성 로직 자체가 존재하지 않음). 따라서 "§9.1 의 6-way 매핑을 위젯이 따르지 않는다"는 서술은, 위젯이 애초에 받지도 않는 6번째 값까지 "의도적으로 축약"한 것처럼 읽혀 실제 경계(백엔드 5값 도메인의 2-way 축약)보다 넓게 일반화된다.
  - 제안: "§9.1 의 source 별 6-way 시각 매핑" 을 "§9.1 의 강제 매핑(그중 위젯 wire 도메인인 backend 5값 — `system_error` 는 §1.1.1 에 따라 frontend-전용이라 위젯에 애초 부재)" 정도로 좁혀 쓰거나, 최소한 "(system_error 는 위젯 wire 에 나타나지 않음 — §1.1.1)" 괄호를 추가해 위젯 문서(`1-widget-app.md` §2, `ai_assistant·ai_tool·system→assistant` 로 정확히 3값만 열거)와 표현을 맞출 것.

- **[INFO] §9 예외 blockquote 의 "[7-channel-web-chat §2]" 링크에 앵커 프래그먼트 누락 — 문서 관행과의 스타일 불일치**
  - target 위치: draft (2) blockquote, "임베드 웹채팅 위젯([7-channel-web-chat §2](../7-channel-web-chat/1-widget-app.md))"
  - 위반 규약: 명시적 가드 위반은 아님(`spec-link-integrity.test.ts` 는 앵커가 있을 때만 slug 대조 — 앵커 없는 파일 링크는 DEAD-path 체크만 통과하면 그린). 다만 같은 문서·인접 문서 전반의 표기 관행과 다름.
  - 상세: 본문 전반(`conversation-thread.md`·`1-widget-app.md`)에서 "§N" 을 링크 텍스트로 명시할 때는 대응 `#N-슬러그` 앵커를 함께 붙이는 패턴이 지배적("[Spec 실행 엔진 §6.1](...#61-컨텍스트-구조)", "[WebSocket §4.4](...#44-...)" 등). 반대로 "§X·§Y" 처럼 **복수 섹션을 한 링크에 묶을 때만** 앵커를 생략하는 관행이 이미 존재(예: 기존 line 11 `[Convention Conversation Thread §9.4·§9.5](../conventions/conversation-thread.md)`, draft R7 의 `[4-execution-engine §7.4·§7.5](...)`). 그런데 이 blockquote 는 **단일 섹션(§2)** 을 가리키면서도 앵커를 생략해, "단일 섹션 인용은 앵커 포함" 관행에서 벗어난다. `## 2. 화면 구조` 헤더의 실제 슬러그는 `2-화면-구조` 로, 앵커를 붙여도 깨지지 않는다(실측 확인).
  - 제안: `../7-channel-web-chat/1-widget-app.md#2-화면-구조` 로 앵커를 추가해 단일-섹션 인용 관행과 맞출 것 (필수는 아니며 가드도 통과하지만, 문서 탐색성·스타일 일관성 차원의 제안).

- **[INFO] frontmatter `code:` 신규 항목의 삽입 위치가 draft 에 명시되지 않음**
  - target 위치: draft (3) "변경 A" — `codebase/backend/src/modules/external-interaction/interaction.service.ts` 한 줄만 제시, 리스트 내 삽입 지점 미지정
  - 위반 규약: `spec-impl-evidence.md` 자체에는 `code:` 리스트의 순서를 강제하는 조항이 없고(`spec-code-paths.test.ts` 는 glob 매치 존재 여부만 검증, 순서 무관), 명시적 위반은 아님.
  - 상세: 현재 `conversation-thread.md` frontmatter `code:` 는 "backend 항목 전부 → frontend 항목 전부" 순으로 정렬돼 있고, backend 내부는 대략 "공유 인프라(`shared/conversation-thread/**`) → execution-engine 모듈 → AI 노드 handler/schema" 순의 아키텍처 계층 순서를 따른다. draft 는 "backend 항목 순서를 지켜 추가" 라고만 서술해 정확한 삽입 지점(리스트 끝 vs 특정 그룹 사이)을 특정하지 않는다. 실제 파일(`interaction.service.ts`, external-interaction 모듈)은 기존 backend 블록의 어느 그룹에도 속하지 않는 신규 소비처이므로, 오배치되면(예: frontend 블록 사이에 끼워 넣기) 기존 "backend 전부 먼저" 관행이 깨진다.
  - 제안: 기존 backend 블록의 마지막 항목(`information-extractor.handler.ts`) 뒤, frontend 블록 시작 전에 삽입해 "backend 전부 → frontend 전부" 그룹핑을 유지할 것을 실제 편집 시 명시.

- **[INFO] `conversation-thread.md` 의 `## 8. Rationale` 이 문서 마지막 섹션이 아님 (pre-existing, draft 로 인한 신규 악화는 아님)**
  - target 위치: `spec/conventions/conversation-thread.md` 문서 전체 구조 — `## 8. Rationale` (L305) 뒤에 `## 9. 미리보기 UI 렌더 규칙` (L388) 이 옴
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 및 `project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — Overview/본문/Rationale 순서 권장(다만 "권장"이며 강제 가드는 없음)
  - 상세: 이 구조는 draft 이전부터 존재(§8.2 Rationale 항목이 "§9 를 UI 계약 SoT 로 확장"한다고 스스로 설명하며 도입된 배치). draft (2) 는 정확히 이 `## 9` 안(Rationale 뒤)에 새 blockquote 를 추가하므로, 기존의 "Rationale-이 아닌 §9 가 문서 말미" 구조를 그대로 답습·강화한다. 새로운 위반을 만드는 것은 아니나, 검토 관점 3("문서 구조 규약")에 해당하므로 기록.
  - 제안: 이번 draft 범위에서 구조 재배치를 요구하지는 않음(과합). 다만 향후 `conversation-thread.md` 를 다시 다듬을 기회가 있으면 `## 9` 를 `## 8` 앞으로 옮기거나 Rationale 섹션 번호를 마지막으로 재배치하는 것을 검토 권장.

---

## 실측 검증 결과 (참고)

- `../7-channel-web-chat/1-widget-app.md` (conversation-thread.md 기준 상대경로) → `spec/7-channel-web-chat/1-widget-app.md` 로 정확히 해석되고 파일 실존 확인.
- `../5-system/4-execution-engine.md` (1-widget-app.md 기준 상대경로) → `spec/5-system/4-execution-engine.md` 로 정확히 해석되고 파일 실존 확인. R7 이 인용하는 `§7.4`(분산 실행/Multi-instance, L873)·`§7.5`(Resume after Restart, L933) 둘 다 실존하며, "waiting_for_input 은 무기한 보존" 불변식이 실제로 §7.4 본문(L930-931)에 서술돼 있어 R7 의 인용이 사실관계상 정확함을 확인.
- 앵커 슬러그 규칙(`spec-link-integrity.test.ts` 의 `slugify` pin 테스트로 확인된 github-slugger parity: 마침표 제거·공백→하이픈)을 기준으로 `## 2. 화면 구조` → `2-화면-구조`, `### 7.4 …` → `74-…`, `### 7.5 …` → `75-…` 로 계산되며, draft 가 실제로 사용한 앵커(없음 — 파일 단위 링크만)는 이 규칙과 충돌하지 않음(앵커 자체가 없어 ANCHOR 검증 대상이 아님).
- 신규 frontmatter `code:` 항목 `codebase/backend/src/modules/external-interaction/interaction.service.ts` 는 실존 파일이며, 그 안의 `getStatus()` 메서드가 `redactThreadForPublic` import·`conversationThread` 동봉 로직을 실제로 구현하고 있어(§8.4 "소비처 갱신" 서술과 일치) evidence 로서 타당. `status: implemented` 문서에 `code:` 항목을 추가하는 것은 `spec-status-lifecycle.test.ts` 의 4개 검증 조건(spec-only TTL, partial pending_plans 미작성/미승격, backlog id 미등재) 중 어느 것에도 해당하지 않아 **가드 충돌 없음**. `spec-code-paths.test.ts` 는 오히려 이 추가로 "≥1 매치" 조건이 더 확실히 충족.
- `plan/in-progress/spec-draft-pr874-deferred-docs.md` 자체 frontmatter (`worktree`/`started`/`owner`/`spec_impact` 리스트)는 `plan-frontmatter.test.ts`·`spec-plan-completion.test.ts`(Gate C) 요구사항을 모두 충족하는 형태(특히 `spec_impact` 가 bare string 이 아닌 YAML 리스트 — 과거 회귀 사례(#733→#735)와 달리 안전).
- R7 이 재서술하는 두 결정(booting 게이팅, graceful/cancel 분기, optimistic 종료)은 모두 `1-widget-app.md` §2 헤더 행·§3.1 표에 **이미 존재하는 산문**과 문장 단위로 대조해 사실관계 불일치 없음을 확인 — draft 가 스스로 명시한 "신규 결정 없음, 산문 승격만" 원칙에 부합.
- R7 제목·R-넘버링(`### R7.` 이 기존 `R4~R6` 뒤를 잇는 것)은 `spec/7-channel-web-chat/` 폴더 내 타 문서(`0-architecture.md` R1-R5, `2-sdk.md` R2-R5, `3-auth-session.md` R3-R6, `4-security.md` R1-R6, `5-admin-console.md` R1-R7) 를 전수 확인한 결과 **R-번호는 문서-로컬 시퀀스**임이 실증되어, draft 의 "본 문서 R 번호는 문서-로컬 연속" 주장과 일치.

---

## 요약

draft 가 제안한 3건은 모두 **spec-only 서술 추가/정합화**이며, 상대 링크 3종(`../7-channel-web-chat/1-widget-app.md`, `../5-system/4-execution-engine.md` 및 그 §7.4/§7.5 섹션)은 전부 실제 경로·앵커로 유효하게 해석되고, frontmatter `code:` 신규 항목도 실존 파일이자 정확한 evidence 로 `spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts` 가드를 통과한다. R7 신설과 §4 표 보강은 기존 본문·§8.4 Rationale 과 문장 단위로 대조해도 사실관계 불일치가 없어 "신규 결정 없음" 원칙에 부합한다. 다만 §9 스코프 예외 blockquote 의 "6-way" 표현이 위젯이 실제로 받는 backend 5값 도메인보다 넓게 일반화돼 있어(WARNING), 이 문서가 스스로 선언한 "예외 스코프 SoT" 역할의 정밀성을 옅게 한다 — 반영 전 문구 조정을 권장한다. 그 외 앵커 생략 스타일·`code:` 삽입 위치 미지정·Rationale 이 문서 말미가 아닌 기존 구조는 가드를 깨지 않는 경미한 스타일/구조 관찰(INFO)이다. Critical 등급 발견은 없다.

## 위험도

LOW
