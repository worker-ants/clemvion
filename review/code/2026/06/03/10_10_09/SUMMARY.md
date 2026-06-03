# Code Review 통합 보고서

리뷰 대상: channel-web-chat spec 갭 보완 변경 (spec/7-channel-web-chat/*, spec/conventions/spec-impl-evidence.md, consistency review 산출물)
리뷰 일시: 2026-06-03

---

## 전체 위험도

**MEDIUM** — spec 구조적 결합도 문제(enum 소유권·SoT 이중화)와 build-time 가드 적용 범위 분리 위험이 존재하나, CRITICAL 수준의 기능 누락·런타임 버그는 없음

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `blocked` 상태 enum 소유권 역전 — 보안 spec 이 정의하지 않은 채 위젯 spec 이 먼저 명기 | `spec/7-channel-web-chat/4-security.md §3-①` + `1-widget-app.md §3.2` | `4-security §3-①` 에 "`blocked` = 정책 거부 상태 SoT" 를 명시하고, `1-widget-app §3.2` 는 단방향 cross-ref 로 전환 |
| 2 | 아키텍처 | `WEB_CHAT_WIDGET_ORIGINS` env 키가 `0-architecture §4` 와 `4-security §2.1` 두 곳에 중복 기술 — 단일 진실 원칙 위배 | `spec/7-channel-web-chat/0-architecture.md §4`, `spec/7-channel-web-chat/4-security.md §2.1` | `0-architecture §4` 에서 키 이름·파일 경로 등 구현 세부를 제거하고 "상세는 [4-security §2.1]" 순수 cross-ref 만 유지 |
| 3 | 아키텍처 | `1-widget-app §3.2` 가 UI 상태, 보안 정책 결정, 프로파일 변이를 동일 절에 혼재 — 레이어 분리 불완전 | `spec/7-channel-web-chat/1-widget-app.md §3.2` | 가시성 축(UI)과 정책 거부(`blocked`)를 별도 하위절로 분리하거나 레이어 구분 주석 명시; `updateProfile` 을 §3.3 또는 2-sdk 로 이동 검토 |
| 4 | 부작용 | `spec-impl-evidence.md §1` 에 `spec/7-channel-web-chat/**.md` 추가 시 4개 build-time 가드 즉시 활성되나, `spec-frontmatter-parse.ts INCLUDE_PREFIXES` 미갱신 — 가드 적용 범위 분리 | `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` | `spec-impl-evidence.md §1` 변경과 `INCLUDE_PREFIXES` 배열 추가를 반드시 동일 PR 에 묶어야 함 |
| 5 | 부작용 | `1-widget-app.md` `pending_plans` 에 `channel-web-chat-demo.md` 추가 — `spec-pending-plan-existence.test.ts` 즉시 강제, plan 파일 실존 미확인 | `spec/7-channel-web-chat/1-widget-app.md` frontmatter | 머지 전 `plan/in-progress/channel-web-chat-demo.md` 실존 여부 확인; 이미 complete 이면 `spec-draft-channel-web-chat-gaps.md` 로 교체 |
| 6 | 요구사항 | plan 지시 항목 `2-sdk §R4 에 blocked 1줄 추가` 가 실제 변경에서 누락 — plan-구현 괴리 | `spec/7-channel-web-chat/2-sdk.md` (미변경) | (a) 철회 의도면 plan 문서에 "2-sdk §R4 추가 철회" 명기; (b) 추가 필요 시 `2-sdk §1` show/hide 설명 하단 1줄 추가 검토 |
| 7 | 요구사항 | EIA `replay_unavailable` 역방향 cross-ref 누락 — 향후 구현 시 위젯 갱신 의무를 놓칠 위험 | `spec/5-system/14-external-interaction-api.md §5.2` (미변경) | EIA §5.2(EIA-NF-03) 에 "클라이언트 fallback: >5분 로컬 시간 기준 — `replay_unavailable` 구현 시 위젯 타이머 교체 의무" 노트 추가 (project-planner 소관) |
| 8 | 요구사항 | `1-widget-app.md` + `3-auth-session.md` `pending_plans` 에 `spec-draft-channel-web-chat-gaps.md` 미등재 | `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md` frontmatter | `pending_plans` 에 `plan/in-progress/spec-draft-channel-web-chat-gaps.md` 추가, 또는 완료 시 원자 갱신 |
| 9 | 요구사항 | `channel-web-chat-followups.md §4` show/hide/updateProfile 항목이 "설계 미완" 체크박스 열린 상태로 방치 — 이번 spec 변경으로 설계 완료됐음에도 미갱신 | `plan/in-progress/channel-web-chat-followups.md §4` | 해당 항목을 "완료(spec-draft-channel-web-chat-gaps.md §4-a/4-b 반영)" 로 갱신 |
| 10 | 유지보수 | `1-widget-app §3.1` SSE 재연결 단락이 소제목·앵커 없이 테이블 절 본문에 묻혀 cross-ref 불가 | `spec/7-channel-web-chat/1-widget-app.md §3.1` | `### 3.1 SSE 재연결 시나리오` 소제목 추가, `3-auth-session §3.1` cross-ref 를 해당 앵커로 갱신 |
| 11 | 유지보수 | `3-auth-session §3` 기존 "새로고침 지속" 요약 bullet 과 신규 `§3.1` 상세 절차가 동일 내용 중복 — 단일 진실 위배 | `spec/7-channel-web-chat/3-auth-session.md §3` | `§3` 본문 bullet 을 "상세 절차는 §3.1" 한 줄 cross-ref 로 축약 |
| 12 | 유지보수 | `spec-impl-evidence.md §1` 신규 항목만 긴 인라인 괄호 설명 — 기존 항목과 스타일 불일치 | `spec/conventions/spec-impl-evidence.md §1` | 인라인 괄호 제거 후 내용을 `## Rationale` 절에 R-7 항목으로 이동 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `3-auth-session §3.1` 과 `1-widget-app §3.1` 이 서로를 순환 참조 — 각 문서의 책임 영역이 다르므로 큰 문제는 아니나 명시 부재 | 두 spec 파일 §3.1 | 각 섹션 도입부에 "인증 토큰 관점 복원" vs "SSE 재연결 메커니즘" 분담 범위 1줄 명시 |
| 2 | 아키텍처 | `spec-impl-evidence.md §1` 신규 항목이 Rationale 없이 인라인 주석만으로 근거 제시 | `spec/conventions/spec-impl-evidence.md §1` | `## Rationale` 에 "채널 영역(spec/7 이후)은 제품 표면을 약속하므로 frontmatter 의무 대상" 기준 1줄 추가 |
| 3 | 아키텍처 | consistency review `_retry_state.json` 이 초기 빈 상태로 커밋 — observability 약점 | `review/consistency/2026/06/03/09_46_31/_retry_state.json` | 향후 최종 상태 별도 보존(`_retry_state_final.json`) 검토 |
| 4 | 요구사항 | `4-security §3-①` `blocked` cross-ref 는 적절하나, `blocked` 정의 SoT = `1-widget-app §3.2` 임을 명시하지 않아 이중 정의 혼동 가능 | `spec/7-channel-web-chat/4-security.md §3-①` | "`blocked` 의 정의 SoT = 1-widget-app §3.2" 명시 |
| 5 | 요구사항 | `plan/in-progress/spec-draft-channel-web-chat-gaps.md §W3` 의 `_product-overview.md` 제외 근거가 spec-impl-evidence.md 규칙과 혼용 표현 | plan 문서 §W3 | "underscore prefix 패턴 제외 규칙(spec-impl-evidence.md §1)"으로 교정 (spec 본문은 정확, plan 문서만 수정) |
| 6 | 문서화 | `4-security §1` 보안 요약표 "임베드 allowlist" 행이 `blocked` 상태 미언급 — §3-① 본문과 불일치 | `spec/7-channel-web-chat/4-security.md §1` | "불일치 시 위젯 `blocked` 상태" 한 줄 추가 |
| 7 | 문서화 | `1-widget-app §3` ASCII 다이어그램이 패널 전개 축만 표시, 가시성 축(`show`/`hide`) 미반영 | `spec/7-channel-web-chat/1-widget-app.md §3` | 다이어그램 위에 "가시성 축(show/hide)은 §3.2 참조" 한 줄 주석 추가 |
| 8 | 문서화 | `spec-impl-evidence.md §6` "60여개" 숫자가 spec/7 영역 추가로 부정확도 증가 | `spec/conventions/spec-impl-evidence.md §6` | 숫자 보정 또는 파일 수 대신 패턴 설명으로 교체 |
| 9 | 문서화 | `0-architecture §4` · `4-security §2.1` 에서 `.env.example` 경로(`codebase/backend/.env.example`) 미명시 | 두 spec 파일 | "backend `.env.example`(`codebase/backend/.env.example`)" 으로 명시 |
| 10 | 유지보수 | `1-widget-app §3.2` 테이블 "패널 전개" 행 의미 열이 "위 상태기계의 collapsed↔패널 축"으로만 기술 — 자기 완결적이지 않음 | `spec/7-channel-web-chat/1-widget-app.md §3.2` 테이블 | "`open` = 패널 펼침, `collapsed` = 패널 접힘. `hide` 상태에서는 무효" 형태로 자기 완결 기술 |
| 11 | 유지보수 | `4-security §2.1` 신규 bullet 이 두 줄로 줄바꿈 — 기존 항목과 시각 계층 불일치, Markdown 렌더러에 따라 별도 단락 처리 가능 | `spec/7-channel-web-chat/4-security.md §2.1` | 단일 행으로 합치거나 기존 스타일과 통일 |
| 12 | 유지보수 | `_retry_state.json` / `meta.json` 파일 말미 newline 누락 (POSIX 위반, diff 경고) | `review/consistency/2026/06/03/09_46_31/` | 오케스트레이터 JSON 직렬화 후 `\n` 추가 |
| 13 | 유지보수 | checker 파일 간 내부 레이아웃 불일치 (`plan_coherence.md` 은 bold 필드, `cross_spec.md` 는 bullet 형태) | `review/consistency/2026/06/03/09_46_31/` 하위 checker 파일 | checker 프롬프트 템플릿에 필드 레이아웃 명문화 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | MEDIUM | `blocked` enum 소유권 역전, `WEB_CHAT_WIDGET_ORIGINS` SoT 이중화, `§3.2` 레이어 혼재 |
| requirement | MEDIUM | `2-sdk §R4 blocked` 추가 누락(plan-구현 괴리), EIA 역방향 cross-ref 누락, pending_plans 미갱신 |
| side_effect | MEDIUM | build-time 가드 적용 범위 분리(`INCLUDE_PREFIXES` 미갱신), `channel-web-chat-demo.md` plan 실존 미확인 |
| maintainability | LOW | SSE 재연결 단락 앵커 부재, `3-auth-session §3` 중복 기술, 스타일 불일치 |
| scope | NONE | 13개 변경 파일 모두 범위 내, 이탈 없음 |
| documentation | NONE | CRITICAL/WARNING 없음. INFO 6건 — 다이어그램 미반영, 요약표 불일치 등 |

---

## 발견 없는 에이전트

없음 (모든 실행 에이전트에서 발견사항 존재).

---

## 권장 조치사항

1. **[즉시·머지 차단] `spec-frontmatter-parse.ts INCLUDE_PREFIXES` 갱신** — `spec-impl-evidence.md §1` 변경과 동일 PR 에 묶지 않으면 4개 build-time 가드가 의도한 대상을 검사하지 않거나 예상치 못한 fail 이 발생한다.
2. **[즉시·머지 차단] `plan/in-progress/channel-web-chat-demo.md` 실존 확인** — 이미 complete 된 plan 이면 `1-widget-app.md pending_plans` 에서 제거하고 `spec-draft-channel-web-chat-gaps.md` 로 교체.
3. **[WARNING 해소] `2-sdk §R4 blocked` 추가 의도 명확화** — 철회면 plan 문서에 명기, 추가 계속이면 `2-sdk §1` 위치에 추가.
4. **[WARNING 해소] EIA `replay_unavailable` 역방향 cross-ref 추가** — `spec/5-system/14-external-interaction-api.md §5.2` 에 위젯 타이머 교체 의무 노트 추가 (project-planner 소관).
5. **[WARNING 해소] `pending_plans` 정합성 복원** — `1-widget-app.md` + `3-auth-session.md` 에 `spec-draft-channel-web-chat-gaps.md` 등재, `channel-web-chat-followups.md §4` 항목 완료 처리.
6. **[WARNING 해소] `blocked` enum SoT 명확화** — `4-security §3-①` 에 "`blocked` 정의 SoT = 1-widget-app §3.2" 명시.
7. **[WARNING 해소] `0-architecture §4` 구현 세부 제거** — `parseWidgetOrigins` 함수명·파일 경로를 `0-architecture §4` 에서 제거하고 `4-security §2.1` SoT 단일화.
8. **[WARNING 해소] `1-widget-app §3.1` SSE 재연결 단락에 소제목(`### 3.1 SSE 재연결 시나리오`) 추가** — cross-ref 앵커 확보.
9. **[WARNING 해소] `3-auth-session §3` 중복 bullet 축약** — "상세 절차는 §3.1" 한 줄 cross-ref 로 대체.
10. **[INFO 후속] `spec-impl-evidence.md §1` 인라인 괄호 제거 + Rationale R-7 추가**, `4-security §1` 요약표 `blocked` 추가, `1-widget-app §3` 다이어그램 주석 추가.

---

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행** (6명): `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `documentation`
- **강제 포함(router_safety)** (2명): `documentation`, `requirement`
- **제외** (8명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | 라우터 판단 생략 |
  | performance | 라우터 판단 생략 |
  | testing | 라우터 판단 생략 |
  | dependency | 라우터 판단 생략 |
  | database | 라우터 판단 생략 |
  | concurrency | 라우터 판단 생략 |
  | api_contract | 라우터 판단 생략 |
  | user_guide_sync | 라우터 판단 생략 |

재시도 필요: 0건.