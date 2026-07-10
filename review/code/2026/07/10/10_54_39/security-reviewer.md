# 보안 코드 리뷰 — HEAD `90ab8f390`

리뷰 대상: `refactor(shared·mcp): URI-userinfo 마스킹을 공용 SoT 로 통합`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`
- `codebase/backend/src/modules/mcp/mcp-error-codes.ts`
- 관련 spec: `spec/5-system/11-mcp-client.md`

검증 방법: 정적 분석 + Node 24 REPL 실측(패턴 동치성·FP/FN 케이스) + perf 실측(ReDoS) + 기존 jest suite 재실행(behavior-preserving 확인). 모두 read-only.

## 발견사항

- **[INFO]** scheme 이 비-MCP 소비처에서 신규로 노출됨 (의도된 트레이드오프, credential 노출 아님)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:47-51` (`SECRET_LEAK_PATTERNS` 마지막 엔트리)
  - 상세: 종전 공용 패턴은 `scheme://user:pass@` 전체를 whole-mask 했다(`***host`, scheme 도 숨김). 신규 패턴은 lookbehind/lookahead 로 `user:pass` 자격증명만 마스킹해 `scheme://***@host` 형태로 scheme 이 그대로 남는다. MCP 는 원래도 scheme 을 노출했으므로 MCP 소비처엔 변화가 없지만, `redactSecrets`/`SECRET_LEAK_PATTERNS` 를 직접 쓰는 **비-MCP 소비처**(conversation-thread `thread-renderer.ts`/`ai-turn-orchestrator.service.ts`, `execution-engine/sanitize-error-message.ts`, cafe24/makeshop 클라이언트의 `sanitizeLastErrorMessage`)는 이 커밋으로 scheme(예: `postgres://`, `redis://`, `mongodb+srv://`)이 처음 노출되게 된다. host 는 종전에도 노출되었으므로 실질 신규 노출은 "scheme 문자열"뿐이며, username/password 자격증명은 여전히 완전 마스킹된다(아래 실측 재현 참고). 커밋 메시지·spec §8.3 에 의도된 변경으로 문서화되어 있어 은닉된 회귀는 아니나, conversation-thread turn text 는 사용자 대면(user-visible history)이라는 코드 주석(`sanitize-error-message.ts:60-62`)을 감안하면 "어떤 종류의 백엔드(DB/캐시/큐)에 연결 시도했는지"가 사용자에게 노출될 수 있다는 점은 인지해 둘 필요가 있다.
  - 재현(Node 24):
    ```js
    const NEW = /(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/gi;
    const OLD = /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/gi;
    'connect https://admin:supersecret@internal.example.com/path failed'.replace(NEW,'***')
    // → 'connect https://***@internal.example.com/path failed'  (scheme 노출)
    'connect https://admin:supersecret@internal.example.com/path failed'.replace(OLD,'***')
    // → 'connect ***internal.example.com/path failed'           (scheme 도 은닉, 종전)
    ```
  - 제안: 조치 불필요(의도된 설계, 자격증명 미노출 확인됨). 다만 conversation-thread 등 순수 사용자 대면 sink 에서 scheme 노출이 정책상 문제라면 별도 후속 검토 대상으로 인지만 해 둘 것.

- **[INFO]** `mcp-error-codes.ts` 주석이 코드 변경을 반영하지 못해 stale
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:65-66`
  - 상세: `redactMcpSecrets` 함수 상단 JSDoc 이 "위 `{@link MCP_EXTRA_SECRET_PATTERNS}` (URL userinfo·bare token)만 MCP 전용으로 얹는다" 라고 서술하지만, 실제 `MCP_EXTRA_SECRET_PATTERNS`(41-52행)에는 이번 커밋으로 URL-userinfo 패턴이 제거되어 `bare token=` 하나만 남아 있다. 같은 파일 39-47행의 배열 상단 주석은 정확히 갱신되었으나(2026-07-10 항목 추가), 65-66행의 함수 레벨 주석은 갱신되지 않은 반쪽 정정이다. 보안 민감 SoT 문서(secret-redaction 로직)에서의 comment drift 는 향후 유지보수 시 "MCP 가 URL-userinfo 를 여전히 커버한다"는 잘못된 전제로 공용 패턴을 실수로 되돌리거나 중복 재도입하는 등의 혼선을 유발할 수 있다.
  - 제안: 65-66행을 "위 `{@link MCP_EXTRA_SECRET_PATTERNS}`(bare token)만 MCP 전용으로 얹는다"로 정정 (기능 변경 없음, 문서 정합성만).

- **[INFO]** 기존에도 존재하던 미해결 FN — 자격증명(password)에 리터럴 `@` 포함 시 부분 노출 (이번 커밋으로 인한 회귀 아님, 개선도 아님)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:51`, 종전 `mcp-error-codes.ts` 의 삭제된 MCP 전용 패턴과 동일한 한계
  - 상세: 두 패턴 모두 password 문자 클래스가 `[^/\s@]+`(첫 `@` 에서 정지)이므로, RFC 3986 상 원칙적으로 percent-encode 해야 하는 리터럴 `@` 가 비인코딩 상태로 자격증명에 포함되면 첫 `@` 이후 나머지가 일반 텍스트로 남아 노출된다.
  - 재현: `'ftp://USER:P@ss1@host'` → 신규/구-MCP 패턴 모두 동일하게 `'ftp://***@ss1@host'` (password 뒷부분 `ss1` 이 텍스트로 노출). 종전 whole-mask 공용 패턴도 `'***ss1@host'` 로 동일하게 tail 노출 — 세 패턴 모두 동일한 한계를 공유하므로 이번 diff 로 인한 새로운 회귀는 아니다.
  - 제안: 조치 불필요(behavior-preserving 범위 밖, 별도 백로그로만 고려).

- **[INFO]** 기존에도 존재하던 over-masking 케이스 — 라벨드 키워드가 URI username 위치에 오면 host/path 까지 통째로 마스킹 (이번 커밋과 무관, pattern 순서·내용 불변)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:37,39` (labelled-kv, bare-`secret` 패턴 — 이번 diff 에서 미변경)
  - 상세: `SECRET_LEAK_PATTERNS` 배열에서 라벨드 kv 패턴(`password|passwd|pwd|secret|...`)이 URI-userinfo 패턴보다 먼저 실행된다. URI 의 username 부분이 우연히 `password`/`secret`/`access_token`/`api_key` 등의 리터럴이면(`https://password:pass123@host/path`), value 문자클래스(`[^\s&'"]+`)가 `/`·`@` 를 제외하지 않아 값 부분이 나머지 문자열 전체(`pass123@host/path`)를 그리디하게 삼켜 `https://***` 로 host/path 까지 사라진다. 자격증명 노출은 아니고(오히려 더 마스킹) 진단 정보 손실 방향의 부작용이며, 이 패턴들의 정의·순서는 이번 커밋에서 변경되지 않았으므로 회귀는 아니다.
  - 제안: 조치 불필요(정보 유출 방향 아님). 참고로만 기록.

- **[정보/확인 완료]** ReDoS·lookbehind 런타임 이슈 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:51`
  - 상세: 신규 패턴 `/(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/gi` 는 lookbehind 가 고정폭(`:\/\/`, 3자)이고, 두 캡처 구간이 서로 disjoint 한 negated 문자클래스(각각 `:`/`@` 를 배타적으로 취급)라 백트래킹이 각 세그먼트에서 최대 1회 선형으로만 발생 — 중첩 quantifier/양의 lookahead 반복 조합에 의한 지수적 폭발 구조가 없다. Node v24.15.0 에서 최대 2,000,003 자 적대적 입력(닫는 `@` 없음, `:` 반복, `://` 다중 등 6종) 실측 결과 모두 **5ms 이내**로 완료(선형 시간 확인). lookbehind(`(?<=:\/\/)`)는 Node 9+/V8 62+ 에서 안정 지원되며 실제 실행도 정상 동작 확인.
  - 재현: `node` 로 `'x'.repeat(1e6)+'://'+' a'.repeat(1e6)`, `'https://'+'a:'.repeat(5e5)+'end'` 등 6개 케이스 실행 — 모두 2.2~4.8ms.

- **[정보/확인 완료]** behavior-preserving 주장 검증 — MCP 전용 패턴 제거는 실측상 no-regression
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:41-52` (삭제), `sanitize-error-message.ts:51` (대체)
  - 상세: 종전 MCP 전용 패턴 `/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi → '$1***@'` 과 신규 공용 패턴을 15개 케이스(정상 URL, IPv6 host, jdbc 중첩 scheme, password 내 콜론, 다중 URL, 빈 username/password, scheme 없는 SSH 축약형 등)로 직접 비교 실행한 결과 **모든 케이스에서 최종 출력 문자열이 완전히 동일**했다. 유일한 차이는 신규 패턴이 scheme 문자열 검증(`\b[a-z][a-z0-9+.-]*`)을 하지 않아 `1abc://user:pass@host`, `" ://user:pass@host"` 같은 비표준 scheme 도 추가로 매칭한다는 점인데, 이는 매칭 범위가 넓어진 것(더 많이 마스킹)이라 자격증명 하-마스킹(under-masking) 방향의 회귀가 아니다. MCP 처리 순서 변화(EXTRA 먼저 실행 → 공용 loop 마지막 실행)에 대해서도, 앞선 공용 패턴(Bearer/labelled-kv/Authorization/bare-JWT)이 URI 세그먼트를 부분적으로 먼저 소비하는 시나리오를 직접 구성해 테스트했으나 credential 이 새어나가는 경우는 발견되지 않았다(라벨드 키워드가 username 자리에 오는 경우는 오히려 과대 마스킹, 위 INFO 항목 참고). jest 로 `sanitize-error-message.spec.ts`(2 suite) + `mcp-error-codes.spec.ts` + `thread-renderer.spec.ts` + `integration-oauth.service*.spec.ts` 실행 결과 **총 209 tests 전부 통과**.

## 요약

이번 변경은 URI-userinfo 자격증명 마스킹 로직을 whole-mask 에서 scheme-preserving(lookbehind/lookahead) 방식으로 통합하고 중복 MCP 전용 패턴을 제거하는 리팩터링으로, 실제 자격증명(username/password)은 신규 패턴에서도 예외 없이 완전히 마스킹되며 credential 이 새어나가는 회귀 케이스는 실측(동치성 비교·jest 재실행·adversarial FP/FN 케이스)에서 발견되지 않았다. ReDoS 우려도 실측상 근거 없음(단순 negated-class 연쇄로 구조적으로 선형 시간이며, 2M자 적대적 입력에서도 5ms 이내). 유일한 실질 노출 증가는 scheme 문자열(예: `postgres://`, `redis://`)이 비-MCP 소비처(conversation-thread 등)에도 처음 노출된다는 점인데 이는 host 가 이미 노출되던 것과 같은 급의 저위험 정보이며 commit/spec 에 의도적으로 문서화되어 있다. 발견된 이슈는 모두 INFO 수준(신규 노출 인지, stale 주석 정정 권고, 기존부터 있던 FN/과대마스킹 한계 재확인)이며, 새로 도입된 CRITICAL/WARNING 급 취약점은 없다.

## 위험도

LOW
