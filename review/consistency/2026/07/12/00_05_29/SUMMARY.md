# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 중 응답 확보된 4개(cross_spec / convention_compliance / plan_coherence / naming_collision) 어디에도 Critical 없음. 단, `rationale_continuity` 는 manifest 상 `status=success` 이나 output 파일이 디스크에 존재하지 않아(disk-write gap) 실제 검토 결과를 확인할 수 없음 — 아래 참고.

## 전체 위험도
**LOW (커버리지 불완전)** — 확보된 4개 checker 는 실질 충돌 없이 WARNING 1건(동일 이슈, 2개 checker 독립 수렴)과 INFO 다수뿐이나, `rationale_continuity` 결과 부재로 완전한 확신은 아님. 특히 그 WARNING 이 Rationale 번호 충돌 건이라 rationale_continuity 재확인이 특히 유효함.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance + naming_collision (동일 이슈, 독립 수렴) | Edit C 가 `spec/7-channel-web-chat/2-sdk.md` Rationale 절에 신설하는 `### R6. locale 은 reserved` 로컬 heading 이, 같은 파일 108행의 기존 파일-비한정 bare `§R6` 참조와 표면 충돌. 108행 bare 참조는 실제로 `1-widget-app.md` 의 `### R6.`(eager-start)를 가리키는데, 신규 로컬 R6 생성 후엔 "같은 문서 안 R6" 로 오귀속되기 쉬움(§4 boot-config/locale 절과 인접해 특히 오독 소지 큼) | Edit C — `spec/7-channel-web-chat/2-sdk.md` §Rationale 신규 `### R6.` | `2-sdk.md:108` bare `§R6`(실제 대상 `1-widget-app.md#R6` eager-start). 대조군: 같은 파일 101-102행은 이미 `[3-auth-session §R6](./3-auth-session.md)` 형태로 파일-한정 링크를 씀 | 같은 PR 에서 108행의 bare `§R6` 를 `[1-widget-app §R6](./1-widget-app.md)` 로 파일-한정 링크화(101-102행 패턴과 동일하게). 신규 heading 번호(R6)는 파일-로컬 순번(R2→R3→R4→R5→R6) 유지가 규약과 더 정합적이므로 번호 자체를 바꾸기보다 기존 bare 참조 쪽을 명확화하는 편이 권장됨 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신설 "적용 범위(Scope)" 절이 `codebase/packages/**` 를 포함/제외 어느 쪽으로도 명시하지 않음 (현재 packages 안에 TSX/UI 렌더링 표면이 없어 실제 충돌은 아님) | Edit A, `spec/conventions/i18n-userguide.md` 신설 `## 적용 범위 (Scope)` | "적용 대상"/"제외 대상" 나열에 `codebase/packages/**`(예: "현재 UI 렌더링 표면 없음 — TSX 도입 시 재검토")를 1줄 추가해 4영역(frontend/backend/packages/channel-web-chat) 완전성 확보. 필수는 아님, 다음 개정에 묶어도 무방 |
| 2 | cross_spec | `5-admin-console.md §6.1:214` 의 remount-on-locale-change 서술이 Edit C/D 의 "locale=reserved/inert" 프레이밍과 표면적으로 결이 다르게 읽힐 여지(실제 모순은 아님, draft 도 이미 검토해 §6.1 무변경 선택) | Edit C/D (`2-sdk.md §4`, `5-admin-console.md §4`) vs `5-admin-console.md:206-214` §6.1 | 선택 사항: §6.1:214 문장 끝에 "(reserved 필드 — [2-sdk §4](./2-sdk.md#4-boot-config-스키마))" 각주로 상호 참조. 반영 안 해도 BLOCK 사유 아님 |
| 3 | convention_compliance | Edit A "적용 대상" 문구에서 `codebase/backend/**(영문 SoT / backend-labels)` 표기가 `backend-labels.ts` 의 실제 소재(frontend)를 오독시킬 소지 | Edit A | `codebase/backend/**(영문 SoT 발행)` 로 축약하거나 `→ codebase/frontend/.../backend-labels.ts 가 매핑` 을 별도 명시. 차단 사유 아님 |
| 4 | convention_compliance | 신설 "적용 범위(Scope)" 절이 i18n-userguide.md 말미 "자동 가드 요약" 표에 행으로 반영되지 않음(표는 Principle 1~7 전용이라 의무는 아님) | Edit A | 선택 사항: 표에 "적용 범위" 한 줄(가드: 없음/문서화) 추가 시 가독성 향상. 필수 아님 |
| 5 | convention_compliance | Edit B 의 i18n-userguide 링크가 신설 절의 정확한 anchor 를 지정하지 않음(문서 전체 링크라 동작은 함) | Edit B | 선택 사항: `#적용-범위-scope` anchor 지정 |
| 6 | plan_coherence | `plan/in-progress/**` 전수 검색 결과 위젯 EN 다국어화·hardcoded-korean-ratchet/doc-sync-matrix 스캔 확장을 계획 중인 plan 없음 — target 의 "EN 착수 시 재검토" 유보 조건과 충돌할 선행 계획 없음 | Edit A | 조치 불요. 향후 위젯 EN 지원 plan 생성 시 본 스코프 절의 "재검토" 트리거를 명시 인용하도록 확인 |
| 7 | plan_coherence | `spec-draft-pr874-deferred-docs.md`(동일 spec 영역 인접 편집, `1-widget-app.md`/`conversation-thread.md §9`)와 섹션이 분리돼 있어(target 은 `_product-overview.md §2`·`2-sdk.md §4`·`5-admin-console.md §4`) 병합/정합 충돌 없음 | 전체 (Edit B~D) | 조치 불요 (참고용 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | INFO 2건(packages scope 완전성, remount vs inert 프레이밍 표면 긴장) — 실질 충돌 없음. 신규 데이터 모델/API/요구사항ID/상태전이/RBAC 미도입 확인 |
| rationale_continuity | **재시도 필요** | manifest 상 `status=success` 이나 `rationale_continuity.md` 가 디스크에 존재하지 않음(disk-write gap, 알려진 실패 유형). 검토 결과 전무 — 특히 아래 WARNING 이 Rationale 번호 충돌 건이라 재확인 가치가 큼 |
| convention_compliance | LOW | WARNING 1건(2-sdk.md 신규 `### R6` ↔ 기존 bare `§R6` 오귀속 위험) + INFO 3건(표현 정밀도 수준) |
| plan_coherence | NONE | 우회/무효화 대상 plan 없음. pr874-deferred-docs 와 섹션 분리 확인 |
| naming_collision | LOW | WARNING 1건 — convention_compliance 와 동일 이슈를 다른 각도(신규 식별자 발급 관점)로 독립 수렴. target 이 실제 신설하는 식별자는 이 `### R6` 하나뿐임을 확인 |

## 권장 조치사항

1. **rationale_continuity 재시도** (선행 권장) — output 파일이 디스크에 없어(status=success 이나 disk-write gap) 실제 검토 결과가 유실됐을 가능성. 특히 아래 WARNING 이 Rationale 번호 충돌 건이므로 이 checker 의 재확인이 다른 어떤 항목보다 유효함. 재시도 실패 시에도 나머지 4개 checker 는 Critical 없음이 이미 확정적임.
2. **WARNING 해소** — Edit C 적용 시 같은 PR 로 `2-sdk.md:108` 의 bare `§R6` 를 `[1-widget-app §R6](./1-widget-app.md)` 로 파일-한정 링크화(101-102행 기존 패턴과 동일). 신규 heading 번호는 그대로 `### R6` 유지(파일-로컬 순번 R2→R6 정합).
3. INFO 항목들(packages scope 명시, backend-labels 소재 표기, admin-console §6.1 각주)은 선택 사항 — 이번 draft 의 "코드 변경 없음" 원칙과 상충하지 않는 문구 보강이므로 같은 PR 또는 다음 개정 중 편한 시점에 반영.
