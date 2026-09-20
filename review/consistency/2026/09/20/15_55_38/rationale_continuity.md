# Rationale 연속성 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 검토 방법

프롬프트 번들(`_prompts/rationale_continuity.md`)의 "관련 Rationale 발췌"는 컨텍스트 예산 초과로
대부분 `⚠️ 본문 생략됨` 처리돼 있고, 특히 target 이 직접 건드리는 두 파일(`0-common.md` ·
`1-http-request.md`)의 자체 Rationale 은 번들에 아예 없었다(`0-common.md` 대신 동명이인인
`3-ai/0-common.md` 가 잘못 매칭되어 들어왔다). 이 gap 을 메우기 위해 worktree 의 실제 spec ·
코드 파일을 직접 읽어 대조했다 — 아래 발견사항은 번들이 아니라 실측(디스크 원문 + 관련 handler
코드)을 근거로 한다.

## 발견사항

- **[INFO]** `1-http-request.md` 의 Rationale 은 "## 8. Rationale" 로 번호가 매겨져 있어 `--spec` 번들러가
  놓쳤다 (다른 형제 문서 `2-database-query.md` 는 번호 없는 "## Rationale"). 대상이 두 파일 중 하나라 이번
  세션의 근거 수집에 실제로 영향을 줬다.
  - target 위치: 없음 (target 문서의 결함이 아니라 검토 인프라의 blind spot)
  - 과거 결정 출처: `spec/4-nodes/4-integration/1-http-request.md` 자체의 헤딩 관례 (다른 integration 문서들과 번호 매김이 다름)
  - 상세: `--spec` 번들 스크립트가 `## Rationale`(정확히 이 문자열)만 추출하는 것으로 보이며, `## 8. Rationale`
    처럼 절 번호가 붙은 헤딩은 대상에서 빠진다. 이번엔 직접 파일을 읽어 메웠지만, 다음 `--spec` 라운드에서도
    같은 gap 이 반복될 수 있다.
  - 제안: (a) `1-http-request.md` 의 "## 8. Rationale" 을 형제 문서들과 맞춰 번호 없는 "## Rationale" 로
    통일하거나, (b) 번들러의 헤딩 매칭 정규식을 `^## (?:\d+\.\s*)?Rationale$` 로 넓힌다. 이 draft 의 스코프
    밖이므로 별도 트래커 항목으로.

- **[INFO]** 변경안 ②의 "가드의 고장"(SSRF 가드가 판정이 아닌 오류를 던지는 경우) 분기는, `http-safety.ts` 의
  두 가드 함수(`assertSafeOutboundUrl` · `assertSafeOutboundHostResolved`)를 실측한 결과 오늘 코드에서는
  **`SsrfBlockedError` 이외의 것을 던지는 경로가 없다**(DNS 조회 실패조차 fail-open 으로 삼켜 pass-through
  한다). 즉 이 분기는 현재 도달 가능한 실사용 케이스가 아니라 가드에 버그가 생겼을 때를 대비한 방어적 분기다.
  - target 위치: 변경안 ② 전체(§89-101 부근), 특히 "SSRF 가드가 판정 아닌 오류를 던진 경우" 문구
  - 과거 결정 출처: `plan/complete/ssrf-catch-instanceof.md` "호출부마다 정한 기대 동작" 표(원칙: "판정만
    차단으로, 판정이 아니면 분류되지 않은 실패 경로로") — 이 결정 자체가 방어적 분기임을 전제로 하고 있어
    상충은 아니다.
  - 상세: target 이 틀린 것은 아니다(실측한 handler 코드 — `http-request.handler.ts` L362 `if (!(err
    instanceof SsrfBlockedError))`, `database-query.handler.ts` L271 동일 패턴 — 이 존재하고 그 라우팅이
    target 표와 정확히 일치한다). 다만 표만 보면 "자주 발생하는 두 번째 경로"로 오독될 여지가 있다.
  - 제안: 각 spec 문서에 반영할 때 "이 경로는 가드 자체의 방어적 버그 캐치이며 오늘 코드에서 SSRF 가드는
    판정(`SsrfBlockedError`) 외의 예외를 던지지 않는다"는 한 구를 덧붙이면, 다음 독자가 이 표를 "실무에서
    자주 갈리는 두 분기"로 오해해 불필요한 처리 로직을 추가하는 것을 막을 수 있다. 선택 사항(INFO) — 없어도
    현재 문구는 사실을 왜곡하지 않는다.

## 상세 대조 결과 (참고 — 이번 라운드에서 발견된 문제 없음)

아래는 이번 검토에서 실제로 검증했고 **Rationale 과 상충하지 않음**을 확인한 항목들이다(음성 결과이지만
검토 근거를 남긴다):

- **변경안 ①** (`http-redirect.ts` frontmatter 누락): `http-redirect.ts` 는 실재하고 SSRF 가드를 재사용한다.
  Rationale 위반 없음 — 순수 증거 목록 보완.
- **변경안 ②** (가드 고장 트리거, 시점 구분): `1-http-request.md` §8.3 Rationale — "종전 redirect hop 의
  SSRF **예외**(=차단 판정)가 바깥 일반 catch 로 떨어져 오분류되던 것을 정정" — 이는 **차단 판정**의 라우팅
  수정이고, target 의 "가드의 고장"(비-판정) 구분과는 다른 축이라 상충하지 않는다. target 의 표(HTTP
  preflight→`INTEGRATION_CALL_FAILED`, redirect 홉→`HTTP_TRANSPORT_FAILED`, DB preflight→
  `INTEGRATION_CALL_FAILED`)는 `http-request.handler.ts`(L353-418, L531-588) · `database-query.handler.ts`
  (L258-285) · `plan/complete/ssrf-catch-instanceof.md` 표와 정확히 일치한다. 1차 `--spec` CRITICAL(두 시점을
  뭉뚱그려 열린 결정을 선취)은 이미 시점 구분 실측표로 교정되어 있다.
- **변경안 ③** (연결 테스트 두 코드): `2-navigation/4-integration.md` Rationale "코드 이름" 문단의 "나머지
  다섯은 연결 테스트 전용"이라는 닫힌 목록에 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`는
  애초에 포함되지 않았다(다섯은 `DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·
  `HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`뿐). target 의 추가 문장은 "닫힌 다섯"을 뒤집는 것이 아니라
  범위를 명확히 하는 보강이며, 그 자체로 새 Rationale 문장을 함께 쓰고 있어 criterion 3(무근거 번복)에
  해당하지 않는다. `http-connection-tester.ts` 실측(L117-153, 단일 `try` 블록)도 INFO 1(`HTTP_CONNECT_FAILED`
  통합 라우팅) 주장과 일치.
- **변경안 ④** (§5.9 범위 좁히기): 이 저장소의 반복 원칙("문서한 보장이 구현보다 넓으면 안 된다")을
  target 자신이 명시적으로 인용하며 적용한 사례 — Rationale 원칙 위반이 아니라 그 원칙의 정확한 적용이다.
  `5-makeshop.md`(403→`MAKESHOP_AUTH_FAILED`)와 Cafe24(403→`CAFE24_INSUFFICIENT_SCOPE`)의 실제 차이도
  기존 스펙 본문과 일치.

## 요약

target 문서는 두 차례(1차 `--spec` CRITICAL 발견 → 실측표로 재작성) Rationale 정합을 스스로 점검하며
작성됐고, 이번 rationale_continuity 관점 재검토(디스크 원문·handler 코드 직접 대조 포함)에서도 기각된
대안의 재도입·합의 원칙 위반·무근거 번복·암묵적 invariant 우회 중 어느 것도 발견되지 않았다. 변경안
②③④는 모두 기존 spec 산문·Rationale 의 정확한 인용에서 출발해 사실 오류만 좁게 정정하며, 결정 번복이
있는 자리(③ 닫힌-다섯 재해석, ④ §5.9 축소)마다 새 근거 문장을 함께 적어 두어 "번복인데 근거 없음"의
형태를 피했다. 유일한 이슈는 target 자체가 아니라 검토 인프라 쪽 — `1-http-request.md` 의 번호 매김
Rationale 헤딩이 `--spec` 번들에서 누락되는 blind spot이며, 이는 INFO 로 별도 처리를 제안한다.

## 위험도

LOW
