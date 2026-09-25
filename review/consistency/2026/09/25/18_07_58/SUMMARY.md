# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 성공·전문 확보. CRITICAL 없음.

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-workspace-path-guard-oracle-census.md`)은 `spec/data-flow/12-workspace.md` §Rationale 두 문장의 좁은 소급 정정(두 메서드→세 메서드)이며, CRITICAL 위배는 없으나 인접 불변식 미재검증(WARNING)과 자매 plan stale(WARNING)이 남아 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | "HTTP 밖 호출자는 없다" 불변식을 재검증 없이 대상 집합에 `transferOwnership`(3번째 메서드)을 편입 | 라인 45-48 (후 (2)) | `spec/data-flow/12-workspace.md` §Rationale "서비스 계층 검사는 남는다" 직전 문장 — "이 메서드들의 HTTP 밖 호출자는 없다(2026-09-25 실측: 내부 위임 `removeMember → leaveWorkspace` 하나)" — 이 문장은 여전히 2-메서드 기준 실측이며 target 편집 범위 밖에 남아 있다 | `transferOwnership`에 대해서도 내부 위임/호출자 전수 확인을 수행해 해당 문장을 "세 메서드" 기준으로 갱신하거나, 여전히 2-메서드 기준임을 각주로 명시해 범위 혼동을 없앤다 |
| 2 | plan_coherence | 자매 plan `workspace-path-guard-impl.md` 체크리스트가 이 draft 가 발생한 경위(4라운드 `/ai-review` 도중의 두 번째 planner 턴)를 반영하지 못한 채 1라운드 기준으로 stale | (target 자체 결함 아님 — target 이 생겨난 배경이 옆 plan 에 미기록) | `plan/in-progress/workspace-path-guard-impl.md` §체크리스트 — 2~4라운드(`568afefec`·`dc60b1af8`·`03b1d4242`·`1f616ef05`·`61ca58343`) 갱신 없음 | target 착지 직후 그 plan 체크리스트에 라운드 2~4 요약 + "requirement WARNING(4라운드) → 두 번째 planner 턴(이 draft) → spec 반영" 흐름을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §1.6 "역할 변경/소유권 이전" 표가 `CANNOT_TRANSFER_PERSONAL` 코드명을 언급하지 않음(다른 코드는 이미 등재돼 비대칭) | `spec/data-flow/12-workspace.md` §1.6 | 이 draft 스코프 밖. `error-handling.md:662` 가 이미 "별도 pass" 로 유예한 기존 채무이므로 그 pass 때 함께 보완 |
| 2 | rationale_continuity | "같은 절이 이미 쓰는 각주 관행을 따른다"는 서술과 실제 편집 방식(인라인 취소선)이 기존 두 선례(blockquote 별도 첨부)와 형식이 다름 | 라인 33-39, 45-48, 52-53 | 서술을 "정정 원칙(원문 보존)을 참고" 정도로 조정하거나 기존 blockquote 형식으로 통일 |
| 3 | plan_coherence | `workspace-path-guard-impl.md` 뮤턴트 표(M1~M17)에 4라운드 수정(`transferOwnership` 인가 선행 재정렬, 커밋 `1f616ef05`)에 대응하는 M18 항목 없음 | impl plan §뮤턴트 표 | M18 한 줄 추가 권장(선택, 필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 인용 원문·에러 코드(`OWNER_REQUIRED`·`CANNOT_TRANSFER_PERSONAL`)·RBAC 모두 정합. INFO 2건은 기존 채무/확인 항목일 뿐 |
| rationale_continuity | LOW | 결정 번복·기각 대안 재도입 없음. 다만 "HTTP 밖 호출자 없음" 불변식이 3번째 메서드까지 재검증되지 않은 채 확장(WARNING) |
| convention_compliance | NONE | `error-codes.md` 명명 규칙 등 위반 없음. 코드 신설이 아닌 사후 반영이라 레지스트리 갱신 의무 target 자체엔 없음 |
| plan_coherence | LOW | spec 정정 자체는 착지된 커밋·CHANGELOG·트래커와 line-level 정합. 자매 plan 체크리스트 stale(WARNING) |
| naming_collision | NONE | 신규 식별자 전무 — 언급된 식별자 전부 기존 spec/codebase 에 동일 의미로 존재, 파일 경로도 기존 명명 컨벤션과 충돌 없음 |

## 권장 조치사항
1. `transferOwnership` 의 HTTP 밖 호출자(내부 위임 등) 존재 여부를 전수 확인하고, `spec/data-flow/12-workspace.md` §Rationale "이 메서드들의 HTTP 밖 호출자는 없다" 문장을 "세 메서드" 기준으로 갱신(또는 여전히 유효함을 실측과 함께 명시).
2. target 착지 직후 `plan/in-progress/workspace-path-guard-impl.md` 체크리스트에 라운드 2~4 진행 경위와 이번 두 번째 planner 턴을 기록.
3. (선택) rationale 각주 형식 서술을 실제 편집 방식(인라인 취소선)에 맞게 조정하거나 기존 blockquote 관행으로 통일.
4. (선택) impl plan 뮤턴트 표에 M18(`transferOwnership` 인가 선행 제거) 추가.
