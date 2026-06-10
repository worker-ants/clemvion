# RESOLUTION — 23_07_53

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1       | 코드 | 7a6d8ffc    | CHANGELOG.md 신규 섹션 — GET /api/health 200→503 breaking change + GET /api/health/live 신규 엔드포인트 + HEALTH_CHECK_LOG 환경변수 추가 공지 3건 |
| W-2       | 코드 | 7a6d8ffc    | GET /api/health/live `@ApiOkResponse` schema 명시 (`{ status: string, example: 'ok' }`) + `live()` 반환 타입 `: { status: 'ok' }` 추가 |
| W-3       | 코드 | 7a6d8ffc    | `k8s/base/configmap.yaml` backend-config 에 `HEALTH_CHECK_LOG: "false"` 명시; README.md §환경 변수 Backend 블록 + §런타임 환경변수 k8s 목록 보완 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (181/181)

## 보류·후속 항목

INFO 항목 (자동 수정 대상 아님 — 1차 RESOLUTION 22_43_39 로부터 이월):

- INFO #1 (I-1): /api/health 내부 인프라 정보 노출 — 클러스터 NetworkPolicy/Ingress 접근 제한 권장
- INFO #2 (I-2): 쿼리스트링 로그 기록 — `url` 대신 `path` 사용 검토
- INFO #3 (I-3): HEALTH_CHECK_LOG 대소문자 미처리 — `.toLowerCase() === 'true'` 개선 검토
- INFO #4 (I-4): HEALTH_PROBE_PATHS 하드코딩 — 현 규모 수용 가능, 경로 증가 시 ConfigService 주입 검토
- INFO #5 (I-5): @Res passthrough Express 의존 — Fastify 전환 시 검증 테스트 추가 권장
- INFO #6 (I-9): ConfigService mock key 별 분기 mockImplementation 개선 권장
- INFO #7 (I-10): HealthService.check() 예외 throw 시 컨트롤러 레벨 테스트 후속 추가 권장
- INFO #8 (I-12): readinessProbe 주석 비대칭 — 주석 1줄 추가 권장
- INFO #9 (I-16): HEALTH_CHECK_LOG 변수명 명확도 — 주석 강화 또는 추후 rename 검토
