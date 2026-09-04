# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-done)

## 스코프 정합성 메모

- **`spec/2-navigation/` 델타는 0개 파일이다** — 이 브랜치는 해당 spec 영역을 전혀 바꾸지 않았다. 즉 "target 문서가 새로 도입하는 식별자" 자체가 이 스코프에는 없다.
- 실제 구현 diff(3파일 / 213줄)는 `spec/2-navigation/` 과 무관한 영역이다 — `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`(`AlertRuleDto.threshold` 타입 정정: `number` → `string`)와 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` / `swagger-dto-contract.spec.ts`(신규 가드 `findNumericAsNumber`)다. `spec/2-navigation/9-user-profile.md` §6.3 이 `/api/alerts` API 를 문서화하고 있어 인접 도메인이긴 하나, 이번 diff 는 그 spec 파일도 건드리지 않았다.
- 아래는 이 diff 가 실제로 도입한 식별자를 대상으로, 요청받은 6개 관점을 델타 기준으로 점검한 결과다 (target 이 `spec/2-navigation/` 이 아니라는 사실 자체는 CRITICAL 근거로 삼지 않았다).

## 신규 식별자 목록 및 충돌 조사

diff 가 새로 도입하는 식별자는 다음 3개뿐이다 (`git -C <worktree> grep` 로 저장소 전수 확인):

| 식별자 | 위치 | 저장소 내 다른 정의 존재? |
|---|---|---|
| `NumericAsNumberOffender` (interface) | `swagger-dto-contract-guard.ts:210` | 없음 — 이 파일에만 존재 |
| `findNumericAsNumber` (function) | `swagger-dto-contract-guard.ts:219` | 없음 — 정의 1곳 + 소비 1곳(`swagger-dto-contract.spec.ts`)뿐 |
| `NUMERIC_COLUMN` (정규식 상수) | `swagger-dto-contract-guard.ts:216` | 없음 — 모듈-로컬(비-export), 다른 파일과 이름 겹침 없음 |

세 식별자 모두 저장소 전체에서 유일하며, 기존 다른 의미의 동명 사용처가 없다. 명명 패턴도 같은 파일의 기존 `findSwaggerContractMismatches` / `ContractMismatch` 짝과 일관된 `find*` / `*Offender` 형태를 따른다 — 혼동 유발 소지 없음.

`withFiles` 는 diff 가 `swagger-dto-contract.spec.ts` 에 새로 **import** 했지만, 정의 자체는 기존 `codebase/backend/src/common/__test-utils__/temp-fixture.ts` (`export function withFiles`) 에 이미 있던 것이고 다른 spec(`nullable-type-lie-cast.spec.ts`)에서도 이미 쓰이고 있다 — 신규 식별자가 아니라 기존 유틸의 재사용이다. 충돌 없음.

`AlertRuleDto.threshold` 는 신규 식별자가 아니라 **기존 필드의 타입 정정**(`number` → `string`, wire 사실에 문서를 맞춘 것)이다. 관점 2(엔티티/타입명 충돌)에 준해 확인했다:

- `CreateAlertRuleDto.threshold`(`alert-rule.dto.ts:34`)는 여전히 `number` — 응답 DTO 와 다른 타입이지만, diff 의 주석이 명시하듯 **읽기/쓰기 비대칭은 의도**이고 프런트엔드(`lib/api/alerts.ts`)가 이미 `threshold: string`(읽기)과 `threshold: number`(쓰기)로 손수 갈라 두고 있었다 — 이번 diff 는 그 기존 비대칭을 뒤늦게 문서화(OpenAPI)했을 뿐 새 비대칭을 만들지 않았다.
- `spec/2-navigation/9-user-profile.md:406`(§6.3 `POST /api/alerts`)은 요청 바디의 `threshold(number, ≥0)` 만 문서화한다 — 이는 `CreateAlertRuleDto`(여전히 `number`) 와 정확히 일치하며 이번 diff 로 깨지지 않는다. 같은 문서는 `GET /api/alerts` 응답 바디의 `threshold` 타입을 명시하지 않으므로, 이번 diff 가 spec 문서와 정면 충돌하는 지점은 없다.
- 저장소의 다른 `threshold` 필드(예: `execution-run-dlq-monitor`, `rag-search`, `agent-memory` 등)는 전혀 다른 도메인의 별개 DTO/설정값이며 `AlertRuleDto` 와 공유 네임스페이스나 참조 관계가 없다 — 동명이의어일 뿐 충돌 아님.
- 참고로 `spec/1-data-model.md:873` 이 `AlertRule.threshold` 를 `Float` 로 라벨링한 것은 이미 이 PR 이 만든 형제 plan(`plan/in-progress/spec-draft-nullable-notation-followups.md` "후속" §)에 planner 대상 미결 항목으로 등재돼 있다 — 이번 검토가 새로 발견한 사안이 아니라 기추적 항목이므로 별도 신규 CRITICAL 로 올리지 않는다.

## 6개 관점별 결과

1. **요구사항 ID 충돌** — 해당 없음 (diff 가 새 요구사항 ID 를 도입하지 않음).
2. **엔티티/타입명 충돌** — 없음. `NumericAsNumberOffender` 는 유일하며, `AlertRuleDto.threshold` 타입 정정은 위에서 확인한 대로 기존 비대칭의 사후 문서화다.
3. **API endpoint 충돌** — 해당 없음 (diff 가 새 endpoint 를 도입하지 않음. 기존 `GET/POST/PATCH/DELETE /api/alerts*` 그대로).
4. **이벤트/메시지명 충돌** — 해당 없음 (webhook/queue/sse 이벤트 신설 없음).
5. **환경변수·설정키 충돌** — 해당 없음 (신규 ENV/config key 없음).
6. **파일 경로 충돌** — 해당 없음 (신규 spec 파일 없음. 코드 파일도 기존 3개를 수정했을 뿐 신규 파일 생성 없음).

## 요약

이번 diff 는 `spec/2-navigation/` 영역에 어떤 새 spec 식별자도 도입하지 않았다(델타 0). 실제로 변경된 것은 별 도메인(alerts DTO + swagger 계약 가드)의 코드이며, 거기서 새로 도입된 식별자(`NumericAsNumberOffender`, `findNumericAsNumber`, `NUMERIC_COLUMN`)는 저장소 전수 검색으로 모두 유일함을 확인했고 기존 명명 패턴과도 일관된다. `AlertRuleDto.threshold` 타입 정정은 신규 식별자가 아니라 기존 읽기/쓰기 비대칭의 사후 문서화이며, `spec/2-navigation/9-user-profile.md` 가 문서화하는 요청 바디 계약과 충돌하지 않는다. 신규 식별자 충돌 관점에서 이 PR 은 문제가 없다.

## 위험도

NONE
