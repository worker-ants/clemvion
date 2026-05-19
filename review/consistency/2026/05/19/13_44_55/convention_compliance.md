# 정식 규약 준수 검토 — convention_compliance

- target: `plan/in-progress/spec-followup-cron-7d-statemachine.md`
- 검토 모드: spec draft (`--spec`)
- 검토일: 2026-05-19

---

## 발견사항

### 1. 명명 규약

- **[INFO]** plan 파일명 자체는 규약 준수
  - target 위치: 파일명 `spec-followup-cron-7d-statemachine.md`
  - 위반 규약: CLAUDE.md §정보 저장 위치 — `plan/in-progress/<name>.md`
  - 상세: 파일명이 kebab-case 소문자로 구성되어 있으며, 위치(`plan/in-progress/`)가 정확하다. frontmatter 의 `worktree`, `started`, `owner` 3개 필수 키가 모두 존재한다.
  - 제안: 해당 없음.

- **[INFO]** 변경 대상 spec 파일 경로 `spec/4-nodes/4-integration/_product-overview.md` 는 규약 준수
  - target 위치: A-4 절
  - 위반 규약: CLAUDE.md §정보 저장 위치 — `spec/<영역>/_product-overview.md`
  - 상세: 제품 정의·요구사항의 경우 `_product-overview.md` 명명을 사용하도록 규정되어 있으며, 이 파일은 그 규칙을 따르고 있다.
  - 제안: 해당 없음.

- **[INFO]** 변경 대상 파일 `spec/0-overview.md` — `0-` prefix 확인
  - target 위치: A-3 절
  - 위반 규약: CLAUDE.md 명시적 언급 (`0-` prefix 등 CLAUDE.md 의 명명 컨벤션)
  - 상세: CLAUDE.md 에서 `0-` prefix 가 명명 컨벤션의 예시로 언급된다. `spec/0-overview.md` 는 이 패턴을 따르고 있다. plan 문서가 이 경로를 변경 대상으로 정확하게 참조하고 있다.
  - 제안: 해당 없음.

---

### 2. 출력 포맷 규약

- **[INFO]** `§1.4 의 Rationale 절 — scheduler ID 표기`
  - target 위치: A-1 의 Rationale draft (`cafe24-background-refresh-daily` 항목)
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 (5-필드 invariant) 와는 직접 관련 없음; 해당 규약은 NodeHandlerOutput 포맷을 정의하며 spec 문서 내 데이터 포맷 서술에 직접 적용되지 않음
  - 상세: plan 이 변경하려는 spec 파일들은 API 응답 포맷 또는 이벤트 페이로드가 아닌 cron 정책·상태머신 전이를 다룬다. `node-output.md` 의 Principle 3.2 (`output.error.code` 는 `UPPER_SNAKE_CASE`) 같은 규약과 직접 충돌하는 서술은 없다.
  - 제안: 해당 없음.

- **[WARNING]** B-1 Rationale draft 의 에러 포트 finalize 서술이 `node-output.md` Principle 3 과 정합 여부 검토 권장
  - target 위치: B-1 Rationale draft (`port='error', status='ended'`)
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — `output.error` 표준 형태; Principle 0 — `port` 필드 의미
  - 상세: plan 본문에서 spec §7.9 를 `port='error', status='ended'` 로 finalize 된다고 서술한다. `node-output.md` Principle 0 에서 `status` 필드의 값은 `waiting_for_input`, `resumed`, `ended` 등이며, `port` 는 라우팅 포트 ID 를 의미한다. `port='error'` 는 Principle 3.3 의 "반드시 `error` 포트를 갖는 노드" 목록에 `ai_agent` 가 포함되어 있어 정합하다. 그러나 `status='ended'` 와 `port='error'` 의 동시 조합이 Principle 4.1 의 상태 전이 다이어그램과 일치하는지 실제 spec §7.9 내용을 추가로 교차 검증하는 것이 안전하다. 본 plan 은 이 finalize shape 을 사실로 전제하고 있으나, plan 문서 자체가 spec 을 정의하는 것이 아니라 기존 spec 의 변경 위치를 기술하는 것이므로 spec §7.9 원본과 일치하는 한 문제없다.
  - 제안: 특별한 수정 불필요. 단, 실제 spec write 시 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 의 `port='error', status='ended'` 정의가 `node-output.md` Principle 3·4 와 정합하는지 확인 권장.

---

### 3. 문서 구조 규약

- **[INFO]** plan 문서 자체의 3섹션 구조 (Overview / 본문 / Rationale) 미적용은 정상
  - target 위치: 문서 전체 구조
  - 위반 규약: CLAUDE.md — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
  - 상세: 3섹션 구조 권장은 `spec/<영역>/*.md` 기술 명세 문서에 적용된다. `plan/in-progress/` 문서는 작업 추적 파일로, CLAUDE.md 에서 해당 형식을 명시하지 않는다. plan 문서가 "배경 / 변경 대상 / 결정 사항 / 진행 계획 / side-effect / 후속" 구조를 취하는 것은 plan 문서의 전형적 패턴으로 규약 위반이 아니다.
  - 제안: 해당 없음.

- **[WARNING]** 변경 대상 spec 파일들에 Rationale 절 추가 방식 — "본문 내 inline Rationale 절" vs "문서 끝 `## Rationale`" 혼용 주의
  - target 위치: 결정 사항 절 — "각 spec 문서 끝 `## Rationale` 절 (또는 본문에 inline Rationale 절이 있는 경우 거기에)"
  - 위반 규약: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
  - 상세: CLAUDE.md 는 Rationale 의 위치를 "해당 spec 문서 끝의 `## Rationale`" 로 단일화한다. plan 의 결정 사항 절은 "본문에 inline Rationale 절이 있는 경우 거기에" 라는 조건부 예외를 허용하고 있다. 이 예외가 기존 spec 문서의 실제 구조(일부 spec 문서는 § 절 안에 inline Rationale 소절을 두기도 함)를 수용한 실용적 판단이라면, 규약의 정신(결정 근거를 spec 문서 내에 보존)은 충족된다. 단, CLAUDE.md 의 단일 위치 원칙과 미세하게 거리가 있는 서술이다.
  - 제안: 실제 spec write 시 각 파일의 기존 패턴에 따르되, 가능하면 문서 끝 `## Rationale` 절에 통일하는 것이 CLAUDE.md 단일 진실 원칙에 더 정합한다. 규약 자체를 갱신해 "inline Rationale 절" 을 공식 허용하는 것도 검토 가능.

- **[INFO]** A-1 Rationale draft 의 "옛 결정 폐기 명시" 패턴은 규약 정신에 부합
  - target 위치: A-1 Rationale draft 마지막 줄 ("옛 결정 (…) 은 본 절로 대체")
  - 위반 규약: 해당 없음
  - 상세: CLAUDE.md 는 "결정의 배경·근거" 를 Rationale 에 둘 것을 요구하며, 옛 결정의 폐기 사유를 명시하는 것은 이력 연속성 유지에 기여한다. plan 이 명시적으로 옛 결정 제목을 인용하고 대체 사유를 서술하는 방식은 규약의 의도에 정합한다.
  - 제안: 해당 없음.

---

### 4. API 문서 규약 (OpenAPI/Swagger)

- **[INFO]** 변경 대상 spec 파일들은 Swagger 데코레이터·DTO 명명과 무관
  - target 위치: 전체
  - 위반 규약: `spec/conventions/swagger.md` — DTO 명명, 데코레이터 패턴
  - 상세: 본 plan 이 다루는 spec 변경은 cron 정책, 상태머신 전이, Rationale 서술 갱신이다. 신규 API endpoint 정의나 DTO 추가가 없으므로 `swagger.md` 규약의 적용 대상이 아니다.
  - 제안: 해당 없음.

- **[INFO]** `cafe24-api-catalog` / `cafe24-api-metadata` 규약과의 충돌 없음
  - target 위치: A 절 전체
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-api-metadata.md`
  - 상세: plan 이 변경하는 cron 주기·cutoff 값은 BullMQ 스케줄러 설정이며, Cafe24 API Catalog 의 `status` enum (`supported`/`planned`/`deprecated`) 또는 endpoint 메타데이터 행과 무관하다. scheduler ID `cafe24-background-refresh-daily` 는 BullMQ 식별자이며 카탈로그의 `id` 컬럼 (`<resource>_<verb>` 패턴) 과 별개 네임스페이스다. 두 체계가 혼동될 우려는 없다.
  - 제안: 해당 없음.

---

### 5. 금지 항목

- **[INFO]** 금지 패턴 위반 없음 — Rationale 내 "대안 검토" 절 포함 여부
  - target 위치: A-1 Rationale draft ("대안 검토" 소절)
  - 위반 규약: 해당 없음 (명시적 금지 항목 없음)
  - 상세: conventions 어느 파일도 Rationale 내 대안 검토 서술을 금지하지 않는다. 오히려 폐기 사유 + 대안 검토가 포함된 Rationale 이 더 완전한 문서다.
  - 제안: 해당 없음.

- **[INFO]** `node-output.md` Principle 4.2 에서 폐기 선언된 `_multiTurnState` 필드 — plan 에서 언급 없음
  - target 위치: B 절 전체
  - 위반 규약: `spec/conventions/node-output.md` Principle 4.2 — `_multiTurnState → _resumeState` 통일
  - 상세: plan 의 B-1 항목은 Execution 상태머신 전이 표와 Rationale 을 다루며, `_multiTurnState` 또는 `_resumeState` 같은 internal 필드를 새로 도입하거나 변경하지 않는다. 기존 `node-output.md` 폐기 선언과 충돌이 없다.
  - 제안: 해당 없음.

- **[INFO]** `migrations.md` 규약 — plan 이 마이그레이션 파일 변경을 포함하지 않음
  - target 위치: 전체
  - 위반 규약: `spec/conventions/migrations.md` §1 명명 규약, §3 Append-only 원칙
  - 상세: 본 plan 은 spec 문서 갱신만 다루며, DB 스키마 마이그레이션 파일을 추가·수정하지 않는다.
  - 제안: 해당 없음.

---

### 6. 기타 — plan 문서 품질 관점

- **[INFO]** frontmatter 필수 키 `worktree`, `started`, `owner` 모두 존재하며 형식 정합
  - target 위치: frontmatter (line 1-5)
  - 위반 규약: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마
  - 상세: `worktree: spec-followup-cron-7d-statemachine-868886`, `started: 2026-05-19`, `owner: project-planner` 가 모두 정확한 형식으로 기재되어 있다.
  - 제안: 해당 없음.

- **[INFO]** plan 에 미체크 체크박스(`[ ]`) 가 없어 `in-progress` 분류의 의미가 모호할 수 있음
  - target 위치: 문서 전체
  - 위반 규약: `.claude/docs/plan-lifecycle.md` §2 분류 기준 — "미체크 체크박스(`[ ]`)… 하나라도 있으면 `in-progress/`"
  - 상세: 역논리로, 미체크 체크박스가 없더라도 실제 spec write 작업이 미완료 상태라면 `in-progress/` 위치가 적절하다. plan 은 체크박스 형식을 사용하지 않고 서술형 변경 명세로 구성되어 있다. 체크박스가 없다는 것이 규약 위반은 아니나, 추적 가시성을 높이기 위해 "변경 대상 파일별 완료 여부" 를 체크리스트로 전환하는 것을 검토할 수 있다.
  - 제안: 강제 아님. 필요 시 각 변경 대상 파일(A-1 ~ A-4, B-1)을 체크박스 항목으로 전환하면 `complete/` 이동 시점 판단이 명확해진다.

---

## 요약

`plan/in-progress/spec-followup-cron-7d-statemachine.md` 는 정식 규약(`spec/conventions/**`, CLAUDE.md, `.claude/docs/plan-lifecycle.md`) 전반에 걸쳐 중대한 위반 없이 작성되었다. 파일 위치·frontmatter 스키마·변경 대상 spec 파일 경로 모두 규약을 준수한다. 변경 내용 자체는 cron 정책·상태머신 전이·Rationale 서술에 국한되어 Swagger / Cafe24 API Catalog / DB migrations 규약과 충돌하지 않는다. 두 가지 WARNING 이 식별되었으나 모두 spec write 단계 주의 사항이며 plan draft 채택을 차단할 사유가 아니다. BLOCK: NO.

---

## 위험도

LOW
