# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능 (WARNING 해소 권장)

---

## 전체 위험도
**LOW** — Critical 0건, WARNING 5건(plan 수정으로 해소 가능), INFO 9건

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `execution.message` EIA spec §5.2·§8 매핑 테이블 미포함 — Phase 4 §1 기술 모호 | Phase 1 §1·§3, Phase 4 §1 | `spec/5-system/14-external-interaction-api.md` §5.2 (L383~387), §8 매핑 테이블 (L848~866) | Phase 4 §1 을 "(a) §5.2 이벤트 목록에 `execution.message` 추가, (b) §8 매핑 테이블에 행 추가" 로 명시 보강 |
| W2 | Cross-Spec | `wc:command { action: "resetSession" }` SDK spec §3·§5 미등재 — undocumented 커맨드 위험 | Phase 2 §3, Phase 3 §1 | `spec/7-channel-web-chat/2-sdk.md` §3 (L86) action 열거, §5 `ChatInstance` 타입 | Phase 4 에 운영콘솔 전용 여부 결정 후 `2-sdk.md §3` 업데이트 또는 internal-only 주석 명시 |
| W3 | Rationale | `execution.message` SSE 신설이 R-CC-16 기각 대안(outbound HTTP 화이트리스트 확장)과 표면적 유사 — Rationale 미명시 | Phase 1·Phase 4 | `spec/5-system/15-chat-channel.md` §R-CC-16, `spec/5-system/14-external-interaction-api.md` §R10 | Phase 4 EIA Rationale 신규 항에 "SSE 추가는 R-CC-16 기각 범위(outbound HTTP) 밖" 을 명시 |
| W4 | Convention | `worktree:` frontmatter 값 `web-chat-preview-improvements` — 실제 디렉토리 이름 `web-chat-preview-improvements-fa0488` 와 불일치 (slug 누락) | plan frontmatter 3번째 행 | `.claude/docs/plan-lifecycle.md §4` — worktree 필드는 전체 디렉토리명(slug 포함) | frontmatter 를 `worktree: web-chat-preview-improvements-fa0488` 로 수정 |
| W5 | Plan Coherence | Phase 4 spec 갱신을 developer 가 직접 수행하는 절차 미명시 — CLAUDE.md 규약상 `spec/` 변경은 `project-planner` 권한 | Phase 4 "Spec 갱신 (정식 phase)" | CLAUDE.md Skill 체계 — `spec/` 변경 → `project-planner`, `developer` read-only | Phase 4 에 "project-planner 위임" 문구 추가 또는 `owner: planner/developer` 명시 |
| W6 | Naming | `execution.message` 가 `EiaEventName` 유니언 미포함 — 타입 경계 밖 처리 위험 | Phase 1 §1, Phase 4 §1 | `codebase/channel-web-chat/src/lib/eia-types.ts` L46-54 `EiaEventName` 유니언 | 구현 시 `EiaEventName` 에 `"execution.message"` 추가 + `ExecutionMessageEvent` 인터페이스 신설 |
| W7 | Naming | plan 제안 `MessageEvent` 타입명 — DOM 전역 `MessageEvent` 와 import shadowing 충돌 | Phase 2 §1 wire 타입 | `host-bridge.ts:45`, `eia-client.ts:15`, `demo-host.tsx:74` 등 수십 곳 DOM `MessageEvent` 참조 | `ExecutionMessageEvent` 로 명명 (기존 `AiMessageEvent` 컨벤션 준수) |

**중복 통합**: Cross-Spec W2·Rationale INFO3·Naming INFO4 가 동일한 `resetSession` spec 미등재를 지적 — 가장 강한 등급(WARNING)으로 W2 로 통합.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `execution.message.presentations` 와 `PresentationPayload` (AI Agent §7.10) 관계 미명시 | Phase 1 §3 payload 정의 | Phase 4 §1 spec 갱신 시 `presentations` shape 을 `{config, output}` 으로 명시하고 §7.10 관계 annotate |
| I2 | Cross-Spec | `5-admin-console.md §6` 레이아웃·초기화 버튼 명세 없어 Phase 4 "갭 없으면 추가 없음" 조건이 오판 — 갭 실존 | Phase 4 §2 조건부 기술 | Phase 4 §2 를 "현 spec §6 에 레이아웃·초기화 명세 없으므로 무조건 추가" 로 확정 |
| I3 | Rationale | 위젯 `AI_MESSAGE` reducer 재사용 — 신규 action 타입 대신 재사용한 근거 미기재 | Phase 2 §2번 항 | plan 또는 Phase 4 spec 에 "text+presentations 분리 렌더 이미 지원, 이중화 방지 목적" 추가 |
| I4 | Rationale | 2-column 레이아웃 `xl` breakpoint 결정 근거 spec 미기재 | Phase 3 §2번 항 | Phase 4 §6 미리보기 항에 Rationale(xl 이하 세로 stack 유지 의도) 추가 |
| I5 | Convention | `spec_impact` in-progress 단계 선언 — 규약상 완료 시점 필드이나 금지 아님 | frontmatter `spec_impact:` | 현행 유지. 완료 이동 시 실제 변경 파일과 비교·갱신 |
| I6 | Convention | `related_spec:` 에 디렉토리 경로(`spec/4-nodes/6-presentation`) 기재 — 파일 아님 | frontmatter `related_spec:` | 현행 유지 (정보용). 명확성 향상 시 실제 파일 경로 교체 가능 |
| I7 | Plan Coherence | `fix-webchat-sse-field-map.md` 의 EIA spec §6.2 backlog 변경과 타겟 plan 의 §6.6 추가가 동일 파일 수정 예정 — 내용 독립, rebase 충돌 가능성 | Phase 4 §1 | spec 갱신 시 §6.2 구간 회피, §6.6 에만 변경. 충돌 시 양쪽 내용 모두 보존 |
| I8 | Naming | `EXECUTION_MESSAGE` enum — `EXECUTION_MESSAGE_TOO_LONG` (WS 에러코드)과 prefix 4자 공유, 별도 네임스페이스라 직접 충돌 없음 | Phase 1 §1 | JSDoc 에 "SSE/WS 이벤트 타입 — 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 와 무관" 명시 |
| I9 | Naming | `PRESENTATION_NODE_TYPES` 상수 — `chat-channel.dispatcher.ts:40` 에 동일명 모듈-로컬 상수 이미 존재 | Phase 1 §2 | 공용 모듈(`src/common/constants/presentation.ts`)로 추출·공유. 엔진이 chat-channel 직접 import 시 의존 방향 위반 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건(EIA 이벤트 매핑 미명시, SDK 커맨드 미등재), INFO 2건. Critical 없음 |
| Rationale Continuity | LOW | WARNING 1건(R-CC-16 기각 범위 미명시), INFO 3건. Critical 없음 |
| Convention Compliance | LOW | WARNING 1건(worktree 필드 slug 누락), INFO 2건. Critical 없음 |
| Plan Coherence | LOW | WARNING 1건(Phase 4 spec 갱신 역할 위임 미명시), INFO 2건. Critical 없음 |
| Naming Collision | LOW | WARNING 2건(EiaEventName 미포함, MessageEvent DOM 충돌), INFO 4건. Critical 없음 |

---

## 권장 조치사항

1. **(즉시 — 구현 착수 전)** `plan/in-progress/web-chat-preview-improvements.md` frontmatter `worktree:` 값을 `web-chat-preview-improvements-fa0488` 로 수정 (W4 — push gate 오동작 방지).
2. **(즉시 — 구현 착수 전)** Phase 4 에 "spec 갱신은 project-planner 위임" 문구 추가 또는 `owner: planner/developer` 명시 (W5 — 역할 규약 위반 방지).
3. **(구현 시)** `eia-types.ts` `EiaEventName` 유니언에 `"execution.message"` 추가 + 신규 타입을 `ExecutionMessageEvent` 로 명명 (W6·W7 동시 해소 — DOM `MessageEvent` shadowing 방지).
4. **(Phase 4 spec 갱신 시)** `spec/5-system/14-external-interaction-api.md` §5.2 이벤트 목록·§8 매핑 테이블 양쪽에 `execution.message` 행 추가 명시 (W1).
5. **(Phase 4 spec 갱신 시)** EIA Rationale 신규 항: "본 변경은 SSE 표면만 additive 추가이며 R-CC-16 기각 대상(outbound HTTP 화이트리스트)과 별개" 명시 (W3).
6. **(Phase 4 spec 갱신 시)** `resetSession` 운영콘솔 전용 여부를 결정하고, `spec/7-channel-web-chat/2-sdk.md §3` action 열거 또는 internal-only 주석 추가 (W2).
7. **(구현 시 — 권장)** `PRESENTATION_NODE_TYPES` 를 공용 모듈로 추출하여 `chat-channel.dispatcher.ts` 와 엔진 레이어가 공유 (I9 — 의존 방향 위반 예방).
