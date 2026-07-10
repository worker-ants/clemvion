# Testing Review — HEAD f5dff479969af8d76e1df4ec9ecf874c1898213c

feat(shared): SECRET_LEAK_PATTERNS 확장 — bare JWT + URI userinfo (EIA §R17 잔여)

대상 파일:
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts`

## 실행 결과 (필수 회귀 검증)

```
cd codebase/backend && npx jest --testPathPatterns="(shared/utils/sanitize-error-message|thread-renderer|interaction\.service\.spec|execution-engine/sanitize-error-message|mcp-error-codes|cafe24|makeshop|integration-oauth)"
→ Test Suites: 32 passed, 32 total / Tests: 744 passed, 744 total
```

추가로 요청 목록에 없지만 `grep` 으로 userinfo/eyJ 리터럴을 포함한 fixture 를 쓰는 인접 스펙도 실행:

```
npx jest --testPathPatterns="(background-execution\.processor\.spec|http-request\.handler\.spec)"
→ Test Suites: 2 passed, 2 total / Tests: 84 passed, 84 total
```

백엔드 전체 스위트도 실행(사이드이펙트 전수 확인):

```
npx jest
→ Test Suites: 400 passed, 400 total / Tests: 1 skipped, 7946 passed, 7947 total
```

`eslint` (변경 파일 한정) — 위반 없음.

기존 exact-string / `not.toContain` assertion 이 신규 패턴에 걸려 깨지는 곳은 발견되지 않았다. 특히 `mcp-error-codes.spec.ts`(자체 userinfo 패턴 선-적용, §발견 3 참고)와 `execution-engine/sanitize-error-message.spec.ts`/`background-execution.processor.spec.ts`(DB 스킴 `CONNECTION_STRING_PATTERN` 이 신규 패턴보다 먼저 `[REDACTED_URI]` 로 치환)처럼, 신규 패턴이 실행되기 전에 이미 값이 치환되어 사실상 신규 패턴이 "닿지 않는" 경로도 확인했고 전부 그린이다.

## 발견사항

- **[WARNING]** bare JWT positive 커버리지가 단일 케이스(HS256, 3-세그먼트, 비-공백 서명)에 한정
  - 위치: `sanitize-error-message.spec.ts:51-57` (`masks a bare JWT (no Bearer prefix)`)
  - 상세: 정규식 `/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?/g` 은 서명 세그먼트가 optional 이라, `alg=none` 2-세그먼트 JWT(`eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0`, trailing dot 없음)도 매칭되도록 설계돼 있다. 직접 node 로 정규식만 떼어 검증한 결과 이 케이스와 쿼리스트링에 내장된 JWT(`?id_token=eyJ...&x=1`)도 정확히 마스킹된다 — 즉 현재 구현은 버그가 없다. 하지만 테스트는 오직 3-세그먼트 케이스만 pin 하고 있어, 향후 누군가 정규식을 "서명 필수"로 리팩터링해 2-세그먼트 `alg=none` JWT 를 놓치게 되는 회귀를 이 스위트가 잡아내지 못한다. `alg=none` 은 실제 보안사고 사례(JWT `alg=none` 우회)와 결부된 케이스라 회귀 방지 가치가 낮지 않다.
  - 제안: `it.each` 로 (a) 2-세그먼트 `alg=none` JWT, (b) 쿼리스트링에 내장된 JWT(`?id_token=eyJ...`) 최소 1-2개를 추가.

- **[WARNING]** FP 가드가 실무에서 자주 나오는 두 오탐 후보(IPv6 host, SSH shorthand)를 pin 하지 않음
  - 위치: `sanitize-error-message.spec.ts:74-81` (`it.each` FP 목록)
  - 상세: 직접 검증한 결과 `http://[::1]:8080/health`(IPv6 대괄호 host)와 `git@github.com:org/repo.git`(SSH shorthand, `scheme://` 없음)는 현재 둘 다 오탐하지 않는다(정상). 그러나 이 두 형태는 백엔드 로그·에러 메시지에 실제로 등장할 수 있는 케이스(내부 IPv6 인프라, git 기반 통합)인데 FP 가드 리스트에 없어 향후 정규식 조정 시 회귀를 못 잡는다. 또한 `https://user@host`(비밀번호 없이 username 만 있는 URL)도 현재 매칭되지 않는데(콜론 쌍이 없으므로), userinfo 패턴의 "user:pass 쌍"이라는 매칭 조건을 명시적으로 pin 하는 테스트는 없다.
  - 제안: `it.each` FP 목록에 `http://[::1]:8080/health`, `git@github.com:org/repo.git`, `https://user@host/path`(password 없음) 3개 추가.

- **[INFO]** `mcp-error-codes.ts` 의 기존 userinfo 패턴과 신규 SoT 패턴이 중복 — MCP 소비처는 이 커밋으로 실질적 신규 방어를 얻지 않음
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:47-51` (`MCP_EXTRA_SECRET_PATTERNS`, PR #842 에서 선행 도입)
  - 상세: `redactMcpSecrets` 는 `MCP_EXTRA_SECRET_PATTERNS`(자체 `scheme://user:pass@` 마스킹, 캡처그룹으로 스킴 보존)를 **공용 `SECRET_LEAK_PATTERNS` 보다 먼저** 적용한다. 따라서 신규 공용 userinfo 패턴이 MCP 경로에 도달할 때는 이미 자격증명이 `***` 로 치환된 뒤라 실질적으로 no-op 이다 — 직접 코드 추적 + 테스트 그린으로 확인. 커밋 메시지가 "전 소비처(...MCP redaction...) 가 함께 개선된다" 라고 서술하지만, MCP 는 이번 커밋 이전에도 이미 URI-userinfo 를 방어하고 있었다(net-new 혜택 아님). 이중 구현이 SoT 파편화(사용자 memory: "새로 구현 금지, 특수 케이스만 얇게 추가")에 해당하는지 여부는 별도 판단이 필요하나, 이번 diff 범위 밖의 pre-existing 코드이며 테스트 관점에서는 회귀·충돌 없음을 확인했다(치명적이지 않음, follow-up cleanup 후보로만 기록).
  - 제안: 필요시 별도 plan 항목으로 `MCP_EXTRA_SECRET_PATTERNS` 의 userinfo 서브패턴 제거 검토(스킴 보존이 필요하면 공용 패턴에 캡처그룹 추가 후 재사용). 이번 커밋 자체를 blocking 하는 사안은 아님.

- **[INFO]** 신규 URI-userinfo 패턴은 스킴까지 통째로 `***` 로 삼켜버리는데, 이 "스킴 소실" 동작이 assertion 으로 pin 되어 있지 않음
  - 위치: `sanitize-error-message.spec.ts:59-72` / `sanitize-error-message.ts:44-46`
  - 상세: 공용 패턴은 캡처그룹이 없어 `redactSecrets` 의 `masked.replace(pattern, '***')` 가 매치 전체(`https://admin:supersecret@`)를 `***` 로 치환한다. 실측: `"connect https://admin:supersecret@internal.example.com/path failed"` → `"connect ***internal.example.com/path failed"` (스킴 `https://` 자체가 사라짐). 반면 `mcp-error-codes.ts` 의 자체 패턴은 캡처그룹(`$1***@`)으로 스킴을 보존한다 — 같은 "URI userinfo 마스킹"이라는 목적에 대해 SoT 와 소비처 extra-pattern 간 마스킹 결과 형태가 다르다. 현재 테스트는 `not.toContain`/`toContain(host/path)` 만 확인해 이 비대칭을 검증하지 않는다. 보안상 문제는 아니며(더 보수적으로 마스킹) 회귀도 아니지만, 스킴 정보가 진단(어떤 프로토콜 연결이 실패했는지)에 유용할 수 있어 의도된 트레이드오프인지 명시적으로 pin 되면 좋겠다.
  - 제안: 스킴 보존이 의도라면 공용 패턴에도 캡처그룹을 추가하고 `toContain('https://')` 류 assertion 추가. 스킴 소실이 의도(단순함 우선)라면 주석에 한 줄 명시.

## 요약

신규 테스트 8개(positive 3 + `it.each` FP 4 + 기존 파일 구조상 자연 통합)는 각 패턴의 핵심 매칭/비매칭 논리를 정확히 검증하고 있고, 요청받은 12+2 소비처 회귀 스위트(shared SoT·thread-renderer·interaction.service·execution-engine sanitizer·mcp-error-codes·cafe24/makeshop client·integration-oauth) 및 인접 fixture 스펙(http-request handler·background-execution processor)까지 전부 그린이며, 백엔드 전체 스위트(400 suites/7946 tests)도 부작용 없이 통과한다. `not.toContain`/`toContain('***')` 류 assertion 은 실측으로 실제 마스킹 결과와 일치함을 직접 확인했고 "우연 통과"는 아니다. 다만 (1) bare JWT 의 `alg=none`/쿼리스트링 내장 변형, (2) IPv6/SSH-shorthand FP 후보가 정규식 자체는 정확히 처리하면서도 회귀 테스트로 pin 되어 있지 않은 커버리지 갭이 있고, (3) MCP 소비처는 이미 자체 패턴으로 방어 중이라 이번 SoT 확장의 실질 net-new 수혜자가 아니라는 점, (4) 공용 패턴이 URL 스킴까지 통째로 마스킹하는 동작이 assertion 으로 고정되지 않은 점을 확인했다. 모두 blocking 은 아니며 후속 강화 대상이다.

## 위험도

LOW
