# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
대상 scope: `spec/2-navigation/6-config.md`
diff-base: `origin/main`

---

## 검토 대상 변경 요약

`codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` 에 다음 두 가지 Swagger 데코레이터 보완이 이루어졌다.

1. `AuthConfigUsagePeriodCountsDto` — `last24h` / `last7d` / `last30d` 세 필드에 `type: Number` 명시 + JSDoc 주석 추가
2. `AuthConfigUsageCallDto` — `sourceIp` 에 `type: String`, `responseCode` 에 `type: String` 명시

---

## 발견사항

발견된 실질적 충돌 없음.

### 검토 관점별 판정

1. **데이터 모델 충돌**: 없음.
   - `AuthConfigUsagePeriodCountsDto.last24h/last7d/last30d` 가 `type: Number` 로 선언된 것은 `spec/2-navigation/6-config.md §A.3` 의 "롤링 윈도(최근 24h/7d/30d) 기준 호출 횟수" 와 일치한다. 카운트는 정수이며 Number 타입이 맞다.
   - `AuthConfigUsageCallDto.sourceIp` 가 `type: String, nullable: true` 로 선언된 것은 `spec/1-data-model.md §2.13 Execution.source_ip` 의 `Varchar(45)? NULL 허용` 정의, 그리고 `spec/2-navigation/6-config.md §A.3` 의 "캡처 안 된 호출(비-HTTP 트리거)은 null" 설명과 일치한다.
   - `AuthConfigUsageCallDto.responseCode` 가 `type: String` (non-nullable) 로 선언된 것은 `Execution.response_code` 가 DB 상 `Varchar(10)? NULL 허용` 임에도 서비스 레이어(`auth-configs.service.ts:628`)에서 `responseCode: e.responseCode ?? e.status` 폴백을 적용해 API 응답은 항상 non-null 임을 보장하기 때문에 모순이 없다. `spec/2-navigation/6-config.md §A.3` 의 "항상 non-null" 선언과 일치한다.

2. **API 계약 충돌**: 없음.
   - `GET /api/auth-configs/:id/usage` 응답 shape 는 spec `§3 Authentication API` 와 코드 DTO 가 일치한다.

3. **요구사항 ID 충돌**: 없음.
   - 본 diff 는 새로운 요구사항 ID 를 부여하지 않는다.

4. **상태 전이 충돌**: 해당 없음.

5. **권한·RBAC 모델 충돌**: 없음.
   - 변경된 파일은 응답 DTO 이며 RBAC 관련 변경 없음.

6. **계층 책임 충돌**: 없음.
   - `type:` 명시는 Swagger 메타데이터 보완이며 레이어 책임 변경 없음.

---

## 요약

본 diff 는 NestJS `@ApiProperty` 데코레이터에 `type:` 필드를 명시적으로 추가하고 JSDoc 주석을 한국어로 정비하는 수준의 변경이다. 기능적 동작, 데이터 타입, API shape, RBAC, 상태 전이 어느 측면에서도 기존 spec(`spec/2-navigation/6-config.md`, `spec/1-data-model.md §2.13`, `spec/5-system/12-webhook.md WH-MG-05`) 과 충돌하지 않는다. `responseCode` 의 DB nullable 과 DTO non-null 간 겉보기 불일치는 서비스 레이어 폴백(`?? e.status`)으로 이미 해소되어 있으며 spec 도 이를 의도적으로 서술하고 있다.

---

## 위험도

NONE
