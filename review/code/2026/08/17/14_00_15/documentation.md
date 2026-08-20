# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING] 새로 추가한 JSDoc 문단이 바로 위 기존 문단과 자기모순을 일으킨다 (`x-auth-token` 소속 오분류)**
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:86-92` (특히 87 vs 89-92)
  - 상세: `CREDENTIAL_KEY_PATTERN`(공용) 위 JSDoc 은 이번 diff 이전부터 "Mirrors the WS-layer
    `CREDENTIAL_KEY_PATTERN` ... and **additionally covers** `x-`-prefixed header names
    (`x-api-key` / `x-auth-token`)"(86-87행, 변경되지 않은 문맥 줄)라고 적어, `x-api-key`·`x-auth-token`
    둘 다 **WS 쪽에는 없고 공용 쪽에만 있는 추가분**이라고 단언한다. 그런데 이번 diff 가 바로 다음
    문단(89-92행, 신규 추가)에 `[a-z0-9_-]*token` 이 "the whole family in one alternative (bare
    `token`, `access_token`, `csrf_token`, `csrfToken`, **`x-auth-token`**)"를 덮는다고 적었다.
    문제는 `[a-z0-9_-]*token` 이라는 대안이 **WS 쪽 `CREDENTIAL_KEY_PATTERN` 에도 이번 diff 로 똑같이
    추가됐다**(`websocket.service.ts` 신규 패턴: `/^(...|​[a-z0-9_-]*token|...)$/i`). 이 대안은
    `^...$` 로 문자열 전체를 매칭하므로 `x-auth-token`("x-auth-" + "token")도 그대로 매칭된다 —
    즉 `x-auth-token` 은 이제 WS 쪽에서도 잡힌다. 86-87행의 "additionally covers ... x-auth-token"
    주장은 이 diff 로 인해 **거짓**이 됐는데(WS 도 이제 커버), 새로 붙인 89-92행은 오히려 그 사실을
    스스로 증명하면서도 위 문단을 정정하지 않아 같은 JSDoc 블록 안에 상충하는 두 문장이 남았다.
    실제로 지금 시점에 공용에만 있고 WS 에는 없는 것은 `x-api-key`(`x[_-]api[_-]?key` 대안, WS 쪽에는
    없음) **하나뿐**이다.
  - 제안: 86-87행을 "additionally covers `x-api-key`" 로 좁히고(`x-auth-token` 은 제거), 필요하면
    "`x-auth-token` 은 `[a-z0-9_-]*token` 패밀리 대안으로 양쪽이 이미 공유한다" 는 문장을 89-92행
    문단에 명시해 두 문단이 서로 배치되지 않게 정리한다.

- **[WARNING] 이 브랜치가 속한 이니셔티브(#1177~#1181)는 매 보안 마스킹 수정마다 `CHANGELOG.md` 에
  "Unreleased" 항목을 남기는 관행을 확립했는데, 이번 커밋에는 그 항목이 없다**
  - 위치: `CHANGELOG.md` (diff에 없음 — 파일 자체가 이번 변경에서 손대지 않음)
  - 상세: 직전 4개 커밋(`107c8038f` 종결 error.message, `f5351e9c2` 읽기 경로 egress, `89c3f3c53`
    node/비종결 emit, `c9cc2a923` 프리필 가드) 전부 `CHANGELOG.md` 에 "## Unreleased — <살아있던
    잔여를 설명하는 제목>" 섹션을 추가했고, 제목 문구가 이번 커밋 메시지("`token` 계열이 값·키 두
    축에서 마스킹 없이 나가고 있었다")와 동일한 패턴("~하고 있었다" 형 결함 서술)이다. 이번 변경도
    같은 성격(egress 마스킹 목록의 살아있는 갭 — bare `token=` 뿐 아니라 접두 계열이 값·키 두 축
    모두에서 새고 있었다는 실측)이라 CHANGELOG 관점에서 동일 카테고리인데 항목이 빠졌다. `git diff
    --stat`/`git status` 로 확인한 결과 `CHANGELOG.md` 는 이번 18개 변경 파일 목록에 없다.
  - 제안: 직전 4개 항목과 동일한 포맷으로 "Unreleased" 절 추가 — 무수정 프로브로 밝힌 3축 결함
    (값-패턴 axis, 키-이름 axis, MCP 전용 목록 중복)과 범위 결정(#4 `maskSensitiveFields` 는 미포함)을
    간단히 요약.

- **[INFO] (이미 consistency-check 가 포착·선택 항목으로 분류함 — 재확인 겸 기록)**
  `websocket.service.ts` 의 신규 주석("`shared/utils/sanitize-error-message.ts` 의 동명 상수와
  **의도된 미러**이므로 한쪽만 고치면 그쪽 JSDoc 의 '같은 클래스를 방어한다' 서술이 거짓이 된다 —
  함께 갱신한다")이 "미러"의 범위를 명시하지 않아, 유일하게 남은 실제 비대칭(`x-api-key` — 공용에만
  있음, REST 전용 확장이라 의도된 것)까지 "동기화 대상"으로 오독될 여지가 있다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:67-73`
  - 제안: `review/consistency/2026/08/17/13_31_57/SUMMARY.md` 권장조치 4번과 동일 — "x-api-key 등
    REST 전용 확장은 미러 대상 아님" 한 줄 추가(선택).

## 확인했으나 문제 없는 항목 (참고)

- `mcp-error-codes.spec.ts`/`mcp-error-codes.ts`: 테스트 이름 변경·배열을 비운 이유·"두 번 비워진
  이력"을 날짜순으로 정리한 JSDoc 모두 정확하고, spec 문서(`11-mcp-client.md` §8.3/Rationale)와
  1:1 대응한다. 무수정 프로브 결과("`mcp-error-codes.spec.ts` 8건 GREEN")까지 주석에 근거로 남겨
  향후 재검증 가능하게 했다 — 모범적.
- `sanitize-error-message.spec.ts` 신규 `describe` 블록: "왜 두 축을 같은 표로 고정하는지", 오탐
  경계 캐너리, 받아들이는 오탐(opaque cursor) 캐너리 모두 이유가 주석에 남아 있고 각 코드 변경과
  1:1 대응 — 품질 높음.
- `spec/5-system/11-mcp-client.md` §8.2 표·§8.3 본문·`spec/5-system/14-external-interaction-api.md`
  EIA-NX-03/R12/§11 표·`2-api-convention.md §2.2`: 모두 `plan/in-progress/eia-secret-pattern-token-family.md`
  "저비용 문서 3건" + impl-prep W1 발견을 정확히 반영했고, `MCP_EXTRA_SECRET_PATTERNS`/`token` 계열
  관련 spec 서술과 실제 코드(빈 배열·`[A-Za-z0-9_-]*token`)가 어긋나는 곳을 더 찾지 못했다.
- `plan/in-progress/eia-secret-pattern-token-family.md` ↔ `spec-sync-external-interaction-api-gaps.md`
  트래커: 체크박스 3건(`:134,136,138`) + `token=` 항목이 정확히 diff 로 플립됐고, "왜 연결 문자열
  항목과 안 묶었는지"·"왜 #4 는 안 닫는지" 근거가 트래커 blockquote 에 남아 향후 재판정 시 참조
  가능 — plan 위생 관점에서 문제 없음.
- README/API 문서: 이 변경이 건드리는 대상(내부 유틸리티 정규식·spec 산문)에는 README 대응 항목이
  없고, 새 엔드포인트·환경변수·설정 옵션도 도입하지 않아 README/설정 문서 업데이트 필요성 없음.

## 요약

핵심 프로덕션 코드(`sanitize-error-message.ts`/`.spec.ts`, `mcp-error-codes.ts`/`.spec.ts`,
`websocket.service.ts`)와 관련 spec 문서(`11-mcp-client.md`, `14-external-interaction-api.md`,
`2-api-convention.md`) 전반의 문서화 품질은 이 저장소 평균을 상회한다 — 왜 바꿨는지, 무엇을
실측했는지, 무엇을 의도적으로 남겼는지(오탐 수용, MCP 훅 존치)가 코드·plan·spec 세 layer 에
일관되게 남아 있다. 다만 두 가지는 고쳐야 한다: (1) 공용 `CREDENTIAL_KEY_PATTERN` JSDoc 에서 새로
추가한 문단이 바로 위 기존 문단의 "`x-auth-token` 은 WS 에 없다"는 주장을 스스로 반증하면서도
그 문장을 정정하지 않아 같은 블록 안에 상충하는 서술이 남았고, (2) 이 이니셔티브가 4연속으로
지켜온 `CHANGELOG.md` "Unreleased" 항목 관행이 이번 커밋에서만 빠졌다. 둘 다 기능적 위험은 없는
순수 문서 정확성/관행 문제다.

## 위험도

LOW
