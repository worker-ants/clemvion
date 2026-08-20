# 요구사항(Requirement) 충족 리뷰 — `token` 계열 값·키 패턴 마스킹 + EIA 저비용 문서 3건 (재검토, `11_01_55`)

## 검증 방법

diff 를 정적으로 읽는 것에 더해 다음을 직접 실행해 재검증했다 (이 세션 기준 fresh 실측, 이전
`14_00_15`/`14_00_50` 라운드의 재확인이 아니라 독립 재현):

- `sanitize-error-message.spec.ts` · `websocket.service.spec.ts` · `mcp-error-codes.spec.ts` 3파일을
  `npx jest` 로 직접 실행 → **3 suites / 124 tests 전원 GREEN**.
- 두 정규식(`SECRET_LEAK_PATTERNS`[1], `CREDENTIAL_KEY_PATTERN` ×2)을 Node 로 직접 실행해
  `tokenizer=lodash`(보존) · `csrf_token=…`(마스킹) · `cb?token=…&state=x`(값만 마스킹,
  `state=x` 보존) · `nextPageToken`(마스킹) · `x-auth-token`(마스킹) 을 재현.
- **뮤테이션 재실행**: `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 을 이 PR 직전 정규식으로
  되돌려 `websocket.service.spec.ts` 를 실행 → **2 RED**(`csrf_token`/`session_token`/`csrfToken`
  류 캐너리 실패 1건 + `nextPageToken` 오탐 캐너리 1건), 나머지 47건 GREEN. 원본 파일은 `cp` 로
  복원 후 `git status` 로 클린 확인 — RESOLUTION.md WARNING 1 의 "2 RED" 주장과 정확히 일치.
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/11-mcp-client.md` §8.2/§8.3,
  `spec/5-system/2-api-convention.md` §2.2 를 직접 열어 코드·plan 서술과 line-level 대조.
- `redact-stored-error.spec.ts` 에 `token` 문자열이 정말 없는지 grep 으로 확인 — plan/CHANGELOG 의
  "그 캐너리는 연결 문자열을 고정하며 `token` 이 한 건도 없다" 주장 재확인.
- `mask-sensitive-fields.util.ts` 가 이번 diff 에서 정말 무변경인지 `git diff origin/main...HEAD`
  로 확인(37개 변경 파일 중 미포함) — "범위 결정 #4 는 닫지 않는다" 주장 재확인.
- `interaction.guard.ts`/`interaction-token.service.ts`/`triggers.service.ts` 가 마스킹 유틸
  (`redactSecrets`/`deepRedactSecrets`/`CREDENTIAL_KEY_PATTERN`)을 import 하지 않음을 확인 — 키
  패턴 확장이 `triggerToken` 인증 경로(별도 스토리지 필드, egress 마스킹과 무관)에 영향을 주지
  않음을 재확인.

## 발견사항

이번 라운드에서 코드·spec·테스트 레벨의 새로운 Critical/Warning 은 발견하지 못했다. 이전
`14_00_15` 라운드에서 지적됐던 항목(WS 미러 회귀 테스트 부재·JSDoc 자기모순·CHANGELOG 관행
이탈·주석 컨벤션 불일치·뮤테이션 수치 오류)은 이 diff 시점에 이미 `RESOLUTION.md` 를 통해
수정 완료돼 있고, 위 재실행 검증으로 그 수정이 실제로 유효함을 직접 확인했다(예: WS 미러
뮤테이션이 이제 2 RED 를 낸다 — 이전엔 0 RED 였다는 것도 `RESOLUTION.md` WARNING 1 이 이미
같은 방식으로 실증해 뒀다).

- **[INFO]** ReDoS 회귀를 고정하는 자동 벤치마크가 여전히 커밋되지 않음 (기존 `14_00_15` testing.md
  INFO 의 재확인 — 선택 항목으로 남겨 둔 채 이번 라운드까지 그대로)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS`
    (값 패턴 `[A-Za-z0-9_-]*token` 대안)
  - 상세: plan 체크리스트("ReDoS 벤치마크 — 2배씩 늘려 배율 정확히 2배")는 1회성 수기 측정으로
    보이고, 세 spec 파일 어디에도 이를 고정하는 서브프로세스+timeout 형태의 자동 회귀 테스트가
    없다. 패턴 자체가 단일 `*` + 리터럴이라 구조적으로 이차 백트래킹 위험은 낮고(직접 확인:
    중첩 정량자 없음), `RESOLUTION.md` INFO 처분에서도 "패턴이 단일 `*`+리터럴이라 회귀 위험이
    낮다"는 이유로 의도적으로 유예됐다 — 기능 결함이 아니라 안전망 강화 여지.
  - 제안: 조치 불요(이미 라운드 내 명시적 유예 결정). 향후 이 정규식에 정량자가 추가되는 형태로
    다시 넓어질 때를 대비해 캐너리를 추가하면 안전망이 된다.

## 확인된 항목 (문제 없음)

- **기능 완전성**: 값-패턴(`SECRET_LEAK_PATTERNS`)·키-패턴(`CREDENTIAL_KEY_PATTERN` ×2)·MCP 훅
  (`MCP_EXTRA_SECRET_PATTERNS`)이 `token` 계열(`token`·`access_token`·`refresh-token`·`id_token`·
  `csrf_token`·`csrfToken`·`session_token`·`x-auth-token`)을 값 축·키 축 양쪽에서 동일하게
  커버함을 직접 정규식 실행 + 전체 회귀 테스트(124 tests)로 확인. 옛 3-대안
  (`access[_-]token|refresh[_-]token|id[_-]token`)이 새 패턴에 진짜 상위집합으로 흡수됨(축소
  없음).
- **엣지 케이스**: `tokenizer=lodash`(값 축)·`tokenizer` 키(키 축)가 보존되는 것을 직접 재현.
  `\b` 앵커/`^...$` 앵커가 "token 으로 끝나는" 경계를 정확히 강제함을 재확인. 빈 문자열/
  non-string 입력에 대한 기존 가드(`typeof raw !== 'string'`)는 이번 diff 로 손대지 않음.
- **TODO/FIXME**: 신규·변경 코드 5개 backend 파일 전체에 TODO/FIXME/HACK/XXX 없음.
- **의도와 구현 간 괴리 없음**: `mcp-error-codes.ts` JSDoc "이 함수는 사실상 공용 SoT 의 얇은
  래퍼다" ↔ `MCP_EXTRA_SECRET_PATTERNS = []`(빈 배열, no-op 루프) 정확히 일치.
  `websocket.service.ts` 신규 주석 "미러의 범위는 자격증명 키 계열까지다 … `x-api-key` 는
  동기화 대상이 아니다"라는 명시적 스코프 한정이 `sanitize-error-message.ts` 쪽 JSDoc
  ("`x-api-key` 하나만 REST 전용 확장")과 상호 모순 없이 정합함(이전 라운드에서 지적된
  자기모순은 이번 diff 시점에 이미 해소돼 있음을 직접 두 파일을 열어 재확인).
- **에러 시나리오/반환값**: 변경된 4개 함수(`redactSecrets`/`deepRedactSecrets`/
  `redactMcpSecrets`/`sanitizeMcpErrorMessage`)는 모두 기존 non-string/null 가드를 그대로 유지,
  모든 경로에서 문자열(또는 원본 무변형 값)을 반환.
- **데이터 유효성**: 정규식 확장은 기존 입력 검증 로직에 영향 없음 — egress 마스킹은 입력
  유효성 게이트가 아니라 표시 전 치환이라 이 관점에서 별도 검증 요구사항 없음.
- **비즈니스 로직**: "범위 결정 #4(`maskSensitiveFields`)는 닫지 않는다"는 plan 의 명시적 결정이
  실제 diff 에서도 그대로 지켜짐(`git diff --stat` 확인 결과 `mask-sensitive-fields.util.ts` 무변경).
  MCP 훅을 완전히 삭제하지 않고 빈 배열로 남긴 설계(제3자 MCP 서버의 미지 형태 대비)도
  2026-07-10 URL-userinfo 흡수 선례와 동일 절차로 일관됨.
- **spec fidelity**: `14-external-interaction-api.md` §R17 이 "`token` 계열 확장(2026-08-17)…
  다만 이 확장은 잔여 ③ 에 미치지 않는다 — `maskSensitiveFields` 의 키 목록은 리터럴 나열이라
  접두 계열이 아직 통과한다"는 캐비엇을 정확히 담고 있음을 직접 확인(구현이 spec 보다 넓다고
  주장하지 않도록 스코프를 정확히 한정) — `RESOLUTION.md` 의 consistency WARNING 1 반영 결과와
  line-level 로 일치. `11-mcp-client.md` §8.3/Rationale 의 "2026-08-17 갱신 — 훅이 비었다" 단락도
  실제 코드(`MCP_EXTRA_SECRET_PATTERNS = []`, `redactMcpSecrets` 구현)와 정확히 대응.
  `2-api-convention.md:54` 의 `/api/external/*` 인증 family 예외 행도 SoT 상호참조(§14/§7/§5.4)와
  정합.
- **회귀 없음**: 관련 3 spec 파일 124 tests 전원 GREEN(이 세션 직접 실행). 뮤테이션으로 WS 미러의
  안전망이 실제로 작동함(2 RED)을 재확인 — 이전 라운드가 지적한 "미러 테스트 부재" 결함이
  실제로 닫혔다.

## 요약

핵심 보안 결함(값-축·키-축 두 곳에서 `token` 접두 계열이 마스킹 없이 새고 있던 문제)을 공용
SoT 정규식(값 1곳·키 2곳, 의도된 미러)에서 일관되게 닫았고, 옛 3-대안이 신규 패턴에 완전히
흡수됨을 직접 실행으로 재확인했다. 이전 `14_00_15`/`14_00_50` 라운드에서 지적된 결함(WS 미러
회귀 테스트 부재, JSDoc 자기모순, CHANGELOG 관행 이탈, 주석 컨벤션 불일치, 뮤테이션 수치 오류,
§R17 서술이 구현보다 넓음)은 이 diff 시점에 `RESOLUTION.md` 를 통해 전부 수정됐고, 이번 라운드의
독립 재실행(테스트 GREEN, 뮤테이션 2 RED, spec-코드 line-level 대조)으로 그 수정이 실제로
유효함을 확인했다. 남은 유일한 항목은 ReDoS 벤치마크 자동화 미비인데, 이는 정규식 형태상
회귀 위험이 낮다는 근거와 함께 라운드 내에서 이미 명시적으로 유예된 선택 사항이라 INFO 로만
남긴다.

## 위험도

LOW — 실질 코드 결함 없음(핵심 마스킹·spec 서술·회귀 테스트를 전부 독립 재실행으로 재확인).
유일 발견은 선택 사항(ReDoS 자동 벤치마크 미비)이며 비차단.
