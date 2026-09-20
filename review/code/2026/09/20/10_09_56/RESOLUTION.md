# RESOLUTION — SSRF 가드 소비자의 판정 분기 (2라운드)

SUMMARY: Critical 0 · Warning 5 · INFO 11. 정지 규칙(1라운드 전에 선언): Critical · Warning 0 이거나 `codebase/` 수정 0 인
라운드에서 수렴, 최대 3라운드.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W2 리다이렉트 **홉** 의 가드 고장이 마스킹 없이 `HTTP_TRANSPORT_FAILED` 로 나간다 · `followRedirectsSafely` JSDoc 이 새 throw 경로를 안 적는다 | **고침 — 이 PR 이 만든 비대칭이다.** (1) JSDoc 에 «던지는 것 둘: `fetch` 전송 오류 + 홉 검사의 판정 아닌 오류» 를 적었다. (2) 핸들러의 전송 catch 가 message 를 `toLogError(err).message` 로 마스킹한다 — 같은 사건(가드 고장)이 검사 시점에 따라 노출이 갈리던 것을 없앤다. 이 한 줄은 전송 오류 문구(URL 자격증명이 섞일 수 있다)도 함께 가리므로 방향이 같다 | `fff0d14bf` |
| W4 `database-query.handler.ts` 가 같은 표현을 catch 안에서 두 번 | **고침.** catch 진입부에서 `const detail` 로 한 번 계산해 `logger.warn` 과 `sanitizeMessage` 가 함께 쓴다 — 형제 파일과 같은 관용구 | `fff0d14bf` |
| W5 새 회귀 테스트의 스파이 복구가 마지막 줄에만 있다 | **고침.** `try`/`finally` 로 감싸 단언이 실패해도 `AbortSignal.timeout` 스파이가 복구된다 | `fff0d14bf` |
| W1 가드 «고장» 메시지에 host/IP 마스킹이 없다(판정 분기와 비대칭) | **코드 밖 이번 PR — 트래커 등재.** 오늘 가드가 낼 수 있는 비판정 오류는 `TypeError` 하나뿐이고 거기엔 host/IP 가 없다(1라운드에서 실측). 고치는 두 길(세 곳을 고정 문구로 / `sanitizeMessage` 에 host·IP 패턴 추가)은 **전 노드의 오류 문구**에 영향을 주므로 이 PR 의 스코프(판정 분류)와 다른 결정이다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 두 선택지와 근거를 함께 등재했다 | 마무리 |
| W3 spec frontmatter `code:` 에 `http-redirect.ts` (1라운드 W5 잔여) | **코드 밖 — 이미 planner 항목으로 등재됨.** `spec/` 쓰기는 developer 권한 밖이고 증거 목록 누락이라 자기-반증형 소정정에도 해당하지 않는다 | 1라운드 커밋 `fc7b896b3` |
| INFO 1 `toLogError` 두 번 호출 | 고침 — `const logError` 한 번 | `fff0d14bf` |
| INFO 8 «§아래 JSDoc» 방향 오기 | 고침 — «§위 JSDoc» | `fff0d14bf` |
| INFO 9 트래커의 «뮤턴트 다섯» vs plan 의 «넷» | 고침 — 트래커에 «판정 분기 넷 + 타임아웃 신호 생성 순서 하나» 로 명시 | `fff0d14bf` |
| INFO 10 plan 체크리스트 미완 · 트래커는 `plan/complete/` 를 선인용 | 마무리 커밋에서 셋(리뷰 수렴 · `--impl-done` · 이동)을 함께 닫는다 — 이 저장소의 마무리 순서 그대로 | 마무리 |
| INFO 2 · 4 · 5 · 6 · 7 · 11 | 조치 없음 — 2: 현재 입력이 짧아 `sanitizeMessage`→`clampMessage` 순서가 문제되지 않는다 · 4: import 정렬은 그 파일 스타일(1라운드 기결) · 5: 공용 헬퍼는 처리 방식이 서로 달라 보류(1라운드 기결) · 6 · 7: 같은 `if` 를 인증 방식·홉이 공유해 회귀 위험 낮음 · 11: 기결정(W1 항목에 함께 적었다) |

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과
- e2e: 통과 (366)

추가로 백엔드 타입체크 ratchet 194건 — baseline 과 일치(래퍼가 돌지 않는 단계라 직접 실행).
