# Rationale 연속성 검토 결과

검토 모드: --impl-done  
대상 scope: spec/2-navigation/6-config.md  
diff-base: origin/main

---

### 발견사항

발견된 CRITICAL / WARNING 항목 없음.

---

### 요약

구현 diff(V096 마이그레이션, auth-configs.service, hooks.service, execution-engine.service, 프론트엔드 페이지, DTO, 테스트)는 `spec/2-navigation/6-config.md § Rationale R-6` 이 명시적으로 기록한 네 가지 결정 — (1) 저장 위치 = `Execution` 행 컬럼 추가(전용 call-log 엔티티 미도입), (2) 응답 코드 "둘 다"(webhook = 실제 HTTP 코드 `202`, 비-HTTP = NULL → `status` enum 폴백), (3) 기간별 호출 수 = 롤링 윈도(캘린더 버킷 미채택), (4) 소스 IP = `extractClientIp` 결과를 인증 whitelist 검증과 공용 — 을 모두 정합하게 이행한다. `spec/1-data-model.md §2.13` 의 `source_ip`/`response_code` 컬럼 서술 및 "AuthConfig 호출 집계 경로 SoT" 박스와도 충돌이 없다. 과거에 기각된 대안인 "전용 `IntegrationUsageLog` 형 call-log 엔티티", "캘린더 버킷 집계", "별도 toggle 엔드포인트" 중 어느 것도 재도입하지 않았으며, 합의된 invariant(`NULL = 비-HTTP 트리거, schedule/manual`, `responseCode null → status enum 폴백`, `sourceIp = extractClientIp 단일 호출 공용`)도 테스트 코드까지 일관되게 반영하고 있다. Rationale 번복이나 무근거 설계 변경은 확인되지 않는다.

### 위험도

NONE
