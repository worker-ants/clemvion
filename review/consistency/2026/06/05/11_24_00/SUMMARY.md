# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**MEDIUM** — Phase B 착수 전 해소해야 할 Rationale 연속성 경고 2건(fast-path 강등 선택지 + D4 Rationale 명문화 미착수) 존재. 나머지는 LOW 수준.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Rationale Continuity | plan B2 의 "fast-path 강등" 선택지가 Rationale 에서 명시 기각된 sticky fast-path 와 동형 — "의존 금지" 레이블을 붙여도 코드에 if(pendingMap.has) 분기가 존재하면 race window 가 현실화됨 | `plan/in-progress/exec-park-durable-resume.md` Phase B, B2 항목 | `spec/5-system/4-execution-engine.md §Rationale "Sticky fast-path 제거"` | B2 에서 "강등" 선택지를 삭제하고 "제거"만 명시. §7.4 "Worker 동작" 행의 fast-path 기술도 제거/갱신을 plan B Spec 변경 항목에 명시. |
| W2 | Rationale Continuity | Phase B 착수 전 D4 turn-단위 park Rationale 명문화가 plan 에 "의무"로만 기록되고 spec 에 미착수 — Phase B 구현이 선행하면 Rationale 부재 번복이 됨 | `plan/in-progress/exec-park-durable-resume.md` Spec 변경 섹션 (104행) | `spec/5-system/4-execution-engine.md §Rationale` | Phase B PR 착수 전 `4-execution-engine.md §Rationale` 에 "D4 turn-단위 park 채택 근거 + 기각 대안(단일 waiting 유지+코루틴 누적 수용)" 항을 실제로 추가. |
| W3 | Convention Compliance | `1-auth.md §1.5.4` historical-artifact forward-reference 단방향 — `error-codes.md §3` 역방향 링크 없어 `rate_limited` 초대-흐름 한정 성격을 독자가 단독 탐색 불가 | `spec/5-system/1-auth.md §1.5.4` 각주 | `spec/conventions/error-codes.md §3` | `1-auth.md §1.5.4` 각주에 "본 코드들의 레지스트리 상세는 `error-codes.md §3` 참조" 역방향 링크 추가 (규약 위반 아님, 탐색성 개선). |
| W4 | Convention Compliance | `11-mcp-client.md §6.2` `skipReason` lower_snake_case 예외가 해당 문서 blockquote 에만 존재하고 `spec/conventions/error-codes.md §1` 또는 `node-output.md` 에 미반영 — 다른 개발자가 conventions 참조 시 근거를 찾기 어려움 | `spec/5-system/11-mcp-client.md §6.2` | `spec/conventions/node-output.md Principle 3.2` | `spec/conventions/error-codes.md §1` 또는 별도 섹션에 "운영 진단 enum(`skipReason` 등)은 에러 코드 규약 적용 범위 밖" 명시. |
| W5 | Convention Compliance | `10-graph-rag.md` Overview 섹션에 요구사항·기술 결정·Phase Plan 등 본문 성격 내용이 혼재 — 권장 3섹션(Overview/본문/Rationale) 구분 위반 | `spec/5-system/10-graph-rag.md §Overview` | CLAUDE.md "Spec 문서 3섹션 구성" | `§Overview` 를 목표·범위 요약으로 축소하고 요구사항(`KB-GR-*`)·기술 결정·Phase 계획을 본문 섹션으로 이동. 또는 이 패턴을 SKILL.md/conventions 에 명문화. |
| W6 | Naming Collision | `forbidden`/`rate_limited` (lowercase) 를 글로벌 레지스트리에 등재하면서 `FORBIDDEN`/`RATE_LIMITED` (UPPER_SNAKE_CASE) 와 동일 레지스트리 내 공존 — 대소문자 혼동 가능성 | `spec/conventions/error-codes.md §3` 해당 행 | `spec/5-system/2-api-convention.md` L160, `spec/5-system/3-error-handling.md` L28·L37 | 레지스트리 entry 에 "본 `forbidden`/`rate_limited`(lowercase)는 초대 흐름 전용이며 `2-api-convention.md` 의 `FORBIDDEN`/`RATE_LIMITED`(global default)와 의도적으로 다른 값이다" 강화 명시. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `telegram.md §5.7` `RESUME_INCOMPATIBLE_STATE` 발생 케이스 열거에 "미래 버전(schemaVersion 초과)" 케이스 미추가 | `spec/4-nodes/7-trigger/providers/telegram.md §5.7` L192 | 해당 열거에 "미래 버전(`schemaVersion` 초과, 롤링 배포 중)" 추가 동기화. |
| I2 | Cross-Spec | `2-api-convention.md §3` 기본값 표에 초대 흐름 lowercase 예외 역방향 언급 없어 탐색성 저하 | `spec/5-system/2-api-convention.md §3` | 기본값 표 footnote 에 "초대 흐름 historical-artifact `forbidden`/`rate_limited` 는 `error-codes.md §3` 참조" 추가 권장. |
| I3 | Rationale Continuity | §7.4 표 "Worker 동작" 행이 fast-path 를 현행 동작으로 기술 — Rationale 기각 결정과 표면 불일치 (과도기로 수용 가능하나 Phase B PR 에서 반드시 갱신) | `spec/5-system/4-execution-engine.md §7.4` 표 L823 | Phase B PR 에서 행을 "항상 rehydration(fast-path 없음)"으로 갱신하고 §4.x 구현 메모의 "현재 fast-path" 서술 제거. |
| I4 | Rationale Continuity | A2b(information_extractor checkpoint 확장) Rationale 기록 필요 — plan 에 메모만 있고 실제 Rationale 미작성 | `plan/in-progress/exec-park-durable-resume.md` A2b 항목 | A2b 착수 시 `4-execution-engine.md §Rationale` 에 "IE checkpoint 확장 채택 근거 + ai_agent 한정 원칙 번복 이유" 추가를 착수 선행 조건으로 명문화. |
| I5 | Convention Compliance | `1-auth.md §5` PATCH `/api/auth/2fa/webauthn/credentials/:id` 행에 HTTP 상태 코드 미기재 (본문 서술에는 있으나 §5 표 내 불일치) | `spec/5-system/1-auth.md §5` 표 | 해당 행에 "200 (갱신된 row), 404 (본인 소유 아님)" 명시. |
| I6 | Convention Compliance | `11-mcp-client.md §3.2` credentials 표 `비밀` 컬럼에 `🔒` 이모지 사용 — CLAUDE.md 이모지 금지 정책 | `spec/5-system/11-mcp-client.md §3.2` | `🔒` 를 `yes` 또는 `암호화` 텍스트로 대체 (신규 작성 시 준수 권장). |
| I7 | Convention Compliance | `10-graph-rag.md` frontmatter `status: implemented` 와 Overview 내 구현 완료 blockquote 중복 — 비동기화 위험 | `spec/5-system/10-graph-rag.md` frontmatter + `§Overview` | Overview 인라인 blockquote 제거 또는 frontmatter `status` 단일 SoT 링크로 대체. |
| I8 | Convention Compliance | `cafe24-api-catalog/application/appstore-orders.md` GET/POST 응답 표 `order` wrapper 설명이 "정렬 순서 asc/desc" 로 잘못 copy-paste | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` | wrapper 설명을 `(응답 객체)` 로 수정. |
| I9 | Plan Coherence | Phase B 선행 spec 의무(D4 Rationale) 미이행 — A2a 스코프 내 수용 가능하나 Phase B 착수 전 pending obligation | `spec/5-system/4-execution-engine.md §4.x / Rationale` | Phase B PR 착수 직전 spec PR 에서 D4 결정 배경 텍스트 추가. plan 체크박스 추가 권장. |
| I10 | Plan Coherence | A2b `ai_agent 한정` 문구 3곳 spec 에 잔존 — A2a 스코프 외 예상된 상태, A2b 착수 시 누락 방지 추적 필요 | `spec/5-system/4-execution-engine.md §1.3` L111·L113·L1166 | A2b 착수 시 3곳 동기 갱신을 일정에 포함. |
| I11 | Plan Coherence | Phase 0 open item — node-cancellation §2 직렬화 순서 미확정 (A2a 충돌 없음, Phase B 착수 전 확정 필요) | `plan/in-progress/exec-park-durable-resume.md` Phase 0 / `plan/in-progress/node-cancellation-infrastructure.md §2` | Phase B PR 착수 전 순서 확정 후 plan 기록. |
| I12 | Plan Coherence | D2(user-defined variables 복원) 미확정 — 현재 target spec 미반영은 예상된 상태, 추적 목적 | `plan/in-progress/exec-park-durable-resume.md §A3` | 사용자/planner 결정 후 A3 체크박스 업데이트. |
| I13 | Plan Coherence | Stale worktree 12건 `plan/in-progress/` 에 참조 잔존 (모두 MERGED PR 종결) | 각 stale plan 파일 | `./cleanup-worktree-all.sh --yes --force` 실행 권장. |
| I14 | Naming Collision | `schemaVersion`/`CHECKPOINT_SCHEMA_VERSION` — execution-engine 모듈 내부 한정, 타 도메인 충돌 없음 | `spec/5-system/4-execution-engine.md` / `execution-engine.service.ts` | 없음. 현재 명명 적절. |
| I15 | Naming Collision | `RESUME_INCOMPATIBLE_STATE` 확장 — 신규 코드 아닌 기존 코드 트리거 조건 확장, 충돌 없음 | `spec/5-system/3-error-handling.md` 외 4개 | 없음. |
| I16 | Naming Collision | invitation 에러코드 4종 레지스트리 등재 — 신규 발명 아닌 기존 코드 소급 등재, 충돌 없음 | `spec/conventions/error-codes.md §3` | 없음. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `telegram.md §5.7` RESUME_INCOMPATIBLE_STATE 케이스 열거 미동기화(INFO). 5개 target 파일 간 내부 일관성 양호. |
| Rationale Continuity | MEDIUM | Phase B2 fast-path 강등 선택지가 명시 기각 결정과 동형(WARNING). D4 Rationale 명문화 미착수(WARNING). §7.4 과도기 기술 존재(INFO). |
| Convention Compliance | LOW | CRITICAL 위반 없음. `skipReason` 예외 conventions 미반영(WARNING), `10-graph-rag.md` 3섹션 구조 위반(WARNING), cross-reference 단방향(WARNING). |
| Plan Coherence | LOW | 모든 발견이 INFO. A2a 변경이 in-progress plan 과 직접 충돌 없음. Phase B 착수 전 pending obligation 추적 기록. |
| Naming Collision | LOW | CRITICAL 충돌 없음. `forbidden`/`rate_limited` lowercase↔UPPER_SNAKE_CASE 혼동 가능성(WARNING). 신규 식별자 충돌 없음. |

---

## 권장 조치사항

1. **(Phase B 착수 전 — W2 우선)** `spec/5-system/4-execution-engine.md §Rationale` 에 "D4 turn-단위 park 채택 근거 + 기각 대안(단일 waiting 유지+코루틴 누적 수용)" 항을 Phase B PR 착수 전 spec PR 로 실제 추가. plan §Spec 변경 항목에 체크박스 추가.
2. **(Phase B 착수 전 — W1 우선)** `plan/in-progress/exec-park-durable-resume.md` B2 항목에서 "강등" 선택지를 삭제하고 "제거"로 단일화. §7.4 fast-path 행 제거를 plan B Spec 변경 항목에 명시 추가.
3. **(W3 — 탐색성)** `1-auth.md §1.5.4` 각주에 `error-codes.md §3` 역방향 링크 한 줄 추가.
4. **(W4 — Conventions 보완)** `spec/conventions/error-codes.md §1` 에 "운영 진단 enum은 에러 코드 규약 적용 범위 밖" 명시 또는 `node-output.md` 에 패턴 명문화.
5. **(W5 — 문서 구조)** `10-graph-rag.md §Overview` 를 목표·범위 요약으로 축소하고 요구사항·기술 결정 사항을 본문 섹션으로 분리.
6. **(W6 — 혼동 방지)** `error-codes.md §3` 해당 행에 lowercase 코드와 UPPER_SNAKE_CASE global default 가 "의도적으로 다른 값"임을 명시 강화.
7. **(I1 — 서술 동기화)** `spec/4-nodes/7-trigger/providers/telegram.md §5.7` 발생 케이스 열거에 "미래 버전(schemaVersion 초과, 롤링 배포 중)" 추가.
8. **(I8 — copy-paste 오류)** `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` GET/POST 응답 표의 `order` wrapper 설명을 `(응답 객체)` 로 수정.
9. **(I13 — 정리)** `./cleanup-worktree-all.sh --yes --force` 로 stale worktree 12건 정리.