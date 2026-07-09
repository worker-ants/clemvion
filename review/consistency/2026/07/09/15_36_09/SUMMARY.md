# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 순수 spec-doc 재배치(14-execution-history.md Overview → _product-overview.md §3.15 이관)는 요구사항 ID·데이터모델·API·RBAC 어느 관점에서도 실질 모순이 없으나, 5개 checker 중 4개(cross_spec/rationale_continuity/convention_compliance/naming_collision)가 동일한 dangling 참조 1건을 독립적으로 지적 — `conventions/conversation-thread.md` 가 이관된 정의를 여전히 구 위치로 링크.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance | target 의 "1-ai-agent·conversation-thread·data-hydration-surfaces 의 EH-DETAIL-12 언급은 링크가 아닌 bare ID 라 불변" 서술이 `conversation-thread.md` 에는 사실과 다름 — 실제로는 살아있는 markdown 링크(파일 전체 참조, 앵커 없음). EH-DETAIL-12 정의가 이번 변경으로 `14-execution-history.md` 밖(`_product-overview.md §3.15`)으로 이동해, 이 링크가 가리키는 "위임 대상"이 더 이상 그 파일에 존재하지 않음 | `plan/in-progress/spec-draft-nav-spec-cleanup.md` §2 "cross-ref 무손상 확인" 문단 (파급 정리 (b)(c) 다음 괄호 문장) | `spec/conventions/conversation-thread.md` §9.3 표, 417번째 줄 — `[Spec Execution History §EH-DETAIL-12](../2-navigation/14-execution-history.md)` | `conversation-thread.md:417` 의 링크 타깃을 `../2-navigation/_product-overview.md#315-execution-history-실행-내역` 로 갱신(또는 `14-execution-history.md` 의 Rationale R-6 앵커로 지정). target 의 "파급 정리" 목록에 (d)로 추가하고 "bare ID 라 불변" 서술에서 conversation-thread 예외를 명시. `14-execution-history.md §Rationale R-6`(구 EH-DETAIL-06 dangling 위임 해소 취지)가 재현되지 않도록 같은 커밋에서 처리 권장 |

빌드 가드(`spec-link-integrity.test.ts`)는 파일 존재만 검사하므로 이 건으로 실패하지 않음(파일-레벨 링크, 404 아님) — 병합을 막을 정도는 아니라는 데 4개 checker 전원 동의.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | target 의 "cross-ref 무손상 확인" 검증 기준이 앵커 유무만 체크해 위 WARNING 건(서술형 위임 참조)을 사전에 못 잡음 | `plan/in-progress/spec-draft-nav-spec-cleanup.md` §2 | 향후 섹션 이관 시 앵커뿐 아니라 "위임"/"정책은 여기 정의됨" 류 서술형 참조도 grep 하는 절차를 plan-lifecycle 관행에 반영 검토(target 필수 수정 아님) |
| 2 | convention_compliance, plan_coherence | "14-execution-history.md 만 유일하게 `## Overview (제품 정의)` 헤딩 보유" 주장이 heading 매칭 기준으로는 부정확 — `spec/2-navigation/6-config.md` 도 동일 헤딩 보유(단 매트릭스가 아닌 범위-설명 문단이라 실질 문제는 없음) | target §"2. 14-execution-history.md" 첫 불릿 | "유일하게 자체 요구사항-ID 매트릭스 Overview 를 보유" 로 서술 좁히거나 현행 유지(spec 변경 정당성엔 영향 없음) — plan 정합성 충돌 아님(참조하는 in-progress plan 없음), 구조 일관성 관점의 별도 이슈로만 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | conversation-thread.md §9.3 의 EH-DETAIL-12 위임 링크가 이관 후 위치를 못 따라감(파일 존재는 유지, 앵커 없어 기술적 미파손) |
| Rationale Continuity | LOW | 동일 건 — R-6(과거 dangling 위임 해소 결정)의 취지가 이 1건에서 소규모로 재현됨. 핵심 변경 자체는 과거 결정 번복 아님 |
| Convention Compliance | LOW | 동일 건(spec-link-integrity invariant 의 취지 위반, 가드는 기술적으로 통과) + INFO 1건(Overview 헤딩 일반화 과잉) |
| Plan Coherence | NONE | 다른 in-progress plan 과의 경로/앵커/선행조건 충돌 없음. 6-config.md 관찰은 참조 plan 부재로 충돌 아님 |
| Naming Collision | NONE | 신규 식별자 전무(verbatim 이동 + 기존 코드 심볼 추적성 문서화뿐), 전 관점 충돌 없음. 동일 WARNING 건을 INFO 로만 언급(자기 관점 밖) |

## 권장 조치사항
1. `spec/conventions/conversation-thread.md` §9.3(417번째 줄) 의 EH-DETAIL-12 링크를 `../2-navigation/_product-overview.md#315-execution-history-실행-내역` 로 갱신 (WARNING 해소, BLOCK 사유 아니므로 병합 전 필수는 아니나 같은 세션 처리 권장).
2. `plan/in-progress/spec-draft-nav-spec-cleanup.md` §2 의 "bare ID 라 불변" 서술을 conversation-thread.md 예외를 반영해 정정.
3. (선택) target §"2. 14-execution-history.md" 의 Overview 헤딩 유일성 주장을 "요구사항-ID 매트릭스" 기준으로 좁혀 정확도 개선.