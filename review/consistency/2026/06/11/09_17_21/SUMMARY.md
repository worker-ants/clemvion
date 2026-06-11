# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건: spec §2.6.3 트랙 배정 현황이 구현과 정면 모순 상태

## 전체 위험도
**CRITICAL** — spec §2.6.3 "override 잔존" 목록이 auto-form 이행 완료된 두 노드를 여전히 포함, 구현과 정면 모순

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | spec §2.6.3 "override 잔존" 목록에 `text_classifier`·`information_extractor` 가 여전히 포함 — 구현은 두 노드를 auto-form 으로 이행 완료 | `override-registry.ts` (두 키 제거), `ai-configs.tsx` (삭제) | `spec/3-workflow-editor/1-node-common.md` §2.6.3 274행: "override 잔존 (`OVERRIDE_REGISTRY` 기준)" 목록 | spec §2.6.3 의 `override 잔존` 목록에서 두 노드를 제거하고, `auto-form 이행 완료` 목록에 추가. Rationale R-2 혹은 신규 R-3 에 이행 근거(V-02 cross-audit) 기록 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | R-2 가 §2.6.3 을 SoT 로 명문화했으나, 구현 변경과 동시에 해당 목록 미갱신 — 단일 진실 원칙 간극 | `override-registry.ts` (두 노드 제거) | `spec/3-workflow-editor/1-node-common.md` §2.6.3 + Rationale R-2 | Critical #1 해소 시 함께 처리: R-2 하위 또는 신규 R-3 에 "두 노드의 zod 스키마가 auto-form 위젯으로 충분히 표현됨을 V-02 에서 확인해 bespoke 폼 폐기 (2026-06-11)" 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `override-registry.ts` 65~68행 — AI 절 코드 엔트리 없이 주석 블록만 잔류, 다른 섹션 인라인 주석 패턴과 형식 불일치 | `override-registry.ts` 65~68행 | 주석을 `// Flow` 섹션 아래 한 줄 인라인으로 압축 이동 (기능·빌드 영향 없으므로 선택 사항) |
| 2 | Plan Coherence | main 트리의 `spec-code-cross-audit-2026-06-10.md` V-02 항목이 여전히 `[ ]` 상태 — PR 머지 전 정상 상태(pre-merge) | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | PR 머지 커밋에 V-02 라인 `[x]` 갱신 포함 또는 머지 직후 별도 커밋 처리 |
| 3 | Plan Coherence | `node-output-redesign/text-classifier.md`·`information-extractor.md` 의 미해소 `(impl)` 항목이 backend handler 영역으로 본 diff 와 직교 — frontend auto-form 전환 후 schema 변경 시 UI 반영 여부 명시 부재 | `plan/in-progress/node-output-redesign/text-classifier.md` (202~205행), `information-extractor.md` (224~231행) | Phase E 착수 시 각 plan 헤더에 "auto-form 전환 완료(V-02), bespoke 컴포넌트 전제 없음" INFO 한 줄 추가 |
| 4 | Rationale Continuity | 이행 근거(V-02 audit, 지원 위젯 목록)가 코드 주석에만 기록되고 spec Rationale 에는 부재 | `override-registry.ts` 인라인 주석 | WARNING #1 해소 시 함께 처리. 별도 작업 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | CRITICAL | spec §2.6.3 트랙 배정 목록이 구현 사실과 정면 모순 (override 잔존 목록에 auto-form 이행 완료 노드 포함) |
| Rationale Continuity | LOW | R-2 가 §2.6.3 을 SoT 로 명문화했으나 구현 동시 갱신 미이행 — WARNING 수준 연속성 간극 |
| Convention Compliance | NONE | 정식 규약 위반 없음. 주석 형식 미세 불일치 1건(INFO) |
| Plan Coherence | LOW | V-02 plan 정합 확인. main 트리 plan 갱신 머지 시 처리 필요(INFO). node-output-redesign 과 직교 확인 |
| Naming Collision | NONE | 순수 삭제 diff — 신규 식별자 없음, 충돌 위험 없음 |

## 권장 조치사항
1. **(BLOCK 해소 필수)** `spec/3-workflow-editor/1-node-common.md` §2.6.3 갱신: `override 잔존` 목록에서 `text_classifier`·`information_extractor` 제거, `auto-form 이행 완료` 목록에 추가.
2. **(BLOCK 해소 동시)** 동일 spec 파일 Rationale 에 R-3 항 추가: "text_classifier·information_extractor — zod 스키마가 field-array·llm-config-selector 등 auto-form 위젯으로 충분히 표현됨을 cross-audit V-02 에서 확인, bespoke 폼 폐기 후 auto-form 이행 (2026-06-11)".
3. **(INFO, 머지 시)** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-02 항목 `[x]` 갱신이 PR 범위에 포함되어 있는지 확인.
4. **(INFO, Phase E 착수 시)** `node-output-redesign/text-classifier.md`·`information-extractor.md` 헤더에 auto-form 전환 완료(V-02) 기록.
5. **(선택)** `override-registry.ts` AI 절 주석을 인라인 한 줄 형식으로 정리 (기능 무영향).