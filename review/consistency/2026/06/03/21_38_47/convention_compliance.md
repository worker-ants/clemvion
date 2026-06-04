# 정식 규약 준수 검토 — `spec/4-nodes/3-ai/`

검토 모드: 구현 착수 전 (--impl-prep)  
검토 대상: `spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`  
검토 일시: 2026-06-03

---

## 발견사항

### [WARNING] `0-common.md` frontmatter `status: partial` + `pending_plans` 실존 여부
- target 위치: `spec/4-nodes/3-ai/0-common.md` — frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`partial` 상태는 `pending_plans` 의무, `pending_plans` 내 경로 실존 의무 — §4 build-time 가드 `spec-pending-plan-existence.test.ts`)
- 상세: 검토 payload 시점의 `0-common.md` 는 `status: partial` + `pending_plans: [plan/in-progress/ai-context-memory-auto.md]` 를 선언했으나, `plan/in-progress/ai-context-memory-auto.md` 파일이 레포에 존재하지 않는다. `spec-pending-plan-existence.test.ts` 가드가 build fail 시킬 가능성 있음. (현재 디스크 상의 파일은 `status: implemented` 로 이미 승격돼 있으므로 이 시점 기준 해소됐을 수 있으나, payload 캡처 시점에는 불일치였음을 기록.)
- 제안: `pending_plans` 에 나열된 경로의 실존을 항상 확인하고, plan 이 `complete/` 로 이동했다면 frontmatter `status: implemented` 로 즉시 승격한다. 이미 디스크 상에서 승격 완료된 것으로 보이므로 추가 조치 불필요.

### [WARNING] `1-ai-agent.md` `pending_plans` 내 계획 경로의 단일성
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` — frontmatter `pending_plans`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3·§4` — `status: partial` 시 `pending_plans` 내 경로 모두 `plan/in-progress/` 또는 `plan/complete/` 에 실존해야 함 (`spec-pending-plan-existence.test.ts`)
- 상세: `pending_plans: [plan/in-progress/ai-agent-tool-connection-rewrite.md]` 는 레포에 실존하는 파일이 확인됨. 규약 준수 상태.  
  단, 이전 payload 에 `ai-context-memory-auto.md` 가 두 번째 항목으로 포함되어 있었으나 디스크 파일에는 없다. 이는 완료 후 정리된 것으로 추정.
- 제안: 현재 상태 이상 없음.

### [INFO] `spec/conventions/cafe24-api-catalog/application.md` frontmatter `status: implemented` 표기
- target 위치: `spec/conventions/cafe24-api-catalog/application.md` — frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `spec/conventions/**` 경로는 frontmatter 의무 적용 대상이나, catalog 파일의 `status` 는 Cafe24 endpoint 구현 상태(§3 `supported`/`planned`/`deprecated`)와 spec-impl-evidence 의 `status` 가 의미 도메인이 달라 혼동 가능
- 상세: `_overview.md §3` 주석에서 "spec frontmatter `status: archived` 와는 별 도메인" 임을 명시했지만, `application.md` frontmatter 의 `status: implemented` 는 spec-impl-evidence 의 `status` enum 값이다. `spec/conventions/**` 는 frontmatter 의무 범위이므로 이 표기는 정상이나, catalog 파일 고유의 Cafe24 endpoint status(supported/planned/deprecated) 와 동명 키가 충돌해 혼동을 줄 수 있다.
- 제안: catalog 파일 frontmatter 에 `status: implemented` 를 유지하되, convention 규약상 혼동 방지를 위해 `_overview.md §3` 의 주의 문구를 각 catalog resource 파일의 frontmatter 주석으로도 인라인 참조하는 것을 고려할 수 있음. INFO 수준이므로 즉각 조치 불필요.

### [INFO] `0-common.md` — Rationale 섹션 위치
- target 위치: `spec/4-nodes/3-ai/0-common.md` 끝부분
- 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- 상세: `0-common.md` 는 §11(시스템 프롬프트 prefix)의 Rationale 만 별도 `## Rationale` 섹션으로 끝에 위치. §1~§10 에 대한 Rationale 는 각 섹션 끝의 blockquote 안에 분산되어 있다. 이 분산 구조 자체는 규약에서 강제하지 않으나, 3섹션 단일 `## Rationale` 권장 구조와 일부 다르다.
- 제안: 현행 유지도 무방하나, 주요 설계 결정(§10 contextScope 축 분리, §4 multi-turn blocking 모델 등)의 근거를 마지막 `## Rationale` 에 통합하면 후행 검토자 파악이 용이해짐.

### [INFO] `1-ai-agent.md` §7 출력 구조 표 — `output.result.presentations` 위치 문서화
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.10
- 위반 규약: `spec/conventions/node-output.md Principle 1` — `output` 에는 도메인 데이터만 담고 `meta` 에는 실행 메트릭만 담는 분리 원칙
- 상세: §7.10 에서 `output.result.presentations[]` (ConversationTurn 의 presentations 가 아닌 output.result 내부에 별도 존재)가 정의되어 있으며, `meta.presentationCalls[]` 도 함께 정의됨. Principle 1 기준으로 `presentationCalls[]` 는 실행 메트릭이라 `meta` 위치가 정확하고, `output.result.presentations[]` 는 도메인 데이터(렌더링된 페이로드)라 `output.result` 위치도 타당. 다만 ConversationTurn의 `presentations[]` 와 `output.result.presentations[]` 두 곳에 유사한 정보가 있어, 어느 것이 "권위" 출처인지 문서 내에서 명확히 구별돼야 한다.
- 상세 확인: §7.10 은 "ConversationTurn 의 top-level `presentations[]`" 을 단일 운반 경로라고 명시하고, `output.result.presentations[]` 예시에도 페이로드가 echo 됨. 두 경로의 관계(ConversationTurn 이 권위, output.result 는 편의 echo)가 §7.10 주석으로 충분히 명시됐는지 구현 단계에서 확인 필요.
- 제안: 구현 시 `output.result.presentations[]` 가 ConversationTurn `presentations[]` 의 동기 복사인지, 아니면 별개 저장인지 핸들러 코드에서 명시적으로 주석 처리.

### [INFO] `2-text-classifier.md` `status: implemented` — `contextScope` 계열 필드 부재
- target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` — frontmatter + §1 config 표
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `implemented` 는 모든 약속 구현 완료를 의미
- 상세: `0-common.md §10` 에서 `text_classifier` / `information_extractor` 는 v2 에서 `contextScope` 계열 push hook 이 추가된다고 명시했다. `2-text-classifier.md` 의 config 표에는 `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` / `memoryStrategy` 필드가 없다 — v2 미구현 상태를 반영한 것이나, `status: implemented` 가 "v1 구현 완료" 임을 명시하지 않아 완전한 기능 구현으로 오독될 수 있다.
- 제안: `status: implemented` 를 유지하되, §1 config 표 하단 또는 spec 서두에 "v2 미구현 기능(`contextScope` 자동 주입)은 `spec/4-nodes/3-ai/0-common.md §10` 의 v2 로드맵 참조" 라는 note 를 추가해 기능 완결성에 대한 오해를 방지.

---

## 요약

`spec/4-nodes/3-ai/` 의 4개 문서는 정식 규약(`spec/conventions/`)의 핵심 요건을 대체로 준수한다. `node-output.md` 의 Principle 0(5필드)·Principle 1(`output`에 도메인 데이터)·Principle 3(에러 컨트랙트)·Principle 7(config echo raw 값) 을 각 출력 구조 섹션이 충실히 반영했으며, `spec-impl-evidence.md` 의 frontmatter 스키마(id/status/code/pending_plans)도 올바르게 사용됐다. CLAUDE.md 의 `_product-overview.md` / `0-common.md` / 숫자 prefix 명명 컨벤션도 준수한다. 주요 지적사항은 (1) `0-common.md` payload 시점의 `pending_plans` 경로 미실존(이미 diisk 상에서 해소됨), (2) `2-text-classifier.md` 의 `status: implemented` 가 v2 미구현 부분을 충분히 언급하지 않는 점이다. CRITICAL 수준의 규약 직접 위반은 발견되지 않았다.

## 위험도

LOW
