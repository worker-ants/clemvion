# 부작용(Side Effect) 리뷰 결과

리뷰 대상: spec/5-system/1-auth.md, spec/5-system/12-webhook.md, spec/conventions/secret-store.md, spec/data-flow/10-triggers.md

---

## 발견사항

### [INFO] spec/5-system/1-auth.md — Auth Config Reveal 엔드포인트가 §5 API 목록에 누락

- 위치: `§3.2 리소스별 권한 매트릭스` 신규 행 vs `§5 API 엔드포인트` 목록
- 상세: `Auth Config Reveal (평문 노출)` 권한 행이 추가되었고 `POST /api/auth-configs/:id/reveal` 엔드포인트가 Rationale에 언급되었으나, `§5 API 엔드포인트` 테이블에 해당 항목이 없다. 기존 소비자가 §5를 API 계약 목록으로 참조한다면 목록 불일치 상태다.
- 제안: `§5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 항목을 추가하거나, 해당 엔드포인트가 별도 spec 파일에 정의되어 있다면 교차 참조 링크를 명시할 것.

---

### [INFO] spec/5-system/1-auth.md — 감사 로그 액션 enum 구체화 (`auth_config.reveal` 신규값)

- 위치: `§4.1 기록 대상 액션` 표, 설정 카테고리 행
- 상세: `auth_config.*` 와일드카드가 `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal` 로 구체화되었다. 현재 파일이 `status: spec-only / code: []` 이므로 즉각적 코드 부작용은 없다. 구현 단계에서 AuditLog 이벤트 타입 enum에 `auth_config.reveal` 추가를 누락하면 런타임 오류가 발생할 수 있다.
- 제안: 구현 plan에 `AuditLogAction` enum(또는 상수 목록)에 `auth_config.reveal` 추가 항목을 명시할 것.

---

### [WARNING] spec/5-system/12-webhook.md — inline auth 폐지 시 배포 순서 미명시 (인증 우회 위험)

- 위치: `§Rationale inline auth path 폐지` 섹션
- 상세: `auth_config_id IS NULL` 인 기존 트리거는 코드 변경 후 "인증 없음(none)"으로 동작한다. 과거 `trigger.config.authType`이 설정된 트리거도 `auth_config_id IS NULL`이면 동일하게 none으로 처리된다. `V065__trigger_config_strip_inline_auth.sql` migration과 코드 배포를 같은 PR에서 처리한다고 명시되어 있으나, 실제 롤아웃에서 코드가 먼저 배포되고 migration이 나중에 실행되는 경우 — inline 인증이 설정된 기존 트리거의 인증이 우회된다. Rationale의 "같은 PR"은 코드 저장소 기준이며 배포 순서를 보장하지 않는다.
- 제안: plan 또는 migration README에 "V065 migration은 코드 배포보다 반드시 먼저 실행되어야 한다"는 배포 순서 제약을 명시할 것.

---

### [INFO] spec/5-system/12-webhook.md — `last_used_at` fire-and-forget UPDATE 실패 시 로그 정책 미명시

- 위치: `§7 처리 흐름 step 6f`, `§8 보안 고려사항`, `WH-SC-08`
- 상세: 인증 성공 시 `auth_config.last_used_at = NOW()` 를 트랜잭션 외에서 fire-and-forget으로 수행한다. 실패 시 `202` 응답은 그대로 반환되는 것이 명시된 의도이나, 실패 시 warn 로그를 남기는지 여부가 spec에 없다. 운영 환경에서 DB 연결 문제로 이 UPDATE가 지속 실패해도 가시성이 없다.
- 제안: spec에 "fire-and-forget UPDATE 실패 시 서버 warn 로그 기록" 여부를 명시할 것.

---

### [INFO] spec/conventions/secret-store.md — `auth-configs` scope 예시 제거

- 위치: `§1 URI Scheme` 표, `scope` 행
- 상세: 기존 예시에 포함되어 있던 `auth-configs` scope가 "현재 미사용"으로 변경되었다. `code: []` 상태이므로 구현 코드에 즉각적 부작용은 없다. 다른 문서나 migration에서 `secret://auth-configs/...` URI를 참조하는 경우 misalignment가 발생할 수 있다.
- 제안: 코드베이스에서 `secret://auth-configs` 패턴 참조가 없는지 확인 권장.

---

### [INFO] spec/data-flow/10-triggers.md — 응답 코드 `200` → `202` 정정

- 위치: `§1.2 Webhook 진입` 시퀀스 다이어그램 마지막 라인
- 상세: 기존 다이어그램이 `200 { executionId }` 로 표현하던 것을 `202 { executionId } (비동기 실행)` 으로 수정했다. Webhook spec `WH-RS-01`과의 정합성 수정이다. data-flow 파일은 `code: []` frontmatter가 없으므로 구현 코드가 실제로 어느 코드를 반환하는지 확인이 필요하다.
- 제안: `codebase/backend/src/modules/hooks/hooks.controller.ts` 의 응답 코드가 `202`인지 확인할 것.

---

### [INFO] spec/5-system/12-webhook.md — `auth_config_id IS NULL` 트리거의 공개 노출 경로

- 위치: `§4.1 None (공개)`, `WH-SC-01`
- 상세: `auth_config_id IS NULL` 트리거는 어떤 자격증명 없이도 `202`를 반환하므로, 공격자는 `202` vs `401` 응답 차이로 특정 endpointPath의 인증 여부를 추론할 수 있다. 이것은 spec이 허용하는 설계(`WH-SC-01`: "endpointPath UUID가 사실상 비밀 키")이나, endpointPath가 노출되면 인증 없는 트리거는 완전히 공개된다. 의도된 부작용이지만 운영자에게 명시적 경고가 없다.
- 제안: 부작용 자체는 의도된 것이나, 관리 UI에서 `auth_config_id IS NULL` 트리거 생성 시 "공개 엔드포인트" 경고를 표시하는 정책을 spec에 추가하는 것을 권장.

---

## 요약

이번 변경은 모두 `spec-only` 문서(`code: []`)에 대한 spec 갱신으로, 현재 단계에서 직접적인 코드 부작용은 없다. 주요 변화는 (1) `auth_config_id` FK를 webhook 인증의 단일 진입점으로 격상하고 inline 인증 path 폐지, (2) Auth Config Reveal 권한 신설, (3) `secret-store.md` convention에서 AuthConfig 비대상 명시, (4) data-flow 다이어그램 정합성 수정이다. 부작용 관점에서 가장 주의할 점은 inline 인증 폐지 시 `V065` migration과 코드 배포의 순서다 — migration 전 코드가 먼저 배포되면 기존 inline 인증 트리거가 "인증 없음"으로 동작하는 인증 우회 위험이 존재한다. `§5 API 엔드포인트` 목록에 `POST /api/auth-configs/:id/reveal` 이 누락된 것은 spec 내 불일치이며, `last_used_at` fire-and-forget UPDATE의 실패 시 로그 정책은 spec에 명시되지 않았다.

## 위험도

**LOW**

모든 변경이 spec 문서 갱신에 국한되며, 가장 위험한 요소인 inline auth 폐지의 롤아웃 순서 위험은 Rationale에서 "같은 PR에서 처리"로 부분적으로 완화되어 있다. 구현 시 V065 migration 선행 적용을 plan에 명확히 반영하면 NONE 수준으로 낮아진다.
