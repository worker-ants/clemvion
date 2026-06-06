# 정식 규약 준수 검토 — `spec/5-system/4-execution-engine.md`

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 일시: 2026-06-06

---

## 발견사항

### 1. [INFO] 섹션 번호 일관성 — `§3.3 Background` 가 `§3.2` 와 `§3.4` 사이에 삽입됨

- **target 위치**: 문서 내 `### 3.3 Background 실행` 절 헤더 위쪽 (`### 3.2 ForEach / Map 실행` 바로 다음)
- **위반 규약**: CLAUDE.md "문서 구조 규약" — 본문 섹션 번호는 순차여야 한다는 범용 기대. 직접 위반 규약은 없으나 `### 3.4 중첩 컨테이너 스코프` 보다 `### 3.3 Background 실행` 이 뒤에 배치되어 있어 번호와 물리적 위치가 역전돼 있다.
- **상세**: `3.4` 절이 378라인 근처에 먼저 나오고 `3.3 Background` 가 그 이후(326라인)에 등장한다. 실제 파일 순서를 보면 `3.1 Loop → 3.2 ForEach/Map → 3.4 중첩 컨테이너 스코프 → 3.3 Background` 로 배치돼 있다 (`3.4` 뒤에 `---` 이후 `### 3.3 Background 실행` 이 출현). 독자가 목차 없이 순서로 읽을 때 번호 순서가 맞지 않아 혼동을 줄 수 있다.
- **제안**: `### 3.3 Background 실행` 절을 `### 3.2 ForEach / Map 실행` 과 `### 3.4 중첩 컨테이너 스코프` 사이로 이동하거나, 번호를 재정렬(예: `3.3 → 3.5` 로 변경). 의미상 Background 는 컨테이너가 아니라 독립 실행 모델이므로 `§4` 혹은 별도 섹션으로 분리하는 방안도 고려할 수 있다.

---

### 2. [INFO] `pending_plans` frontmatter 에 완료되거나 정리된 플랜 경로가 포함될 가능성

- **target 위치**: frontmatter (파일 1~13행)
  ```yaml
  pending_plans:
    - plan/in-progress/execution-engine-residual-gaps.md
    - plan/in-progress/spec-sync-execution-engine-gaps.md
    - plan/in-progress/exec-intake-queue-impl.md
    - plan/in-progress/exec-park-durable-resume.md
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존해야 하며, 빌드 가드 `spec-pending-plan-existence.test.ts` 가 이를 검증한다.
- **상세**: 이번 PR (`exec-park-b2b-04a2f8` 브랜치)은 `exec-park-durable-resume.md` plan 의 PR-B2a(top-level 멀티턴 AI turn-park)를 완료한 커밋이다. 만약 해당 plan 이 `plan/complete/` 로 이동했다면 frontmatter 에서 `plan/in-progress/exec-park-durable-resume.md` 를 업데이트해야 한다. 빌드 가드가 `plan/complete/` 도 허용하므로 경로 치환이 필요하다. 현재 상태는 빌드 환경에서 자동 검증되지만 리뷰 시점에 점검이 필요하다.
- **제안**: plan 완료 여부 확인 후 해당 `pending_plans` 항목을 `plan/complete/exec-park-durable-resume.md` 로 갱신하거나, plan 이 여전히 진행 중이면 그대로 유지. `spec-impl-evidence.md §3` 의 `partial → implemented` 전이 가드도 함께 점검.

---

### 3. [WARNING] `status: partial` 유지 적정성 — PR-B2a 완료 후 `pending_plans` 재평가 필요

- **target 위치**: frontmatter `status: partial`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `partial → implemented` 전이 규칙: "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)". `spec-status-lifecycle.test.ts` 가 "모든 `pending_plans` 가 complete 로 이동했는데 status 미승격" 시 빌드 실패한다.
- **상세**: 본 브랜치는 `exec-park-durable-resume` plan 의 PR-B2a 를 완료했다. 만약 4개의 `pending_plans` 중 3개는 이미 완료·아카이브됐고 `exec-park-durable-resume` 만 남았는데 이 브랜치에서 B2a 만 완료되고 B2b(D6 중첩 blocking durable화)는 아직 남아 있다면 `status: partial` 유지가 맞다. 그러나 4개 plan 이 모두 완료됐다면 `implemented` 로 승격하지 않으면 빌드 가드가 실패한다. 본 문서 본문 내 "PR-B2b(중첩 D6 + full B3) 미적용", "PR3/PR4 Planned" 등 미구현 언급 다수가 있어 `partial` 은 사실에 근거하나, plan 파일 실존 여부와 빌드 가드 통과를 확인해야 한다.
- **제안**: 브랜치 완료 전 `spec-pending-plan-existence.test.ts` + `spec-status-lifecycle.test.ts` 로컬 실행으로 가드 통과 확인. 필요하면 완료된 plan 을 `plan/complete/` 로 이동하고 frontmatter 경로 동기.

---

### 4. [INFO] Redis 키 네이밍 예외 — 전역 키가 §9.1 패턴에서 명시적으로 벗어남

- **target 위치**: `§9.2 용도별 키 정의 및 TTL` 표 — `exec:recover:lock`, `exec:cont:seq:<executionId>`, `exec:run:seq:<executionId>` 행
- **위반 규약**: `§9.1` 에 선언된 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴. 이는 외부 컨벤션 문서가 아닌 이 spec 문서 자체의 내부 규약이다. `spec/conventions/` 에 별도 Redis 키 명명 컨벤션 문서는 없다.
- **상세**: 문서 자체에 "§9.1 의 패턴을 따르지 않는다. 워크스페이스에 종속되지 않는 책임을 가지므로 전역 키로 둔다" 고 명시적으로 예외를 기술하고 있어 의도된 일탈이다. 실제 위반이 아니라 예외 선언이 spec 내부에서 적절히 이루어진 사례다.
- **제안**: 현 상태로 충분. 향후 전역 키 패턴이 늘어날 경우 `§9.1` 에 예외 분류를 표 형태로 명시하는 것을 고려할 수 있다 (규약 갱신 제안).

---

### 5. [INFO] `INVALID_EXECUTION_STATE` 에러 코드 — `error-codes.md` 도메인 prefix 권장 패턴과의 거리감

- **target 위치**: `§7.4` / `§7.5.1` — `INVALID_EXECUTION_STATE` 에러 코드 사용
- **위반 규약**: `spec/conventions/error-codes.md §1` — "도메인 prefix(권장): 도메인 범주화가 의미 있는 코드는 `<DOMAIN>_<CONDITION>` 으로 그룹화한다". `EXECUTION_*` prefix 가 아닌 `INVALID_EXECUTION_STATE` 는 `INVALID_` 로 시작해 상태 서술어가 앞에 온다. 그러나 §1 에서 "권장"이라 명시했고, `error-codes.md §3` Historical-artifact 레지스트리에 등재되지 않았으므로 신규 코드로서 패턴 일탈이다.
- **상세**: 동일 spec 에서 `EXECUTION_TIME_LIMIT_EXCEEDED` (도메인 prefix `EXECUTION_` 선두) 와 `INVALID_EXECUTION_STATE` (상태 서술어 `INVALID_` 선두)가 혼재한다. 의미 기반 명명 원칙(`error-codes.md §1`) 위반은 아니지만 도메인 prefix 권장 패턴과 거리감이 있다. `RESUME_*` 계열(`RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`) 은 `RESUME_` prefix 가 일관하게 선두에 위치해 좋은 예다.
- **제안**: 신규 코드 신설이 아니라 이미 클라이언트 계약이 된 코드이므로 `error-codes.md §2` rename 금지 정책에 따라 rename 하지 않는다. 단, `error-codes.md §3` Historical-artifact 레지스트리에 `INVALID_EXECUTION_STATE` 를 등재해 "WS layer 한정, 의도적 명명" 임을 명시하는 것을 권장 (규약 문서 갱신 제안).

---

### 6. [INFO] `§10.3 호출 순서` 절 번호 배치 — `§10.3` 이 `§10.2` 바로 다음이 아닌 `§11 Graceful Shutdown` 뒤에 위치

- **target 위치**: 파일 내 `### 10.3 호출 순서` 절 (1132행 근처)
- **위반 규약**: 문서 구조 규약 — 절 번호 순서. `§11 Graceful Shutdown` (§11) 뒤에 `§10.3`, `§10.4` 가 등장한다.
- **상세**: 파일을 선형으로 읽으면 `§10.2 IntegrationHandlerBase 계약` → `---` → `## 11. Graceful Shutdown` → `### 10.3 호출 순서` 순서로 나타난다. 이는 §10 Integration Handler 의 하위 절들이 §11 블록 내부에 오삽입된 구조다. `### 10.3` 과 `### 10.4` 가 `## 11` 뒤에 배치되어 어느 섹션에 속하는지 혼동이 발생한다. 렌더러(헤딩 레벨)로는 `###`(h3) 이므로 실제 §11(h2) 의 자식으로 해석될 수 있다.
- **제안**: `### 10.3 호출 순서`, `### 10.4 Fallback / Degraded 모드` 를 `### 10.2 IntegrationHandlerBase 계약` 바로 다음(`## 11. Graceful Shutdown` 이전)으로 이동. 또는 `---` 구분선 위치를 조정해 §10 그룹이 명확하게 §11 이전에 완결되도록 수정.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 frontmatter의 `id`·`status`·`code`·`pending_plans` 필드를 모두 보유하고 `spec/conventions/spec-impl-evidence.md` 의 스키마를 준수하고 있다. 에러 코드는 `error-codes.md §1` 의 의미 기반 명명 원칙을 대부분 따르며, `RESUME_*` 계열과 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 도메인 prefix 권장 패턴에 부합한다. `node-output.md` Principle 0~7 의 `NodeHandlerOutput` 5필드 규약과 내부 필드(`_resumeState`/`_resumeCheckpoint`/`_retryState`) 예외 선언도 컨벤션에 정합한다. 주요 우려사항은 두 가지다: (1) `§3.3 Background` 절이 `§3.2` 와 `§3.4` 사이가 아닌 `§3.4` 뒤에 물리적으로 배치되어 번호와 순서가 역전된 점, (2) `§10.3`·`§10.4` 가 `## 11. Graceful Shutdown` 뒤에 배치되어 섹션 귀속이 모호한 점. 이 두 항목은 구현 정합성(코드 동작)에는 영향이 없으나 문서 가독성과 구조 규약 측면에서 수정이 권장된다. `pending_plans` 경로 실존 여부와 `status: partial` 유지 적정성은 브랜치 완료 전 빌드 가드(`spec-pending-plan-existence.test.ts`, `spec-status-lifecycle.test.ts`) 실행으로 최종 확인해야 한다.

---

## 위험도

LOW
