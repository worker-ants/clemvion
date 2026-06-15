# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

## 전체 위험도
**LOW** — 전 checker CRITICAL/WARNING 없음. INFO 수준 7건 (SoT 경계 모호함, Rationale 미기재, plan 추적 누락, 상수 이중관리)

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | ip_whitelist 저장 시점 검증 규칙이 webhook spec WH-SC-09 에 미반영 | `spec/5-system/12-webhook.md §3.2 WH-SC-09` | WH-SC-09 에 "형식 검증은 저장(create/update) 시 DTO 레이어에서 선행 수행 — 참조 spec/1-data-model.md §2.17" 주석 추가 (필수 아님) |
| 2 | Cross-Spec | data-flow/10-triggers.md 런타임 흐름에 저장 시점 검증 언급 없음 | `spec/data-flow/10-triggers.md` 84행 | 동기화 불필요 — 런타임 흐름 SoT 와 저장 시점 SoT 영역 분리로 자연스러운 구조 |
| 3 | Cross-Spec | §2.17.2 "AuthConfig 마스킹 정책 SoT" 에 6-config.md §A.4 신규 UI 30초 자동 hide 정책 미동기화 | `spec/1-data-model.md §2.17.2` | §2.17.2 를 "API 계약 레벨 마스킹" 으로 명시 범위를 제한하거나, UI 타이머 정책 1줄을 §2.17.2 에 추가해 SoT 경계를 명확히 함 |
| 4 | Rationale Continuity | ip_whitelist 저장 검증 명문화에 대한 Rationale 미기재 | `spec/1-data-model.md §2.17.3` | §2.17.3 에 "ip_whitelist 저장 시 형식 검증" 설계 근거 항목 추가 권장 |
| 5 | Rationale Continuity | create/regenerate 30초 자동 hide 확장에 대한 Rationale 미기재 | `spec/2-navigation/6-config.md ## Rationale` | Rationale 에 "왜 create/regenerate 1회 노출에도 동일 타이머를 적용하는가" 항목 추가 권장 |
| 6 | Plan Coherence | `auth-config-webhook-followups.md §3` "IP whitelist CIDR/IPv6 지원 여부 명시" 항목이 이번 spec 갱신으로 해소됐으나 plan 미체크 상태 | `plan/in-progress/auth-config-webhook-followups.md §3` | 해당 항목 체크 처리 또는 해소 근거 주석 추가 |
| 7 | Naming Collision | 테스트 로컬 상수 `AUTOCLEAR_MS` 와 구현 상수 `SECRET_AUTOCLEAR_MS` 가 같은 값을 하드코딩으로 이중 관리 | `authentication/__tests__/generated-key-autoclear.test.tsx:31` | `SECRET_AUTOCLEAR_MS` 를 named export 하거나 공용 상수 파일로 추출해 값 변경 시 자동 반영 되도록 개선 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §2.17.2 SoT 경계 모호함(UI 30초 hide 미동기화), webhook/data-flow spec 런타임 전용 기술 vs 저장 검증 누락(영역 분리로 모순 아님) |
| Rationale Continuity | LOW | ip_whitelist 저장 검증·create/regenerate 30초 hide 확장 모두 기각된 대안 재도입·합의 원칙 위반 없음. 근거 미기재만 남음 |
| Convention Compliance | NONE | 명명(kebab-case/PascalCase/camelCase), Swagger DTO 패턴, 에러 코드 체계, 문서 3섹션, frontmatter glob — 모두 규약 준수 |
| Plan Coherence | LOW | plan 범위 내 작업, 선행 plan 미해소·후속 무효화 없음. CIDR/IPv6 항목 추적 누락 1건 |
| Naming Collision | NONE | 5개 신규 식별자 모두 충돌 없음. AUTOCLEAR_MS 이중 관리는 현재 충돌 아닌 유지보수 리스크 |

## 권장 조치사항

1. **(SoT 경계 명확화 — INFO #3)** `spec/1-data-model.md §2.17.2` 가 "AuthConfig 마스킹 정책 SoT" 로 선언된 상태이므로, UI 30초 자동 hide 정책 범위를 명시하거나 §2.17.2 범위를 "API 계약 레벨 마스킹" 으로 제한하는 1줄 수정을 권장. 이번 PR 병합을 막는 요건은 아님.
2. **(Plan 체크 갱신 — INFO #6)** `plan/in-progress/auth-config-webhook-followups.md §3` 의 "IP whitelist CIDR/IPv6 지원 여부 명시" 항목을 체크 처리해 plan 추적 정확도 유지.
3. **(Rationale 보강 — INFO #4, #5)** ip_whitelist 저장 검증 및 create/regenerate 30초 hide 확장의 설계 근거를 각 Rationale 섹션에 1~2줄로 추가하면 추후 리뷰어의 이해 비용 감소.
4. **(상수 추출 — INFO #7)** `SECRET_AUTOCLEAR_MS` 를 named export 하거나 공용 상수 파일로 추출해 테스트와 구현 간 값 동기화를 컴파일 타임에 보장.