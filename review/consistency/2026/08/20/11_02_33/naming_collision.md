STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 0 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, diff-base=`origin/main`)

## 대상 diff 요약

`origin/main...HEAD` 범위(커밋 `45ba37792`, `e2193f8a6`)에서 실제 코드/spec 변경은
`spec/5-system/{2-api-convention,11-mcp-client,14-external-interaction-api}.md` 3개 spec
파일과 `codebase/backend/src/{modules/mcp/mcp-error-codes.ts, modules/websocket/websocket.service.ts,
shared/utils/sanitize-error-message.ts}` + 대응 `*.spec.ts` 뿐이다. 나머지 diff(CHANGELOG,
`plan/in-progress/*.md`, `review/**`)는 문서·산출물이며 신규 식별자를 도입하지 않는다.
내용은 `token` 계열(bare `token` + `access_token`/`csrf_token`/`csrfToken`/`x-auth-token`
등 접두형) secret 마스킹 정규식을 값·키 두 축에서 통합하고, 그에 따른 spec 인용을
정정한 것이다. `git diff origin/main...HEAD --name-status`(spec+backend 8파일)는 전부
`M`(modify)이며 `A`(add)/`R`(rename)은 0건 — 신규 파일 자체가 없다.

## 관점별 확인

1. **요구사항 ID 충돌** — 없음. `EIA-NX-03`(문구만 수정, ID 불변)·`R12`(캐비엇 단락
   추가)·`R17`(캐비엇 단락 추가) 등 기존 ID 를 재사용했을 뿐 신규 `EIA-*`/`WH-*`/`CCH-*`
   요구사항 ID 가 부여되지 않았다.

2. **엔티티/타입명 충돌** — 없음.
   - 코드 diff 는 `CREDENTIAL_KEY_PATTERN`(기존 상수, `sanitize-error-message.ts` ·
     `websocket.service.ts` 두 자리 "의도된 미러" — 동일 이름 유지)과 `SECRET_LEAK_PATTERNS`
     (기존 상수)의 정규식 리터럴만 확장했다. `MCP_EXTRA_SECRET_PATTERNS` 는 기존 상수명
     그대로 두고 배열 값만 비웠다(신규 명 아님) — `codebase/backend/src/modules/mcp/mcp-error-codes.ts:54`.
   - spec 쪽 `hmacAlgorithm` → `AuthConfig.config.algorithm` 인용 정정은 **신규 필드 도입이
     아니라** 이미 `spec/5-system/12-webhook.md:223-229`(`config.algorithm`,
     `HMAC-{config.algorithm}(...)`)에 확립된 기존 필드를 정확히 재인용한 것 — 다른 의미로
     겹치는 재사용이 아님을 직접 grep 으로 재확인했다.

3. **API endpoint 충돌** — 없음. `2-api-convention.md §2.2` 에 추가된 표 행("예외 — 인증
   family 전용 네임스페이스")은 `/api/external/{resource}` 를 **신규 endpoint 로 선언하지
   않고**, 이미 `14-external-interaction-api.md:1155,1307`(§R11)·§6/§7 rate-limit 표에
   존재하던 "인증 family 분리" 패턴을 URL 구조 규칙 절에 뒤늦게 명시한 것이다. "인증
   family" 용어 자체도 같은 문서에서 이미 쓰던 표현과 일치함을 확인했다.

4. **이벤트/메시지명 충돌** — 없음. `§11` 표에 추가된 `execution.stop`/`execution.start`
   행의 `_(WS 명령 §4.2 won't-do)_` 주석은 신조어가 아니라 같은 저장소의
   `spec/5-system/6-websocket-protocol.md:820-821` 에 **이미 동일 문구**로 존재하는 매핑을
   EIA 문서의 자매 표(§11)에 미러링한 것 — 두 "권위 표"가 어긋나 있던 것을 정정한 것이지
   새 이벤트가 아니다(직접 grep 으로 두 표 문구 일치 재확인).

5. **환경변수·설정키 충돌** — 없음. 신규 ENV var·config key 도입 없음. 정규식 리터럴
   확장(`[A-Za-z0-9_-]*token` / `[a-z0-9_-]*token`)만 있고 상수·설정 키 이름은 그대로다.

6. **파일 경로 충돌** — 없음. 신규 spec 파일·신규 소스 파일 경로가 생성되지 않았다
   (전부 기존 파일의 `M`odify). `plan/in-progress/eia-secret-pattern-token-family.md` 는
   PLAN 문서이고 `spec/` 이 아니라 명명 컨벤션·충돌 대상 밖이다.

## 참고로 확인한 잠재 이슈 (범위 외)

`[A-Za-z0-9_-]*token` 확장 정규식이 `nextPageToken`(불투명 커서) 같은 무해한 키도
마스킹하는 것은 diff 자체에 캐너리 테스트로 명시적으로 기록된 **의도된 트레이드오프**이지
신규 식별자가 기존 식별자와 다른 의미로 충돌하는 사안이 아니다 — 본 관점(신규 식별자
충돌) 밖으로 판단해 findings 에 올리지 않았다.

### 발견사항

없음.

### 요약

이번 PR(`45ba37792` + 후속 `e2193f8a6`)은 `token` 계열 secret 마스킹 정규식(값 축·키 축)을
`sanitize-error-message.ts`(값/키 패턴)·`websocket.service.ts`(키 패턴) 세 자리에서
통합하고 `mcp-error-codes.ts` 의 잉여 대안을 흡수 제거했으며, 그에 맞춰
`spec/5-system/{11-mcp-client,14-external-interaction-api,2-api-convention}.md` 세 곳의
인용·표를 정정한 순수 정합화 작업이다. 신규 요구사항 ID·엔티티/타입명·API endpoint·
이벤트명·ENV var·spec/코드 파일 경로 중 어느 것도 새로 만들어지지 않았고, spec 표에 새로
추가된 행("인증 family 전용 네임스페이스", `execution.start`/`execution.stop` WS 매핑,
`AuthConfig.config.algorithm` 출처 정정)은 모두 같은 문서군 안에 이미 확립돼 있던
식별자·용어를 재사용하거나 정확히 재인용한 것이라 충돌 소지가 없다. 이 결론은 직전
`review/consistency/2026/08/17/14_00_50/naming_collision.md`(동일 결론, NONE)와도 일치하며,
그 사이 추가된 후속 커밋(`e2193f8a6`)도 테스트·문서 보강일 뿐 새 식별자를 도입하지 않는다.

### 위험도
NONE
