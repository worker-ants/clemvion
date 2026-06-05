# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system` (--impl-done, diff-base=origin/main)
검토 기준: spec/0-overview.md, spec/1-data-model.md 와의 교차 정합성

---

## 발견사항

### [INFO] `Execution.resume_call_stack` 컬럼 — spec 동기화 완료, 구현 상태 표기 정합
- target 위치: `spec/5-system/4-execution-engine.md §6.2` + `spec/1-data-model.md §2.13`
- 충돌 대상: 없음 (정합)
- 상세: V087 마이그레이션이 `Execution.resume_call_stack JSONB NULL` 컬럼을 추가했고, `spec/1-data-model.md §2.13` 에 해당 컬럼 행이 동기 갱신됐다. `spec/5-system/4-execution-engine.md §6.2 park commit (e)` 와 `§7.5 중첩 sub-workflow 재개` 절도 V087 컬럼을 참조하며, 구현이 미완료임을 "(구현 상태 2026-06-06: ... PR-B2 후속 커밋에서 구현)" 메모로 명시하고 있다. spec ↔ 데이터모델 ↔ 마이그레이션이 삼자 일치한다.
- 제안: 현재 상태 유지. PR-B2 구현 완료 후 구현 메모를 완료형으로 전환(project-planner 위임, plan §Spec 변경 7번 항목).

### [INFO] `Execution.active_running_ms` — V083 언급이 data-model 에 없으나 컬럼 본문은 정합
- target 위치: `spec/1-data-model.md §2.13 Execution.active_running_ms`
- 충돌 대상: `spec/0-overview.md §2.4 Execution Engine`(active-running 타임아웃 언급) + `spec/5-system/4-execution-engine.md §8`
- 상세: `spec/1-data-model.md §2.13` 에 `active_running_ms` 컬럼 행이 있고 `4-execution-engine.md §8` 참조가 올바르다. V083 마이그레이션 번호는 data-model 본문에 명시되어 있지 않지만, 다른 컬럼들(conversation_thread=V084, user_variables=V085, resume_call_stack=V087)은 번호가 명시된 반면 active_running_ms 는 번호 미기재다. 기능 서술 자체는 일치한다.
- 제안: 명시적 마이그레이션 번호 표기를 원한다면 `active_running_ms | Integer | ... (V083)` 형태로 통일. 기능 일치이므로 OPTIONAL 수준.

### [INFO] `spec/5-system/4-execution-engine.md §4.x banner` — PR-B2 미적용 과도기 상태 정직화 완료
- target 위치: `spec/5-system/4-execution-engine.md §4.x` 구현 메모 + `§7.4` Worker 동작
- 충돌 대상: 없음 (정합)
- 상세: §4.x 배너 2개("park=세그먼트 종료" / "slow-path 일원화")와 §7.4 Worker 동작이 단계 롤아웃(PR-B1 완료 / PR-B2 미적용)을 명시하는 형태로 정직화됐다. plan §진행 메모의 "W1 정합화(완료 2026-06-06)"과 일치한다.
- 제안: 현재 상태 유지. PR-B2 완료 시 배너를 완료형으로 교체.

### [INFO] `spec/1-data-model.md §2.13 Execution` — 컬럼 순서와 plan 기재 컬럼 완전 일치
- target 위치: `spec/1-data-model.md §2.13` Execution 컬럼 표
- 충돌 대상: `plan/in-progress/exec-park-durable-resume.md` Phase A 컬럼 기술
- 상세: plan 이 기술한 컬럼 V084(`conversation_thread`), V085(`user_variables`), V087(`resume_call_stack`)이 data-model §2.13 에 모두 정확히 반영되어 있다. Plan §D1·§D2·§D6 결정이 spec 에 반영됐다. 오탐 가능성 없음.
- 제안: 확인 완료.

### [INFO] `spec/5-system/1-auth.md §5 API 엔드포인트` — `/api/auth/resend-verification` 미기재
- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- 충돌 대상: `spec/5-system/1-auth.md §1.1` 본문 ("`POST /auth/resend-verification` — throttle 5/min" 언급)
- 상세: §1.1 본문에 `POST /auth/resend-verification` 엔드포인트가 서술되어 있으나 §5 API 엔드포인트 표에는 해당 경로가 목록에 없다. 기능 서술과 엔드포인트 인벤토리 간 불일치다. 다른 spec 영역과의 직접 모순이 아니라 동일 문서 내 누락이므로 INFO 수준.
- 제안: `spec/5-system/1-auth.md §5` 표에 `POST /api/auth/resend-verification` 행 추가(설명: 인증 메일 재발송, throttle 5/min, 인증 불요 또는 Auth 선택).

### [INFO] `spec/0-overview.md §6.2 실행 엔진` — `pending_plans` 와 `exec-park-durable-resume.md` 일치
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans`
- 충돌 대상: `spec/0-overview.md §6.1` 실행 엔진 설명
- 상세: `spec/5-system/4-execution-engine.md` frontmatter 에 `exec-park-durable-resume.md` 가 `pending_plans` 로 등록돼 있다. `spec/0-overview.md §2.4` 의 실행 엔진 서술(`execution-continuation` 큐 기반 분산 continuation, `waiting_for_input` 은 큐 없는 durable DB park)이 `4-execution-engine.md §7.5` 의 rehydration 모델과 정합한다.
- 제안: 없음. 정합 확인.

### [INFO] `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` — 채널명 `kb:{documentId}` vs `kb:{kbId}` 표기
- target 위치: `spec/5-system/10-graph-rag.md §6` — "채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8` 과 동일)"
- 충돌 대상: `spec/5-system/8-embedding-pipeline.md §8`
- 상세: Graph RAG spec §6 이 채널명을 `kb:{documentId}` 로 기술하면서 embedding-pipeline §8 과 동일하다고 주석했다. 채널명 자체는 문서 단위(documentId)로 동일 패턴을 쓰는 것이 합리적이지만, `kb:{kbId}` 패턴(KB 단위)과의 구분이 spec 에서 명시적으로 보이지 않는다. 다른 영역과의 모순은 아니며, embedding-pipeline 과 graph-rag 가 동일 채널명을 쓴다는 주장 자체는 일관성 있다. 확인 수준.
- 제안: 정합 확인 또는 채널 이름이 `kb:{documentId}` 임을 `8-embedding-pipeline.md §8` 에 명시적으로 기록 요망.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/5-system` 과 기존 spec 영역 간의 직접 모순(CRITICAL 또는 WARNING 등급)은 발견되지 않는다. PR-B1 구현 완료로 추가된 `Execution.conversation_thread`(V084)·`user_variables`(V085)·`resume_call_stack`(V087) 세 컬럼은 `spec/1-data-model.md §2.13`, `spec/5-system/4-execution-engine.md §6.2/§7.5`, 그리고 실제 마이그레이션 파일(V084~V087)이 삼자 일치하여 데이터 모델 충돌 없음. 상태 전이(`waiting_for_input` park ↔ 재개)가 `spec/0-overview.md §2.4`·`1-data-model.md §2.13`·`4-execution-engine.md §1.1` 전이 표에서 일관되게 기술됐다. PR-B2 미적용 구간(멀티턴 AI fast-path 잔존)은 §4.x 배너에 정직하게 표기되어 over-claim 없음. 발견된 항목들은 모두 동일 문서 내 INFO 수준(엔드포인트 목록 누락, 마이그레이션 번호 불일치)으로 즉각 수정하거나 PR-B2 완료 시점에 정리할 수준이다.

## 위험도

NONE
