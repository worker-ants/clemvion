# 정식 규약 준수 검토 결과

> target: `spec/4-nodes/4-integration/` (전체 5개 노드 spec + 공통 규약)
> 검토 모드: `--impl-done`, `scope=spec/4-nodes/4-integration/`, `diff-base=origin/main`
> 검토 일시: 2026-06-11

---

## 발견사항

### [WARNING] `2-database-query.md` — `Rationale` 섹션 위치 규약 미준수 (`##` 아닌 소제목)
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` 문서 끝 `## Rationale` 섹션
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` + `CLAUDE.md` "정보 저장 위치" — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 에 두도록 명시. 또한 CLAUDE.md 는 spec 3섹션 구성을 "Overview / 본문 / Rationale" 로 권장.
- **상세**: `2-database-query.md` 의 `## Rationale` 섹션은 파일 끝에 올바르게 위치해 있다. 그러나 내부 소제목이 `### 풀 캐시 멀티 인스턴스 무효화 — Redis pub/sub broadcast (2026-06-11, refactor 04 m-4)` 형태로 날짜·작업명 내부 메모를 제목에 포함하고 있다. 규약은 근거 기술을 요구하지, commit/task 메타 정보를 제목에 박는 것을 요구하지 않는다. 날짜·태스크 코드(`refactor 04 m-4`)는 title 이 아니라 본문 내부 맥락 표시로 두는 것이 관례에 더 가깝다.
- **제안**: 소제목을 `### Redis pub/sub 멀티 인스턴스 풀 캐시 무효화 채택 근거` 등 순수 근거 기술 형태로 변경하고, 날짜·태스크 코드는 본문 첫 줄에 맥락 주석으로 이동. 규약 자체를 갱신할 필요는 없음.

---

### [WARNING] `2-database-query.md` — `meta.rowCount` 이중 위치 언급이 `spec/conventions/node-output.md` Principle 2와 tension
- **target 위치**: `spec/4-nodes/4-integration/0-common.md §6` 및 `2-database-query.md §5.1` 필드 설명 주석
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 — `meta` 는 "실행 메트릭만" 담는다. Principle 2 표에 `meta.rowCount` 가 DB 계열 권장 필드로 명시됨. 동시에 `output.rowCount` 도 정의되어 있음.
- **상세**: `0-common.md §6` 의 필드 설명표에서 `meta` 항목이 `meta.rowCount (output.rowCount 와 중복 가능 — output 은 도메인, meta 는 메트릭 측면)`으로 기술하여 중복을 용인하고 있다. 그러나 `2-database-query.md §5.1` 의 `rowCount` 필드 설명 주석은 `rowCount 는 형식상 메트릭이지만, 워크플로우 분기(if rowCount > 0)의 비즈니스 판단 재료로 사용되어 output 에 유지한다... meta 에 복제하지 않는다`고 서로 반대의 정책을 선언하고 있다. 즉 `0-common.md` 는 `meta.rowCount` 도 가능하다고 하고, `2-database-query.md` 는 `meta 에 복제하지 않는다`고 명시한다. 이 두 선언이 상충한다. 실제 출력 JSON 예시(§5.1.1~5.1.3)에는 `meta: { "durationMs": ... }` 만 있고 `meta.rowCount` 는 미포함 — `2-database-query.md` 의 "복제하지 않는다" 정책이 실제 구현 상태. `0-common.md` 의 `meta.rowCount` 용인 기술이 혼란을 만든다.
- **제안**: `0-common.md §6` DB 행에서 `meta.rowCount (output.rowCount 와 중복 가능)` 괄호 문구를 제거하고 `meta.durationMs` 만 명시. `2-database-query.md` 의 "meta 에 복제하지 않는다" 정책이 단일 진실이 되도록 정렬.

---

### [WARNING] `3-send-email.md §3.2` — 출력 포트 id가 `out` 이며 다른 노드와 비일관적
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md §3.2` 출력 포트 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 — `port: undefined` (기본 단일 출력) 예시에 `send_email` 을 열거하면서 `port: undefined` 케이스로 분류하고 있다. 그러나 `3-send-email.md §5.1` 출력 JSON 에는 `"port": "out"` 이 명시되어 있다. 또한 Principle 6 시스템 포트 예약어 목록에 `out` 이 포함되어 있어 `out` 은 시스템 예약 포트다. 반면 HTTP Request / Database Query / Cafe24 / MakeShop 은 모두 `success` 포트를 정상 출력에 사용한다.
- **상세**: `send_email` 만 정상 포트가 `out` 으로 다른 Integration 노드들의 `success` 와 달라 노드 간 포트 네이밍 일관성이 없다. `node-output.md` Principle 5 표에서도 `send_email` 을 `port: undefined`(단일 출력) 케이스로 분류해두었지만 실제 spec 에는 `port: 'out'` 이 기술되어 있어 규약 표기와 spec 간 불일치도 존재한다.
- **제안**: `send_email` 의 정상 출력 포트를 `success` 로 통일하거나, 의도적으로 `out` 을 유지한다면 `node-output.md` Principle 5 표에서 `send_email` 을 `port: undefined` 가 아닌 `port: 'out'` 예시로 명확히 수정. 단 Principle 6 예약어 목록의 `out` 과의 충돌 여부도 검토 필요.

---

### [INFO] `1-http-request.md §5.8` — 절 번호 의도적 공백(`§5.2` 미존재)이 문서 내 선언만으로 처리됨
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §5` 서두 주석
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 — 출력 문서화 케이스 분리 방식(성공/에러/재개 등). 규약 자체가 절 번호 비워두기를 금지하진 않으나 일관성 관점에서 언급.
- **상세**: `1-http-request.md §5` 서두에 `절 번호: 성공(§5.1) / 에러(§5.3) 두 케이스만 존재한다. §5.2 는 의도적으로 비어 있다(연번 보존용).` 고 명시해 의도를 문서화하고 있다. 규약 위반은 아니나 `2-database-query.md` 도 동일하게 `§5.2` 가 없고 같은 패턴을 쓰는데 `1-http-request.md` 처럼 명시적 주석이 없다. 두 문서 간 설명 방식 소폭 불일치.
- **제안**: `2-database-query.md §5` 서두에도 동일하게 `§5.2 는 의도적으로 비어 있다` 주석 추가 (또는 양쪽 모두 주석 제거하여 일관성 통일).

---

### [INFO] `2-database-query.md` — `status: implemented` 이지만 `pending_plans` 미포함 + `integration-cache-bus.service.ts` 신규 `code:` 경로 추가가 정합
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 는 `code: ≥1 매치 의무`, `pending_plans` 없음 이 정상.
- **상세**: `2-database-query.md` frontmatter 에 새롭게 `codebase/backend/src/common/redis/integration-cache-bus.service.ts` 가 `code:` 경로로 추가되었다. 이는 Redis pub/sub 무효화 구현을 반영하는 올바른 갱신이다. `status: implemented` + `pending_plans` 없음 조합도 정상이다. 위반 없음 — 정보성 확인.
- **제안**: 특별히 조치 불필요. frontmatter 갱신이 규약과 정합함을 확인.

---

### [INFO] `cafe24-api-catalog/application/appstore-orders.md` — `order` 응답 필드 설명이 "정렬 순서"로 잘못 기술됨
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `GET /api/v2/admin/appstore/orders/{order_id}` 응답 표, `order` 행
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — 출처는 Cafe24 공식 API docs 의 결정적 파싱이어야 하며, 추측 주입 금지.
- **상세**: 응답 표의 `order` wrapper 행 설명이 `정렬 순서 asc : 순차정렬 · desc : 역순 정렬`로 되어 있는데, 이는 다른 endpoint 의 `order` (정렬 파라미터) 설명이 잘못 복사된 것으로 보인다. `order` wrapper 는 단순 응답 객체 래퍼이므로 `(응답 객체)` 로 표기해야 한다. `POST /api/v2/admin/appstore/orders` 응답 표에서도 동일 오류.
- **제안**: 두 operation 의 `order` wrapper 행 설명을 `(응답 객체)` 로 수정. 생성기 재실행으로 자동 수정 가능하나 수동 수정도 허용됨 (`_overview.md §7.3` 기준).

---

## 요약

`spec/4-nodes/4-integration/` 전체는 `spec/conventions/node-output.md` 의 5필드 invariant(Principle 0), config echo(Principle 7), 에러 컨트랙트(Principle 3), 출력 문서화(Principle 11) 를 전반적으로 잘 준수하고 있다. 주요 이슈는 두 가지다: (1) `0-common.md §6` 와 `2-database-query.md §5.1` 사이에서 `meta.rowCount` 중복 허용 여부가 상충하는 내부 일관성 갭 (WARNING), (2) `send_email` 의 정상 출력 포트가 `out` 이고 다른 Integration 노드들이 `success` 를 쓰는 포트 네이밍 비일관성 + `node-output.md` Principle 5 표기와의 불일치 (WARNING). `2-database-query.md` 의 핵심 신규 내용(Redis pub/sub 풀 캐시 무효화 Rationale, `integration-cache-bus.service.ts` `code:` 등록)은 규약과 정합하다. `cafe24-api-catalog/application/appstore-orders.md` 의 응답 설명 오기는 생성기 산출물 오류로 사소한 INFO 수준이다.

## 위험도

LOW
