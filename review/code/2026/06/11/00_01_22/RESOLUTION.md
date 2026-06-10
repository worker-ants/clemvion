# RESOLUTION — health probe (review 2026/06/11 00_01_22, post-rebase 최종)

전체 위험도 MEDIUM, **Critical 0 / Warning 5**. 5건 모두 **코드로 수정 가능한 결함이 아니라**,
(a) 이미 검증 완료된 안전 항목이거나 (b) 본 변경(breaking change·DI 시그니처·k8s probe 분리)의
**본질적 속성에 대한 배포 시 운영 점검 항목**으로, 이미 CHANGELOG/configmap/spec 에 문서화돼 있다.
feature 를 제거하지 않는 한 "fix" 대상이 아니므로, 처분을 본 문서에 기록하고 종결한다(코드 변경 없음).

## 조치 항목

| SUMMARY # | 카테고리 | 처분 | 근거 / commit |
|---|---|---|---|
| W-1 | side_effect | 검증 완료 — 조치 불요 | `grep -r "new LoggingInterceptor" codebase/` → 프로덕션 직접 인스턴스화 0건(테스트 mock 주입만). DI 경로(APP_INTERCEPTOR)만 사용 |
| W-2 | side_effect | 검증 완료 — 조치 불요 | `grep -r "controller.check\|HealthController"` → 테스트 외 직접 호출 0건. NestJS 라우팅만 호출 |
| W-3 | side_effect | 문서화 완료 — 배포 운영 점검 | `HEALTH_CHECK_LOG=false` 기본의 성공 로그 억제는 의도된 동작(spec §1.1). configmap·CHANGELOG·README 명시. 배포 전 로그 알림 규칙 점검은 ops 체크리스트 |
| W-4 | side_effect | 문서화 완료 — 배포 운영 점검 | livenessProbe 경로 변경의 롤링업데이트 과도기 404 는 이미지+manifest 동시 apply 로 해소(표준 절차). CHANGELOG 에 배포 주의 명시 |
| W-5 | api_contract | 문서화 완료 — 의도된 breaking change | `/api/health` 200→503 은 본 변경의 핵심 목적(readiness probe 정상화). CHANGELOG 에 BREAKING 으로 명시. 외부 모니터링 503 수용 확인은 ops 체크리스트 |

INFO 14건: SPEC-DRIFT 2건(I-13/I-14)은 spec 갱신 완료 확인됨(오탐). 나머지(checks 대칭검증·e2e BASE_URL 상수화·
readinessProbe 주석·Ingress 차단 등)는 비차단 선택 개선 — 일부(대소문자 정규화·readiness 주석·healthy checks 검증)는
직전 commit(`refactor(health): ai-review INFO 정리`)에서 이미 반영. 잔여는 후속 백로그.

## TEST 결과

post-rebase(#524 기반) 전 단계 재수행 — 모두 통과:

- lint: 통과 (`_test_logs/lint-20260610-235806.log`)
- unit: 통과 (40 suites) (`_test_logs/unit-20260610-235840.log`)
- build: 통과 (frontend turbopack + docker 이미지 포함) (`_test_logs/build-20260610-235916.log`)
- e2e: 통과 (186 tests, health.e2e-spec 포함) (`_test_logs/e2e-20260610-235955.log`)

## 보류·후속 항목

- 선택 INFO(I-1 Ingress/NetworkPolicy 외부차단, I-6 e2e TransformInterceptor 단언 단순화, I-9 BASE_URL 상수화,
  I-11/I-12 HEALTH_CHECK_LOG 재시작 필요 운영가이드 명시)는 본 PR 범위 밖 후속 개선으로 이월.
- W-3/W-4/W-5 는 **배포 시 ops 체크리스트** 항목 (코드 미해당): 로그 알림 규칙 점검 / 이미지+manifest 동시 apply / 외부 모니터 503 수용 확인.
