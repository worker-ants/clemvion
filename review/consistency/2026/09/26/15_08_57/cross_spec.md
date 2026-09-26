# Cross-Spec 일관성 검토 — `spec/conventions/swagger.md` (forbidden-helper-sentences)

## 범위 확인

`--impl-prep` 스코프의 실제 diff(`23929195d..c576153f6`)는 `spec/conventions/swagger.md` 단 한 파일만
건드린다 (§2-4 "광고한 성공 코드 ↔ 실제 성공 코드", §5-4 "403 설명의 거부 코드" 두 Rationale 절 신설 +
체크리스트 항목 갱신 + `code:` 프런트매터에 가드 파일 2쌍 등재). 아래는 이 변경이 `spec/data-flow/12-workspace.md`,
`spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md` 등 다른 영역과 부딪히는지를 검토한 결과다.

## 발견사항

- **[INFO]** `api-convention.md §6` 의 200 코드 정의가 "액션 POST" 를 아직 담지 않음 — 이미 트래킹됨
  - target 위치: `spec/conventions/swagger.md` §2-4 신설 Rationale — "그러나 §2-4 · api-convention §6
    표에는 «자원을 만들지 않는 POST» 칸이 없다 — 그 명문화는 별 결정이다(트래커 등재)."
  - 충돌 대상: `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표 — `200 | OK | 조회, 수정 성공`
    (POST 액션 자체를 200 사유로 적지 않음). 같은 문서 §3 은 `POST | 리소스 생성, 액션 실행` 이라 액션
    POST 의 존재는 인정하면서도 §6 은 그 경우의 200 사용을 명문화하지 않는다.
  - 상세: swagger.md 는 이제 OAuth begin(cafe24 Private/MakeShop pending-install 분기)과 초대 수락처럼
    **자원을 새로 만들지 않는 POST 액션이 200 을 광고**하는 것을 정상 사례로 서술하는데, `api-convention.md`
    §6 표만 읽으면 200 은 "조회/수정" 전용으로 보인다. target 문서 스스로 이 gap 을 자인하고 있어 **새로
    발견한 모순은 아니다**.
  - 확인: 동일 gap 이 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (라인 4881,
    "상태 코드 표에 «자원을 만들지 않는 POST 액션» 칸이 없다", 2026-09-26 등재, planner/낮음)에
    백로그로 걸려 있고, `plan/complete/post-status-openapi.md` · `plan/complete/spec-draft-swagger-http-status-guard.md`
    가 이번 diff 의 직접 선행 작업으로 이미 완료 처리되어 있다.
  - 제안: 별도 조치 불필요 — 기존 트래커 항목이 이 gap 을 정확히 겨냥하고 있으므로 그 항목 처리 시
    `api-convention.md §6` 을 함께 갱신하면 된다. 이 리뷰에서 새 액션 항목을 만들 필요 없음.

## 다른 관점 확인 (충돌 없음)

- **RBAC 모델**: swagger.md §5-4 신설 Rationale의 "`@Roles()` 라우트도 `NOT_A_MEMBER` 를 싣는다" ·
  "`viewer` 는 코드가 하나다(`ROLE_REQUIRED.viewer` = `NOT_A_MEMBER`)" 는 `spec/data-flow/12-workspace.md`
  §"가드 거부의 오류 코드 (2026-09-25)" 의 채택안 (나)와 정확히 일치한다 — 비멤버는 요구 역할과 무관하게
  `NOT_A_MEMBER`, `@Roles('viewer')` 는 멤버십과 동치.
  - `NOT_A_MEMBER` / `EDITOR_REQUIRED` / `ADMIN_REQUIRED` / `OWNER_REQUIRED` 네 코드는
    `spec/5-system/3-error-handling.md` §1.2 에 전부 등재돼 있고, `VIEWER_REQUIRED` 는 어디에도
    존재하지 않는다 — swagger.md 가 "viewer 는 코드가 없다" 고 서술한 바와 일치.
- **API 계약(상태 코드 짝)**: swagger.md §2-4 신설 Rationale의 "SSE/`@Res()` 핸들러도 면제하지 않는다",
  "리다이렉트만 광고한 라우트는 짝 대조 제외" 서술은 `spec/5-system/2-api-convention.md` §6 의 302/410
  관련 서술이나 `12-webhook.md`/`14-external-interaction-api.md` 의 SSE 계약과 모순되지 않는다(별도
  상태 코드 규칙을 재정의하지 않고 "광고 ↔ 실제 코드 일치" 축만 추가).
- **요구사항 ID**: `spec/conventions/swagger.md` 는 규약 문서라 요구사항 ID 를 발급하지 않는다 — ID 충돌
  경로 없음.
- **계층 책임**: `RolesGuard`(런타임 강제) / `forbidden-response-codes` 정적 가드(문서-실제 일치 검증) /
  서비스 계층 403(설명 자동 검증 제외) 세 층의 책임 분리는 `data-flow/12-workspace.md` 가 이미 확정한
  "멤버십 검증은 가드 1곳에서" 원칙과 같은 경계를 유지한다 — 새 층 신설이나 책임 이동 없음.

## 요약

이번 diff 는 `spec/conventions/swagger.md` 안에 두 개의 Rationale 절(§2-4, §5-4)과 체크리스트 항목만
추가했고, 두 절 모두 `spec/data-flow/12-workspace.md`("가드 거부의 오류 코드")·`spec/5-system/3-error-handling.md`
의 코드 레지스트리와 정확히 합치한다. 유일하게 걸리는 지점(`api-convention.md §6` 이 "자원을 만들지 않는
POST 액션의 200" 을 아직 표에 담지 못한 것)은 target 문서 스스로 인지하고 있고 별도 트래커
(`spec-draft-nullable-notation-followups.md`)에 이미 등재돼 있어 새로운 위험이 아니다. 데이터 모델·상태
전이·요구사항 ID 축에서는 해당 변경 사항이 없다.

## 위험도

LOW
