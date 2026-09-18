# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 위험도 NONE, CRITICAL/WARNING 없음. (`plan_coherence` 는 STATUS 라인 없이 반환됐으나 인라인 전문이 완전하여 정상 반영함 — 재시도 불요.)

## 전체 위험도
**NONE** — 웹훅 `endpoint_path` 전역 유일 변경(V131·V132 + `2-trigger-list.md` 2줄)이 cross-spec·rationale·규약·plan·신규식별자 5개 관점 모두에서 충돌 없이 정합.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | governing plan(`spec-draft-webhook-endpoint-path-global-unique.md`)이 아직 `plan/in-progress/`에 있는데 V131/V132 헤더·e2e·`1-data-model.md` Rationale 이 `plan/complete/` 경로로 선인용 중 | (target 문서 밖) plan 라이프사이클 | 이 PR 마지막 커밋에서 `plan/complete/` 로 이동(governing plan 자체가 이미 예정해 둔 절차) — cross-spec 결함 아님, 관찰만 |
| 2 | rationale_continuity | `2-trigger-list.md` 의 UNIQUE 스코프 서술 변경분에 `spec/1-data-model.md` 신규 Rationale(「Webhook endpoint_path 전역 유일 (2026-09-18)」)로의 역참조 링크 없음 | `2-trigger-list.md` §2.3.1 `endpointPath` 행 또는 §3 하단 UNIQUE 註 | 두 자리 중 하나에 `([Spec 데이터 모델 Rationale](../1-data-model.md#webhook-endpoint_path-전역-유일-2026-09-18))` 형태 링크 추가 (선택, non-blocking) |
| 3 | convention_compliance | "여러 엔드포인트가 같은 에러 설명을 공유할 때 `UPPER_SNAKE_CASE` `_DESCRIPTION` 상수로 추출"하는 관행이 `swagger.md` §2 에 아직 규칙화되지 않음 (이번이 `OAUTH_BEGIN_RESULT_DESCRIPTION` 다음 두 번째 사례) | (target 문서 밖) `codebase/.../triggers.controller.ts` `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` | 이번 PR 책임 아님(`swagger.md` 의 rule-of-three 자기규율). 세 번째 사례 등장 시 project-planner 가 §2 소절 승격 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델(V131 tie-break·V132 인덱스)·API 계약(409 wire 불변)·사용자 가이드(WH-SC-01 추측/복사 구분)가 fix 라운드 이후에도 spec 서술과 문자 그대로 일치. plan 경로 선인용은 관찰만 |
| rationale_continuity | NONE | 워크스페이스 단위→전역 UNIQUE 번복이지만 `1-data-model.md`에 재현실험·기각안·이력보존(취소선)을 갖춘 새 Rationale 동반, 인접 도메인(R-CC-21, R-15) 원칙 위반 없음. target 자체엔 역참조 링크만 빠짐(INFO) |
| convention_compliance | NONE | error-codes.md rename 정책·migrations.md 명명규약·swagger DTO/Controller 패턴 모두 준수. 공유 설명 상수 패턴 미문서화는 INFO |
| plan_coherence | NONE | governing plan 처방과 target 서술 문자열 일치, 선행 트래커 항목 종결+후속 tombstone 항목 등재로 동기화, 다른 in-progress plan 과 충돌 없음 |
| naming_collision | NONE | 신규 식별자(V131/V132 파일명·`idx_trigger_endpoint_path`·신규 e2e·컨트롤러 로컬 상수) 전수 grep 대조 결과 기존 식별자와 충돌 없음. 대부분은 기존 계약의 스코프 확장이지 신규 도입이 아님 |

## 권장 조치사항
1. (non-blocking) `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 를 `plan/complete/` 로 이동 — 이미 governing plan 체크리스트에 예정된 마무리 커밋 항목.
2. (선택) `2-trigger-list.md` 에 `1-data-model.md` 신규 Rationale 로의 역참조 링크 1줄 추가.
3. (미래 대비) 세 번째 "공유 Swagger 설명 상수" 사례 등장 시 `swagger.md` §2 규칙 승격 검토 — 이번 PR 조치 불요.
