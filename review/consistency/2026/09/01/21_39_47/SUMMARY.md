# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 CRITICAL 0건. WARNING 4건은 모두 target(`plan/in-progress/spec-draft-error-code-two-surfaces.md`, `spec/conventions/error-codes.md` §Overview 병기 draft)의 좁은 범위 내에서 조치 가능한 항목이며 시스템 invariant 위반이나 작동 불가 상황은 없음.

## 전체 위험도
**MEDIUM** — CRITICAL 없음, WARNING 4건(cross_spec 2 + convention_compliance 2)이 "직접 모순은 아니지만 기존 SoT/구조 규약과 성격이 어긋나 drift 잠재력이 있는" 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/1-data-model.md` §2.13 `Execution.error` 서술이 draft 의 "두 family 공존" 모델과 어긋나는 낡은 이분법(엔진 인프라 코드 6종 무차별 나열, 실제로는 `EngineErrorCode`/`ErrorCode`/둘 다 아님 삼분법)과 "복사"만이 유일한 채움 경로처럼 읽히는 서술(EXECUTION_QUEUE_WAIT_TIMEOUT 의 직접-UPDATE 경로 누락)을 그대로 남김 | draft "변경 제안" §, `EngineErrorCode` 4종 나열 문단 + "두 family 공존" 문단 (61~73행) | `spec/1-data-model.md:474`(§2.13 Execution `error` 컬럼), `spec/1-data-model.md:557-563`(관계 표) | draft 가 이미 동반 검토 대상으로 지정한 `1-data-model.md` 를 이번 diff 또는 후속 planner 턴에서 (a) `:474` 6개 코드를 실제 소속별로 재분류/각주, (b) `:562` "복사" 행에 admission-gate 직접 갱신 예외 한 줄 보강 |
| 2 | Cross-Spec | `spec/5-system/3-error-handling.md` §1.4 카탈로그 표가 "엔진 수준 에러" 10종을 단일 집합처럼 나열하나 named const(`ErrorCode`/`EngineErrorCode`) 등재는 2종뿐(나머지 8종은 무등재 raw literal) — draft 의 "두 surface" 프레이밍이 이 카탈로그를 "두 surface 로 다 설명된다"로 오독시킬 위험 | draft "변경 제안" § `EngineErrorCode` 4종 서술 문단 | `spec/5-system/3-error-handling.md:106-125` (§1.4 "엔진 수준 에러" 표) | error-codes.md 신설 문구 근처에 "이 두 surface 가 엔진 수준 에러 코드 전체집합은 아니다" 한 줄 보강 또는 후속 항목으로 plan 에 기록 |
| 3 | Convention Compliance | `## Rationale` 이 문서 최종 섹션이 아님 — `## 판단 기준은 이번에 안 쓴다` 절이 Rationale **뒤**에 별도 최상위 섹션으로 존재 | `plan/in-progress/spec-draft-error-code-two-surfaces.md:71`(`## Rationale`) 이후 `:89` | `.claude/skills/project-planner/SKILL.md` §워크플로 3단계 "본문 끝에 `## Rationale`로 결정 근거 명시" | `## 판단 기준은 이번에 안 쓴다` 절을 `## Rationale` 하위 절(`###`)로 합치거나 Rationale 마지막 bullet 로 흡수. 별도 섹션 유지가 의도라면 SKILL.md 규정을 갱신해 규약-관행 정합 |
| 4 | Convention Compliance | `EngineErrorCode` 4종 전체 열거가 카탈로그 SoT(§1 `3-error-handling.md`, 이 문서 자신이 "카탈로그는 SoT 아님"이라 선언)를 개수까지 못박아 중복시킴 — 5번째 멤버 추가 시 조용히 stale 해질 가드 없는 경로 | `plan/in-progress/spec-draft-error-code-two-surfaces.md:44-45` | `spec/conventions/error-codes.md` §Overview 자신의 "카탈로그·분류·트리거 SoT = `5-system/3-error-handling.md §1`" 선언 | §Overview 삽입문을 "예: `WORKER_HEARTBEAT_TIMEOUT` 등(전체 목록은 `3-error-handling.md §1` 참조)" 형태로 낮추거나, 전체 열거 유지 시 "스냅샷이며 SoT 아님" 캐비엇 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/conventions/error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행이 이미 "엔진 레벨 `error.code`"로 정확히 표기 — draft 와 정합 | `error-codes.md` §3 | 조치 불필요(확인용) |
| 2 | Rationale Continuity | "판단 기준 유보"의 재개 조건(세 번째 자매 const 발생 시)이 driving plan 체크리스트에만 있고 spec draft 자체엔 없음 | `## 판단 기준은 이번에 안 쓴다` 절 | 절 말미에 재개 신호 한 줄 포인터 추가(선택) |
| 3 | Rationale Continuity | ARCH#5 ⑤ 의 완화 요인(WS ack 경계 코드 한정 맥락일 수 있음) 인용 생략 — 안전한 방향(유보를 더 무겁게 다룸)이라 위험 낮음 | `## Rationale` "왜 자매 const 인가" 절 인용 블록 | 선택. 완화 요인까지 인용하면 자기완결성 향상 |
| 4 | Convention Compliance | "대표 surface" 단수→복수 조정, 직전 라운드 지적사항 이미 반영 확인 | `:82-83` | 조치 불필요(확인용) |
| 5 | Plan Coherence | 직전 라운드(`21_30_10`) plan_coherence WARNING(판단 기준 질문 무응답)이 이번 개정으로 해소됨 | `## 판단 기준은 이번에 안 쓴다` 절 | 조치 불필요(확인용). 후속 라운드에서 재개 신호 충족 판단 시 재검토 |
| 6 | Plan Coherence | 착수 plan(`spec-conventions-engine-error-code-surface.md`) `worktree`/체크박스 2건이 아직 draft 적용 전 상태 — 정합하나 절차 이월 | 착수 plan frontmatter + §할 일 | draft 를 실제 spec 에 적용하는 커밋에서 체크박스·`worktree`·양쪽 `complete/` 이동 동시 수행 |
| 7 | Plan Coherence | `WsErrorCode`(별도 파일)가 "세 번째 자매 const" 재개 신호 후보인지 애매 — 낮은 확신 참고 메모 | `## 판단 기준은 이번에 안 쓴다` 절 재개 신호 문구 | 조치 불필요. 재개 시점에 함께 검토 |
| 8 | Naming Collision | `EngineErrorCode` 는 spec/ 전역 최초 등장이나 코드에 이미 존재하고 값 수준 disjoint 가 테스트로 고정 — 충돌 아님 | §Overview 삽입 문구 | 조치 불필요 |
| 9 | Naming Collision | `spec-draft-error-codes.md`(complete, 2026-06-02) vs `spec-draft-error-code-two-surfaces.md`(in-progress) 명명 유사 — 정상 컨벤션, 충돌 아님 | 파일 경로 | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `spec/1-data-model.md` §2.13 이분법/단일 채움경로 서술, `spec/5-system/3-error-handling.md` §1.4 카탈로그 미분화가 draft 의 새 모델과 직접 모순은 아니나 오독 재생산 잠재력 |
| Rationale Continuity | LOW | 직전 라운드(`21_30_10`) WARNING 3건 모두 원문 근거로 정확히 반영 확인. CRITICAL/WARNING 없음, INFO 2건(완전성 보강) |
| Convention Compliance | LOW | `## Rationale` 최종 섹션 배치 규약 위반, `EngineErrorCode` 4종 완전 열거가 카탈로그 SoT 경계와 성격 충돌 |
| Plan Coherence | NONE | `plan/in-progress/` 전수 grep(10개 관련 plan 확인) 결과 정면 충돌·전제 무효화 없음. 직전 WARNING 해소 확인 |
| Naming Collision | NONE | 신규 도입 유일 이름(`EngineErrorCode`)이 코드에 이미 존재하고 값 수준 정합, 파일 경로도 기존 컨벤션 준수 |

## 권장 조치사항
1. (BLOCK 무관, 권장) `spec/1-data-model.md:474` 6개 코드를 실제 소속(`EngineErrorCode` 2 / `ErrorCode` 1 / 둘 다 아님 3)으로 재분류하거나 각주 추가 — draft 가 이미 동반 검토 대상으로 지정한 문서이므로 이번 diff 또는 즉시 후속 turn에서 처리.
2. `spec/1-data-model.md:562` "복사" 서술에 `EXECUTION_QUEUE_WAIT_TIMEOUT` 등 admission-gate 직접 갱신 경로 한 줄 보강.
3. draft 의 `## 판단 기준은 이번에 안 쓴다` 절을 `## Rationale` 내부 하위 절로 이동해 project-planner SKILL.md "본문 끝에 Rationale" 규약과 구조 정합.
4. §Overview 삽입문의 `EngineErrorCode` 4종 완전 열거를 예시+링크 형태로 낮추거나 "스냅샷/SoT 아님" 캐비엇 명시해 카탈로그 SoT(`3-error-handling.md §1`)와의 경계를 문서 내에서도 밝힘.
5. (선택) `spec/5-system/3-error-handling.md` §1.4 근처에 "두 surface(named const)가 엔진 수준 에러 전체집합은 아니다" 한 줄 보강 — 시급하지 않으면 plan 후속 항목으로 기록.
6. draft 를 실제 `spec/conventions/error-codes.md` 에 적용하는 커밋에서 착수 plan(`spec-conventions-engine-error-code-surface.md`) 체크박스·`worktree` 갱신 + 두 plan 문서 `complete/` 이동 동시 수행.