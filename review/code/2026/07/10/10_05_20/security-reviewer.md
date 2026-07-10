# 보안 코드 리뷰 — HEAD f5dff479969af8d76e1df4ec9ecf874c1898213c

대상: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `SECRET_LEAK_PATTERNS` 에
bare JWT / URI userinfo 2개 regex 추가 (+ 테스트 6건).

검증 방법: `git show HEAD` diff 정독, 전체 파일 컨텍스트(`redactSecrets`/`deepRedactSecrets`/소비처)
확인, 소비처 grep(11개 파일) 및 관련 spec 4개 스위트(107 tests) + cafe24/makeshop client spec
(75 tests) 실제 실행 통과 확인, node 로 두 regex 에 대한 실측 timing(adversarial 200k~1M 문자
입력) 수행.

## 발견사항

### ReDoS — 없음 (실측 확인)
두 신규 패턴 모두 인접 quantifier 의 문자 클래스가 그 뒤에 오는 리터럴(`.`, `:`, `@`, `://`)과
서로소(disjoint) 라서, greedy quantifier 가 백트래킹 없이 정확히 한 지점에서 멈춘다(고전적인
`(a+)+` 류 중첩 quantifier 모호성이 없음). Node 로 다음 adversarial 입력에 대해 실측:

- `"eyJ" + "a".repeat(200000)` (dot 없음): 1ms
- `"eyJ" + "a".repeat(200000) + "." + "bbbbb"` (2번째 세그먼트 미달): 1ms
- `"eyJ" + ("a".repeat(15) + ".").repeat(20000)` (반복 dot): 0ms
- `"http://" + "a".repeat(200000) + ":" + "a".repeat(200000)` (`@` 없음): 2ms
- 5000개 오탐-유사 토큰 연결(각 40자): 2~3ms
- 균일 소문자 100만자(스킴 자체가 없음): 2ms

모두 sub-3ms — 지수적 백트래킹 징후 없음. **CRITICAL/WARNING 없음.**

### False positive — 실질적 문제 없음
다음 케이스들을 직접 추적(regex 상태 기계 수준)했고, diff 에 포함된 FP 가드 테스트 4건
(`eyJustKidding` word / URL-without-userinfo / `ratio 3:4` / `host:port`)도 모두 통과:

- `host:port` (`http://localhost:3000/health`): 2번째 `[^/\s:@]+` 가 `/` 에서 멈추고 뒤에
  `@` 가 없어 매치 실패 — userinfo 없는 URL 은 오탐하지 않음. 확인됨.
- markdown `[text](https://user:pass@host)`: 괄호는 매치에 영향 없이 실제 credential 만
  정상적으로 마스킹됨 — 이건 오탐이 아니라 의도된 정상 탐지.
- query string 내 `key:value@` 형태(`?q=email:foo@bar.com`)는 host 뒤 `/` 로 인해 첫 `[^/\s:@]+`
  가 `/` 에서 멈추고 `:` 요구조건을 못 채워 매치 실패 — 오탐 없음.

- **[INFO] 스킴이 선행 단어에 공백/구분자 없이 직접 붙는 경우 과잉 마스킹** — `\b` 는
  전체 word-run 의 시작에서만 성립하므로, 예: `"linkhttps://user:pass@host"` (구분자 없이
  글루) 는 `\b` 가 `link` 앞에서 성립해 `[a-z][a-z0-9+.-]*` 가 `linkhttps` 전체를 스킴으로
  삼켜 매치되고, 최종 마스킹 시 `link` 라는 무관한 단어까지 `***` 에 흡수된다. 실제 secret 은
  안전하게 마스킹되므로 보안 결함은 아니고 가독성만 약간 저하되는 코스메틱 이슈. 자연어
  로그/에러 문자열에서 스킴 직전에 구분자가 전혀 없는 경우는 드물어 실사용 영향은 낮음.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:46`
  - 재현: `redactSecrets('linkhttps://user:pass@host')` → `'***host'` (link 손실)

### False negative — 경미한 갭 2건, Critical 없음
- **[INFO] `eyJ` 바로 앞에 word-boundary 가 없는 경우 미탐지.** 예: `"tokeneyJhbGciOiJIUzI1NiJ9....` 처럼
  키워드가 구분자 없이 JWT 에 직접 이어붙은 경우, `\b` 가 `token` 시작에서만 성립하고 `eyJ`
  직전에는 성립하지 않아(둘 다 word char) 매치 실패. 다만 이런 형태(`=`, `:`, 공백, 따옴표
  등 구분자 전혀 없이 키워드+JWT 가 붙는)는 실제 HTTP 헤더/JSON/쿼리스트링 관례상 드묾 —
  대부분의 실제 경로는 `Bearer `, `token=`, `"access_token":"` 등 구분자를 가지며 이미 기존
  키워드 패턴(34, 39번 라인)이나 신규 bare-JWT 패턴이 잡는다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:43`
- **[INFO] `alg=none` JWT 의 빈 서명 트레일링 dot** (`header.payload.` — 세 번째 세그먼트가
  0자) 은 `(?:\.[A-Za-z0-9_-]+)?` 의 `+` 가 최소 1자를 요구해 트레일링 `.` 자체는 마스킹
  대상에서 제외된다. header/payload 는 이미 마스킹되고 트레일링 `.` 하나만 잔존 — 시크릿
  누출은 아님(서명이 원래 비어있음), 극히 낮은 영향.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:43`
- 검토 요청에 명시된 다른 변형들은 실제로는 갭이 아님을 확인: URL-encoded userinfo(퍼센트
  인코딩 문자는 두 문자 클래스에 모두 허용되어 정상 매치), 대문자 스킴(`gi` 플래그로 커버,
  `HTTPS://...` 정상 매치 확인).

### Whole-match 마스킹 부작용 / 이중 처리 — 충돌 없음
- URI userinfo 패턴은 `scheme://user:pass@` 전체를 `***` 로 치환해 스킴 정보가 손실된다
  (`https://admin:pw@host/path` → `***host/path`). 주석(44~46번 라인)에 "host/path remain
  for context" 로 명시된 의도된 트레이드오프이며, diff 의 신규 테스트도 이 동작을 그대로
  검증한다. 보안 결함 아님, 진단 가독성만 소폭 저하 — **INFO**.
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:22-30` 의
  `CONNECTION_STRING_PATTERN`(postgres/redis/mongodb/mysql 스킴 한정, `[REDACTED_URI]` 로
  치환)이 **먼저** 실행되고 그 결과 문자열에 대해서만 `redactSecrets`(신규 URI-userinfo 패턴
  포함)가 나중에 적용된다(같은 파일 27~31번 라인, `.replace(CONNECTION_STRING_PATTERN,...)`
  이 `redactSecrets(...)` 호출을 감싸는 인자로 먼저 평가됨). 따라서 이 소비처에서 DB 스킴
  URI 는 이미 `[REDACTED_URI]` 로 치환된 뒤라 신규 URI-userinfo 패턴이 볼 시점엔 `://` 자체가
  남아있지 않아 재매칭되지 않는다 — **이중 처리/충돌 없음**, 신규 패턴은 이 특정 소비처에서는
  redis/postgres/mongodb/mysql 외의 스킴(https, amqp, ftp 등)에 대해서만 실질적으로 동작한다.
  다른 소비처(conversation-thread egress, cafe24/makeshop client 등)는 `CONNECTION_STRING_PATTERN`
  선행 처리가 없으므로 신규 URI-userinfo 패턴이 DB 스킴을 포함한 유일한 방어선이 된다 — 의도된
  설계.

### 소비처 영향 — 회귀 없음 (실측)
- 신규 패턴을 포함하는 `redactSecrets`/`deepRedactSecrets`/`sanitizeLastErrorMessage` 는
  `ai-turn-orchestrator.service.ts`(AI 턴 사용자向 메시지·프레젠테이션), `thread-renderer.ts`
  (대화 이력 렌더링), `interaction.service.ts`(외부 상호작용 노출 데이터),
  `integration-oauth.service.ts`, `cafe24-api.client.ts`, `makeshop-api.client.ts`,
  `mcp-error-codes.ts`, `execution-engine/sanitize-error-message.ts` 등 11개 파일에서 소비.
  관련 spec 스위트를 직접 실행해 전수 통과 확인:
  - `sanitize-error-message.spec.ts`(shared) 35 tests pass
  - `execution-engine/sanitize-error-message.spec.ts` + `mcp-error-codes.spec.ts` +
    `thread-renderer.spec.ts` + `integration-oauth.service.spec.ts` 107 tests pass
  - `cafe24-api.client.spec.ts` + `makeshop-api.client.spec.ts` 75 tests pass
- **[INFO] AI 턴 사용자向 텍스트(`ai-turn-orchestrator.service.ts:743,870` 의
  `redactSecrets(nextConv.message)` / `redactSecrets(responseText)`)에도 신규 패턴이 함께
  적용된다.** 어시스턴트가 예시로 `postgres://user:pass@host` 형태의 튜토리얼 텍스트나
  `eyJ...` 형태의 JWT 예시를 설명 목적으로 출력하면 사용자에게 보이는 채팅 응답 본문이
  `***` 로 마스킹되어 답변 품질이 저하될 수 있다. 이는 기존 키워드 기반 패턴(`password=`,
  `secret:` 등)에서도 이미 존재하던 동일 계열의 트레이드오프이며, 이번 diff 로 새로 발생한
  카테고리의 위험은 아니다(시크릿 오탐지로 인한 보안 하락이 아니라 UX 저하 방향의 보수적
  선택) — 기능적 관찰 사항으로만 기록, 보안 결함 아님.

## 요약
두 신규 정규식(bare JWT, URI-embedded userinfo)은 부정형 문자 클래스가 뒤따르는 구분자
리터럴과 서로소로 설계되어 있어 백트래킹 모호성이 원천적으로 없으며, 200k~1M 문자
adversarial 입력에 대한 실측에서도 전부 수 ms 이내로 종료돼 ReDoS 위험은 확인되지 않았다.
diff 에 포함된 FP 가드 테스트(`host:port`, URL-without-userinfo, prose-colon, `ey`-word)를
포함한 관련 소비처 spec 스위트(217개 테스트)를 직접 실행해 전수 통과를 확인했으며, 실행엔진
sanitizer 의 `CONNECTION_STRING_PATTERN` 과의 처리 순서를 추적한 결과 이중 처리/충돌은
없다(선행 처리로 DB 스킴 URI 가 먼저 걸러진 뒤 신규 패턴은 나머지 스킴만 담당). 발견된 사항은
모두 INFO 수준의 코스메틱/가독성 트레이드오프(스킴 손실, 드문 글루 케이스의 과잉/과소 마스킹,
AI 턴 텍스트에서의 예시 문구 오마스킹 가능성)뿐이며, 시크릿 누출로 이어지는 Critical/Warning
급 결함은 발견되지 않았다. 이번 변경은 기존에 키워드/접두사 없이 새던 두 형태의 시크릿을
공용 SoT 한 곳에서 막아 전 소비처를 동시에 강화하는 순수 하드닝으로 평가한다.

## 위험도
NONE
