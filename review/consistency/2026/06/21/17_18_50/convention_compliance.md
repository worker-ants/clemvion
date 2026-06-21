# 정식 규약 준수 검토 — convention_compliance

target: `plan/in-progress/spec-draft-email-change.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-21

---

## 발견사항

### [WARNING] 마이그레이션 버전 번호 미확정 (`V0xx`) — 규약 위반 예비 상태
- target 위치: §1 데이터 모델, "마이그레이션: 다음 순번 `V0xx`"
- 위반 규약: `spec/conventions/migrations.md §1·§2` — 번호는 `V<단조증가_정수>__<snake_case_descriptor>.sql` 형식 필수. `V0xx` 는 placeholder
- 상세: 현재 main 의 max V 번호는 V099 임이 확인된다. `V0xx` 는 실제 번호를 전달하지 않는 placeholder 표기다. spec draft 단계에서는 확정 번호 기재를 강제하지 않지만, 이 표기 그대로 spec 본문(`spec/1-data-model.md`)에 반영되면 구현자가 번호를 임의로 선택하게 돼 단조성·충돌 위험이 생긴다.
- 제안: draft 에서는 "현재 main max+1~+3 범위에서 구현 시 결정" 등으로 의도를 명시하거나, spec 본문 반영 시 실제 번호(예: `V100`)로 교체한다는 안내를 추가할 것. spec 에 반영되는 최종 문서에는 실제 `V<N>__add_email_change_fields.sql` 형식으로 기재 권고.

---

### [WARNING] 에러 코드 §4 — `EMAIL_CHANGE_TOKEN_INVALID` 의미 기반 명명 재검토
- target 위치: §4 에러 코드 표, `EMAIL_CHANGE_TOKEN_INVALID | 400 | 토큰 무효·만료`
- 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드 이름은 조건의 의미(무엇이 잘못되었는가)를 기술. 구현 세부·전이적 맥락을 이름에 박지 않는다
- 상세: `_INVALID` 가 "무효·만료" 두 조건을 모두 포함한다는 점을 고려하면, 만료(expired)와 무효(invalid form/unknown) 가 클라이언트 입장에서 동일 분기(동일 400 처리)라면 단일 코드는 적합하다. 그러나 기존 auth spec 에 `password_reset_token` 계열 에러 코드가 존재한다면 그 패턴과 정렬 여부가 미확인 상태다.
- 제안: 기존 `spec/5-system/1-auth.md` 에서 `password_reset_token`/`email_verify_token` 관련 에러 코드 패턴을 확인하고 일관성을 유지할 것. 만료를 별도 분기할 필요가 없으면 `EMAIL_CHANGE_TOKEN_INVALID` 단일 코드로 무효·만료를 모두 포함한다는 의도를 spec 본문에 명시.

---

### [INFO] 에러 코드 주석 — `historical lowercase 선례 따르지 않고 UPPER` 표현
- target 위치: §4 에러 코드 표 하단 주석
- 위반 규약: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`
- 상세: 주석의 내용은 정확하며 규약과 일치한다. 단 이 설명은 plan draft 용 메모로 적합하나 spec 본문 반영 시 제거해야 한다. spec 본문에는 확정된 UPPER_SNAKE_CASE 코드만 기재하면 충분하다.
- 제안: spec 본문(`1-auth.md §1.1.B`) 반영 시 이 주석 라인을 삭제. 에러 코드는 확정 UPPER_SNAKE_CASE 형태로만 기재.

---

### [INFO] 감사 액션 `user.email_changed` — audit-actions.md §3 레지스트리 갱신 누락
- target 위치: §2.4 §4.1 감사, `## 다음 단계`
- 위반 규약: `spec/conventions/audit-actions.md §3` — 도메인별 분류 레지스트리에 신규 감사 액션 등재 필요. `user` 행에 현재 `password_changed`, `2fa_enabled`, `2fa_disabled` 만 등재됨
- 상세: target 이 `user.email_changed` 를 추가하지만 `## 다음 단계 §3` 의 "side-effect 점검" 이 `conventions/audit-actions.md §3 user 행 갱신` 을 명시적으로 포함하지 않는다. 구현 시 `AUDIT_ACTIONS` 추가는 언급하나 conventions 레지스트리 갱신은 언급 없음.
- 제안: `## 다음 단계 §3` 에 `spec/conventions/audit-actions.md §3 user 행에 email_changed (상태: 미구현) 추가` 를 명시적으로 포함할 것.

---

### [INFO] 문서 구조 — plan draft 내 Rationale 섹션
- target 위치: `## Rationale (spec 반영 시 각 문서 ## Rationale 에 분배)` 섹션
- 위반 규약: CLAUDE.md — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- 상세: plan draft 에 Rationale 를 임시 집합시킨 후 spec 반영 시 분배한다는 의도가 명시되어 있다. 이는 CLAUDE.md 규약을 직접 위반하지 않는다 (plan 은 spec 이 아님). 단, 분배 의도가 `## 다음 단계` 에도 체크리스트 항목으로 명시되지 않아 반영 누락 위험이 있다.
- 제안: `## 다음 단계 §2` 에 "각 Rationale 절(R1~R6)을 대상 spec 3개 파일 각각의 `## Rationale` 에 분배" 를 체크리스트 항목으로 추가할 것.

---

## 요약

target plan draft 는 정식 규약을 대체로 준수하고 있다. 에러 코드는 모두 `UPPER_SNAKE_CASE` 를 사용하며 `error-codes.md §1` 의 의미 기반 명명 원칙에 부합한다. 감사 액션 `user.email_changed` 는 `audit-actions.md §2.1` 과거분사 패턴에 정합하며 `user` resource 기존 분류와 일관된다. 주요 경고는 두 가지: 마이그레이션 번호가 `V0xx` placeholder 로 남아 있어 spec 본문 반영 시 단조성 위반 위험이 있고 (`migrations.md §1·§2`), 에러 코드 `EMAIL_CHANGE_TOKEN_INVALID` 가 기존 auth 에러 코드 패턴과 정렬됐는지 확인이 필요하다 (`error-codes.md §1`). INFO 등급으로는 `audit-actions.md §3` 레지스트리 갱신이 다음 단계 목록에 명시되지 않아 누락 위험이 있다.

## 위험도

LOW
