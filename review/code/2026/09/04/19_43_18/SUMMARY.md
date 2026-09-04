# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. `AlertRuleDto.threshold` 를 실제 wire 타입(`string`)에 맞춘 순수 문서/타입 정정으로, 코드 변경 자체는 8개 reviewer 전원이 엔티티·서비스·프런트엔드와 line-level 로 정합함을 실측 확인했다. 다만 (1) 이 결함을 되잡을 회귀 테스트가 여전히 없고, (2) CHANGELOG 서술이 실제 영향 범위(list/create/update 3곳)를 축소해 전달하며, (3) 동반 plan 문서에 산술 불일치(59 vs 57)가 남아 있어 WARNING 4건으로 수렴. forced whitelist(7명) 전원 결과 확보 확인 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `AlertRuleDto.threshold` 결함을 되잡을 회귀 테스트가 여전히 없다 — 원인(컨트롤러 반환 타입 미명시로 `tsc` 가 DTO-엔티티를 대조한 적 없음)이 수정 후에도 그대로 남아 있고, 저장소 전역 가드(`swagger-dto-contract-guard.ts`)는 presence/null 두 축만 봐서 primitive 타입 불일치는 구조적으로 못 잡는다. `AlertRuleDto`/`GET·POST·PATCH /api/alerts/rules` 를 참조하는 unit·e2e 테스트는 0건 | `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:36-37`, `alerts.controller.ts`(`list()` 반환 타입 미명시) | 최소 1건의 얕은 계약 테스트 추가 — 컨트롤러 응답의 `data[0].threshold` 가 `typeof === 'string'` 인지 단언하는 `alerts.controller.spec.ts` 신설, 또는 실제 엔드포인트 e2e/통합 테스트 |
| 2 | 문서화 | CHANGELOG·JSDoc 의 원인 서술이 `list()`(단수)만 언급하지만, 실측 결과 `create()`(`POST`)와 `update()`(`PATCH`) 응답도 동일하게 컨트롤러 반환 타입 애노테이션 없이 엔티티를 그대로 반환해 같은 결함을 갖고 있었다. DTO 공유로 결과적으로 3곳 다 고쳐졌으나, 서술이 실제 영향 범위를 축소해 향후 "list() 만 고치면 된다"는 오독 소지 | `CHANGELOG.md:5,27`; `alert-rule-response.dto.ts:22` | "`list`/`create`/`update` 세 응답 모두 반환 타입 애노테이션이 없다"로 정정 |
| 3 | 문서화 | CHANGELOG 신규 항목에 OpenAPI 코드젠 클라이언트 영향(`**영향**:`) 문단이 빠져 있다 — 같은 CHANGELOG 의 다른 DTO 타입 정정 항목(`invitedBy`, `ipWhitelist`, `ExecutionStatusDto` 등)은 전부 이 캐비엇을 명시하는데, 이번 건은 nullable 플립보다 더 파괴적일 수 있는 원시 타입 변경(`number`→`string`)임에도 누락 | `CHANGELOG.md:3-29` | 다른 항목과 동일 형식으로 "OpenAPI 로 타입을 생성하는 클라이언트에서 threshold 가 number → string 으로 바뀐다" 류의 영향 문단 추가 |
| 4 | 문서화/계획 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 실측 서술("불일치 **59**건")과 바로 아래 분류 표 합계(46+6+4+1=**57**)가 어긋난다. 이 수치는 §5.4 drift 2단계(검증자 없는 응답 DTO 78곳) 착수 범위를 정하는 근거이며, 최악의 경우 아직 발견되지 않은 실제 DTO/엔티티 계약 거짓이 최대 2건 더 있을 수 있음을 가리는 것일 수 있다. 같은 커밋 메시지(`a65a4f85e`)에도 동일 수치가 반복돼 일회성 오타가 아니라 원 실측 자체의 계산 오류로 보인다 | `plan/in-progress/spec-draft-nullable-notation-followups.md:276`(문장), `:281-284`(표) | §5.4 2단계 착수 전 원 실측(엔티티↔DTO 23쌍 필드 대조)을 재실행해 59 vs 57 을 재대조하고 문서를 정정. 표에 누락된 항목이 있다면 그 2건이 실제 계약 거짓인지 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `threshold` 필드 JSDoc 이 16줄로 같은 파일 다른 필드(1~3줄) 대비 5배 이상 길어 일관성이 깨진다 — "지금 왜 문자열인가"와 "종전에 왜 틀렸는가"(정정 서사)가 한 블록에 섞임 | `alert-rule-response.dto.ts:20-35` | 코드 JSDoc 은 "지금 무엇을 지켜야 하는가"만 남기고 정정 히스토리는 CHANGELOG 로 위임 |
| 2 | 유지보수성 | CHANGELOG 신규 항목과 DTO JSDoc 이 같은 설명(정밀도 보존 이유·프런트 읽기/쓰기 분리·비대칭 의도)을 거의 동일 문장으로 중복 서술 — SoT 가 둘로 나뉘어 향후 한쪽만 갱신되고 다른 쪽이 stale 로 남을 위험 | `CHANGELOG.md:5-23` vs `alert-rule-response.dto.ts:21-34` | 코드 주석을 짧은 요약 + CHANGELOG 링크로 축약, SoT 단일화 |
| 3 | 유지보수성 | `@ApiProperty({ type: String, ... })` 의 명시적 `type: String` 지정이 같은 파일의 다른 `string` 필드(타입 추론에 맡김)와 스타일이 다름 — 이유가 코드에 드러나지 않음 | `alert-rule-response.dto.ts:36` | 이유를 JSDoc 에 한 줄 남기거나 다른 필드와 스타일 통일 |
| 4 | 유지보수성 | `CHANGELOG.md` 가 release cut 없이 단일 파일에 계속 누적돼 이미 1,800줄+ (이번 diff 는 이 PR 의 책임이 아닌 기존 관례) | `CHANGELOG.md` 전체 | 릴리즈 컷/기간별 파일 분리 등 아카이빙 정책을 저장소 차원에서 검토 (이번 PR 요구사항 아님) |
| 5 | 테스트 | §5.4 drift 2단계(검증자 없는 응답 DTO 78곳) 목록에 `AlertRuleDto`(바로 이번 결함을 촉발한 사례)가 대표 엔드포인트로 명시돼 있는지 plan 문서에서 확인되지 않음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 체크리스트 | 2단계 대표 엔드포인트 후보에 `GET /api/alerts/rules`(`AlertRuleDto`) 명시적으로 추가 |
| 6 | 요구사항/spec | `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 라벨링 — 이 PR 이 명확히 한 "wire·엔티티는 string" 사실과 라벨이 어긋남(diff 범위 밖, 선재 이슈, 코드 결함 아님) | `spec/1-data-model.md:873` | 후속 spec 정리 때 라벨을 String 또는 DB 타입(`Numeric(12,4)`)으로 정정 검토 (planner 트랙) |
| 7 | 범위 | 자매 커밋(`d8b7cb93e`, `invitedBy`)은 캐너리 테스트를 함께 추가했는데 이번 커밋은 테스트 파일 변경이 없음 — scope 이탈(과잉)이 아니라 범위 미달 성격 | `alert-rule-response.dto.ts` | 위 WARNING #1(회귀 테스트 부재)과 동일 조치로 해소 |
| 8 | 보안/API계약 | `threshold` 타입 정정 자체는 실제 wire·내부 유일 소비자(`frontend/src/lib/api/alerts.ts`)와 정합 확인됨 — 순수 문서 정합화이며 런타임 파손 없음 | `alert-rule-response.dto.ts`, `frontend/src/lib/api/alerts.ts` | 조치 불요 |
| 9 | API계약 | `CreateAlertRuleDto.threshold`(쓰기, `number`)와 응답 DTO(`string`)의 읽기/쓰기 비대칭은 이번 diff 가 만든 게 아니라 기존 의도된 설계 | `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts`(diff 밖) | 조치 불요 (범위 밖) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 관점 실질 결함 없음 (인젝션·인증·시크릿·암호화 해당 없음) |
| requirement | LOW | 코드 변경은 엔티티·서비스·프런트와 전수 정합 확인. plan 문서 산술 불일치(59 vs 57) |
| scope | NONE | 3파일 모두 단일 서사(검증자(a) 반증 + threshold 수정)에 결속, 범위 이탈 없음. 캐너리 테스트 부재는 참고(INFO) |
| side_effect | LOW | 저장소 내부 side effect 없음(DTO 미강제 확인). OpenAPI 공개 계약 변경의 codegen 영향은 실질 위험 낮음 |
| maintainability | LOW | JSDoc 과다·CHANGELOG 중복·데코레이터 스타일 비일관 (전부 INFO, 구조적 결함 없음) |
| testing | LOW | 기존 테스트 안 깨짐, 그러나 이 결함 자체를 잡을 회귀 테스트 부재 (WARNING) |
| documentation | LOW | 영향범위 축소 서술 + codegen 영향 고지 누락 + plan 산술 불일치 (WARNING 3건, 코드는 정확) |
| api_contract | LOW | 코드 계약 정정은 실측으로 뒷받침됨. CHANGELOG 코드젠 영향 고지 형식 비일관 (WARNING, documentation 과 중복) |

## 발견 없는 에이전트

- security — 발견사항 0건 (INFO 포함 전무, "발견된 보안 취약점 없음"으로 명시)

## 권장 조치사항

1. `AlertRuleDto`/`GET·POST·PATCH /api/alerts/rules` 에 대한 최소 1건의 계약 테스트를 추가해, 이번에 고친 "타입 문서와 wire 가 어긋나도 아무도 못 잡는" 구조적 원인을 닫는다 (WARNING #1).
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "불일치 59건" 서술을 재실측해 표 합계(57)와 맞추거나 누락 2건을 찾아 반영한다 — §5.4 2단계 착수 범위 산정에 직접 영향 (WARNING #4).
3. CHANGELOG 신규 항목의 원인 서술을 "list() 만"에서 "list/create/update 세 응답 모두"로 정정하고, 같은 파일의 다른 항목들과 동일하게 코드젠 클라이언트 영향(`**영향**:`) 문단을 추가한다 (WARNING #2, #3).
4. (선택) §5.4 2단계 대표 엔드포인트 후보 목록에 `AlertRuleDto`(`GET /api/alerts/rules`)를 명시적으로 추가해 재발을 방지한다 (INFO #5).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(문서/타입 정정)와 무관 |
  | architecture | router 판단상 이번 diff(문서/타입 정정)와 무관 |
  | dependency | router 판단상 이번 diff(문서/타입 정정)와 무관 |
  | database | router 판단상 이번 diff(문서/타입 정정)와 무관 |
  | concurrency | router 판단상 이번 diff(문서/타입 정정)와 무관 |
  | user_guide_sync | router 판단상 이번 diff(문서/타입 정정)와 무관 |