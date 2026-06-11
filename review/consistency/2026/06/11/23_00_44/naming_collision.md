# 신규 식별자 충돌 검토

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/4-integration/, diff-base=origin/main)

---

## 발견사항

### [WARNING] `INTEGRATION_NOT_FOUND` — target 이 제거한 식별자가 인접 spec 에 잔존

- **target 신규 식별자**: `spec/4-nodes/4-integration/1-http-request.md` §5.8 및 §6 에서 `INTEGRATION_NOT_FOUND` 를 목록에서 **제거**하고, 대신 "`INTEGRATION_CALL_FAILED` 로 surface 된다 (별도 `INTEGRATION_NOT_FOUND` 코드는 http-request 경로에 없음)" 으로 교체함. `spec/4-nodes/4-integration/0-common.md` §4.2 는 동일하게 "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다" 를 이미 명시.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md:1073` — `| INTEGRATION_NOT_FOUND | integrationId가 존재하지 않거나 타 워크스페이스 소속 | Usage 로그 기록(failed) + 노드 실패 |` — 이 테이블은 **노드 실패(throw)** 로 기술하며 여전히 `INTEGRATION_NOT_FOUND` 를 유효한 에러 코드로 나열.
  - `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/2-database-query.md:324,343` — §5.8 및 §6.2 에서 `INTEGRATION_NOT_FOUND` 를 surface 가능한 코드로 나열 (origin/main 기준이며, 이번 worktree diff 에는 이 파일의 변경이 없음 — 즉 target 범위 밖에서 잔존).
- **상세**: target(`1-http-request.md`)은 `INTEGRATION_NOT_FOUND` 가 실제로 존재하지 않음을 명확히 했으나, `spec/2-navigation/4-integration.md` 에서는 여전히 "노드 실패" 동작으로 묘사되는 유효 코드로 등장한다. 이 결과 "INTEGRATION_NOT_FOUND 라는 코드가 surface 되는가?" 라는 질문에 두 spec 이 상이한 답을 준다. `2-database-query.md` 도 동일하게 잔존 모순을 품는다.
- **제안**: `spec/2-navigation/4-integration.md` §5.x 에러 코드 테이블에서 `INTEGRATION_NOT_FOUND` 행을 제거하거나, "`INTEGRATION_CALL_FAILED` 로 surface됨 (별도 코드 없음)" 비고를 추가한다. `spec/4-nodes/4-integration/2-database-query.md` §5.8 / §6.2 도 동일하게 교정이 필요하다.

---

### [INFO] `INTEGRATION_SERVICE_UNAVAILABLE` — 0-common.md 에 신규 추가, 인접 파일과 의미 일관

- **target 신규 식별자**: `spec/4-nodes/4-integration/0-common.md` §4.2 공통 에러 코드 표에 `INTEGRATION_SERVICE_UNAVAILABLE` 행 추가(이번 diff 에서 새로 삽입). 의미: `IntegrationsService` 미주입 또는 workspace context 누락 — D4 이후 `port: 'error'` 라우팅.
- **기존 사용처**: 해당 코드명은 `1-http-request.md`, `2-database-query.md`, `3-send-email.md` 에서 이미 동일 의미로 사용 중. `0-common.md` 의 공통 에러 코드 표에만 빠져 있었으므로 이번 추가로 표가 완성된다.
- **충돌 여부**: 없음. 의미가 모든 기존 사용처와 동일하다.
- **제안**: 없음 (표 정합성 개선).

---

### [INFO] `HTTP_BLOCKED` — 기존 코드명 재사용, 적용 범위 확장

- **target 신규 식별자**: `1-http-request.md` §4 step 8 SSRF 가드가 `authentication='integration'` 전용에서 **전 인증 방식 공통**(`none`/`integration`/`custom`)으로 확장됨. 코드명 `HTTP_BLOCKED` 는 그대로 유지. `spec/5-system/3-error-handling.md` §노드 에러 코드 표에도 `HTTP_BLOCKED (SSRF 차단 — 전 인증 방식 공통)` 가 새로 추가됨.
- **기존 사용처**: `spec/4-nodes/4-integration/1-http-request.md`, `spec/5-system/3-error-handling.md` 에서 이미 같은 코드명을 `integration` 인증 전용 SSRF 차단으로 사용 중.
- **충돌 여부**: 코드명 동일, 의미 확장(동일 노드·동일 에러 경로에서 적용 조건 범위 변경). 다른 엔티티에서 다른 의미로 사용되는 케이스 없음.
- **제안**: 없음.

---

### [INFO] `assertSafeOutboundUrl` / `assertSafeOutboundHostResolved` — 기존 함수명 재사용

- **target 신규 식별자**: `1-http-request.md` §4 에서 두 함수가 `none`/`custom` 경로에도 호출된다고 명시적으로 기술됨.
- **기존 사용처**: `2-database-query.md`, `3-send-email.md`, `4-integration.md` 에서 동일 함수명이 동일 의미(SSRF 호스트 검사)로 참조됨.
- **충돌 여부**: 없음. 동일 함수의 적용 범위 확대 기술.

---

### [INFO] `Principle 7 D1` (명시 열거, spread 금지) — 새 결정 레이블

- **target 신규 식별자**: `1-http-request.md` §4 step 2 에 `Principle 7 D1` 이라는 결정 레이블 신설. `node-output.md` 의 Principle 7 하위 결정 번호로 사용됨.
- **기존 사용처**: `spec/conventions/node-output.md` 에 `Principle 7` 는 있으나 `D1` 레이블이 별도 정의된 섹션이 있는지 확인 필요. 다른 노드 spec 에서 `D1` 레이블은 현재 등장하지 않음.
- **충돌 여부**: 잠재적. `node-output.md` 에 `D1` anchor 가 존재하지 않으면 링크(`[node-output.md Principle 7 D1](...)`)가 깨진 dead link 가 된다. 식별자 충돌은 아니지만 신규 레이블 도입 시 SoT 파일 동기화가 필요하다.
- **제안**: `spec/conventions/node-output.md` 에 `### Principle 7 D1` (또는 `#### D1: 명시 열거`) 섹션·anchor 를 추가해 링크를 유효하게 만든다.

---

### [INFO] `CODE_MEMORY_LIMIT` — target(error-handling.md) 에서 제거, Code 노드 spec 잔존 가능

- **target 신규 식별자**: `spec/5-system/3-error-handling.md` 의 Code 노드 에러 코드에서 `CODE_MEMORY_LIMIT` 제거됨 (origin/main 에는 있었음).
- **기존 사용처**: `spec/4-nodes/5-data/2-code.md` 가 해당 코드를 언급하는지 확인 필요. 이번 worktree diff 에 `2-code.md` 가 포함돼 있으므로 해당 파일의 변경 내용에 따라 달라짐.
- **충돌 여부**: 범위 외(이번 target 은 `spec/4-nodes/4-integration/` 이므로 Code 노드는 직접 검토 대상 밖). 다만 `3-error-handling.md` 의 변경이 `2-code.md` 와 정합하는지는 Code 노드 checker 가 별도 확인하는 것이 적절하다.

---

## 요약

`spec/4-nodes/4-integration/` 의 주요 신규 식별자(`HTTP_BLOCKED` 적용 확장, `INTEGRATION_SERVICE_UNAVAILABLE` 공통 표 추가, `ALLOW_PRIVATE_HOST_TARGETS` 범위 명확화)는 기존 사용처와 의미·명명이 일관되며 실질적 충돌이 없다. 주목할 사항은 `INTEGRATION_NOT_FOUND` 의 처리 방식이다 — target(`1-http-request.md`, `0-common.md`)은 해당 코드가 실제로 surface 되지 않음을 명시했으나, `spec/2-navigation/4-integration.md` (미변경)와 `spec/4-nodes/4-integration/2-database-query.md` (미변경)에서는 여전히 유효 코드로 나열되어 독자 혼선을 유발한다. `Principle 7 D1` 레이블은 `spec/conventions/node-output.md` 에 anchor 가 없으면 dead link 가 된다. 두 항목 모두 naming collision 보다는 spec 내부 일관성 문제이며, 즉시 차단 수준은 아니다.

## 위험도

LOW
