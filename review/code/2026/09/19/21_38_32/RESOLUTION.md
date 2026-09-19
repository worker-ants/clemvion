# RESOLUTION — 통합 노드 SSRF 가드 하나로 (1라운드)

SUMMARY: Critical 0 · Warning 7 · INFO 11. 정지 규칙(리뷰 전에 선언): Critical · Warning 0 이거나 `codebase/` 수정 0 인 라운드에서 수렴,
최대 3라운드.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W1 판정을 메시지 접두어로 가름 | `http-safety` 에 `SsrfBlockedError`(메시지 `SSRF_BLOCKED: …` 그대로), SMTP 가드는 `instanceof`. 다른 소비자는 메시지가 같아 동작 불변. 테스트: 차단이 이 클래스로 오는지 · 재던짐 테스트의 mock 이 클래스를 내보내게 | `a1e1a591b` |
| W2 공용 가드가 `http-request/` 폴더에 | 리뷰어가 적은 최소 조치(이유 한 줄)를 `http-safety.ts` 헤더에. 이전은 spec `1-http-request.md` frontmatter `code:` 경로와 함께 바꿔야 해 planner 몫 — 트래커 등재(마무리 커밋) | `a1e1a591b` |
| W3 IPv4 내장 다른 표기의 회귀 고정 | `it.each` 넷(IPv4-compatible · SIIT · NAT64 · 6to4 → 통과). 실측 근거를 주석에 | `a1e1a591b` |
| W4 host 누락 | `undefined` · 공백 → `false` | `a1e1a591b` |
| W5 · W7 CHANGELOG · 배포 영향 | Unreleased 항목 — 뚫려 있던 것 · 고친 것 · 배포 뒤 막히는 것 · opt-out · LLM/S3 는 그대로 | `a1e1a591b` |
| W6 `.env.example` 헤더 | Send Email · 판정 방식(IPv4-mapped) · SMTP 가드 경로 | `a1e1a591b` |
| INFO 8 · 9 | SMTP spec 이 DNS 를 mock 하지 않아도 되는 이유 · 빈 host 가 통과해도 되는 이유(두 호출 경로 모두 필수 필드 검증이 먼저 — `dispatchTest` step 1 · 핸들러 `missingSmtpFields` 확인) | `a1e1a591b` |
| INFO 1 · 2 · 3 · 5 · 6 · 11 | 조치 없음 — 기존 한계 · 의도된 범위 · 양성 확인 | — |
| INFO 4 | DNS fail-open 명문화는 spec 몫 — `--impl-prep` INFO 와 함께 트래커 등재(마무리 커밋) | 마무리 |
| INFO 7 | 대칭 입력 행의 판별력 — 뮤턴트(옥텟 뒤바꿈)가 비대칭 행(`a9fe:a9fe` 외 `6440:1` 등)으로 RED 인 것을 이미 확인 | — |
| INFO 10 | `testEmailTransport` 의 가드 호출이 try 밖 — 가드가 던지는 것은 판정(`SsrfBlockedError` → `true`)뿐이고 `lookup` 오류는 가드 안에서 삼킨다. 새 경로 없음 | — |

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과 (타입체크 ratchet 포함)
- e2e: 통과 (364)
