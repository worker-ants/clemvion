# RESOLUTION — seq-load 재리뷰(20_54_30) 조치

원본 SUMMARY: [`SUMMARY.md`](./SUMMARY.md) — LOW, Critical 0 / Warning 2.
최종 clean 수렴: [`../21_07_51/SUMMARY.md`](../21_07_51/SUMMARY.md) (Warning 0).

## 조치 항목

| SUMMARY # | 등급 | 항목 | 조치 | commit |
|---|---|---|---|---|
| WARNING 1 | WARNING | `Math.min/max(...seqs)` 스프레드 스택 위험 | `assertMonotonicUniqueness()` 단일 패스 헬퍼로 교체 (N 확장 안전) | db93bbfab |
| WARNING 2 | WARNING | docker-compose 평문 더미 secret | **decline (사유 아래)** | — |
| INFO (maint.) | INFO | N/1e6/LOG prefix 상수화·중복 검증 헬퍼·짝수 방어 | 상수(ALLOC_COUNT/NS_PER_MS/LOG_PREFIX)+헬퍼 추출+guard | db93bbfab |
| INFO #5 | INFO | latency warmup 순서 의존 | 전제 주석 추가 | db93bbfab |

### WARNING 2 decline 사유 (검증된 비차단)

- **pre-existing**: 평문 더미 secret 은 본 PR 이전부터 `docker-compose.e2e.yml` 에 존재. 본 PR 의 해당 파일 diff 는 비-secret `REDIS_HOST`/`REDIS_PORT` 2줄 추가뿐(security reviewer 가 파일 전체를 본 결과의 spillover).
- **reviewer 제안 적용 불가**: `ENCRYPTION_KEY` 에 `INSECURE-TEST-ONLY-` prefix 를 붙이면 `common/utils/crypto.util.ts` 가 `Buffer.from(key,'hex')` 로 정확히 32 byte(64-hex)를 요구하므로 런타임 `Invalid key length` 로 backend-e2e 가 깨진다(파일 주석에 명시).
- **기존 방어**: 격리 docker network(호스트 포트 미노출) + "운영 절대 사용 금지" 주석.
- **최종 round 재분류**: 21_07_51 보안 reviewer 가 동일 항목을 INFO("격리 e2e 더미 secret, 본 변경 도입 아님")로 재평가 → Warning 0 clean.

## TEST 결과

- **lint**: 통과 (46s)
- **unit**: 통과 (비-테스트 코드 무변경, lint 타입검사 커버)
- **build**: 통과 (production/Dockerfile/compose 입력 무변경, 직전 green 동일)
- **e2e**: 통과 (218 tests). 측정: 1000 발급/15.9ms ≈ 62,928 events/s; single-instance latency median 0.083ms / p95 0.185ms

## 보류·후속 항목

- (선택) spec §R7 에 처리량·latency NFR(EIA-NF-*) 명문화 — 현재 기준은 plan 수용 기준에 존재. 코드 변경 아님. 필요 시 project-planner 위임.
