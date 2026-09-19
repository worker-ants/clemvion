# RESOLUTION — 연결 테스트 결과 코드 · 테스트 빈칸 (1라운드)

SUMMARY: Critical 0 · Warning 2 · INFO 5. 정지 규칙(리뷰 전에 선언): Critical · Warning 0 이거나 `codebase/` 수정 0 인 라운드에서 수렴,
최대 3라운드.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W1 MakeShop `pingConnection` 런타임 테스트 0건 | `makeshop-api.client.spec.ts` «pingConnection» — 200 · 자격증명 누락 `INTEGRATION_INCOMPLETE`(호출 없음) · 403 `MAKESHOP_AUTH_FAILED`(갱신 · 격하 없음) · 네트워크 `MAKESHOP_TRANSPORT_FAILED`. 기대값은 리터럴 | `287aa2b89` |
| W2 타입 계약이 게이트 무리를 빠뜨림 + 그 런타임 분기 미검증 | `accepted` 를 union 의 여섯 무리에서 하나씩으로(`INTEGRATION_CREDENTIALS_UNREADABLE` 추가). `integrations.service.spec` — 복호화 불가면 등록된 entity tester 를 부르지 않고 `INTEGRATION_CREDENTIALS_UNREADABLE` | `287aa2b89` |
| INFO 3 게이트 코드 비상수화 | 이유를 union 주석에(쓰는 곳 한 함수 · 통합 전반 코드 · 오타는 union 이 막음) | `287aa2b89` |
| INFO 1 | spec §5.3 · §14.1 — `--impl-prep` 에서 잡혀 트래커 등재 예정(마무리 커밋) | 마무리 |
| INFO 2 · 4 · 5 | 조치 없음 — 2: DTO JSDoc 은 이 PR 의 wire 계약 밖(타입 불변) · 4: 두 블록은 드라이버마다 주석이 달라 헬퍼로 합치면 이유가 흐려진다 · 5: ratchet 은 `run-test.sh build` 단계와 CI build 에서 돈다(이 PR 의 build 로그에서 확인) | — |

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과 (타입체크 ratchet 포함 — 194, baseline 일치)
- e2e: 통과 (364)
