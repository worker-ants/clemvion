# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불필요.

## 전체 위험도
**LOW** — 모든 5개 checker 에서 Critical·Warning 항목 없음. INFO 수준 개선 여지 5건 존재하나 시스템 동작·spec 정합성을 깨지 않음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/1-data-model.md §2.23` dedup UPDATE 설명에 `expires_at` 재설정 조건(`ttlDays` 유무) 누락 — 직접 모순은 아니나 독자 오해 가능 | `spec/1-data-model.md §2.23` 의미 dedup/갱신 설명 | §2.23 에 `ttlDays` 제공 여부에 따른 `expires_at` 처리 조건 한 문장 추가, 또는 `spec/5-system/17-agent-memory.md §4` 를 SoT 로 참조 링크 추가 |
| 2 | Convention Compliance | §6 API 경로 표기에 base URL 맥락 미명시 — `/agent-memories/scopes` 등이 절대 경로처럼 혼용 표기되어 독자가 base URL 추론 필요 | `spec/5-system/17-agent-memory.md §6` 표 상단 또는 섹션 도입부 | `base: /api/agent-memories` 또는 `base URL: /api/` 한 줄 추가 |
| 3 | Convention Compliance | frontmatter `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` — 해당 파일 실존 여부 미확인 (build 가드 `spec-pending-plan-existence.test.ts` 에서 fail 가능) | `spec/5-system/17-agent-memory.md` frontmatter | 파일 실존 확인 후 없으면 plan 파일 생성 또는 frontmatter 경로 수정 |
| 4 | Rationale Continuity | KB Rationale 의 "재임베딩 필요" 결정과의 표면적 충돌 — agent_memory Rationale 에 KB 와의 영역 분화 결정임을 명시하는 cross-reference 한 줄 부재 | `spec/5-system/17-agent-memory.md §Rationale` "일괄 재임베딩 경로 부재" 소항 | "KB §Rationale 의 재임베딩 필요 판단은 영속 문서에 적용되는 원칙이며, agent_memory 는 성질 상이로 명시 분리 결정" 한 줄 cross-reference 추가 |
| 5 | Plan Coherence | `ai-context-memory-followup-v2.md` 미완료 항목 I1(§3 AGM-04 BullMQ 표현 갱신)이 존재 — target Rationale 신규 소항과 섹션이 달라 현재는 충돌 없으나, I1 적용 시 §3 본문과 Rationale 간 표현 일관성 확인 필요 | `spec/5-system/17-agent-memory.md §3` / Rationale | I1 적용 시 §3 "scheduleBackgroundBody snapshot 격리 invariant" 와 Rationale 신규 소항 표현 일치 여부 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·AI Agent·IE·LLM 클라이언트·네비게이션 spec 전반에서 모순 없음. `spec/1-data-model.md §2.23` dedup UPDATE `expires_at` 조건 누락만 INFO |
| Rationale Continuity | NONE | 기존 KB Rationale 과의 표면적 충돌은 영역 분화 결정으로 확인. pgvector 재사용·스코프 키 안전 디폴트·hard delete 모두 정합 |
| Convention Compliance | LOW | CRITICAL·WARNING 없음. API base URL 미명시, `pending_plans` 파일 실존 미확인 INFO 2건 |
| Plan Coherence | NONE | active worktree 경합 없음. in-progress plan 과 실질적 충돌 없음. I1 향후 적용 시 표현 일관성 확인 권장 |
| Naming Collision | NONE | AGM-01~AGM-13, 테이블명·상수·서비스명·API 경로·config 필드명·frontmatter id 모두 기존 코퍼스와 충돌 없음 |

## 권장 조치사항

1. (INFO — 확인 필요) `plan/in-progress/ai-context-memory-followup-v2.md` 파일 실존 확인 — 없으면 생성하거나 frontmatter 수정 (Convention Compliance INFO #3, build 가드 관련).
2. (INFO — 선택) `spec/1-data-model.md §2.23` 의미 dedup/갱신 설명에 `expires_at` 재설정 조건(`ttlDays` 유무) 한 문장 추가 (Cross-Spec INFO #1).
3. (INFO — 선택) `spec/5-system/17-agent-memory.md §6` 표 상단에 `base URL: /api/` 한 줄 추가 (Convention Compliance INFO #2).
4. (INFO — 선택) `spec/5-system/17-agent-memory.md §Rationale` 에 KB 비대칭 inputType Rationale 과의 영역 분화 결정을 명시하는 cross-reference 한 줄 추가 (Rationale Continuity INFO #4).
5. (INFO — 향후) `ai-context-memory-followup-v2.md` I1 적용 시 §3 본문 표현과 Rationale 신규 소항 간 일관성 재확인 (Plan Coherence INFO #5).

---

검토 대상: `spec/5-system/17-agent-memory.md`
검토 일시: 2026-06-06 12:44:52
Checker: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision (5/5 success)
