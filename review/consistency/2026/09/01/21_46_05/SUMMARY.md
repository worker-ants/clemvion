# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — Critical 은 없으나, `## 변경 제안` 의 "층(layer)" 프레이밍이 같은 문서 자신의
Rationale 원칙 및 자기 실측(`EXECUTION_TIME_LIMIT_EXCEEDED`)과 충돌한다는 WARNING 이 두
checker(cross_spec, convention_compliance)에서 서로 다른 각도로 확인됨. spec 반영 전 정정 권장.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec + convention_compliance | `## 변경 제안` 이 도입하는 "노드 핸들러 층" / "엔진 층" 이분법이 (a) 같은 draft `## Rationale` 의 자체 원칙("두 surface 가 존재한다는 사실만 적는다, 형태를 규약으로 굳히지 않는다")과 충돌하고, (b) draft 자신이 실측한 `EXECUTION_TIME_LIMIT_EXCEEDED`(`ErrorCode` 소속이면서 엔진이 `Execution.error.code` 로 싣는 사례) 및 `1-data-model.md`/`3-error-handling.md §1.4` 의 느슨한 "엔진 (수준/인프라) 코드" 서술과 어긋나 독자가 const 멤버십을 오추론할 위험 | `plan/in-progress/spec-draft-error-code-two-surfaces.md` `## 변경 제안` 절, "`ErrorCode` — **노드 핸들러 층**의 대표 surface" / "`EngineErrorCode` — **엔진 층**의 대표 surface" 두 불릿 | `spec/conventions/error-codes.md` §4.1(엔진 레벨 `EXECUTION_TIME_LIMIT_EXCEEDED` 콜아웃), `spec/1-data-model.md` §2.13 `Execution.error`, `spec/5-system/3-error-handling.md` §1.4, `spec/5-system/4-execution-engine.md §Rationale`(2026-06-14, `ErrorCode` 를 "중앙" enum 으로 규정) | "층" 프레이밍을 제거하고 draft 자신의 원칙대로 존재 사실만 서술 (예: "같은 파일의 자매 const 로 공존한다"). 굳이 소속을 언급하려면 "대표적으로 어디서 쓰이는가" 로 완화하고 `EXECUTION_TIME_LIMIT_EXCEEDED` 같은 층-교차 예외를 각주로 병기하거나, const 경계가 "누가 발행하는가" 기준이며 카탈로그의 "엔진 수준 에러" 분류와 1:1 대응하지 않는다는 clause 를 추가 |
| 2 | plan_coherence | driving plan 의 "할 일" 체크리스트가 target 의 2차 개정에서 이미 폐기된 접근("목적지 필드 인라인 서술": `EngineErrorCode` 가 `Execution.error`·`NodeExecution.error` 에 싣는다)을 아직 그대로 지시함 — unchecked 항목이라 그대로 실행되면 두 라운드에 걸쳐 반증된 서술이 되살아날 위험 | `plan/in-progress/spec-conventions-engine-error-code-surface.md` §할 일 첫 항목(31~34행) | `plan/in-progress/spec-draft-error-code-two-surfaces.md` `### 목적지 필드를 여기 안 쓰는 이유 — 두 라운드가 반대로 가리켰다` 절 (결론: 목적지는 `3-error-handling.md §1` SoT 로 위임, §Overview 에는 안 씀) | driving plan 31~34행을 target 의 최종 접근(층으로만 병기, 목적지는 카탈로그 SoT 위임)에 맞춰 갱신. target 을 spec 에 적용하는 커밋에서 이 항목과 `--spec` 재검토 체크를 함께 반영 (별도 턴 불요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 조립 프롬프트 번들이 `spec/conventions/**` 전체 및 `3-error-handling.md`·`4-execution-engine.md` 본문을 예산 초과로 누락(플레이스홀더만 존재) — 기존 known issue(harness `--spec` 예산) | `_prompts/cross_spec.md` (harness 산출물) | 이번 라운드는 저장소 파일 직접 열람으로 갭을 메움. 새 spec-impact 불요, harness 쪽 known issue 로만 추적(이미 사용자 메모리에 기록됨) |
| 2 | convention_compliance | `## Rationale` 뒤에 동급(`##`) 섹션("판단 기준은 이번에 안 쓴다")이 이어져 CLAUDE.md 의 "문서 끝 Rationale" 배치 관례를 벗어남 (plan 트래킹 문서라 강제 대상은 아니나 spec 형태를 모사 중) | `plan/in-progress/spec-draft-error-code-two-surfaces.md` 최하단 | "판단 기준…" 절을 `## Rationale` 의 `###` 하위 섹션으로 접거나 `## Rationale` 앞으로 재배열 (실질 내용 변경 불요) |
| 3 | plan_coherence | `WsErrorCode` 재개 신호·인접 문서 선재 drift 2건(`1-data-model.md:474`, `3-error-handling.md §1.4`)은 이번 개정에서 target·driving plan 양쪽에 이미 일관되게 반영됨 | target `### 판단 기준은 이번에 안 쓴다` 절 + driving plan §할 일 "후속(별도 planner 턴)" 항목 | 조치 불요 — 확인 메모 |
| 4 | naming_collision | "노드 핸들러 층"/"엔진 층" 표현은 신규 재사용 식별자가 아니며 grep 0건. 다만 같은 규약 문서(§3)가 이미 "레이어"(외래어)라는 표기를 다른 구분에 쓰고 있어, "층"(고유어)과 병존하게 됨 | `spec/conventions/error-codes.md` §3 | 신규 식별자 충돌 범주 밖. 필요 시 별도 terminology 검토로 (조치 필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | "층" 이분법이 `1-data-model.md`/`3-error-handling.md` 의 느슨한 "엔진 코드" 서술과 정확히 대응하지 않아 오독 위험(WARNING). harness 예산 절단은 실측으로 보완(INFO) |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·암묵적 가정 충돌 4관점 모두 위반 없음. 4라운드 지적을 순차 흡수한 이력 확인 |
| convention_compliance | MEDIUM | "층" 프레이밍이 draft 자신의 Rationale 원칙 및 자기 실측(`EXECUTION_TIME_LIMIT_EXCEEDED`)과 충돌하는 자기모순(WARNING). Rationale 뒤 동급 섹션 배치(INFO) |
| plan_coherence | LOW | driving plan 할 일 체크리스트가 target 이 이미 폐기한 "목적지 필드 인라인 서술" 접근을 여전히 지시(WARNING). `WsErrorCode`·선재 drift 는 이미 동기화 확인(INFO) |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·endpoint·이벤트·환경변수·파일 경로 전부 미도입. `EngineErrorCode` 는 기존 코드(`error-codes.ts:147`)의 사후 문서화일 뿐 충돌 없음 |

## 권장 조치사항

1. **(최우선, WARNING #1)** `## 변경 제안` 의 "노드 핸들러 층" / "엔진 층" 이분 명명을 제거하거나 완화 — draft 자신의 Rationale 원칙("존재 사실만 적는다")과 자기 실측(`EXECUTION_TIME_LIMIT_EXCEEDED`)에 맞게, const 경계는 "누가 발행하는가" 기준이며 카탈로그의 "엔진 수준 에러" 분류와 1:1 대응하지 않는다는 clause 로 대체.
2. **(WARNING #2)** `spec-conventions-engine-error-code-surface.md` §할 일 31~34행의 "목적지 필드 인라인 서술" 지시문을 target 의 최종 접근(SoT 위임)에 맞춰 갱신 — spec 적용 커밋 시점에 함께 처리 가능.
3. (선택, INFO #2) "판단 기준은 이번에 안 쓴다" 절을 `## Rationale` 하위로 재배치해 spec 3섹션 관례와 형태를 맞춘다.
4. 나머지 INFO 항목은 조치 불요 — 확인 기록으로 충분.