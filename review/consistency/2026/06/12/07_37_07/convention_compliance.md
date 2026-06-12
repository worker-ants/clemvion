# Convention Compliance Review
**Target**: `spec/4-nodes/4-integration/`
**Mode**: 구현 완료 후 검토 (`--impl-done`, diff-base=origin/main)
**Date**: 2026-06-12

---

## 발견사항

### [INFO] `0-common.md` — 문서 구조: 독립 Rationale 섹션 없음
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 전체
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `0-common.md` 는 `## 1` ~ `## 7` 절로 끝나며 `## Rationale` 섹션이 없다. 다른 Integration 노드 문서(1-http-request §8 Rationale, 2-database-query Rationale, 3-send-email §8 Rationale)는 모두 Rationale 을 갖는다.
- **제안**: 문서 말미에 `## Rationale` 섹션을 추가하거나, 주요 결정(D4 통합 에러 라우팅, `meta.durationMs` 통일, `clampMessage` 패턴 등)의 근거를 해당 절에 이동. 현재 근거는 §4.2, §6.1 등 본문에 인라인으로 산재.

---

### [WARNING] `1-http-request.md §5.3.2` — transport 실패 시 `output.response` 에 legacy 잔재 포함 (Principle 1/8 위반 인지 후 미제거)
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 (Transport 실패) — `output.response` 필드 및 설명 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 1 ("output 은 비즈니스 결과물만"), Principle 8.1 (불필요한 중첩 제거)
- **상세**: §5.3.2 예시에서 transport 실패 시 `output.response = { "error": "ECONNREFUSED" }` 를 포함한다. 이 값은 실제 HTTP 응답 body 가 아니라 핸들러가 직접 채운 내부 에러 표현이며, 같은 정보가 `output.error.message` 에도 존재한다. 설명 표에 "legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용" 이라고 자체 명시돼 있어 규약 위반임을 인지했으나 제거 계획이 없다. 이 패턴을 따라 새 노드를 구현하면 동일한 중복이 재생산된다.
- **제안**: spec 내부에 `output.response` 가 transport 실패 시 제거될 예정임을 명기하거나(`Planned: 제거`), Rationale §8.x 에 "현재 구현이 legacy 잔재를 유지하는 이유와 향후 제거 계획"을 기술. 동시에 `0-common.md §7` 출력 색인 표에서 http_request 에러 케이스의 `output.response` 존재 여부도 명확히 할 것.

---

### [WARNING] `3-send-email.md §5.1` — `meta.deliveryStatus` 가 `node-output.md` Principle 2 열거 목록에 없음
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.1 / §5.3 / §5.5 — `meta.deliveryStatus`
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 ("meta 는 실행 메트릭만") — 이메일 노드에 해당하는 meta 필드가 명시되지 않음 (HTTP 행: `statusCode, durationMs` / DB 행: `durationMs, rowCount` 는 열거되지만 이메일 행은 없음)
- **상세**: `meta.deliveryStatus: 'sent' | 'failed'` 는 Principle 2 열거 표에 없는 비표준 필드다. 성공/실패 구분은 이미 `port` 와 `output.error` 로 표현되며, `deliveryStatus` 는 비즈니스 상태값에 더 가깝다. spec 자체도 "향후 enum 확장 예정 (개선안 §3)"이라고 미완임을 인정한다.
- **제안**: (A) `meta.deliveryStatus` 를 `output.deliveryStatus` 로 이동해 Principle 1 의 비즈니스 결과물 위치에 맞추거나, (B) `node-output.md` Principle 2 에 이메일 행(`meta.durationMs, meta.deliveryStatus`)을 추가하고 `deliveryStatus` 를 메트릭으로 정당화하는 근거를 기록. 두 문서의 진술이 현재 불일치하므로 규약 갱신 또는 출력 재배치가 필요.

---

### [INFO] `2-database-query.md §5.1` — `meta.rowCount` 규약 목록 vs spec 결정 충돌 미해소
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §5.1 출력 필드 표 각주
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 ("DB 행 — `meta.durationMs, meta.rowCount`")
- **상세**: Principle 2 는 DB 노드의 `meta` 에 `meta.rowCount` 를 열거한다. 그러나 `2-database-query.md §5.1` 은 `rowCount` 를 `output.rowCount` 에만 두고 "`meta` 에 복제하지 않는다"고 명시해 conventions 목록과 직접 충돌한다. 의식적인 결정이 spec 에 기록됐으나 규약 문서는 갱신되지 않았다.
- **제안**: `node-output.md` Principle 2 의 DB 행에서 `meta.rowCount` 를 제거하거나 "Database Query 는 `output.rowCount` 에 비즈니스 접근용으로 유지하며 meta 에 중복 포함하지 않는다"는 주석을 추가. 규약 문서 갱신이 적절.

---

### [INFO] `3-send-email.md §5.4` — `status: 'requires_integration'` 이 5필드 invariant 예외 목록에 미등재
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.4 (Integration stub 케이스)
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 ("5필드 invariant") — 허용 `status` 값 목록
- **상세**: §5.4 예시는 `status: 'requires_integration'` 을 사용한다. Principle 0 의 허용 `status` 값은 `waiting_for_input`, `resumed`, `ended` 이며 `'requires_integration'` 은 열거에 없다. Principle 0 의 internal top-level 필드 예외 절에도 없다. 실사용 경로가 "단위 테스트·부팅 단계만"이라는 점에서 prod 영향은 낮으나 규약과 어긋난 값이 spec 에 기록됐다.
- **제안**: `node-output.md` Principle 0 의 status enum 또는 예외 절에 `'requires_integration'` (DI 미주입 환경 전용 escape hatch)을 명시 등재. 해당 값이 prod 비노출이라면 그 사실도 함께 기록.

---

### [INFO] SSRF 에러 코드 명명 — `HTTP_BLOCKED` / `DB_HOST_BLOCKED` / `EMAIL_HOST_BLOCKED` 동일 조건 삼분화
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §6`, `2-database-query.md §6.2`, `3-send-email.md §5.3`
- **위반 규약**: `spec/conventions/error-codes.md` §1 의미 기반 명명 ("도메인 prefix 권장: `<DOMAIN>_<CONDITION>`")
- **상세**: 동일한 SSRF 가드 차단 조건에 대해 세 노드가 서로 다른 에러 코드를 발행한다. `0-common.md §4 SSRF opt-out callout` 은 "세 노드가 동일 메커니즘·플래그를 공유한다"고 명시하지만 surface 코드는 삼분화돼 있다. 이는 규약 §1 의 "의미를 기술" 원칙과 거리가 있고, 클라이언트가 SSRF 차단을 공통 처리하려면 3개 코드를 모두 열거해야 하는 부담을 준다. 그러나 기존 코드 rename 은 §2 안정성 정책상 breaking change이므로 신규 통합 코드 신설 외 방법이 없다.
- **제안**: 이 패턴이 의도적이라면(노드별 출처 구분 목적) `error-codes.md §3` Historical-artifact 예외 레지스트리에 등재 + 정당화 근거 기록. 향후 공통 코드로 통일을 검토하는 경우 신규 코드 신설(§2 절차) 후 점진 이전.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` wrapper 설명 오기
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — GET/POST 응답 표의 최상위 `order` 행 설명 컬럼
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §7.3 ("추측·날조로 field·샘플을 채우지 않는다")
- **상세**: GET 및 POST 응답 표에서 최상위 `order` wrapper 의 `설명` 컬럼이 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬"로 기재돼 있다. 이는 명백히 다른 endpoint 의 정렬 파라미터 설명이 잘못 복사된 것이며, wrapper 설명은 `(응답 객체)` 여야 한다 (`apps.md` 의 동일 wrapper 패턴 참고).
- **제안**: `appstore-orders.md` 의 응답 표에서 최상위 `order` 행 설명을 `(응답 객체)` 로 수정.

---

## 요약

`spec/4-nodes/4-integration/` 의 Integration 노드 spec 군은 전반적으로 `spec/conventions/node-output.md` 의 5필드 invariant(Principle 0), config echo(Principle 7), 에러 컨트랙트(Principle 3.2), 출력 문서화 규칙(Principle 11)을 충실히 따른다. D4 결정(에러 포트 라우팅 통일)과 `meta.durationMs` 명명 통일도 일관되게 반영됐다. 처리가 필요한 부분은 세 가지다: (1) `meta.deliveryStatus` 가 Principle 2 열거 목록에 없는 상태로 spec 에 존재하는 점, (2) transport 실패 시 `output.response` legacy 잔재가 규약 위반임을 인지하면서도 제거 계획 없이 spec 에 남아 있는 점, (3) `meta.rowCount` 를 둘러싼 conventions 문서와 Database Query spec 간 진술 충돌이 미해소 상태인 점. 나머지 항목은 형식 일관성·문서 구조 수준의 INFO다. `appstore-orders.md` 의 설명 오기는 카탈로그 정확성 원칙 위반으로 별도 수정이 필요하다.

---

## 위험도

LOW
