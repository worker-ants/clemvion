# Rationale 연속성 검토 — 웹훅 경로 영구 예약 (spec-draft-webhook-endpoint-reservation)

## 발견사항

- **[INFO]** FK ON DELETE 표기 컨벤션과의 정합 확인 필요
  - target 위치: `## 설계` — `webhook_endpoint_reservation` 필드 정의 (`workspace_id` FK → Workspace **ON DELETE SET NULL**), `## 변경 A.` §2.8.1 신설 예고
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` «§2 FK 삭제 동작 · 빠진 컬럼 (2026-09-19)» — "적은 26행의 다수형인 짧은 형 `(CASCADE)` 를 따른다" 는 표기 규칙
  - 상세: target 의 draft 문면 자체는 표기 규칙을 위반하지 않지만(문장 서술이지 §2 표 행 자체가 아직 작성되지 않음), §2.8.1 신설 시 `(SET NULL)` 축약 표기를 §2 FK 행 표기 컨벤션에 맞춰 써야 한다는 점이 draft 본문에 명시돼 있지 않다. 결정 번복이나 원칙 위반은 아니고, planner 커밋 시 반영해야 할 표기 통일 항목이다.
  - 제안: `## 변경 A.` 항목에 "§2.8.1 표는 §2 FK 삭제 동작 표기 컨벤션(2026-09-19)의 축약형을 따른다" 한 줄을 덧붙이면 커밋 단계에서 재확인할 필요가 없어진다.

- **[INFO]** "묘비" 대안이 과거 Rationale 이 남긴 예고의 정식 이행임을 명시하면 연속성이 더 뚜렷해진다
  - target 위치: `## 왜`, `## 사용자 결정 (2026-09-19)`
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` «Webhook `endpoint_path` 전역 유일 (2026-09-18)» 의 **남는 틈** 단락 — "지운 경로를 묶어 두려면 묘비(tombstone)가 필요하고, 트래커에 따로 올렸다."
  - 상세: target 은 이 문단이 예고한 남는 틈을 정확히 닫고 있고, `## 변경 A.` 마지막 항목에서 "«남는 틈» 단락 끝에 «(2026-09-19 해소)»" 를 추가하도록 이미 계획돼 있다 — 이는 위반이 아니라 모범적인 연속성 사례다. 다만 새로 쓰는 §2.8.1 Rationale 절에서도 "이 결정이 2026-09-18 절이 예고한 tombstone 필요성에 대한 답" 이라는 역참조를 한 문장 넣으면, 향후 독자가 두 절을 역방향으로도 추적할 수 있다.
  - 제안: `## 변경 A.` 의 §2.8.1 Rationale 신설 지시에 "«Webhook endpoint_path 전역 유일» 이 예고한 tombstone 필요성에 대한 답" 이라는 역참조 문구를 명시.

## 확인된 정합성 (참고)

- **기각된 대안 재도입 없음** — target 이 채택한 "DB 트리거 + `INSERT … ON CONFLICT DO NOTHING`" 강제 방식은 `spec/1-data-model.md` «Webhook `endpoint_path` 전역 유일 (2026-09-18)» 이 이미 확립한 원칙("앱 레벨 검사는 동시 요청 경합을 막지 못한다" → 기각된 대안이 "비유일 보조 인덱스 + 앱 레벨 검사")을 그대로 계승한다. 새 원칙 도입이 아니라 기존에 합의된 DB-강제 원칙의 재적용이다.
- **FK 인덱스 원칙 준수** — `(workspace_id) WHERE workspace_id IS NOT NULL` 부분 인덱스는 `spec/1-data-model.md` «쓸 인덱스가 없는 FK 서른하나의 처분» 이 세운 "nullable FK 는 부분 인덱스, 삭제 연쇄가 훑지 않게" 원칙과 정확히 일치하며, target 자신이 그 절을 명시적으로 인용한다.
- **정보 비공개 원칙과 정합** — "예약됨을 따로 알리면 그 경로가 한때 쓰였다는 사실이 새어 나간다" 는 새 Rationale 은 `spec/5-system/12-webhook.md` WH-SC-01 (endpointPath 가 사실상 capability token) 및 데이터 모델의 "존재 누설 방지"(`MODEL_CONFIG_NOT_FOUND` cross-kind 동일 코드) 패턴과 같은 축의 판단이다. 새 원칙이 아니라 기존 비공개 원칙의 일관된 확장이다.
- **삭제 경로 무변경 설계와 기존 우려의 정합** — target 은 "예약은 삭제와 무관하게 이미 있다" 며 트리거·워크플로·워크스페이스 삭제 경로 넷을 건드리지 않는다고 명시한다. 새 테이블의 FK 는 `Workspace` 하나뿐이라(트리거를 가리키지 않음) `spec/1-data-model.md` 의 삭제 연쇄 비용 분석(캔버스 저장·워크플로 삭제·워크스페이스 삭제 경로)에 새 부담을 얹지 않는다 — 기존 성능 Rationale 들과 충돌하지 않는다.
- **결정 번복에 새 Rationale 동반** — "기간 묘비" 대안을 기각하면서 그 자리에서 이유(외부 서비스가 더 오래 옛 URL 로 보내면 여전히 위험, «아는» 사람이 넓다)를 함께 적었고, `## Rationale` 절에서 "삭제 시점 vs 사용 시점", "DB 트리거인 이유", "응답을 구분하지 않는 이유" 세 가지를 모두 새로 기록했다 — 무근거 번복이 아니다.
- **endpointPath mutable 원칙과 충돌 없음** — `spec/5-system/12-webhook.md` «endpointPath 가변성» 이 이미 "고엔트로피는 추측만 막고 복사는 막지 못한다" 며 남긴 틈을 target 이 정확히 이어받아 닫는다. mutable 성질 자체는 건드리지 않으므로 그 절의 핵심 결정(webhook mutable, schedule frozen)과 충돌하지 않는다.

## 요약

target 문서(`plan/in-progress/spec-draft-webhook-endpoint-reservation.md`)는 `spec/1-data-model.md` 의 «Webhook `endpoint_path` 전역 유일 (2026-09-18)» Rationale 이 명시적으로 예고하고 트래커로 넘긴 "남는 틈"(삭제된 경로의 tombstone 부재)을 정확히 겨냥해 닫는 후속 결정이며, DB-레벨 강제 원칙·nullable FK 부분 인덱스 원칙·정보 비공개(존재 누설 방지) 원칙 등 기존에 합의된 설계 원칙을 위반 없이 그대로 계승한다. 새로 기각한 대안("기간 묘비")과 새로 채택한 대안("사용 시점 예약")에는 각각 근거가 명시돼 있어 결정 번복도 무근거하지 않다. 발견된 두 항목은 모두 INFO 수준(§2 FK 표기 축약 컨벤션 반영 확인, 역참조 문구 보강 제안)이며 target 을 차단할 이유가 되지 않는다.

## 위험도

LOW
