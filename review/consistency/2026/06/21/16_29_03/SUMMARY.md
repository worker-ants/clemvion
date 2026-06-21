# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — WARNING 2건(주석·문서 레벨 명명 명확화)이 있으나 런타임·컴파일 타임 충돌 없음. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `W-6` 트래킹 태그 이중 의미 — 구현 주석에서 "채널 구독 비-UUID 선차단"으로 사용, 그러나 spec/코드 전반에서는 "sub-workflow cross-workspace 격리 차단" 의미로 고정 | `uuid.ts` JSDoc, `background-run-channel-authorizer.ts`, `kb-channel-authorizer.ts` 주석 | `spec/4-nodes/2-flow/1-workflow.md`, `spec/5-system/3-error-handling.md`, `execution-engine.service.ts:539`, `error-codes.ts:62/65` 등 | 채널 UUID 선차단 주석의 `(W-6)` 태그를 제거하고 "비-UUID 입력 차단 (채널 구독 인가 일관성)" 서술형으로 대체하거나, 별도 태그(`WS-UUID-GUARD`) 부여 |
| 2 | Naming Collision | `M-7` 배치 ID 이중 사용 — 코드 주석의 `refactor M-7`이 batch 번호 없이 기술돼 완료된 `04 M-7`(MCP insecure URL 가드)과 혼동 가능 | `websocket.module.ts` 등 코드 주석 내 `refactor M-7` 언급 | `spec/5-system/11-mcp-client.md:140`, `spec/5-system/1-auth.md`, `plan/in-progress/refactor/README.md:45` (`04 M-7`) | 코드 주석 내 `refactor M-7` → `refactor 02 M-7`로 배치 번호 포함 통일 (README.md:62는 이미 `02 M-7`로 표기) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | spec §3.3 `channelAuthorizers` 서술이 "DI 역전" 구조를 명시하지 않아 "gateway 인라인 배열"로 읽힐 여지 | `spec/5-system/6-websocket-protocol.md` §3.3 (line 143) | spec Rationale 에 M-7 결정("배열 직접 확장 → DI 역전 채택") 간략 기록 (project-planner 위임) |
| 2 | Cross-Spec / Convention Compliance | spec frontmatter `code:` 에 M-7 신규 파일 6종 미등록 (`channel-authorizer.ts`, `notifications-channel-authorizer.ts`, 도메인 authorizer 4종, `uuid.ts`) | `spec/5-system/6-websocket-protocol.md` frontmatter (line 6–13) | `code:` 글로브에 `*-channel-authorizer.ts` 패턴 또는 개별 경로 추가 (project-planner 위임) |
| 3 | Rationale Continuity | M-6 Rationale "배열 항목 추가만으로 확장" → M-7 DI 역전 전환 결정이 spec Rationale 에 미기록 | `spec/5-system/6-websocket-protocol.md` Rationale | spec Rationale 에 M-7 결정(DI 역전 채택 이유·기각 대안·W-5 fail-closed 강화) 명문화 (project-planner 위임) |
| 4 | Rationale Continuity / Convention Compliance | spec §3.3 `kb:` 행에 비-UUID 선차단 명시 부재 — 구현은 W-6 정책을 `kb:` 에도 일관 적용했으나 spec 표에 미반영 | `spec/5-system/6-websocket-protocol.md` §3.3 `kb:{documentId}` 행 | `kb:` 행을 "workspace 문서 소유 검증 (비-UUID 선차단)"으로 갱신, execution/workflow/background:run 행과 형식 정렬 (project-planner 위임) |
| 5 | Rationale Continuity | fail-closed(W-5) 신설 — `authorizer` 부재 시 명시적 거부로 변경됐으나 spec Rationale 미기록 | `websocket.gateway.ts` diff (`if (!authorizer)` 분기) | spec §3.3 에 "매칭 authorizer 없는 valid-prefix 채널은 기본 거부(fail-closed)" 규약 한 줄 추가 (project-planner 위임) |
| 6 | Convention Compliance | spec §3.2 채널 패턴 표에 `background:run:{id}` 누락 — §3.3 및 구현에는 존재 (기존 spec drift, M-7 이전부터) | `spec/5-system/6-websocket-protocol.md` §3.2 (line 118–123) | spec §3.2 표에 `background:run:{id}` 행 추가 (project-planner 위임) |
| 7 | Naming Collision | `isValidUuid` 함수명이 v1~v5 수락이나 일부 spec 표기는 "UUID v4" 한정 — JSDoc 에 이미 명시, 런타임 충돌 없음 | `codebase/backend/src/common/utils/uuid.ts` | 현 상태 유지 가능. 필요 시 JSDoc 첫 줄에 "UUID v1–v5 (not v4-only)" 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 구현이 spec §3.3 행동 명세(채널별 소유권 검증·거부 형태·채널 목록)와 완전 일치. INFO 2건: DI 구조 서술 모호, frontmatter `code:` 미등록 |
| Rationale Continuity | LOW | M-7 DI 역전이 M-6 Rationale "배열 추가 확장"을 긍정 방향으로 진화시켰으나 spec Rationale 미갱신. INFO 3건 (DI 역전 기록·kb UUID 선차단·W-5 fail-closed), CRITICAL/WARNING 없음 |
| Convention Compliance | NONE | 명명·출력 포맷·에러 코드 규약 모두 준수. INFO 3건: 기존 spec drift(`background:run:` §3.2 누락)·frontmatter 경로 미등록·`kb:` 행 표기 불일치 |
| Plan Coherence | NONE | target spec 미수정, `02-architecture.md §M-7` Option A 결정 정확 이행, 선행 조건 충족, 후속 항목 누락 없음 |
| Naming Collision | LOW | `W-6` 태그 이중 의미(WARNING), `M-7` 배치 ID 혼동(WARNING). 런타임·컴파일 타임 충돌 전무. 식별자/클래스/파일 경로 충돌 없음 |

## 권장 조치사항

1. **(WARNING 해소 — developer 권한)** `uuid.ts` JSDoc 및 `background-run-channel-authorizer.ts`, `kb-channel-authorizer.ts` 주석의 `(W-6)` 태그를 제거하고 서술형 설명으로 대체 — 기존 W-6 의미(sub-workflow workspace 격리)와의 혼동 방지.
2. **(WARNING 해소 — developer 권한)** 코드 주석 내 `refactor M-7` 언급을 `refactor 02 M-7`로 일관 갱신 — 완료된 `04 M-7`(MCP 가드)과 구분.
3. **(INFO 권장, 비차단 — project-planner 위임)** spec Rationale 에 M-7 결정(DI 역전 채택 이유·기각 대안·W-5 fail-closed 강화) 및 `kb:` UUID 선차단 정책 확대 기록.
4. **(INFO 권장, 비차단 — project-planner 위임)** spec §3.2 에 `background:run:{id}` 행 추가, spec §3.3 `kb:` 행에 "(비-UUID 선차단)" 표기, frontmatter `code:` 에 신규 파일 경로 등록.