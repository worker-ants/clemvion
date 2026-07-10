# Cross-Spec 일관성 검토 — URI-userinfo 마스킹 SoT 통합 (scheme-preserving refactor)

## 검토 스코프 정정 (payload 상 유의사항)

`_prompts/cross_spec.md` 에 임베드된 target 본문은 `spec/5-system/1-auth.md` 등 인증 spec 전체를
싣고 있어 이번 변경과 무관한 template anchor 로 판단된다. 실제 diff(`git diff origin/main...HEAD`)를
직접 확인해 아래 3개 실변경 파일을 기준으로 검토했다:

1. `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `SECRET_LEAK_PATTERNS` 의 URI-userinfo
   패턴을 `/\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/gi`(scheme+credential 전체 매치, `***` 로 통째 치환
   → `***`만 남고 scheme 소실) 에서 `/(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/gi`(lookbehind/lookahead 로
   `user:pass` 부분만 매치) 로 교체 — **scheme-preserving**(`scheme://***@host`).
2. `codebase/backend/src/modules/mcp/mcp-error-codes.ts` — MCP 전용으로 중복 유지하던 동형 userinfo 패턴
   (`MCP_EXTRA_SECRET_PATTERNS`)을 제거. `redactMcpSecrets` 는 이제 공용 `SECRET_LEAK_PATTERNS` 만으로
   동일 케이스를 커버(MCP 전용으로 남는 것은 bare `token=` 뿐).
3. `spec/5-system/11-mcp-client.md` §8.3 표 + Rationale 절을 위 코드 변경에 맞춰 갱신.

## 발견사항

검토한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 중 이 변경이 닿는 영역은
"계층 책임 충돌"(secret-redaction SoT 분할)과 "데이터 모델/계약 서술 정합"(§8.3 표의 `error.message`
마스킹 형태 서술) 뿐이다. 아래는 그 범위에서의 점검 결과다.

- **[INFO] `spec/5-system/11-mcp-client.md` 는 코드와 정합 — 신규 staleness 없음**
  - target 위치: `spec/5-system/11-mcp-client.md` §8.3 표(L481) + Rationale "에러 message redaction 은
    공용 패턴 재사용" 절(L587-589)
  - 충돌 대상: `codebase/backend/src/modules/mcp/mcp-error-codes.ts`,
    `codebase/backend/src/shared/utils/sanitize-error-message.ts`
  - 상세: §8.3 표는 "URL userinfo(scheme 보존 `scheme://***@host`)" + "MCP 전용 bare-token(`token=`) 패턴"
    으로 정확히 기술하고, Rationale 절은 "connect URL userinfo 패턴은 종전 MCP 전용이었으나 공용
    `SECRET_LEAK_PATTERNS` 가 흡수해 MCP 전용 목록에서 제거" 라고 명시한다. 코드 diff 를 대조하면:
    (a) `mcp-error-codes.ts` 의 `MCP_EXTRA_SECRET_PATTERNS` 에서 userinfo 패턴이 실제로 제거됨 — 남은
    항목은 bare `token=` 하나뿐, spec 서술과 일치. (b) `sanitize-error-message.ts` 의 신규 lookbehind/
    lookahead 패턴이 `scheme://***@host` 형태로 마스킹함을 `mcp-error-codes.spec.ts`(`expect(out).toContain(
    'https://***@mcp.example.com/rpc')`) 와 `sanitize-error-message.spec.ts` 양쪽 테스트로 실측 확인했고
    (jest 48 tests 전부 pass), spec 서술과 정확히 일치. (c) `redactMcpSecrets` 의 재사용 목록 서술("bearer
    토큰·Authorization 헤더·URL userinfo(scheme://***@host)·bare JWT·labelled secret")도 코드 주석·구현과
    1:1 대응. 코드-스펙 drift 없음.
  - 제안: 없음 (정보성 확인).

- **[INFO] 인접 spec 의 "URL userinfo" 언급은 이번 변경과 무관한 별도 메커니즘 — 혼동 유발 가능성만 낮게 존재**
  - target 위치: (참고용, target 외부) `spec/conventions/node-output.md` L302-304
    ("URL 내 임베디드 credential (`https://user:pass@host` → `https://host` 로 sanitize)"),
    `spec/4-nodes/4-integration/1-http-request.md` L24/L86/L181/L350 ("URL 내 `user:pass@host` → userinfo
    제거")
  - 충돌 대상: 없음 — 이 두 문서는 `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
    의 별도 함수 `sanitizeUrlCredentials`(HTTP Request 노드의 `NodeHandlerOutput.config` echo 전용, userinfo
    자체를 완전 제거)를 가리키며, 이번 diff 가 건드린 `shared/utils/sanitize-error-message.ts` 의
    `SECRET_LEAK_PATTERNS`(에러 메시지 sanitizer, userinfo 를 `***` 로 치환·scheme 보존)와는 다른 코드
    경로다. `sanitizeUrlCredentials` 는 이번 diff 에서 변경되지 않았고, 두 문서 모두 diff 대상 밖이라
    conflict 는 아니다.
  - 상세: 다만 두 함수가 "URL userinfo 를 마스킹한다" 는 동일 목적을 각자 다른 결과 형태(완전 제거 vs
    scheme-preserving `***`)로 구현하고 있어, 향후 이 영역을 다시 만지는 사람이 "MCP/error-message SoT
    통합" 선례를 보고 `sanitizeUrlCredentials` 도 같은 SoT 로 흡수해야 한다고 오인할 여지가 있다(실제로는
    config-echo 용도가 "완전 제거"를 요구하므로 의도적으로 다른 동작). 이번 PR 의 범위는 아니다.
  - 제안: 액션 불요. 추후 두 sanitizer 를 나란히 다루는 리팩터가 있을 때만 `node-output.md` Principle 7 에
    "config-echo 용 URL sanitize 는 error-message 용 `SECRET_LEAK_PATTERNS` 와 별개 SoT(완전 제거 vs
    scheme-preserving)" 한 줄 각주를 추가하는 정도로 충분.

## 요약

이번 변경은 `shared/utils/sanitize-error-message.ts` 의 URI-userinfo 마스킹을 scheme-preserving 으로
정밀화하고, `mcp-error-codes.ts` 에 중복 유지되던 동형 패턴을 제거해 공용 SoT 로 흡수한 리팩터 + 그에 맞춘
spec 동기화다. `spec/5-system/11-mcp-client.md` §8.3 표·Rationale 는 갱신된 코드 동작(패턴 위치·마스킹 형태
`scheme://***@host`·MCP 전용 잔여 항목이 bare `token=` 뿐이라는 점)을 정확히 반영하고 있으며, 실제 diff·
jest 테스트(48 tests pass, `expect(out).toContain('https://***@...')` 류 실측)로 대조한 결과 spec-code
drift 는 발견되지 않았다. 다른 영역(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC)에는 이 변경이 닿지
않는다. 유일한 저강도 관찰은 `node-output.md`/`1-http-request.md` 가 기술하는 별개의 URL-sanitize 함수
(`sanitizeUrlCredentials`, config echo 전용)가 이번 SoT 통합과 이름·목적이 유사해 향후 혼동 소지가 있다는
점인데, 이는 이번 diff 의 범위 밖이라 대응 불요다.

## 위험도

NONE
