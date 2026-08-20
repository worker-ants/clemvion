# 요구사항(Requirement) 충족 리뷰 — `token` 계열 값·키 패턴 마스킹 + EIA 저비용 문서 3건

## 검증 방법

diff 를 정적으로 읽는 것에 더해, 다음을 실제로 실행해 검증했다:

- `mcp-error-codes.spec.ts`(8건) · `sanitize-error-message.spec.ts`(67건) · `websocket.service.spec.ts`(110건) ·
  `mcp`/`websocket`/`external-interaction` 모듈 전체(31 suites/591 tests) — 전부 GREEN.
- `[A-Za-z0-9_-]*token` 신규 대안이 옛 3-대안(`access[_-]token|refresh[_-]token|id[_-]token`)을 실제로
  흡수하는지 Node 정규식 직접 실행으로 대조(8개 family 멤버 전수).
- 캐너리 오탐 경계(`tokenizer=lodash`) 가 정규식 backtracking 상 실제로 매치되지 않음을 직접 추적.
- **뮤테이션 재실행**(값-패턴/키-패턴 각각 옛 정규식으로 되돌려 실제 RED 개수 측정 후 `git checkout --`
  으로 원복·재확인 GREEN) — 값-축은 plan 주장과 일치, 키-축은 불일치(아래 발견사항 참조).
- spec 교차 인용 3건(`triggers.service.ts:634` strip, `V066__trigger_config_strip_inline_auth.sql` 존재,
  `12-webhook.md:167`/`spec/1-data-model.md:644` `AuthConfig.config.algorithm`, `6-websocket-protocol.md`
  §4.6 authoritative 표)을 실제 파일에서 직접 대조.

## 발견사항

- **[WARNING]** plan 의 뮤테이션 검증 수치(키-축)가 실측과 다르다 — 8 RED 로 기록했으나 재실행하면 5 RED
  - 위치: `plan/in-progress/eia-secret-pattern-token-family.md:118`
  - 상세: 체크리스트가 "**뮤테이션 검증**: 값-축 되돌리면 **6 RED**, 키-축 되돌리면 **8 RED**" 라고 완료
    근거로 적어 뒀다. `sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`[1]을 옛 정규식으로 되돌려
    재실행하면 **정확히 6 RED**(plan 주장과 일치, `it.each` FAMILY 5건 + 따옴표/쿼리스트링 1건). 그러나
    같은 파일의 `CREDENTIAL_KEY_PATTERN` 을 옛 정규식으로 되돌려 재실행하면 **5 RED**(`it.each` FAMILY
    중 `id_token`/`csrf_token`/`csrfToken`/`session_token` 4건 + 캐너리 `nextPageToken` 1건) 이지 8 RED
    가 아니다 — `token`/`access_token`/`refresh-token`/`x-auth-token` 4건은 옛 정규식도 이미 잡고 있어
    (bare `token` 과 `access[_-]?token`/`refresh[_-]?token`/`x[_-]auth[_-]?token` 이 이미 옛 목록에
    있었음) 되돌려도 RED 가 되지 않는다. 코드 자체는 정확하다(뮤테이션이 실제로 5개 회귀를 잡아낸다는
    점은 유효) — 다만 완료 근거로 기록된 "8" 이라는 숫자가 실측과 다르다.
  - 제안: 기능적 결함은 아니므로 코드 수정은 불필요. plan 체크리스트 항목의 "8 RED" 를 "5 RED" 로
    정정하거나(자체 재실측), 왜 8로 셌는지(예: websocket.service.ts 쪽 mirror 도 포함해 세는 의도였다면
    그쪽엔 대응 `it.each` 테스트가 없으므로 그 의도라도 현재는 뒷받침되지 않음) 근거를 보완.

## 확인된 항목 (문제 없음)

- **기능 완전성**: 값-패턴(`SECRET_LEAK_PATTERNS`)·키-패턴(`CREDENTIAL_KEY_PATTERN` ×2, sanitize-error-message.ts
  + websocket.service.ts)·MCP 하위 훅(`MCP_EXTRA_SECRET_PATTERNS`) 전부 `token` 계열(`token`·`access_token`·
  `refresh-token`·`id_token`·`csrf_token`·`csrfToken`·`session_token`·`x-auth-token`)을 동일하게 커버.
  옛 3-대안(`access[_-]token|refresh[_-]token|id[_-]token`)이 새 대안에 완전히 흡수됨을 직접 정규식
  실행으로 확인(8/8 일치).
- **엣지 케이스**: 오탐 경계 캐너리(`tokenizer=lodash`, `tokenized text here`)가 실제로 매치되지 않음을
  정규식 엔진 동작(backtracking)까지 추적해 확인 — `\b` 앵커가 중간 위치에서 성립하지 않아 스캔이 시작
  조차 안 됨. `maxTokens`/`tokenId` 류(끝이 `token` 이 아닌 식별자)는 앵커(`^...$`)가 전체 매치를 요구해
  마스킹되지 않음(잠재적 실사용 오탐을 정확히 피함).
- **TODO/FIXME**: 신규/변경 코드(5개 backend 파일) 전체에 TODO/FIXME/HACK/XXX 없음.
- **의도와 구현 간 괴리 없음**: `mcp-error-codes.ts` JSDoc "이 함수는 사실상 공용 SoT 의 얇은 래퍼다" ↔
  실제로 `MCP_EXTRA_SECRET_PATTERNS = []` 이고 루프가 no-op. `websocket.service.ts` 주석 "함께 갱신한다"
  ↔ 실제로 두 `CREDENTIAL_KEY_PATTERN` 이 `token` 계열 축에서 동형으로 갱신됨(단, `x[_-]api[_-]?key` 비대칭은
  이 PR 이전부터 존재하던 것으로 이번 변경과 무관 — 이미 `13_31_57` consistency 리뷰가 INFO로 등재해 뒀음).
- **회귀 없음(blast radius)**: `mcp`/`websocket`/`external-interaction` 모듈 31 suites / 591 tests 전원
  GREEN. `triggers.service.spec.ts`(`interaction.triggerToken` 관련) · `interaction.guard.spec.ts` 도 GREEN
  — 키 패턴이 `triggerToken` 도 새로 매치하게 됐지만 그 필드는 DB 저장 경로 전용이라 egress 마스킹
  경로를 거치는 기존 테스트에 영향 없음.
- **spec fidelity**: `spec/5-system/11-mcp-client.md` §8.2/§8.3/Rationale 이 "MCP 전용으로 남는 것은 bare
  `token=` 뿐" → "**전부** 공용, MCP 전용 추가 패턴은 없다" 로 정확히 갱신되고 2026-08-17 캐비엇이
  근거(무수정 프로브 동치·8건 GREEN)까지 명시. `14-external-interaction-api.md` EIA-NX-03/§9.3 R12 의
  `hmacAlgorithm` 출처가 `AuthConfig.config.algorithm` 으로 정정된 것은 `triggers.service.ts:634`(strip)·
  `V066__trigger_config_strip_inline_auth.sql`(실재)·`12-webhook.md:167`·`spec/1-data-model.md:644`
  (`config.algorithm` 필드 실재) 전부와 line-level 로 일치. §11 `execution.stop`/`execution.start` 행의
  `_(WS 명령 §4.2 won't-do)_` 각주가 §5.1(line 300)·WS `6-websocket-protocol.md` §4.6(line 820, 자기
  선언 권위 표)과 세 표 모두 동일 문구로 일치. `2-api-convention.md §2.2` 신설 행이 `/api/external/*` 를
  별도 인증 family 로 정확히 서술.
- **비즈니스 로직**: MCP 전용 훅 배열을 비우되 구조는 유지(제3자 MCP 서버가 공용이 모르는 형태를 반환할
  가능성에 대비)한 설계는 2026-07-10 URL-userinfo 흡수 때와 동일 절차 — plan·spec·코드 3자가 일관되게
  같은 이유를 든다. `maskSensitiveFields`(axis #4, workflow-assistant 소유)를 의도적으로 건드리지 않은
  범위 결정도 spec-sync 트래커(file 7)에 정확히 반영되고 sibling 항목에 증거만 추가됨(우회 없음).
- **반환값/에러 시나리오**: 변경된 함수(`redactMcpSecrets`/`sanitizeMcpErrorMessage`/`redactSecrets`/
  `deepRedactSecrets`) 모두 기존 non-string/null 가드 로직에 손대지 않았고 모든 경로에서 값을 반환.

## 요약

핵심 보안 결함(값-축·키-축 두 곳에서 `token` 접두 계열이 마스킹 없이 새고 있던 문제)을 공용 SoT
정규식 한 곳(값)·두 곳(키, 의도된 미러)에서 일관되게 닫았고, 옛 3-대안을 신규 패턴이 완전히 흡수함을
직접 실행으로 재확인했다. MCP 전용 보충 패턴이 잉여가 된 사실을 이번 PR 이 스스로 포착해 코드·spec
양쪽에서 동일 절차(2026-07-10 선례)로 흡수 처리했고, 세 spec 문서 정정(hmacAlgorithm 출처·§11 won't-do
각주·§2.2 인증 family)도 근거 문서와 line-level 로 일치한다. 회귀는 관련 31 suites/591 tests 전원
GREEN 으로 확인됐다. 유일한 흠은 기능 결함이 아니라 plan 체크리스트에 기록된 "키-축 되돌리면 8 RED"
라는 완료 근거 수치가 재실측 결과(5 RED)와 다르다는 점 — 코드는 옳고 self-report 만 부정확하다.

## 위험도

LOW — 실질 코드 결함 없음(전 항목 재현·재실행으로 확인). 유일 발견은 plan 문서의 완료-근거 수치
부정확(비차단, 문서 정정 권장).
