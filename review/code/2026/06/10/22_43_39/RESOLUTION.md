# RESOLUTION — 22_43_39

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1        | 코드 | 862289d1    | logging.interceptor.spec.ts 실패 경계값(400/399/401/404/500) 테스트 5건 추가 |
| #2        | 코드 | 862289d1    | health.controller.spec.ts healthy HTTP wire 케이스 body 구조 검증(status+checks) 추가 |
| #3        | 코드 | 862289d1    | health.controller.ts @ApiServiceUnavailableResponse 에 type: HealthCheckDto 명시 |
| #4        | 코드 | 862289d1    | LoggingInterceptor 클래스 수준 JSDoc 추가 (게이팅 규칙 + spec cross-ref 포함) |

## TEST 결과

- lint  : 통과
- unit  : 통과 (6464 backend + 40 frontend passed)
- e2e   : 통과 (181/181)

## 보류·후속 항목

INFO 항목 (자동 수정 대상 아님):

- INFO #1: /api/health 내부 정보 노출 — 클러스터 내부 NetworkPolicy/Ingress 접근 제한 확인 권장
- INFO #2: 쿼리스트링 로그 기록 — 민감 파라미터 마스킹 로직 후속 개선 검토
- INFO #3: LoggingInterceptor 생성자 시그니처 변경 DI 외 직접 인스턴스화 확인
- INFO #4: HealthController.check() 시그니처 변경 직접 호출 위치 확인
- INFO #5: HEALTH_CHECK_LOG 기본값 false 로 기존 배포 환경 로그 억제 — 운영 알림 규칙 확인 필요
- INFO #6: /api/health/live Swagger 스키마 미정의 (inline schema 또는 DTO 추가 고려)
- INFO #7: 200→503 breaking change 팀 릴리스 노트 공지 권장
- INFO #8: HealthService.check() 예외 throw 시 컨트롤러 레벨 동작 테스트 후속 추가 권장
- INFO #9: ConfigService mock 다중 키 대응 개선 (key 별 분기 mockImplementation)
- INFO #10: live() 반환 타입 어노테이션 명시 권장
- INFO #11: e2e 헬퍼 포트 하드코딩 — test/helpers/constants.ts 추출 고려
- INFO #12: livenessProbe.timeoutSeconds: 5 → 2 로 축소 가능 (무해한 현 설정)
