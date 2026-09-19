# Rationale 연속성 검토 — `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`

## 발견사항

- **[INFO]** 신규 전용 e2e `webhook-endpoint-reservation.e2e-spec.ts` 의 "전용 vs 기능" 경계를 이름만으로는 구분하기 어렵다
  - target 위치: target 문서 `### F. 구현 착수 뒤 추가` 첫 불릿 (frontmatter `code:` 추가)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → `` `code:` 에 전용 e2e 가드 셋 (2026-09-19) `` — "**넣지 않은 것**: 자기 기능의 인덱스·컬럼을 곁들여 확인하는 기능 e2e(`background-monitoring`·`notifications-dismiss`·`terminal-duration-sql`·`webhook-trigger`). 넣으면 이 문서가 무관한 기능 변경의 게이트가 된다."
  - 상세: target 은 새 e2e 를 "V131 가드 `trigger-endpoint-path-dedupe` 와 같은 방식"(임시 스키마에 V133 을 그대로 적용해 백필·DB 트리거만 확인)이라고 명시해, 이미 제외 목록에 있는 `webhook-trigger`(트리거 CRUD 기능 e2e) 와는 성격이 다름을 스스로 구분하고 있다 — 원칙 위반은 아니다. 다만 파일명 `webhook-endpoint-reservation.e2e-spec.ts` 자체는 "기능 이름" 처럼 읽혀서, 이후 이 파일에 예약 기능의 API 레벨 시나리오(예: PATCH 충돌 409 검증)가 곁들여 추가되면 그 순간 "전용" 에서 "기능" 으로 슬며시 넘어가 이 Rationale 의 배제 원칙을 침식한다.
  - 제안: 변경 F 반영 시 `spec/1-data-model.md` 의 `code:` 주석 또는 새 e2e 파일 상단에 "이 파일은 V133 마이그레이션 메커니즘(백필·DB 트리거)만 검증하며, 서비스 레벨 409 매핑 등 기능 검증은 별도(비-code:) e2e 가 맡는다" 는 한 줄 스코프 고지를 남겨, 다음 사람이 이 파일에 기능 케이스를 얹지 않도록 한다.

## 요약

target 초안은 자신이 뒤집는 과거 결정("삭제 시점 묘비")에 대해 그 자리에서 명시적 새 Rationale("삭제 시점 묘비가 아니라 사용 시점 예약인 이유")을 함께 써 두었고, DB 트리거 채택 이유를 V132 가 이미 기각한 "비유일 보조 인덱스 + 앱 레벨 검사" 원칙과 정확히 같은 근거(동시 요청 경합은 DB 만 막을 수 있다)로 연결해 재도입 없이 계승하고 있다. 응답을 구분하지 않는 이유(경로 재사용 여부 비노출), FK 인덱스 원칙(부분 인덱스로 `SET NULL` 캐스케이드의 전체 스캔 방지), 경로=비밀 키 취급(감사 로그에서 되살리지 않음), `endpointPath` 가변성 원칙(수신은 여전히 404) 등 기존 Rationale 에 박힌 원칙들과 모두 정합하며, `webhook_endpoint_reservation_owner` 가 실재 제약이 아니라는 점·자연키 PK 선택 이유처럼 이전 `--spec`/`--impl-prep` 라운드가 지적한 사항도 이미 본문에 반영돼 있다. 기각된 대안(기간 묘비, 비유일 인덱스+앱 검사)을 이유 없이 되살리는 지점은 발견되지 않았고, 유일하게 남는 것은 아직 spec 에 반영 전인 "변경 F"(전용 e2e 추가·UI 고지 미도입 근거)의 스코프를 명확히 해 두라는 절차적 제안 수준이다.

## 위험도
LOW
