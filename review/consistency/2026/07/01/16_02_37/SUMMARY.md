# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견사항 없음. 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 모두 LOW. WARNING 2건(중복 통합 후 실질 2건), INFO 6건. 런타임 동작 정합, spec 표기 불일치 수준.

> 본 세션 대상 변경 = refactor-03 m-1 planner 위임 (`console.warn`→`logger.warn` 2건). 아래 WARNING/INFO 는 **I-1 을 제외하고 전부 `ai-agent.md` 대형 파일의 pre-existing drift** 로 본 변경과 무관 — 별건 후속 대상.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec + Naming Collision (통합) | `_resumeState.lastExtractionTurnSeq` (구 flat 키)를 canonical 명칭으로 기술. I12 결정에 의해 canonical 은 `_resumeState.memoryState.lastExtractionTurnSeq` 이며 flat 키는 읽기 폴백 전용 | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 2.7 / §2.7 증분 추출 단락 | `spec/5-system/17-agent-memory.md` §3 (AGM-08/I12), `spec/4-nodes/3-ai/3-information-extractor.md` line 163 | §6.1 step 2.7 의 키를 `_resumeState.memoryState.lastExtractionTurnSeq` (I12)로 갱신하고 "(읽기 경로는 구 평면 키 폴백 — in-flight 하위호환)" 병기 |
| W-2 | Convention Compliance | 조건 ID 예약 포트 금지 목록이 5개(`out`/`in`/`error`/`user_ended`/`max_turns`)뿐이며 `default`/`done`/`completed`/`fallback`/`continue` 누락. 반대로 `in` 은 Principle 6 전역 목록에 없는 추가 항목 | `spec/4-nodes/3-ai/1-ai-agent.md` §5.1 + §10 Pre-flight 에러 표 | `spec/conventions/node-output.md` Principle 6 | §5.1/§10 을 Principle 6 전체 예약어 9개 기준으로 갱신. `in` 은 Principle 6 에도 포함 제안 |

> **둘 다 pre-existing — 본 PR(console→logger) 범위 밖.** 별건 spec 후속으로 처리.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | §6.2 c.fallback `console.warn` → `logger.warn` 변경 — presentation-common §10.9 `logger.warn` 표기와 오히려 더 정렬됨 | §6.2 c.fallback | **변경 유지. 별도 조치 불필요** (= 본 PR 변경) |
| I-2 | Rationale Continuity | D6 결정(`output.result.*` 단일 경로)이 §12 대신 §7.5 인라인 노트에 기술 | §7.5 | §12.15 로 이전 또는 교차참조 추가 |
| I-3 | Rationale Continuity | §12.12 폐기 위젯명 `embedding-model-selector`/`chat-model-selector` stale (⚠️ 고지 존재) | §12.12 | 현행 위젯명 한 줄 병기 |
| I-4 | Rationale Continuity | §4 ToolOverride 테이블이 비활성("재작성 예정") 섹션에 상세 기술 | §4 | 비활성 주석/`<details>` 처리 |
| I-5 | Convention Compliance | 조건 ID 예시값 `"refund_request"` 이 §1 UUID v4 규약과 불일치 | §7.2/§7.6/§1 | UUID 형태 교체 또는 illustrative 주석 |
| I-6 | Convention Compliance | 출력 예시 제목 `### 7.1 ...` 이 Principle 11 `### Case:` 형식과 불일치 | §7.1~§7.10 | 형식 통일 또는 번호 허용 명시 |
| I-7 | Convention Compliance | `## 12. Rationale` 번호 heading (규약은 bare `## Rationale`) | §12 | 번호 제거 또는 규약에 허용 명시 |
| I-8 | Plan Coherence | `ai-context-memory-followup-v2.md` 미완료 2건이 타 spec 파일 대상 — target 무영향 | 해당 없음 | 별도 spec PR |
| I-9 | Plan Coherence | `exec-park-durable-resume.md` 잔여 항목 target 무관하나 `pending_plans` 유지 | frontmatter | 계획 종결 시 자동 해소 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 1(W-1), INFO 1(I-1 logger.warn 호환) |
| Rationale Continuity | LOW | INFO 3 |
| Convention Compliance | LOW | WARNING 1(W-2), INFO 3 |
| Plan Coherence | LOW | INFO 2. CRITICAL/WARNING 없음 |
| Naming Collision | LOW | WARNING 1(W-1 통합). 나머지 충돌 없음 |

---

## 권장 조치사항

1. **(본 PR)** §6.2 c.fallback console.warn→logger.warn — I-1, 조치 완료.
2. **(별건 후속)** W-1 §6.1 step 2.7 watermark canonical 키(`memoryState.` sub-namespace) 갱신 — `17-agent-memory.md §3`/`3-information-extractor.md:163` 과 수렴.
3. **(별건 후속)** W-2 §5.1/§10 조건 ID 예약 포트 목록을 `node-output.md` Principle 6 전체 기준으로 갱신.
4. **(별건)** I-8 `node-output.md`/`3-information-extractor.md` watermark 참조 갱신 (`ai-context-memory-followup-v2.md` Batch 2).
5. **(cleanup)** I-2~I-7/I-9 표기 정합 — 다음 해당 문서 편집 시 일괄.

_(SUMMARY 는 main 이 workflow 반환 summary_markdown 을 idempotent persist — workflow terminal write 는 write_blocked.)_
