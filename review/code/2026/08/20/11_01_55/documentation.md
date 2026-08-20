# 문서화(Documentation) 리뷰

## 사전 확인 사항

이 diff 는 실제 코드 수정(`45ba37792` 등) 뿐 아니라, 그 이전 라운드의 code-review(`review/code/2026/08/17/14_00_15/**`)와 consistency-check(`review/consistency/2026/08/17/13_31_57/**`, `14_00_50/**`) 산출물, 그리고 그 RESOLUTION 처리 결과가 모두 하나의 브랜치 diff 로 묶여 있다. `RESOLUTION.md` 를 대조 근거로 삼아, 이전 라운드 documentation/maintainability WARNING(자기모순 JSDoc 문단, CHANGELOG 누락, plan 설계 정규식 drift, WS 미러 회귀 테스트 부재)이 실제 소스에 반영됐는지 직접 파일을 열어 재확인했다.

## 확인 결과 (이전 WARNING 해소 여부 — 직접 재검증)

- `codebase/backend/src/shared/utils/sanitize-error-message.ts:59-104` — `CREDENTIAL_KEY_PATTERN` 위 JSDoc 이 "additionally covers `x-api-key`" 로 좁혀졌고, `x-auth-token` 은 이제 WS 미러도 커버한다는 문장(94-96행)이 추가돼 자기모순이 해소됨을 확인. WS 쪽(`websocket.service.ts:59-78`)에 실제로 `x[_-]api[_-]?key` 대안이 없음도 grep 으로 대조 — 서술과 코드가 일치.
- `codebase/backend/src/modules/websocket/websocket.service.ts:59-78` — 신규 설명이 기존 `/** */` JSDoc 블록 안에 문단으로 병합됨(별도 `/* */` 블록 없음) — 이전 라운드가 지적한 스타일 불일치 해소.
- `CHANGELOG.md:1-27` — "Unreleased" 항목이 직전 4커밋과 같은 포맷으로 존재. 3축 결함·범위 결정(#4 `maskSensitiveFields` 미포함)·MCP 패턴 흡수·받아들이는 오탐·반증된 트래커 전제까지 기술.
- `plan/in-progress/eia-secret-pattern-token-family.md` "설계" 절 — 실제 shipped 정규식(`[A-Za-z0-9_-]*token` / `[a-z0-9_-]*token`)으로 교체되고, 초안(`(?:[A-Za-z0-9]+[_-]?)?token`)과 왜 단순화했는지가 blockquote 로 남음. 뮤테이션 수치도 "6 RED"로 정정되고 왜 최초 "8"이 틀렸는지 근거 명시.
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts:135-181` — `x-auth-token`/`csrf_token`/`csrfToken`/`session_token`/`id_token` 5종 필드 + `tokenizer`/`nextPageToken` 오탐 경계 캐너리가 추가됨. `sanitize-error-message.spec.ts` 의 `FAMILY` 축과 동일한 커버리지로 미러가 맞춰짐.
- `spec/5-system/14-external-interaction-api.md` §R17(1579-1583행) — "`token` 계열이 닫혔다"는 서술이 "값·키 두 축에 한한다"는 캐비엇으로 좁혀지고 `maskSensitiveFields` 축의 잔여를 명시 — consistency `14_00_50` WARNING 1 해소.
- `spec/5-system/11-mcp-client.md` §8.2/§8.3/Rationale, `spec/5-system/2-api-convention.md §2.2` — `hmacAlgorithm` → `AuthConfig.config.algorithm` 출처 정정, `execution.stop`/`execution.start` won't-do 각주, `/api/external/*` 인증 family 예외 행이 모두 실제 코드(`triggers.service.ts:634`, `V066__trigger_config_strip_inline_auth.sql`)·spec 교차 인용과 line-level 로 일치.
- 전 코드베이스에서 "MCP 전용 bare token" 류 표현이 새 상태(빈 배열 + 흡수 서술)와 어긋나게 남아있는 곳이 없음(grep 으로 전수 확인).

새로 도입된 documentation/maintainability 등급 결함은 발견하지 못했다.

## 발견사항

(CRITICAL/WARNING 없음)

- **[INFO]** `MCP_EXTRA_SECRET_PATTERNS` 소비 루프에 선언부 JSDoc 참조가 없음 (이전 라운드에서 이미 "선택 항목"으로 분류되어 미반영 — 재확인 목적으로만 기록)
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `redactMcpSecrets` 함수 내 `for (const [pattern, replacement] of MCP_EXTRA_SECRET_PATTERNS)` 루프
  - 상세: 배열 선언부(39-53행)는 "훅을 남겨 두는 이유"를 상세히 설명하지만, 매 호출마다 도는 소비 지점(72-81행)에는 그 설명이 없어 함수 본문만 보는 사람에게는 이 루프가 죽은 코드로 보일 수 있다. 기능적 결함이 아니고 이전 라운드(maintainability WARNING 처리 시 RESOLUTION 의 "미반영 INFO" 6번 항목)에서 이미 선택 사항으로 처리 완료된 항목이라 재차단 사유는 아니다.
  - 제안: 조치 불요(기존 판정 유지). 향후 코드 정리 시 "위 JSDoc 참조 — 현재는 no-op, 훅 유지" 한 줄만 추가해도 충분.

## 확인했으나 문제 없는 항목

- README/API 문서: 이번 diff 는 새 엔드포인트·환경변수·설정 옵션을 도입하지 않는 내부 정규식/유틸리티 확장이라 README 갱신 대상이 아님.
- `mcp-error-codes.spec.ts` 테스트 이름 변경("MCP 전용 패턴" → "공용 패턴이 흡수") + 그 이유를 밝히는 JSDoc 스타일 주석 — 정확하고 characterization 성격을 잘 보존.
- `sanitize-error-message.spec.ts` 신규 `describe('token 계열 — 값 축과 키 축을 같은 표로 고정')` — 값/키 두 축을 같은 `FAMILY` 표로 고정하고, 오탐 경계·받아들이는 오탐(opaque cursor) 캐너리 각각에 "왜 이 결정인가"가 주석으로 남아 있어 재발견 대신 결정을 바로 보게 함.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 체크박스 3건(`:134,136,138`) + `token=` 항목이 diff 와 정확히 대응하고, "왜 연결 문자열 항목과 안 묶었는지"·"왜 #4 는 범위 밖인지"가 blockquote 근거로 남아 향후 재판정 시 참조 가능.
- 리뷰/컨시스턴시 산출물(`review/code/2026/08/17/14_00_15/**`, `review/consistency/2026/08/17/{13_31_57,14_00_50}/**`)은 CLAUDE.md 저장 위치 규약과 일치하는 신규 산출물이며, `RESOLUTION.md` 가 각 WARNING 의 처리 근거·검증(뮤테이션 재실행 수치 포함)를 남겨 추적 가능.

## 요약

이번 diff 는 이미 두 차례(`14_00_15` code-review, `13_31_57`/`14_00_50` consistency-check)의 문서화 검토를 거쳤고, `RESOLUTION.md` 가 주장한 수정 내역(JSDoc 자기모순 해소, CHANGELOG 항목 추가, JSDoc 블록 스타일 통일, WS 미러 회귀 테스트 추가, plan 설계 정규식/뮤테이션 수치 정정, spec §R17 캐비엇)을 직접 소스 파일을 열어 전수 재검증한 결과 전부 실제로 반영돼 있음을 확인했다. 핵심 프로덕션 코드(`sanitize-error-message.ts`/`.spec.ts`, `mcp-error-codes.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`)와 관련 spec 문서(`11-mcp-client.md`, `14-external-interaction-api.md`, `2-api-convention.md`) 전반에 "왜 바꿨는지·무엇을 실측했는지·무엇을 의도적으로 남겼는지"가 코드·테스트·plan·spec 네 layer 에 일관되게 남아 있어 이 저장소 평균을 상회하는 문서화 품질이다. 이번 라운드에서 새로 발견한 CRITICAL/WARNING 급 문서화 결함은 없다.

## 위험도

NONE
