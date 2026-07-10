# Consistency Check SUMMARY — `--spec` (docs-only)

- **일시**: 2026-07-10 22:31:15
- **모드**: `--spec` (project-planner 가 `spec/` 쓰기 직전 의무 호출)
- **대상**: #501 후속 `llm_usage_log` attribution 문서 정합화 (backlog 그룹 1)
- **base**: `origin/main` @ `cc3dafa8c`
- **checker**: 5종 직접 Agent fan-out (cross-spec / rationale-continuity / convention-compliance / plan-coherence / naming-collision)

## BLOCK: NO

Critical 0건. Warning 5건 — **전부 본 세션에서 반영 완료**(아래 §대응).

## 발견사항 집계

| checker | Critical | Warning | Info |
| --- | --- | --- | --- |
| cross-spec | 0 | 2 | 1 |
| rationale-continuity | 0 | 1 | 0 |
| convention-compliance | 0 | 1 | 4 |
| plan-coherence | 0 | 2 | 3 |
| naming-collision | 0 | 1 | 0 |

(cross-spec W2 와 rationale-continuity W1 은 동일 근본 원인 — 중복 집계)

## 대응

### W1 (cross-spec) — Text Classifier 모호 서술이 SoT 문서 자신에도 잔존
`spec/data-flow/7-llm-usage.md:163` (§4 외부 의존 표, Execution 행) 이 draft 의 (f) 스코프
(`4-execution-engine.md:713` + `CHANGELOG.md:25`) 에서 빠져 있었다.
→ **반영**: 세 번째 사이트로 포함해 함께 정정. Text Classifier 는 단발(resume 턴 없음) 임을 명시.

### W2 (cross-spec) + W1 (rationale-continuity) — 신설 절이 §1.3 을 restate 해 drift 재생산
draft 의 "attribution 3열 주석" 이 §1.3 의 caller 채움 현황을 복제했고, 그 과정에서 §1.3 의
"잔여 NULL" 4-caller 중 `AI Agent 자동 메모리 롤링 요약 압축`(`7-llm-usage.md:107`) 을 누락했다.
이번 작업의 발단(요약 문서가 SoT 를 못 따라가 stale 화) 을 그대로 재생산하는 자기모순.
→ **반영**: caller 열거를 **삭제**. 신설 절은 스키마 사실(nullable 근거 · ungated vs gated 대비) 만
기술하고 "어느 caller 가 채우는지는 본 문서에 복제하지 않는다 — §1.3 이 단일 진실" 로 명시 위임.
자매 §2.10.1 `IntegrationUsageLog` 의 관례(스키마 사실만)와 정렬.

### W (convention-compliance) — `### 2.16.1` 을 `#### Rationale (ModelConfig 통합)` 뒤에 두는 배치는 선례 없음
checker 는 "부모 로컬 Rationale **이전**" 배치를 권고했으나, 그리 두면 `#### Rationale (ModelConfig 통합)`
이 `### 2.16.1 LlmUsageLog` 의 하위 절로 오분류된다(heading 계층상 실제 버그). 재확인 결과
`1-data-model.md` 에서 "자식 + 부모 로컬 Rationale" 을 동시에 갖는 절은 §2.16 이 유일하고
(`#### ` 헤딩 전수: 602 / 622 / 637 / 647), 유사 사례 §2.17 AuthConfig 는 Rationale 을 **마지막 번호 자식**
(`#### 2.17.3 Rationale`) 으로 둔다. 즉 확립된 선례가 없다.
→ **반영**: W(naming-collision) 과 합쳐 **`### 2.16.1` 자체를 포기**하고 최상위 `### 2.24 LlmUsageLog` 로 신설.
Rationale 중첩 문제와 번호 재사용 문제를 동시에 해소.

### W (naming-collision) — `§2.16.1` 은 구 `RerankConfig` 가 쓰던 번호
`unified-model-management` 개정이 RerankConfig 를 §2.16 ModelConfig `kind=rerank` 로 흡수하며 절을 삭제했으나,
`plan/complete/rag-rerank-impl.md:12` · `rag-rerank-followup-v2.md:14` 등이 아직 `1-data-model.md §2.16.1` 을
RerankConfig 의미로 링크한다. 번호를 재사용하면 "깨진 링크" 가 "조용히 틀린 링크" 로 바뀐다.
→ **반영**: `### 2.24 LlmUsageLog` 사용. 추가로 신설 절에 **넘버링 주의** 각주를 달아 구 §2.16.1 의 내력을 기록.
부수 근거: `llm_usage_log` 의 CASCADE 소유자는 `ModelConfig` 가 아니라 `Workspace` 이고 `llm_config_id` 는
`SET NULL` 이므로, `.1` 자식 배치는 소유관계를 오표기하는 것이기도 했다.

### W1·W2 (plan-coherence) — plan 체크박스 미갱신 + plan 내 stale 참조 2건
→ **반영**: `plan/in-progress/resume-llm-usage-attribution.md` 를 본 커밋에 포함.
- (a)/(c)/(f) 체크 + 완료 주석.
- (b)/(d) 는 **no-op 종결**로 체크하고 판정 근거를 인라인.
- 원 plan 의 stale 참조 2건도 정정: `spec/data-flow/7-statistics.md` → `spec/2-navigation/7-statistics.md` (경로 오기),
  exec-engine `§7.4` → `§1.3` (§7.4 는 "분산 실행(Multi-instance)" — #884 가 2채널을 넣은 곳은 §1.3).
- (e)/(g) 는 코드 항목이라 미체크 유지 → plan 은 `in-progress` 잔류 (complete/ 이동 불가).

## Info (비차단, 조치 불요)

- **cross-spec I1**: entity `@Index` 데코레이터가 3종 중 2종만 선언(partial index 는 SQL 전용) — 실제 불일치 아님.
- **convention I1**: `7-llm-usage.md` 로의 anchor-없는 bare-file 링크 스타일은 기존 6개 인용 전부와 일치 — 위반 아님.
- **convention I2**: `spec/1-data-model.md` 는 `spec-impl-evidence.md:51` 의 `EXCLUDE_BASENAMES` 대상 →
  `code:`/`status`/`pending_plans` frontmatter 갱신 의무 없음.
- **convention I3**: CHANGELOG `## Unreleased` 항목의 사후 in-place 정정은 선례 존재 (commit `26bd1fe1`, PR #839).
- **plan-coherence I**: 타 in-progress plan 과 충돌 없음. `spec_impact` 는 in-progress 단계 의무 아님.
- **naming-collision I**: `spec/1-data-model.md:29-31` 의 `IntegrationUsageLog` 줄이 중간 항목인데 `└──` 를 쓰는
  기존 트리 표기 버그 확인 — 본 변경 범위 밖이라 미수정(신규 `LlmUsageLog` 줄은 `├──` 로 올바르게 추가).

## 검증

`codebase/frontend` doc guard 6종 통과 (1374 tests) — `spec-link-integrity`(dead path + **broken anchor** 검출) 포함.
신설 anchor `#224-llmusagelog` · 인용 anchor `#216-modelconfig` / `#2101-integrationusagelog` / `#3-인덱스-전략` 전부 해소 확인.
