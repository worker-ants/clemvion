# 변경 범위(Scope) 리뷰 — eia-secret-pattern-token

## 발견사항

- **[INFO]** `token` 계열 흡수가 `mcp-error-codes.ts`/`11-mcp-client.md` 로 원 티켓 범위를 확장했다
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:41` (`MCP_EXTRA_SECRET_PATTERNS` 를 빈 배열로), `spec/5-system/11-mcp-client.md` §8.3(디프 상 `604`/`608` 부근)
  - 상세: 트래커 원문은 "`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다"(값 패턴 확장)만 지목했는데, 실제 diff 는 세 번째 파일(`mcp-error-codes.ts`)의 `MCP_EXTRA_SECRET_PATTERNS` 배열을 통째로 비우고 그 JSDoc 을 재작성했으며, `spec/5-system/11-mcp-client.md` §8.3·Rationale 도 함께 고쳤다. 이는 리터럴 티켓 범위 밖이지만, `plan/in-progress/eia-secret-pattern-token-family.md` §"자매 표가 놓친 축"에 `/consistency-check --impl-prep`(`13_31_57` cross_spec W1)가 지목한 사실로 기록돼 있고, 무수정 프로브(`?token=abc&foo=bar` → 공용만으로 `?***&foo=bar`)로 배열이 완전히 잉여가 됐음을 검증한 뒤 2026-07-10 URL-userinfo 흡수 때와 **동일 절차**로 처리했다. `mcp-error-codes.spec.ts` 8건이 그대로 GREEN 임도 확인됨 — 근거가 문서화된 정당한 sibling 확장이며 은닉된 추가가 아니다.
  - 제안: 조치 불필요. 향후 유사 확장 시에도 이번처럼 plan 에 "왜 원 티켓보다 넓어졌는지"를 남기는 패턴을 유지할 것.

- **[INFO]** 보안 패턴 수정과 무관한 spec 문서 정정 3건이 같은 plan/PR 에 번들됐다
  - 위치: `spec/5-system/14-external-interaction-api.md:64`(EIA-NX-03), `:1124-1125`(§11 표), `:1324-1329`(R12 캐비엇); `spec/5-system/2-api-convention.md:54`
  - 상세: `hmacAlgorithm` 출처 정정, §11 `execution.stop`/`execution.start` won't-do 각주, `2-api-convention.md §2.2` 인증 family 예외 — 세 항목은 `token` 계열 마스킹과 인과관계가 없는 별건 문서 오류다. 다만 이는 실행 중 몰래 끼워 넣은 것이 아니라, `plan/in-progress/eia-secret-pattern-token-family.md` 최초 작성 시점부터 제목("... + EIA 저비용 문서 정정 3건")과 "곁들이는 저비용 문서 3건" 섹션에 명시적으로 선언됐고, `spec-sync-external-interaction-api-gaps.md` 트래커에도 대응 체크박스가 있어 추적 가능하다. 코드 변경(패턴 정규식)과 성격이 다른 diff 가 같은 커밋 세트에 섞여 있다는 점만 기록해 둔다.
  - 제안: 조치 불필요(사용자가 사전 승인한 번들링). 리뷰어가 diff 를 "보안 수정" 하나로만 기대하면 §11/§2.2/R12 변경을 무관하다고 오판할 수 있으므로 참고용으로만 남긴다.

- **[INFO]** `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 변경은 티켓이 명시하지 않았지만 문서화된 미러 계약의 필연적 결과
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:74-75` (diff 상 `+/*` 블록 및 정규식 라인)
  - 상세: `sanitize-error-message.ts` 의 동일 이름 상수(`CREDENTIAL_KEY_PATTERN`)와 "의도된 미러"라고 서로의 JSDoc 이 명시하므로, 한쪽만 고치면 그 주석이 거짓이 된다. 무관한 파일 수정이 아니라 자매 표 (`plan` §"자매 전수") #2·#3 항목으로 사전에 식별된 필수 동반 변경.
  - 제안: 조치 불필요.

## 확인했으나 스코프 이탈이 아닌 항목 (참고)

- `review/consistency/2026/08/17/13_31_57/**` 6개 신규 파일 — `/consistency-check --impl-prep` 산출물. CLAUDE.md 워크플로 상 구현 착수 직전 의무 절차이며 산출물 저장 위치(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)도 규약과 일치. 스코프 외 추가가 아니라 표준 절차의 흔적.
- `mcp-error-codes.spec.ts` 테스트 이름 변경(`MCP 전용 패턴` → `공용 패턴이 흡수`) + JSDoc 6줄 — 코드 동작이 실제로 이관됐음을 반영한 정직한 리네이밍이며, 케이스 자체는 삭제하지 않고 "MCP 소비자가 이 형태에 의존한다"는 회귀 앵커로 남겼다. 불필요한 주석 변경이 아니라 사실 변경에 따른 필수 갱신.
- `sanitize-error-message.spec.ts` 신규 `describe('token 계열 — 값 축과 키 축을 같은 표로 고정')` 63줄 — 변경된 정규식 2곳(값 축·키 축)에 정확히 대응하는 회귀 테스트이며 기능 확장(over-engineering) 이 아님. 오탐 캐너리 2건도 "새 기능"이 아니라 기존 정책(`secret:`/`password:` 오탐 허용)의 일관 적용을 문서화하는 성격.
- 포맷팅/공백/불필요 리팩토링/미사용 import/설정 파일 변경: 발견되지 않음. `git diff --stat origin/main...HEAD` 로 확인한 18개 파일 전체가 프롬프트에 실린 18개 파일과 정확히 일치 — 프롬프트에 안 실린 숨은 변경 없음.

## 요약

핵심 변경(`SECRET_LEAK_PATTERNS` 값 패턴 + `CREDENTIAL_KEY_PATTERN` 키 패턴 2곳의 `token` 계열 흡수)은 티켓이 요청한 범위에 정확히 대응한다. 여기에 더해 `mcp-error-codes.ts`/`11-mcp-client.md` 흡수와 spec 문서 정정 3건이 같은 diff 에 섞여 있어 얼핏 범위 확장처럼 보이지만, 전부 `plan/in-progress/eia-secret-pattern-token-family.md` 에 착수 전부터 명시적으로 선언되고 `/consistency-check --impl-prep` 산출물로 근거가 남아 있어 "몰래 끼워 넣은 추가 수정"이 아니다. 포맷팅 뒤섞임·불필요 리팩토링·미사용 import·설정 파일 변경·무관한 파일 수정은 발견되지 않았고, git diff 전체 파일 목록이 리뷰 프롬프트와 정확히 일치해 숨은 변경도 없다.

## 위험도
NONE
