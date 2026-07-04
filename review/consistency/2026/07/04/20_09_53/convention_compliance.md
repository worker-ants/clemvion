# 정식 규약 준수 검토 — convention_compliance

## 검토 대상 / 계획 작업 불일치 (선행 확인)

본 checker 에게 전달된 `_prompts/convention_compliance.md` 의 "Target 문서" 페이로드는
`spec/5-system/1-auth.md`(§1~§5 + Rationale) 와 `spec/5-system/10-graph-rag.md`,
`spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/**` 를 담고 있다.
반면 호출자가 명시한 "Planned work" 는 **§8 동시성 admission gate(TEST-ONLY 회귀 테스트 추가)**
이며, 이는 `spec/5-system/4-execution-engine.md §8`(동시 실행 제한 — advisory-lock admission gate,
PR2b #800/#801) 영역이다. 페이로드에는 `4-execution-engine.md` 본문이 전혀 포함되어 있지 않고,
admission gate·`runExecutionFromQueue`·`pg_advisory_xact_lock`·`queued_at`·
`EXECUTION_QUEUE_WAIT_TIMEOUT` 등 §8 관련 식별자도 전혀 등장하지 않는다. 동일 디렉터리의
다른 sibling 프롬프트(`cross_spec.md`·`naming_collision.md`·`plan_coherence.md`·
`rationale_continuity.md`) 도 동일한 `spec/5-system/` 번들(auth·graph-rag 중심)을 공유하고
있어, orchestrator 단계에서 이번 태스크(§8 admission gate TEST-ONLY 회귀)에 맞는 target 재수집이
누락된 것으로 판단된다(오케스트레이터 레벨 이슈 — 본 checker 개별 결함 아님).

이 상태에서는 실제 변경 대상(TEST-ONLY 테스트 파일 — 예상 위치
`codebase/backend/src/modules/execution/**/*.spec.ts` 또는 `*.e2e-spec.ts`)의 코드를 전혀 볼 수
없어, "명명 규약·출력 포맷 규약·API 문서 규약" 등 본 checker 의 핵심 점검 관점을 target 자체에는
적용할 수 없다. 아래는 (a) 페이로드로 실제 전달된 문서에 대한 참고용 점검과 (b) 리포지토리에서
직접 확인 가능한 §8/admission-gate 관련 정식 규약 정합성을 보조적으로 확인한 결과다. **정식
판정은 재-스코프된 target 페이로드로 재검토가 필요하다.**

---

### 발견사항

- **[CRITICAL]** Target 페이로드가 계획 작업 범위와 불일치
  - target 위치: `_prompts/convention_compliance.md` 전체("Target 문서" 섹션, `spec/5-system/1-auth.md`·`10-graph-rag.md`·conventions 번들)
  - 위반 규약: 특정 `spec/conventions/*` 항목 위반이 아니라, CLAUDE.md 의 "정보 저장 위치(단일 진실 원칙)" 및 review 프로세스 전제 — target 문서가 실제 변경/검토 대상과 일치해야 한다는 암묵적 계약
  - 상세: 계획 작업은 §8 admission gate(TEST-ONLY 회귀 커버리지, `4-execution-engine.md §8` 대상)이나 페이로드에는 해당 절이 전혀 실려 있지 않다. 이 상태로 "명명 규약/출력 포맷/문서 구조/API 문서 규약/금지 항목" 준수를 판정하면 실제 변경분에 대한 검증 없이 무관한 문서(1-auth.md 등)만 채점하게 되어 **의미 없는 PASS/BLOCK 판정**을 만들 위험이 있다.
  - 제안: orchestrator 가 target 문서 수집 단계를 재실행해 `spec/5-system/4-execution-engine.md`(§8 본문 + Rationale "동시성 cap admission gate" 항) 와 실제로 추가된 TEST-ONLY 테스트 파일 diff 를 payload 에 포함시켜 재검토해야 한다. 재검토 전까지 이번 결과를 최종 판정으로 사용하지 말 것.

- **[INFO]** (참고, 페이로드 내 실제 문서에 한함) `spec/5-system/1-auth.md` §1.5.4 lower_snake_case 예외는 이미 문서화된 historical-artifact
  - target 위치: `1-auth.md` §1.5.4 하단 "명명 — historical-artifact 예외" 문단
  - 위반 규약: `spec/conventions/error-codes.md §1`(UPPER_SNAKE_CASE 원칙) 자체 위반처럼 보이나
  - 상세: 문서가 `error-codes.md §3` 의 historical-artifact 레지스트리 등재를 명시적으로 인용하고 있어 규약 위반이 아니라 규약이 인정한 예외다. 신규 코드에 선례로 삼지 않는다는 경고도 포함되어 있어 규약 준수 관점에서 문제 없음.
  - 제안: 없음 (정상). 다만 이번 checker 호출의 실제 관심사(§8)와 무관한 절이라는 점만 참고.

- **[INFO]** (참고) `audit-actions.md`/`4.1.A` dot-prefix·시제 3분류 정합성은 페이로드 내에서 자기정합적
  - target 위치: `1-auth.md` §4.1 + Rationale 4.1.A/4.1.B, `spec/conventions/audit-actions.md`
  - 상세: Planned 액션 표기(`user.password_changed` 등)가 `audit-actions.md` 의 dot-prefix·시제 3분류 규약과 합치하며, 규약 SoT 와 문서 간 상호 인용도 정합적이다. 이 부분은 규약 준수 관점에서 문제 없음.
  - 제안: 없음. §8 admission gate 와 무관하므로 이번 태스크의 판정 근거로 사용하지 않음.

- **[WARNING]** §8 admission gate 관련 정식 규약 커버리지를 이 checker 인스턴스가 검증하지 못함
  - target 위치: N/A (페이로드 부재로 검증 불가)
  - 위반 규약: 특정 항목 아님 — 검증 공백 자체가 리스크
  - 상세: `spec/5-system/4-execution-engine.md §8`·Rationale "동시성 cap admission gate" 를 리포지토리에서 직접 열람한 결과, `error-codes.md`(코드 명명)·`node-output.md`(OutputError 표준)·`swagger.md`(API 문서 데코레이터) 등과 연관될 소지가 있는 신규 표면(`EXECUTION_QUEUE_WAIT_TIMEOUT`, `PATCH /api/workspaces/:id/settings` 확장, `queued_at` 컬럼 등)이 이미 구현 완료(#800/#801) 상태다. TEST-ONLY 회귀 테스트가 이 표면의 명명·에러코드를 그대로 재사용한다면 규약 위반 소지는 낮지만, 실제 테스트 파일을 보지 못한 채로는 단정할 수 없다.
  - 제안: 재스코프된 페이로드(테스트 파일 diff + `4-execution-engine.md §8` 본문)로 이 checker 를 재호출해 실제 판정을 받을 것. 그 전까지는 본 회차 결과를 "정보 부족으로 인한 조건부 보류"로 취급.

### 요약

이번 호출에 전달된 target 페이로드(`spec/5-system/1-auth.md`, `10-graph-rag.md`, 관련
conventions 번들)는 호출자가 명시한 계획 작업("§8 admission gate TEST-ONLY 회귀 커버리지 추가")과
무관하다. 페이로드로 전달된 문서 자체의 정식 규약 준수는 대체로 양호(historical-artifact 예외
명시, audit action 명명 규약 정합)하지만, 이는 이번 태스크의 실제 검토 대상이 아니므로 유효한
판정 근거가 될 수 없다. §8 admission gate 관련 정식 규약 위반 여부는 이번 회차에서 검증되지
않았다 — target 재수집 후 재검토가 필요하다.

### 위험도

MEDIUM

BLOCK: YES
