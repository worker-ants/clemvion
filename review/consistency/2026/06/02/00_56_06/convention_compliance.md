# 정식 규약 준수 검토 결과

**대상 경로**: `spec/4-nodes/4-integration/`
**검토 모드**: `--impl-prep` (구현 착수 전 점검)
**검토 일시**: 2026-06-02

---

## 발견사항

### [WARNING] `0-common.md` §3 의 nested envelope 참조 표기 불일치
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §3 "공통 출력 구조" 첫 문장
- **위반 규약**: `spec/conventions/node-output.md` 에는 "Principle 7", "Principle 3", "Principle 2" 등의 번호 체계가 있으며, §3 의 본문이 "CONVENTIONS Principle 7 / §3 의 nested envelope" 라고 표기하고 있음 — 그러나 `node-output.md` 에는 "§3"(섹션3) 이라는 레이블이 없고 "Principle 3" 이다. "Principle 7 / §3" 은 `node-output.md` 내부의 섹션 헤더 번호 혼용으로, `Principle 7` (config echo 원칙) 과 `Principle 3` (에러 컨트랙트 통일) 을 모두 언급하려는 것으로 보이나 `§3` 이 section 3 의 일반 축약인지 `Principle 3` 인지 모호하다.
- **상세**: `node-output.md` 에서 "nested envelope" 를 정의하는 단락은 Principle 0 (5필드), Principle 3.2 (`output.error` envelope), Principle 7 (config echo) 에 분산되어 있다. "Principle 7 / §3 의 nested envelope" 라는 표현은 내부 참조의 정확성이 낮다.
- **제안**: `0-common.md` §3 의 참조 표기를 "CONVENTIONS Principle 0 (5필드 invariant) · Principle 7 (config echo)" 으로 명확히 분리 기재한다.

---

### [WARNING] `3-send-email.md` 의 성공 포트 id `out` — `node-output.md` Principle 5 와 비표준
- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 및 §5.1 JSON 예시
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 의 port 활성화 모델 표에서 `port: undefined` 는 "기본 단일 출력" 에 해당하고 예시 노드로 `send_email` 을 명시함. 그러나 `send_email` 스펙은 `port: 'out'` 을 명시적으로 사용하고 있다 (`"port": "out"` 이 §5.1 JSON 예시에 포함됨). Principle 5 는 `send_email` 에서 `port: undefined` 를 기대한다.
- **상세**: Principle 5 주석에 `send_email` 이 `port: undefined` 의 예시 노드로 등재되어 있으나, `3-send-email.md` §3.2 출력 포트 표에는 `out` 포트가 명시되고 §5.1 예시 JSON 에도 `"port": "out"` 이 기재되어 있다. 양쪽이 상충한다.
- **제안**: 둘 중 하나를 기준으로 통일해야 한다. (a) `send_email` 이 명시적 `out` 포트를 갖기로 확정했다면 `node-output.md` Principle 5 표의 예시 노드 목록에서 `send_email` 을 제거하거나 `port: string` 행으로 이동한다. (b) 반대로 `port: undefined` 로 통일하기로 결정한다면 `3-send-email.md` §5.1 JSON 예시에서 `"port": "out"` 을 제거한다. 구현 착수 전에 이 불일치를 `project-planner` 에 위임해 spec 을 정정해야 한다.

---

### [WARNING] `2-database-query.md` SSRF 가드 차단 에러 코드 — `INTEGRATION_CALL_FAILED` 로 fallback, 전용 코드 없음 (노드 간 비일관성)
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 실행 로직 SSRF 가드 박스
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 ("code 는 UPPER_SNAKE_CASE") 자체에는 위반 없으나, 같은 폴더 내 `0-common.md` §4.2 공통 에러 코드 표에서 `INTEGRATION_CALL_FAILED` 는 "기타 일반 예외(분류되지 않은 실패)" fallback 으로 정의되어 있다. 동일 SSRF 가드가 `1-http-request.md` 에서는 `HTTP_BLOCKED`, `3-send-email.md` 에서는 `EMAIL_HOST_BLOCKED` 라는 전용 코드를 가지는 반면, `2-database-query.md` 는 `INTEGRATION_CALL_FAILED` fallback 을 사용한다. spec 본문도 "향후 통일 후보" 라고 스스로 인정한다.
- **상세**: `0-common.md` §4.2 에 `INTEGRATION_CALL_FAILED` 를 "기타 일반 예외" 로 정의하므로 규약 위반은 아니나, 다른 노드와 달리 SSRF 차단을 전용 에러 코드 없이 fallback 으로 처리하면 downstream 표현식 분기가 `database_query` 에서만 다르게 작동한다. 이는 "노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능" 을 목표로 하는 Principle 0 의 설계 목표에 반하는 일관성 흠결이다.
- **제안**: 구현 착수 전에 `spec/4-nodes/4-integration/2-database-query.md` 에 `DB_HOST_BLOCKED` (또는 `INTEGRATION_HOST_BLOCKED`) 전용 코드를 추가하고 §6.2 에러 코드 표에도 등재하는 것을 project-planner 와 협의한다. 대안으로 통합 공통 코드 (`INTEGRATION_HOST_BLOCKED`) 를 `0-common.md` §4.2 에 신설하는 방법도 있다.

---

### [WARNING] `4-cafe24.md` — `status: partial` 이나 `4-cafe24.md` §3.2 포트에 rate-limit 미반영 여지
- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` frontmatter `status: partial` 및 `pending_plans`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` 의 frontmatter `status` 값 관리 정책과 CLAUDE.md 의 "spec/ 변경 → project-planner" 규칙 자체에는 위반 없음. 다만 `pending_plans` 에 기재된 `plan/in-progress/cafe24-restricted-scopes-followups.md` 와 현재 worktree 의 plan `plan/in-progress/cafe24-install-ratelimit.md` 가 모두 `spec/4-nodes/4-integration/4-cafe24.md` 를 건드릴 계획이므로, 구현 착수 시 두 plan 의 spec 수정 충돌 범위를 사전 확인해야 한다.
- **상세**: `4-cafe24.md` §6 에러 코드 표는 truncation (`...`) 으로 잘려 있어 전체 에러 코드 확인이 불가했다. prompt payload 의 표시 한도 문제이나, 실제 파일에서 `CAFE24_INSTALL_RATELIMIT` 관련 코드가 추가될 경우 §6 표에도 반영되어야 한다.
- **제안**: 구현 전 `spec/4-nodes/4-integration/4-cafe24.md` 전체를 재검토하여 rate-limit 재시도 소진 코드 (`CAFE24_RATE_LIMITED`) 가 §6 에 이미 정의되어 있는지, 새 코드가 추가되어야 하는지 확인한다.

---

### [INFO] `0-common.md` §4.1 Step 6 — `logUsage` 의 `api` 채우기 책임 표기가 단일 진실 참조만 함
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §4.1 단계 6
- **위반 규약**: 없음 (CLAUDE.md 단일 진실 원칙 준수). 다만 `_product-overview.md INT-US-05` 를 단일 진실로 위임하면서 공통 문서에서 세부 정책을 반복하지 않으므로 가독성을 위한 참조가 충분한지 여부.
- **상세**: 각 노드 문서 (§1~§4)가 각자 `api_label` / `api_method` / `api_path` 채우기 정책을 직접 기술하고 있어 단일 진실 준수 여부는 양호하다. INFO 수준 메모.
- **제안**: 현행 유지 가능. 향후 노드 추가 시 참조 패턴을 일관 유지한다.

---

### [INFO] 문서 구조 규약 — `0-common.md` 에 `## Rationale` 섹션 없음
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 전체
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
- **상세**: `0-common.md` 는 Overview 와 본문 섹션(§1~§7)은 있으나 `## Rationale` 섹션이 없다. 3섹션 구조는 "권장"이므로 CRITICAL/WARNING 에 해당하지는 않는다. `3-send-email.md` 는 `## 8. Rationale` 을 포함하여 모범을 보이고 있다.
- **제안**: 공통 규약 (`0-common.md`) 에도 `## Rationale` 섹션을 추가하여 D4 결정 (모든 에러를 error 포트로 라우팅), `meta.durationMs` 통일 결정, Usage 로깅 의무화 결정의 배경을 기술하면 미래 기여자에게 도움이 된다.

---

### [INFO] `cafe24-api-catalog/application.md` `paginated` 컬럼 — `scripttags_list` 가 paginated 비어있음
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` 표의 `scripttags_list` 행
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §2 컬럼 정의 — `paginated: ✓ 또는 빈 칸`
- **상세**: `scripttags_list` 는 `paginated` 컬럼이 비어 있다. 빈 칸은 "paginated 아님" 의 의미로 규약에 정의되어 있으므로 규약 위반은 아니다. 단, 실제 Cafe24 API 문서에서 `scripttags` 는 `limit`/`offset` 페이지네이션을 지원하므로 업무상 재확인이 필요할 수 있다. INFO 수준.
- **제안**: Cafe24 공식 docs 에서 `GET /scripttags` 가 `limit`/`offset` 파라미터를 지원하는지 재확인 후, 지원하면 `✓` 로 갱신 및 `catalog-sync.spec.ts` 재통과 확인.

---

## 요약

`spec/4-nodes/4-integration/` 의 문서들은 전반적으로 `spec/conventions/node-output.md` 의 Principle 체계 (0–11) 를 충실히 준수하고 있다. 5필드 invariant (Principle 0), config echo (Principle 7), 에러 컨트랙트 (Principle 3.2 UPPER_SNAKE_CASE), 출력 예시 포맷 (Principle 11), `meta.durationMs` 통일 (§6.1) 모두 규약에 부합한다. CRITICAL 위반은 없다. 다만 두 가지 WARNING 이 구현 착수 전에 해소되어야 한다: (1) `send_email` 의 성공 포트 id `out` vs Principle 5 의 `port: undefined` 예시 목록 간 불일치 — `node-output.md` 또는 `3-send-email.md` 중 한 곳을 정정해야 invariant 가 깨지지 않는다. (2) `database_query` 의 SSRF 차단 에러 코드가 `INTEGRATION_CALL_FAILED` fallback 을 사용해 `http_request` (`HTTP_BLOCKED`) / `send_email` (`EMAIL_HOST_BLOCKED`) 와 비일관 — 구현 전 전용 코드 신설 여부를 결정해야 한다.

---

## 위험도

**MEDIUM**

(CRITICAL 위반 없음, WARNING 2건이 구현 착수 전 spec 조정 필요 — 방치 시 구현이 규약과 어긋난 상태로 굳어질 위험)
