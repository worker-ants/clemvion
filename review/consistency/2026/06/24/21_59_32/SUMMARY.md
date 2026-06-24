# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 진행 가능.

검토 대상: `plan/in-progress/spec-draft-c1m7-publish-failfast.md`
검토일: 2026-06-24

---

## 전체 위험도
**LOW** — WARNING 2건(규약 비표준 필드 / 연계 plan 체크박스 미동기화), INFO 다수. Critical 없음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | plan frontmatter 에 `transient` 비표준 필드 사용 — plan-lifecycle §4 에 정의·허용된 필드가 아니며, 주석 "plan-frontmatter 가드 회피"는 규약 인정 우회 수단(`BYPASS_PLAN_GUARD=1`)이 아님 | `plan/in-progress/spec-draft-c1m7-publish-failfast.md` frontmatter `transient:` 행 | `.claude/docs/plan-lifecycle.md §4` 필수 3필드 + 허용 필드 목록 | `transient` 필드 제거. 대신 plan 본문 첫 줄에 "임시 spec-sync draft: apply 후 삭제" 인라인 주석으로 의도 표현. 또는 plan-lifecycle §4 에 `transient` 를 허용 필드로 공식 등재. |
| W-2 | Plan Coherence | `refactor/06-concurrency.md` C-1·M-7 체크박스가 여전히 `[ ] 미착수` — target spec-sync 적용 후 해당 항목이 stale 오독 위험 | `plan/in-progress/refactor/06-concurrency.md` C-1·M-7 행, `plan/in-progress/refactor/README.md` 집계 | target plan "구현 PR #693 머지 완료(537c930b)" 전제와 불일치 | target plan apply/PR merge 완료 시 C-1·M-7 체크박스를 `[x] 완료 (구현 PR #693 머지, spec-sync spec-draft-c1m7-publish-failfast)` 로 갱신하고 README 집계 카운트 동기화. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `§7.5.2` "4종 continuation 핸들러" 열거와 §7.4 신규 cancel bullet 간 잠재적 혼선 | `spec/5-system/4-execution-engine.md §7.5.2`, §7.4 신규 bullet | 신규 bullet 에 "§7.5.2 의 4종 WS ack 핸들러와 달리 cancel 은 REST stop() 경로"임을 1문장 보조 설명 추가 권장. 필수 아님. |
| I-2 | Cross-Spec | `3-error-handling.md §1.5` intro 정정이 기존 표 내부 불일치를 해소하는 방향임을 확인 | `spec/5-system/3-error-handling.md §1.5` | 변경 의도 올바름. 추가 조치 불필요. |
| I-3 | Cross-Spec | `2-api-convention.md §6` 503 행 추가가 `4-execution-engine.md §11` 및 `3-error-handling.md §1.5` 표와 정합됨 확인 | `spec/5-system/2-api-convention.md §6` | 충돌 없음. |
| I-4 | Cross-Spec | `EXECUTION_ENQUEUE_FAILED` 신규 에러 코드 — `conventions/error-codes.md` 명명 원칙·`EXECUTION_*` 네임스페이스와 일치 확인 | `spec/5-system/3-error-handling.md §1.5` | 추가 조치 불필요. |
| I-5 | Cross-Spec | `exec:cont:seq` M-7 fail-fast 추가와 `exec:seq` in-memory fallback 비대칭이 §9.2 에 명문화됨 확인 | `spec/5-system/4-execution-engine.md §9.2` | 변경 적절. 추가 수정 불필요. |
| I-6 | Rationale Continuity | `EXECUTION_ENQUEUE_FAILED` §1.5 등재 설명이 `RESUME_*` 비동기 원칙과의 경계를 미명시 | `spec/5-system/3-error-handling.md §1.5` 신규 행 | 행 설명에 "enqueue 자체 실패(Redis 장애 — queue.add 반환 `queued:false`) = enqueue 미진입 케이스. worker 측 비동기 실패(`RESUME_*`)와 구별" 명시 권장. |
| I-7 | Rationale Continuity | §7.4 신규 bullet 의 "WS §4.2 queued 재시도 계약 준용" 표현이 `SERVER_SHUTTING_DOWN §11` 선례보다 덜 직접적 | `spec/5-system/4-execution-engine.md §7.4` 신규 bullet | "SERVER_SHUTTING_DOWN 503 선례(upstream 의존성 장애 → 503 + 재시도 권장, §11)와 동형"으로 교체 권장. WS §4.2 `queued` 는 parenthetical 처리. |
| I-8 | Rationale Continuity | §1.5 intro 완화 후 `§Rationale` cross-link 보강 | `spec/5-system/3-error-handling.md §1.5` intro | "일부 코드가 REST 표면을 가지는 설계 원칙은 4-execution-engine.md §Rationale 의 SERVER_SHUTTING_DOWN 선례를 따른다" 한 줄 cross-link 추가 권장. |
| I-9 | Convention Compliance | plan 파일명 `spec-draft-c1m7-publish-failfast` 의 `c1m7` 약어 불투명 | `plan/in-progress/spec-draft-c1m7-publish-failfast.md` | 필수 수정 아님. 필요 시 `spec-draft-publish-failfast-c1-m7.md` 처럼 도메인 단어 우선 배치 검토. |
| I-10 | Convention Compliance | `2-api-convention.md §6` 503 행 "사용 상황" 컬럼에 에러 코드 문자열 직접 기재 — 기존 표 스타일과 미소한 불일치 | `spec/5-system/2-api-convention.md §6` 503 행 | 에러 코드 괄호 직접 표기 대신 `→ §1.5` 링크 참조로 대체 검토. 규약 직접 위반 아님. |
| I-11 | Convention Compliance | `4-execution-engine.md` `pending_plans:` 에 본 plan 미등재 — additive-only spec-sync 는 면제 대상이나 규약에 명시 없음 | `spec/5-system/4-execution-engine.md` frontmatter | plan 본문에 "additive-only, spec frontmatter 변경 없음(status: partial 유지)" 한 줄 명시 권장. |
| I-12 | Plan Coherence | `spec-draft-exec-intake-queue.md` 도 §7.4·§1.5 편집 예정 — hunk 근접, 내용 충돌은 없으나 apply 순서 조율 필요 | `spec/5-system/4-execution-engine.md §7.4`, `spec/5-system/3-error-handling.md §1.5` | target plan 에 "spec-draft-exec-intake-queue §7.4/§1.5 변경과 hunk 근접 — apply 순서 확인" 메모 추가. |
| I-13 | Naming Collision | `EXECUTION_ENQUEUE_FAILED` — spec·코드베이스 전체 충돌 없음 확인 | `spec/5-system/3-error-handling.md §1.5` | 없음. |
| I-14 | Naming Collision | `ContinuationPublishResult` — 코드에 이미 존재, spec 사후 등재. 동명 충돌 없음 확인 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:329` | 없음. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | additive spec-sync 로 신규 크로스-스펙 모순 없음. 기존 서술 누락·내부 불일치 해소 방향 확인. |
| Rationale Continuity | LOW | 기각된 대안 재도입·invariant 위반 없음. `EXECUTION_ENQUEUE_FAILED` 등재 설명에 `RESUME_*` 비동기 원칙과의 경계 명시 권장(INFO). |
| Convention Compliance | LOW | `transient` 비표준 frontmatter 필드 사용(WARNING). 그 외 스타일·가독성 수준 INFO. |
| Plan Coherence | LOW | `refactor/06-concurrency.md` C-1·M-7 체크박스 미동기화(WARNING). `spec-draft-exec-intake-queue` 와 hunk 근접 INFO. |
| Naming Collision | NONE | 신규 식별자 전부 기존 대비 충돌 없음. |

---

## 권장 조치사항

1. **(W-1 해소)** `plan/in-progress/spec-draft-c1m7-publish-failfast.md` frontmatter 에서 `transient:` 행 제거. 대신 plan 본문 상단에 "임시 spec-sync draft: apply 후 삭제" 인라인 주석 추가.
2. **(W-2 해소)** spec-sync apply/merge 완료 후 `plan/in-progress/refactor/06-concurrency.md` C-1·M-7 체크박스를 완료 마킹하고 `refactor/README.md` 집계 동기화.
3. **(I-6 권장)** `3-error-handling.md §1.5` 신규 `EXECUTION_ENQUEUE_FAILED` 행 설명에 "enqueue 미진입 케이스(`queue.add` 반환 `queued:false`). `RESUME_*` 비동기 실패와 구별" 명시.
4. **(I-7 권장)** §7.4 신규 bullet 의 "WS §4.2 queued 준용" 표현을 "SERVER_SHUTTING_DOWN 503 선례(§11)와 동형"으로 교체.
5. **(I-12 권장)** `spec-draft-exec-intake-queue` 와 §7.4/§1.5 hunk 근접 여부를 apply 전 확인하고 선행·후행 순서를 plan 메모에 교차 기재.