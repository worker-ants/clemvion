# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `INTEGRATION_STATUSES` 에 `'attention'` 추가 — 가상 필터값의 API 노출 방식 적절
  - 위치: `backend/src/modules/integrations/dto/integration.dto.ts` +44~50
  - 상세: `attention` 은 DB enum 에 존재하지 않는 가상 필터값임을 코드 주석과 Swagger description 에 명확히 문서화하였다. `@IsIn(INTEGRATION_STATUSES)` 로 요청 검증도 일관되게 유지된다. 클라이언트가 `?status=attention` 을 전송하면 서버가 union WHERE 절로 변환하는 계약이 DTO, 서비스 구현, 프론트엔드 타입 3곳에 걸쳐 정합적으로 기술되어 있다.
  - 제안: 현재 설계 유지. 다만 Follow-up 이슈(plan W4)에 기재된 대로, `spec/conventions/` 또는 `spec/5-system/2-api-convention.md` 에 "가상 필터값(virtual filter value)" 패턴을 공식 규약으로 박제하면 향후 동일 패턴 재사용 시 일관성이 보장된다.

- **[INFO]** 기존 `?status=expiring` URL 하위 호환성 유지 확인
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` +39~43, `backend/src/modules/integrations/integrations.service.ts` 기존 분기
  - 상세: 배너 클릭 동작이 `updateParam("status", "expiring")` 에서 `updateParam("status", "attention")` 으로 변경되었으나, `expiring` 필터 자체는 `INTEGRATION_STATUSES` 와 `STATUS_FILTERS` 에 여전히 포함되어 있다. 이미 `?status=expiring` 을 북마크하거나 공유한 사용자의 URL은 계속 동작한다. Breaking change 없음.
  - 제안: 해당 없음. 현재 설계 적절.

- **[INFO]** Swagger `description` 갱신으로 가상 필터값 계약 문서화
  - 위치: `backend/src/modules/integrations/dto/integration.dto.ts` +56~58
  - 상세: `@ApiPropertyOptional` description 에 `expiring` 과 `attention` 이 가상 필터값이며 서버가 WHERE 절로 변환한다는 사실이 명기되었다. API 소비자(클라이언트 개발자, 외부 통합)가 스펙 문서 없이도 계약을 이해할 수 있다. `example` 값도 `'attention'` 으로 갱신하여 신규 기능을 즉시 체험 가능하게 했다.
  - 제안: 현재 설계 적절. `expiring` 의 7일 임박 기준도 description 에 언급되면 완전한 문서가 된다(현재는 `attention` 의 합집합 조건만 언급되고 `expiring` 단독 필터의 7일 기준은 description 에서 빠져 있다).

- **[WARNING]** `ListStatusFilter` 와 `IntegrationStatus` 의 타입 분리가 응답 스키마와 불일치 가능성
  - 위치: `frontend/src/lib/api/integrations.ts` +2~10
  - 상세: `IntegrationStatus`(`connected | expired | error | pending_install`)는 서버 응답에서 내려오는 실제 DB 값이고, `ListStatusFilter`(`all | attention | connected | expiring | expired | error`)는 요청 시에만 사용하는 필터값이다. 두 타입이 별도로 정의되어 있어 계약상 의도는 명확하다. 그러나 API 클라이언트 코드에서 `ListStatusFilter` 를 응답 `status` 필드 타입으로 잘못 사용하거나, 응답 `status` 로 받은 값을 `ListStatusFilter` 자리에 그대로 넘기는 버그가 향후 발생할 수 있다(`attention` / `expiring` 은 응답에 절대 등장하지 않는 값이므로).
  - 제안: 현재 변경 내에서는 올바르게 분리되어 있으므로 즉각 수정 대상은 아니다. JSDoc 주석으로 `ListStatusFilter`가 요청 전용(request-only) 타입임을 명시하거나, 파일 상단 주석처럼 `// request-only` 태그를 추가하면 이 혼용 위험을 낮출 수 있다.

- **[INFO]** `attention` 필터의 서버 측 구현 — SQL 조건이 스펙 §9.1 과 일치
  - 위치: `backend/src/modules/integrations/integrations.service.ts` +141~153
  - 상세: `expired | error | (connected AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7 days')` 조건은 스펙 §9.1 의 Attention 합집합 정의(Expired ∪ Error ∪ Expiring)를 정확히 구현한다. `pending_install` 은 명시적으로 제외되며, 이는 스펙 §2.4 의 설계 의도와 일치한다. 단위 테스트(`integrations.service.spec.ts`) 도 세 조건을 개별 검증한다.
  - 제안: 현재 설계 적절.

---

## 요약

이번 변경은 `GET /api/integrations?status=attention` 이라는 신규 가상 필터값을 API 계약에 추가한다. DTO(`@IsIn` 검증), Swagger description, 서비스 구현(union WHERE), 프론트엔드 타입(`ListStatusFilter`), URL 파라미터 처리가 모두 일관되게 맞물려 있으며, 기존 `?status=expiring` 등 기존 URL은 그대로 동작하므로 breaking change가 없다. 주의할 점은 `ListStatusFilter`(요청 전용)와 `IntegrationStatus`(응답 값)의 타입 경계가 현재는 올바르게 분리되어 있으나, 두 타입이 겹치는 값(예: `connected`)을 공유하기 때문에 향후 혼용 버그 위험이 잠재한다는 것이다. 이는 이번 변경이 유발한 문제가 아니라 기존 구조적 특성이므로 경고 수준으로만 기록한다. Follow-up W4(가상 필터값 공식 규약 박제)가 완료되면 API 계약 관점의 완결성이 높아진다.

## 위험도

LOW
