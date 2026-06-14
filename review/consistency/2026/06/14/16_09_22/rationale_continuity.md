### 발견사항

기각된 대안 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 가정 충돌 — 해당 없음.

분석한 구현 변경(V096 마이그레이션, auth-configs.service.ts, execution-engine.service.ts, hooks.service.ts, DTO, 프론트엔드 usage-drawer) 은 `spec/2-navigation/6-config.md ## Rationale R-6` 및 `spec/1-data-model.md §2.13 AuthConfig 호출 집계 경로` 와 전면 일치한다. 구체적으로:

1. **저장 위치 = Execution 행 컬럼 추가 (전용 call-log 엔티티 미도입)** — R-6 의 "전용 call-log 엔티티 미도입 / 이중기록 회피" 원칙을 V096 이 그대로 따른다. 구현 주석도 `IntegrationUsageLog 와 달리 AuthConfig 는 Execution 을 SoT 로 재사용` 이라 명시해 기각된 별도 엔티티 대안을 의식적으로 피한다.
2. **롤링 윈도(24h/7d/30d), 캘린더 버킷 미채택** — R-6 의 "캘린더 버킷(일/주/월 경계) 대신 롤링 윈도" 결정이 `USAGE_PERIOD_WINDOWS_MS` 상수·`COUNT(*) FILTER` 쿼리·DTO 주석·UI 번역 키(`period24h`/`period7d`/`period30d`) 전 계층에서 일관 적용된다.
3. **응답 코드 = 실제 HTTP 코드(202) + 비-HTTP 폴백** — R-6 의 "webhook 은 실제 HTTP 코드, 비-HTTP 는 status enum 폴백" 이 `WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)`, `responseCode: e.responseCode ?? e.status` 폴백, WH-MG-05 이행 주석으로 관철된다.
4. **소스 IP = extractClientIp 재사용, 인증과 이력 공용** — R-6·hooks.service 주석 모두 "인증 IP whitelist 검증과 호출 이력 영속에 공용. 한 번만 추출" 을 채택. 별도 추출 경로를 두는 대안(중복 호출·부수효과 회귀 위험)은 W-9 코멘트로 명시 기각됐고 구현도 동일하다.
5. **단일 쿼리 조건부 집계** — R-6 의 "round-trip 1회로 3종" 방침이 `Promise.all` + `getRawOne<{ last24h, last7d, last30d }>` 단일 쿼리로 구현됐다. 쿼리당 독립 QB 분리(W-11) 는 병렬화 안전성을 위한 추가 구현 세부이며 spec 결정을 번복하지 않는다.

### 요약

target 구현(§A.3 호출 이력 — 소스 IP·응답 코드·기간별 호출 수)은 `spec/2-navigation/6-config.md ## Rationale R-6` 와 `spec/1-data-model.md §2.13 AuthConfig 호출 집계 SoT 주석` 이 합의한 설계 결정 — (a) 전용 call-log 엔티티 미도입 + Execution SoT 재사용, (b) 캘린더 버킷 대신 롤링 윈도, (c) 실제 HTTP 응답 코드 + 비-HTTP status 폴백, (d) extractClientIp 단일 추출 공용 — 을 코드·마이그레이션·DTO·프론트엔드 전 계층에서 일관되게 구현하고 있다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 시스템 invariant 우회가 식별되지 않았다.

### 위험도

NONE
