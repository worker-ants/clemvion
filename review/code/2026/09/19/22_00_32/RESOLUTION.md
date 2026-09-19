# RESOLUTION — 통합 노드 SSRF 가드 하나로 (2라운드)

SUMMARY: Critical 0 · Warning 5 · INFO 5.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W1 가이드가 Email(SMTP) · CGNAT 를 빠뜨림 | `integration-management.mdx` · `.en.mdx` — 차단 대상에 Email(SMTP) · CGNAT, 그 연동을 쓰는 노드도 같은 규칙. frontend `src/lib/docs` 가드 3460 통과 | `fce34b77b` |
| W3 JSDoc 문단 끼어듦 | 한국어 문단을 헤더 끝으로, 영어 문장 흐름 복원 | `fce34b77b` |
| W4 «트래커에 있다» 가 거짓 | 같은 커밋에서 트래커에 실제로 등재 — 문장도 «트래커 … 의 항목으로 둔다» | `fce34b77b` |
| W5 정규화 폴백 분기 미실행 | `fe80::1%eth0` · `[fe80::1%25en0]` → 차단(둘 다 URL 파서가 거부함을 확인). 뮤턴트(폴백 `''`) RED 2 | `fce34b77b` |
| W2 소비자 넷의 catch 가 `instanceof` 가 아님 | **수렴 예외**(developer SKILL §ISSUE FIX 정책) — (a) 동작 결함이 아니다: 가드가 `SsrfBlockedError` 만 던져 넷의 동작은 지금 같다. (b) 고치면 네 파일에서 URL 파싱 등 다른 오류의 처분(차단 → 실패)이 바뀌어 호출부마다 기대 동작 · 테스트를 새로 정해야 하고, 그 라운드가 또 잔여를 낸다. (c) 이 조항을 여기에 인용한다. (d) 같은 턴에 트래커 등재(«SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로») | 트래커 |
| INFO 1 | 1라운드 INFO 10 과 같은 사안 — 새 경로 없음 | — |
| INFO 2 | 발송 경로는 가드 unit + 핸들러 배선 unit 으로 덮음. 워크플로 실행 e2e 는 비용 대비 낮음 | — |
| INFO 3 | `EMAIL_HOST_BLOCKED` ko 라벨 — `ERROR_KO` 매핑은 **아무도 읽지 않는다**는 기존 트래커 항목(«`ERROR_KO` 의 API 에러 코드 매핑을 아무도 읽지 않는다»)이 있어 더하지 않았다 | — |
| INFO 4 · 5 | 기록용 — 의도된 전파 · 병렬 리뷰어의 일시 뮤테이션(최종 클린) | — |

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과 (타입체크 ratchet 포함)
- e2e: 통과 (364)
