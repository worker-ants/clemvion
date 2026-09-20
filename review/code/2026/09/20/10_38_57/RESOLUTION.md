# RESOLUTION — SSRF 가드 소비자의 판정 분기 (3라운드 · 종결)

SUMMARY: Critical 0 · Warning 3 · INFO 9. 정지 규칙(1라운드 전에 선언): Critical · Warning 0 이거나 `codebase/` 수정 0 인
라운드에서 수렴, **최대 3라운드** — 이 라운드가 세 번째다.

## 종결 판정 — `developer` SKILL §수렴 예외로 갈음한다

남은 Warning 셋 중 **W3 는 `spec/` 이라 developer 권한 밖**(이미 planner 항목 등재)이고, **W1 · W2 는 같은 자리
(리다이렉트 홉의 가드 고장)** 를 가리킨다. 그 둘을 이 PR 에서 고치지 않고 등재로 갈음하며, 근거를 조항과 함께 적는다:

- **(a) 동작 결함이 아니다** — W2 가 말하는 «시점에 따라 코드가 갈린다» 는 **오늘 도달할 수 없는 경로**다. 가드가 낼 수
  있는 비판정 오류는 `isBlockedHostname` 의 `TypeError` 하나뿐이고, 그 입력(문자열이 아닌 host)은 저장·테스트 두 경로
  모두 `validateCredentials` 가 거절한다(1라운드에서 실측, 3라운드 security·requirement 가 재확인). W1 은 그 경로의
  테스트 공백이다 — 발견의 성격이 동작 → 구조 → 테스트/문서로 이동했다.
- **(b) fix 가 새 라운드를 강제한다** — 홉 경로를 `IntegrationError` 로 승격하는 것은 `outboundBlockReason` ·
  `followRedirectsSafely` · 핸들러 세 곳의 계약을 다시 만지는 변경이고, 코드가 바뀌면 게이트 freshness 가 재무장돼 4라운드가
  필요하다. 그 라운드가 또 같은 성격의 잔여를 낼 형태다.
- **(c) 근거와 조항을 함께 인용한다** — 이 절이 그것이다. 등재 사유는 «비용» 이 아니라 «수렴» 이다.
- **(d) 등재는 이 턴에** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 W1 · W2 를 한 항목으로
  (두 해법 후보 · 리뷰어가 뮤테이션으로 실증한 테스트 공백 · 도달 불가 실측을 함께) 적었다.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W1 홉 경로 마스킹에 회귀 테스트가 없다(뮤턴트 생존으로 실증) | **등재(수렴 예외).** 위 (a)~(d). 리뷰어의 실증을 그대로 인용해 적었다 — 전송 catch 의 `toLogError` 를 되돌려도 스위트가 GREEN 이다 | 마무리 |
| W2 가드 고장이 preflight 는 `INTEGRATION_CALL_FAILED`, 홉은 `HTTP_TRANSPORT_FAILED` | **등재(수렴 예외).** 두 해법 후보(홉 승격 통일 / spec 표에 두 코드 명시)를 등재문에 함께 적었다 — 어느 쪽이든 planner 의 에러 표 결정과 맞물린다 | 마무리 |
| W3 spec frontmatter `code:` 에 `http-redirect.ts` | **코드 밖.** 1라운드부터 planner 항목으로 등재돼 있다 | `fc7b896b3` |
| INFO 6 `database-connection-tester.ts` 가 `_base` 를 import 해 모듈 순환이 생긴다 | 조치 없음 — 리뷰어가 `transpileModule` 로 컴파일해 **타입 전용이라 JS 에서 사라진다**는 것을 실측했다(런타임 순환 없음). `integration-handler-base.ts` 가 `IntegrationsService` 를 값으로 쓰게 되면 달라진다는 기록만 남긴다 |
| INFO 1 · 2 · 3 · 4 · 5 · 7 · 8 · 9 | 조치 없음 — 1 · 2 · 7: 이미 트래커 등재분 · 3: 이 마무리 커밋이 해소한다(체크리스트 셋 + `plan/complete/` 이동) · 4 · 5 · 8: 앞선 라운드에서 유예 확정 · 9: 현재 입력이 짧아 순서 문제 없음 |

## 보류·후속 항목

- `plan/in-progress/spec-draft-nullable-notation-followups.md` — (1) 홉/preflight 코드 통일 + 그 경로 회귀 테스트(W1 · W2),
  (2) 가드 고장 메시지의 host/IP 마스킹 정책(2라운드 W1), (3) `1-http-request.md` `code:` 에 `http-redirect.ts` + 세 에러 표에
  «가드 고장» 트리거(planner), (4) `schedule-trigger` e2e 의 시각 충돌 flake.

## TEST 결과

이 라운드는 코드 변경이 없다. 마지막 코드 커밋(`fff0d14bf`) 뒤 TEST WORKFLOW:

- lint: 통과
- unit: 통과
- build: 통과
- e2e: 통과 (366)

백엔드 타입체크 ratchet 194건 — baseline 과 일치.

## 병렬 리뷰어의 워크트리 뮤테이션 (기록)

이 라운드에서 `testing` 이 판별력 검증을 위해 저장소 파일을 `cp` 백업 후 뮤테이트했고, 그 중간 상태를 `security` ·
`maintainability` 가 관측해 리포트에 적었다(이 저장소가 아는 형태 — 리뷰어 프롬프트의 뮤테이션 규약 2절). 라운드 종료 후
`git status --short` 로 확인한 결과 **이 라운드 산출물 디렉터리 말고는 변경 없음** — 원복됐다.
