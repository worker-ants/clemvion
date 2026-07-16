# Cross-Spec 일관성 검토 — `spec/conventions/` (audit-actions.md, cafe24-api-catalog/**)

## 검토 범위 메모

`git diff origin/main...HEAD -- spec/conventions/` 실측 결과, 이번 브랜치에서 `spec/conventions/` 내 실제 변경분은 `cross-node-warning-rules.md`·`execution-context.md`·`node-cancellation.md`(plan 경로 `in-progress→complete` 갱신)와 `spec-impl-evidence.md`(가드 서술 정정) 4개 파일·각 1줄뿐이다. payload 의 "target 문서"로 첨부된 `audit-actions.md`, `cafe24-api-catalog/_overview.md`, `application.md`(+ field-level 8개), `category.md`(+ `category/autodisplay.md`)는 이번 diff 의 신규·변경분이 아니라 기존에 이미 병합된 안정 콘텐츠다(각각 커밋 `d4b774f10`, `c234dcc6b` 등에서 도입). 따라서 아래는 이 기존 콘텐츠 전체를 대상으로 한 cross-spec 정합성 재확인 결과다.

## 발견사항

- **[INFO]** Cafe24 `webhooks` 리소스 ↔ Integration `service_type='webhook'` 명명 근접
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md` 표의 `webhooks_logs_list`/`webhooks_update` 및 `application/webhooks-logs.md`·`application/webhooks-setting.md`
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration `service_type` enum 의 `webhook` 값 (범용 outbound webhook 커넥터)
  - 상세: `application.md`는 이미 `app_type`(Integration의 Cafe24 Public/Private 앱 필드)과의 naming collision을 명시적으로 경고하는 주석을 달아 두었다("우리 서비스의 Integration `app_type` … 무관 — naming collision 회피 참고"). 같은 문서에 있는 Cafe24 자체 "Webhook 설정/로그" 리소스(`webhooks_update`, `webhooks_logs_list`)는 우리 시스템의 `service_type='webhook'`(범용 webhook 커넥터)과 개념이 다름에도 동일한 disambiguation 주석이 없다. 토큰이 완전히 동일하진 않아(`webhooks` 복수형 리소스명 vs `webhook` 단수형 service_type 값) 실제 충돌 가능성은 낮으나, `app_type` 사례와 같은 패턴의 잠재 혼동이다.
  - 제안: 필수는 아님. `application.md` 상단에 이미 있는 disambiguation 주석에 "Webhook(logs/setting) 리소스도 Integration `service_type='webhook'`(범용 아웃바운드 웹훅)과 무관 — Cafe24 자체 웹훅 발송 로그/설정" 한 줄만 추가하면 향후 혼동을 완전히 차단할 수 있다.

## 요약

`audit-actions.md`의 verb 시제 taxonomy·도메인 레지스트리는 `spec/5-system/1-auth.md §4.1`의 액션 카탈로그·`spec/1-data-model.md §2.18 AuditLog`·실제 구현 `audit-action.const.ts`(`AUDIT_ACTIONS`) 세 지점과 정확히 일치했고(구현/미구현 도메인 분류, `workspace.deleted` 구조적 제외 근거, `model_config.set_default` 명명 등 모두 대조 확인), `spec/5-system/1-auth.md §3.1~3.2` RBAC 매트릭스의 "Audit Log: Owner/Admin 만 R" 도 §4.2 "관리자(Admin+)만 조회"와 부합했다. `cafe24-api-catalog/_overview.md`·`application.md`·`category.md`의 리소스 명명(`Cafe24Resource` enum), `restricted`/`status` 컬럼 계약, field-level 레이어의 spec-impl-evidence 프론트매터 예외(`*-api-catalog/` 트리)도 실제 backend `types.ts`, `cafe24-api-metadata.md`, `spec-impl-evidence.md` 가드 테이블과 각각 대조해 불일치가 없음을 확인했다. `Integration.credentials.app_type` 과 Cafe24 자체 `apps_update` 리소스 간 naming collision은 이미 문서가 스스로 경고 주석으로 해소해 두었다(정합성 우수 사례). 유일하게 발견한 항목은 동일 패턴의 잠재 혼동(webhooks 리소스 vs `service_type='webhook'`)에 대한 disambiguation 누락으로, 토큰이 정확히 일치하지 않아 실제 충돌보다는 명명 인접에 가까운 INFO 수준이다. 나머지 대부분(약 2000줄)은 Cafe24 공식 문서에서 결정적으로 추출한 field-level 참조 카탈로그(응답 속성·요청 파라미터·JSON 샘플)로, 우리 내부 엔티티·API 계약·상태 머신·RBAC 을 정의하지 않는 순수 외부 API 레퍼런스라 cross-spec 충돌 표면 자체가 낮다.

## 위험도

LOW
