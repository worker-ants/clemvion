# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 이전 라운드(`14_00_15`)의 WARNING 5건 + consistency WARNING 1건에 대한 **처분(resolution) 반영**과 그 산출물(RESOLUTION.md, 이전 리뷰 아티팩트 20여 개, spec 문서 3건)의 커밋이다. 실제 프로덕션 로직 변경은 다음 세 파일에 집중된다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 값 패턴(`SECRET_LEAK_PATTERNS`)과 키 패턴(`CREDENTIAL_KEY_PATTERN`)을 `[A-Za-z0-9_-]*token` / `[a-z0-9_-]*token` 단일 대안으로 확장해 `token` 접두 계열(`csrf_token`·`session_token`·`x-auth-token`·`csrfToken` 등)의 값·키 두 축 egress 노출을 닫음.
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 동일 `CREDENTIAL_KEY_PATTERN` 을 "의도된 미러"로 동형 확장.
- `codebase/backend/src/modules/mcp/mcp-error-codes.ts` — `MCP_EXTRA_SECRET_PATTERNS`(bare `token=` 전용 보충 패턴)가 공용 패턴에 완전히 흡수되어 빈 배열로 정리, 훅 구조는 유지.

세 파일 모두 `Read` 로 현재 상태를 직접 열어 diff 와 일치함을 확인했고, 확장된 정규식(`[A-Za-z0-9_-]*token`)에 대해 직접 Node 벤치마크(적대적 입력 `"a".repeat(n)`, `"token".repeat(n)`, 최대 160,000자)를 돌려 처리 시간이 입력 크기에 선형임을 재확인했다(ReDoS 없음 — 중첩 정량자가 없는 단일 `*` + 고정 리터럴 접미사 구조라 이론적으로도 안전).

## 발견사항

- **[INFO]** 알려진 잔여 갭 — `maskSensitiveFields`(`DEFAULT_SENSITIVE_KEYS`)는 이번 PR 범위 밖으로, 키 축에서 여전히 `token` 접두 계열(`csrf_token`/`auth_token`/`session_token`/`csrfToken`)을 평문 통과시킨다.
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (이번 diff 미포함 — `git diff --stat` 로 무변경 확인). 범위 결정 근거는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:247-253` (2026-08-17 증거 추가 단락).
  - 상세: 이번 diff 는 `SECRET_LEAK_PATTERNS`(값)·`CREDENTIAL_KEY_PATTERN`(키, 공용+WS 미러) 세 곳만 계열째 닫았고, `maskSensitiveFields`(로깅·workflow-assistant LLM 도구 표면 `inputData`/`outputData`/`error`)는 의도적으로 손대지 않았다. 마스킹 형태가 다르고(`****<last4>` vs `***`) 별도 트래커 항목(workflow-assistant 소유)이 이미 있어 "무엇이 우선인가"는 아직 결정 항목이라는 이유가 plan 에 명시돼 있다 — 이번 diff 의 회귀가 아니라 **알려진 채로 범위 밖에 남긴 기존 노출**이다. 보안 관점에서 살아있는 갭이라는 사실만 기록한다.
  - 제안: 조치 불필요(별도 트래커에서 추적 중). 그 항목 착수 시 동일 `[a-z0-9_-]*token` 형태 적용 검토.

- **[INFO]** `websocket.service.ts` ↔ 공용 `CREDENTIAL_KEY_PATTERN` 의 `x-api-key` 비대칭 — 이번 diff 이전부터 있던 것으로 신규 결함 아님.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:73` (신규 주석이 비대칭을 명시), 공용 쪽 `codebase/backend/src/shared/utils/sanitize-error-message.ts:104` (`x[_-]api[_-]?key` 대안 포함).
  - 상세: WS 페이로드가 `x-api-key` 형태의 REST 전용 헤더를 echo 할 경로가 없다는 전제 하에 의도된 비대칭으로 문서화됐다(`websocket.service.ts` 신규 JSDoc "미러의 범위는 자격증명 키 계열까지다" 단락). 이전 라운드 consistency/security 리뷰가 동일 항목을 이미 포착·기록했고 이번 diff 는 그 문서화를 보강했을 뿐이다.
  - 제안: 조치 불필요. WS 가 향후 `x-api-key` 류 헤더를 실제로 echo 하게 되면 그때 미러에 추가.

- **[INFO]** 받아들인 오탐(accepted false positive) — 불투명 커서(`nextPageToken` 등)도 마스킹됨. 보안 방향으로만 작용하는 트레이드오프.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:98-101` (JSDoc), `sanitize-error-message.spec.ts:408-418` (캐너리).
  - 상세: 값·키 두 패턴 모두 `token` 으로 **끝나는** 이름 전체를 겨누므로 `nextPageToken` 처럼 자격증명이 아닌 opaque cursor 도 화면/로그 표면에서 `***`/`[REDACTED]` 로 나간다. 마스킹은 egress 전용이고 DB 는 원문을 보존하므로 기능 저하가 아니라 화면 가시성 손실에 그친다 — 보안 결함이 아니라 과잉 마스킹이며, 캐너리 테스트로 결정이 고정돼 있다.
  - 제안: 조치 불필요.

## 확인한 항목 (문제 없음)

- **정규식 ReDoS**: `[A-Za-z0-9_-]*token`/`[a-z0-9_-]*token` 는 중첩 정량자 없는 단일 `*` + 고정 리터럴 접미사. 직접 Node 벤치마크(정상 입력 160,000자, `token` 반복 32,000회 적대적 입력 모두)로 실행시간이 선형(수 ms 이내)임을 재확인 — plan 이 기록한 "2배 입력 → 2배 시간" 실측과 합치.
- **패턴 확장이 진짜 상위집합**: 제거된 옛 3-대안(`access[_-]token|refresh[_-]token|id[_-]token`, WS 쪽 `token|access[_-]?token|refresh[_-]?token`)이 새 단일 대안에 완전히 흡수됨 — 기존에 잡던 형태가 새로 빠지는 마스킹 축소(회귀)는 없음.
- **재마스킹 방지 계약 불변**: `MASKED_MARKERS`/`isMaskedMarker` 로직은 이번 diff 로 변경되지 않았고, 확장된 패턴이 그 계약(이미 마스킹된 값을 다시 마스킹하지 않는 단방향 안전 규칙)을 우회하지 않는다.
- **MCP 훅 축소 아님**: `MCP_EXTRA_SECRET_PATTERNS` 를 비워도 공용 `SECRET_LEAK_PATTERNS` 가 상위집합으로 흡수함을 `mcp-error-codes.spec.ts` 8건 GREEN(공용만으로) 으로 확인했고, 훅 구조(빈 배열 + 소비 루프)는 유지돼 제3자 MCP 서버가 새 형태를 echo 할 때의 확장 지점이 사라지지 않았다.
- **하드코딩 시크릿 없음**: 테스트 파일의 `sk-live-abc123` 등은 전부 합성 fixture 이며 실제 자격증명 패턴/실서비스 키가 아니다. 프로덕션 코드·plan·spec 문서 어디에도 실제 API 키/비밀번호/토큰 리터럴 없음.
- **인젝션/인증/인가/암호화/의존성**: 이번 diff 는 egress 마스킹 정규식과 그 문서 동기화(+ 리뷰 아티팩트 커밋 + 무관 spec 문서 3건 정정)에 국한된다. SQL/커맨드/경로 인젝션, 인증·인가 로직, 세션 관리, 해시/암호화 알고리즘, 평문 전송, 서드파티 의존성 변경 없음.
- **범위 밖 파일들(review/**, spec/**)**: 리뷰 아티팩트(RESOLUTION.md, meta.json, _retry_state.json 등)와 spec 문서 3건(`11-mcp-client.md`, `14-external-interaction-api.md`, `2-api-convention.md`)은 순수 문서/기록이며 보안 관점에서 실행 코드 변경이 없다. `14-external-interaction-api.md` 의 신규 §R17 캐비엇("`token` 계열이 닫혔다는 서술은 이 두 축에 한한다")도 실제 구현 범위와 정확히 일치하게 서술돼 문서-구현 drift 를 만들지 않는다.

## 요약

핵심 변경은 `token` 접두 계열 자격증명이 값-패턴·키-패턴(공용 + WS 미러) 세 곳 모두에서 egress 마스킹을 우회하던 실제 정보노출 결함을 닫는 보안 하드닝이며, 확장된 정규식은 기존 매칭 범위의 진짜 상위집합이라 마스킹 축소 회귀가 없다. 직접 Node 벤치마크로 ReDoS 부재를 재확인했고, MCP 전용 중복 패턴을 공용 SoT 로 흡수한 것도 등가성이 테스트로 뒷받침된다. 남은 항목은 전부 INFO — (1) `maskSensitiveFields` 축은 의도적으로 범위 밖에 남아 별도 트래커에서 추적 중인 기존 노출이고, (2) WS↔공용 `x-api-key` 비대칭은 이전부터 있던 의도된 것이며, (3) 불투명 커서 마스킹은 보안 방향으로만 작용하는 받아들인 오탐이다. 이번 diff 자체가 새로 도입한 취약점이나 방어 축소는 발견되지 않았다.

## 위험도

NONE
