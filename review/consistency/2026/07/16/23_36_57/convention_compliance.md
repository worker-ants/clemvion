### 발견사항

- **[WARNING] `won't-do` 절 단위 표기가 기존 repo 관례를 따르지 않고 새로 발명될 위험**
  - target 위치: D2 "변경 2-2/2-3/2-4" (`spec/5-system/11-mcp-client.md` §3.3 제목·L144·L371 → won't-do 전환, §Rationale 신설)
  - 관련 규약: 명문화된 `spec/conventions/*.md` 문서는 없으나, `spec/5-system/6-websocket-protocol.md`(§1.2·§1.3·§4.2·§8, Rationale 앵커 `R-wontdo-rawws-rest`)가 이미 확립한 **사실상(de facto) 절 단위 won't-do 표기 패턴**이 `2-api-convention.md`·`4-execution-engine.md`·`14-external-interaction-api.md` 3개 spec 에서 cross-ref 로 재사용되고 있다. 토큰: 제목 접미 `_(비채택 won't-do)_`, 본문 `> **비채택 (won't-do)**: ...`, Rationale 절 앵커 `R-wontdo-<slug>`.
  - 상세: target draft 자신이 "검토 요청 관점 §3"에서 "won't-do 표기에 대한 정식 컨벤션이 있는가... 절 단위 won't-do 표기 관례 확인 요망" 이라고 명시적으로 묻고 있다. 답은 "있다(비공식 precedent) — 다만 `spec/conventions/`에 정식 문서화되지 않았다." D2 는 정확한 토큰을 지정하지 않은 채 "won't-do 표기로"라고만 서술해, 구현 시 4개 문서와 다른 wording 이 채택될 위험이 있다.
  - 제안: D2 실행 시 `_(비채택 won't-do)_` 제목 접미 + `> **비채택 (won't-do)**:` 블록쿼트 + `R-wontdo-<slug>` 앵커의 기존 3요소를 그대로 재사용. 아울러 이 패턴 자체가 4개 문서에 반복 사용되는데도 `spec/conventions/`에 SoT 가 없으므로, `project-planner` 백로그로 "절 단위 won't-do 표기 정식 컨벤션화" 를 별도 제안할 가치가 있다(규약 갱신 필요 케이스).

- **[WARNING] D1 의 `status: partial` 유지 판단이 `9-rag-search.md` 자신의 `## Rationale` 절에는 기록되지 않음**
  - target 위치: D1 전체 (`spec/5-system/9-rag-search.md` frontmatter 변경)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". `9-rag-search.md` 는 이미 이 패턴을 "**왜 X 했나 (날짜)**" bullet 형식으로 촘촘히 쓰고 있다(예: "byte-identical 조항 폐기 (D1, 2026-06-06)").
  - 상세: D1 은 `spec-status-lifecycle.test.ts (c)` 가드가 `implemented` 승격을 유도하는데도 의도적으로 `partial` 을 유지하는, 비자명한 판단이다(실측: 현재 가드가 실제로 `allCompleted=true` 를 감지해 이 케이스에서 FAIL 중임을 확인함). 이 근거는 현재 (a) 휘발성 PR draft, (b) `rag-quality-improvement.md §7` 헤더 노트에만 있고 `9-rag-search.md` 자체엔 남지 않는다. 반면 D2 는 "변경 2-4: §Rationale 에 기각 근거 1개 절 추가"를 명시해 같은 문제를 올바르게 처리한다 — D1·D2 간 rigor 불일치.
  - 제안: D1 실행 시 `9-rag-search.md` `## Rationale` 에 "왜 rag-dynamic-cut 종결 후에도 `status: partial` 을 유지했나 (2026-07-16)" 형태의 bullet 1개 추가 권장.

- **[INFO] `spec-impl-evidence.md §4.2` 의 "plan/ 링크 제외" 서술이 실제 코드 동작과 불일치 (target 의 오류 아님, SoT 자체의 drift)**
  - target 위치: 배경 §2, D3 전체의 "spec-link-integrity.test.ts(build 차단)" 서술
  - 관련 규약: `spec/conventions/spec-impl-evidence.md §4.2` 표는 `spec-link-integrity.test.ts` 의 예외로 "plan/ 링크(=plan-coherence 담당)"를 명시하고, 코드 주석(`spec-link-integrity.test.ts:23`)도 동일하게 "Plan-side link hygiene is handled by plan-coherence-checker, not this gate"라고 적혀 있다.
  - 상세: 그러나 실제 `findBrokenLinks()` 구현(`spec-links.ts`)에는 `plan/` 대상 링크를 걸러내는 필터가 전혀 없다. 실측(`npx vitest run spec-link-integrity.test.ts`)으로 확인한 결과, 현재 저장소는 정확히 target draft 가 지목한 5곳(`10-parallel.md` L211/L230, `cross-node-warning-rules.md` L20, `execution-context.md` L45, `node-cancellation.md` L18)에서 `plan/in-progress/parallel-p2-followups.md` DEAD 링크로 **실제 빌드 실패** 중임을 확인했다. 즉 target 의 "build 차단" 표현은 **실제 동작 기준으로는 정확**하지만, 그 근거로 인용 가능한 정식 규약 문서(`spec-impl-evidence.md §4.2`)는 반대로 "plan/ 링크는 제외"라고 잘못 서술하고 있다.
  - 제안: target draft 는 수정할 필요 없음(실측과 일치). 다만 `spec-impl-evidence.md §4.2` 표와 `spec-link-integrity.test.ts` 헤더 주석의 "plan/ 링크 제외" 문구를 실제 구현에 맞게 정정(또는 반대로 그 예외를 실제로 구현)하는 후속 정리가 필요 — `project-planner` 백로그 제안.

- **[INFO] `spec/5-system/11-mcp-client.md` 가 CLAUDE.md 권장 `## Overview` 헤더 대신 `## 1. 개요` 를 사용 (target draft 와 무관한 기존 상태)**
  - target 위치: 해당 없음(D1~D3 미변경 범위)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
  - 상세: 사전 존재하던 상태이며 `spec/5-system/` 18개 파일 중 7개가 동일 패턴(`## N. 개요` 등)을 쓴다. target draft 는 이 구조를 건드리지 않으므로 이번 PR 의 책임 범위 밖.
  - 제안: 조치 불필요(참고용 기록).

- **[확인 — 이슈 없음] D1/D2/D3 의 핵심 기술 주장은 코드·가드 실행으로 전수 검증되어 정확함**
  - `plan/in-progress/rag-quality-improvement.md` 실존(D1 재배선 대상 유효), `9-rag-search.md §Rationale` 의 4개 미구현 표면(멀티-KB 리랭크·ef_search 튜닝·D2 정량임계·재임베딩 트리거) 인용 정확.
  - `spec-status-lifecycle.test.ts (c)` 가드가 현재 `9-rag-search.md`·`11-mcp-client.md` 양쪽에서 실제로 FAIL 중임을 vitest 실행으로 직접 확인 — D1(허위 승격 방지용 재배선)·D2(정당한 승격) 판단 모두 가드 메커니즘과 정합.
  - `11-mcp-client.md` 전수 grep(`미구현|Planned|잔여`) 결과 §3.3(L142/144/371) 만 잔존 — "유일한 미구현 표면" 주장 정확, `implemented` 승격 근거 타당.
  - D2 frontmatter 변경(`pending_plans:` 절 전체 삭제)은 `spec-impl-evidence.md §5.3` "완성 머지 시" 예시와 정확히 일치(빈 배열이 아니라 필드 자체 제거).
  - D3 의 5개 dead link 목록·`10-parallel.md` L211 의 "§2-E 절 실제 부재" 주장 모두 실측 일치.
  - 신규 식별자 0건(naming collision 없음) 주장도 사실과 부합.

### 요약
검토한 target(`spec-draft-plan-grooming.md` D1~D3)은 `spec/conventions/spec-impl-evidence.md` 의 frontmatter lifecycle(§2~§4, 특히 가드 (c) 전이 규칙)과 `spec-link-integrity.test.ts`/`spec-pending-plan-existence.test.ts` 의 실제 동작을 정확히 이해하고 설계됐다 — 모든 핵심 기술 주장을 vitest 직접 실행과 파일 대조로 검증한 결과 사실과 일치했으며, D1 의 "허위 승격 방지를 위한 pending_plans 재배선" 판단은 가드의 기계적 요구(promote)와 spec 의 실제 상태(미구현 표면 잔존) 사이 긴장을 정확히 포착해 처리한 우수한 사례다. 다만 두 가지 개선 여지가 있다 — (1) D2 의 절 단위 won't-do 표기가 기존 4개 spec 문서의 비공식 precedent(`R-wontdo-*` 패턴)를 명시적으로 인용/재사용하지 않으면 wording drift 위험이 있고, (2) D1 은 D2 와 달리 상태 유지 판단의 근거를 spec 자체의 `## Rationale` 에 남기는 절차를 누락했다. 부수적으로, target 과 무관하게 `spec-impl-evidence.md §4.2` 자체가 "plan/ 링크는 가드 예외"라고 잘못 서술하고 있음을 코드 실행으로 발견했는데, 이는 target 의 결함이 아니라 규약 SoT 문서의 자체 drift이므로 별도 후속이 적절하다.

### 위험도
LOW