# RESOLUTION — 12_40_00

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드(문서) | 34ce270e0 | 413 행 셀: `<br/>` 로 공개(32KB 구현)·인증(1MB Planned) 명확 분리. KO/EN parity |
| #2 | 코드(문서) | 34ce270e0 | 429 "global" → "instance-wide global"(EN) / "인스턴스 전역 글로벌"(KO) 로 범위 명시 |
| #3 | 보류·추적 | (없음) | inbound RATE_LIMITED 이미 "(Planned — not yet implemented)" 마킹, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 추적 중 — 추가 수정 불필요 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (48 passed)
- e2e   : 자동 흐름 환경 차단 (postgres container 기동 실패 — `dependency failed to start: container clemvion-e2e-objective-bose-ede03d-postgres-1 exited (1)`)

## 보류·후속 항목

- WARNING #3 defer: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에서 추적 중 (EIA inbound rate-limit 미구현). 문서 마킹 이미 정상, 추가 조치 불필요.
- INFO #1 (Planned 문구 단일화): WARNING #1 수정 시 두 파일 표 셀은 "Planned, not yet implemented" 형태로 정합화됨. URL 섹션의 "not yet enforced" 표현은 별도 문맥(본문 크기 cap)이므로 추가 확대 금지.
- INFO #2 (응답 바디 구조 미명시): non-blocking, 추가 확대 대상 아님.
- e2e 인프라 차단: postgres 컨테이너 복구 후 수동 `run-test.sh e2e` 재실행 권장.
