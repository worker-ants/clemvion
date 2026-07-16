# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 성공 실행, Critical 위배 없음.

대상: D1(⑦ Cafe24 D-2 에러 격리 정책 명문화, `spec/2-navigation/4-integration.md §10.5`) + D2(⑧ merge-p2-async-fanin ADR 마감, `spec/4-nodes/1-logic/11-merge.md ## Rationale`). 두 변경 모두 이미 워크트리에 staged 되어 코드·타 spec·plan 과 실측 대조 검증됨.

## 전체 위험도
**MEDIUM** — Critical/구조적 위반은 없으나, plan_coherence 가 지적한 두 건의 "후속 갱신 누락"(인접 in-progress plan 의 stale 서술, ADR 잔여 결정의 추적 부재)과 5개 checker 중 3곳이 공통 지목한 Rationale 앵커 명명 taxonomy 이슈가 병합 전 정리를 권장할 수준으로 누적됨.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | D1 이 2026-06-02 defer 결정(`cafe24-backlog-residual.md` D-2)을 해제하며 논거(OTel 도입으로 전제 충족)를 spec 의 durable `## Rationale` 이 아니라 transient plan 파일에만 남김 | `spec/2-navigation/4-integration.md §10.5` (인라인 note만 존재) | `plan/in-progress/cafe24-backlog-residual.md` D-2 (추후 archive 이동 시 배경 유실 위험) | `4-integration.md ## Rationale` 에 "cafe24-token-refresh 에러 격리 정책 — D-2 defer 해제 (2026-07-17)" 항목 신설: (a) 2026-06-02 defer 사유 (b) OTel(#594) 도입으로 전제 충족 (c) 코드가 이미 re-throw 구현 중이었다는 사실 명시. D2 의 `R-adr-async-fanin` 이 이미 이 패턴을 올바르게 따르고 있어 참고 가능 |
| 2 | plan_coherence | 인접 in-progress plan 이 D2 의 P2→P3 격하를 반영하지 않아 stale — "P2 활성화 임박" 오인 위험 | D2 — `11-merge.md §1/§6 note` (P2→P3 격하 완료) | `plan/in-progress/node-output-redesign/merge.md` L88, L108 ("P1 → P2" / "P2 에서 MERGE_TIMEOUT 도입 가능성" 구 표기) | L88/L108 을 "P1 → P3(무기한 dormant, ADR `R-adr-async-fanin`)" 로 갱신. D2 커밋에 동반 포함 또는 별도 후속 커밋 |
| 3 | plan_coherence | ADR(`R-adr-async-fanin`)이 새로 남긴 "영구 dormant 필드의 UX 처리(필드 제거 vs severity 완화 vs 유지)" 결정을 추적할 살아있는 in-progress 문서가 없음 | D2 — `11-merge.md §Rationale R-adr-async-fanin` 말미 "남은 UX 이슈" | `plan/complete/merge-p2-async-fanin.md`(이미 complete 이동, 각주로만 존재) / `node-output-redesign/merge.md`(인접하지만 별개 항목) | `node-output-redesign/merge.md` 에 이 UX 결정을 `(product-decision)` 체크박스로 명시 추가하거나 별도 짧은 in-progress 항목 신설 |
| 4 | naming_collision (cross_spec·rationale_continuity·convention_compliance INFO 로 동일 관찰) | 신규 Rationale 앵커 `R-adr-async-fanin` 이 "무기한 dormant + 조건부 재개 트리거" 구조상 기존 `R-wontdo-*` 선례(`R-wontdo-rawws-rest`, `R-wontdo-cached-capabilities`)와 사실상 동형인데 제3의 접두(`R-adr-`)를 신설 — ID 직접 충돌은 없으나 `grep R-wontdo-` 기반 tooling 이 이 항목을 누락하는 taxonomy 파편화 위험 (naming_collision 은 WARNING, 나머지 4개 checker 는 "정합/위반 아님" INFO 로 판정 — 가장 강한 등급으로 통합) | `spec/4-nodes/1-logic/11-merge.md ## Rationale ### R-adr-async-fanin` (L226) | `spec/5-system/6-websocket-protocol.md #R-wontdo-rawws-rest`, `spec/5-system/11-mcp-client.md #R-wontdo-cached-capabilities` | (a) `R-adr-async-fanin` → `R-wontdo-async-fanin` 개명해 기존 선례 합류, 또는 (b) "ADR"을 별도 카테고리로 유지할 실익이 있다면 그 구분 기준을 `spec/conventions/`(예: 신규 `rationale-anchors.md`)에 명문화. draft 자신의 검토 요청 §3 이 이미 이 판단을 요청했으므로 이번 PR 안에서 결정 권장(비차단) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `attempts:1`(cafe24-token-refresh worker, D1) vs `attempts:3`(§11.1, 4개 독립 스캐너 job) 는 실제 충돌 아님 — 서로 다른 큐. 다만 같은 worker 의 동작 상세가 `navigation/4-integration.md`(신규)와 `data-flow/5-integration.md`(기존)에 부분 중복 기술되어 향후 편측 갱신 drift 위험 | `spec/2-navigation/4-integration.md §10.5` vs `spec/data-flow/5-integration.md §2.2/§1.4` | 별도 fix 불요. 후속 편집 시 `data-flow/5-integration.md §2.2` 에 re-throw invariant 상호 참조 한 줄 추가 고려(비차단) |
| 2 | convention_compliance | `spec/2-navigation/4-integration.md` frontmatter `code:` 글로브가 새로 상세 인용된 `cafe24-token-refresh.processor.ts`/`.spec.ts` 경로를 커버하지 않음(pre-existing gap, 이번 draft 가 인용 밀도만 높임). `spec-code-paths.test.ts` 가드는 ≥1 매치만 요구해 build 비차단 | `spec/2-navigation/4-integration.md:943` frontmatter | 조치 불요(비차단). 근거 추적성 강화 원하면 `code:` 에 `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` 명시 추가(선택, 이번 범위 밖) |
| 3 | plan_coherence | `plan/complete/merge-p2-async-fanin.md` L12 가 참조하는 `../complete/logic-node-followups.md` 는 2026-05-30 이미 삭제된 dead link(draft 와 무관한 사전 이력) | `plan/complete/merge-p2-async-fanin.md:12` | 이 파일을 이번에 편집하는 김에 "(2026-05-30 삭제됨 — 요약은 본 문서 §결정 히스토리 참조)" 로 각주 처리 또는 링크 제거(비차단) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 실제 모순 없음. attempts 값 병존은 서로 다른 큐라 정합, dedup 서술 위치만 INFO 관찰 |
| Rationale Continuity | LOW | 결정 번복 없음(D1 재개·D2 격하 모두 사전 설계된 분기 실행). D1 의 defer 해제 근거가 spec Rationale 부재(WARNING) |
| Convention Compliance | NONE | 명명·출력포맷·문서구조·API문서·금지항목 5개 관점 모두 위반 없음. R-adr-* 는 명시적으로 "정합" 판정 |
| Plan Coherence | MEDIUM | 인접 in-progress plan(`node-output-redesign/merge.md`) stale 반영 누락 2건(WARNING) — 결정 번복은 아니나 후속 갱신 누락 |
| Naming Collision | LOW | ID 재사용 충돌 없음. `R-adr-*` taxonomy 파편화만 WARNING 수준으로 지적(유일하게 강한 등급) |

## 권장 조치사항

1. **(WARNING #2, 최우선)** `plan/in-progress/node-output-redesign/merge.md` L88, L108 의 "P1 → P2" 서술을 D2 의 P2→P3 격하 결과("P1 → P3, 무기한 dormant, ADR `R-adr-async-fanin`")로 갱신 — 같은 PR 또는 즉시 후속 커밋.
2. **(WARNING #1)** `spec/2-navigation/4-integration.md ## Rationale` 에 D-2 defer 해제 근거(defer 사유·OTel 전제 충족·코드 기 구현 사실) 항목 신설.
3. **(WARNING #3)** `node-output-redesign/merge.md` 또는 신규 in-progress 항목에 ADR 잔여 UX 결정("영구 dormant 필드 제거 vs severity 완화 vs 유지")을 추적 항목으로 명시 추가.
4. **(WARNING #4)** `R-adr-async-fanin` 명명을 이번 PR 안에서 확정: `R-wontdo-async-fanin` 개명 또는 `spec/conventions/` 에 ADR vs won't-do 구분 기준 명문화.
5. (INFO, 선택) `data-flow/5-integration.md §2.2` 에 re-throw invariant 상호 참조 추가, `4-integration.md` frontmatter `code:` 에 cafe24-token-refresh 경로 명시, `merge-p2-async-fanin.md` L12 dead link 각주 처리.