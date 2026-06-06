# 변경 범위(Scope) 리뷰

## 발견사항

### 핵심 구현 파일 (파일 1-3) — NONE

- **[INFO]** 모두 PR-B2의 직접 구현 범위 내.
  - 위치: `codebase/backend/migrations/V087__execution_resume_call_stack.sql`, `execution.entity.ts`, `resume-call-stack.types.ts`
  - 상세: `resume_call_stack` JSONB 컬럼 추가(마이그레이션 + 엔티티 + 타입) — `ResumeCallStack`/`ResumeCallStackFrame` 인터페이스는 해당 컬럼 전용 타입으로 필요 최소 범위.
  - 제안: 없음.

### Plan 파일 (파일 4-7) — 모두 범위 내

- **[INFO]** `exec-intake-queue-impl.md`: PR2b 착수조건 추가(착수 전 rebase 선행 명기) + PR3 이관 표기.
  - 위치: `plan/in-progress/exec-intake-queue-impl.md` L172-176
  - 상세: consistency-check W4에서 권고된 조치 사항(PR3 → exec-park-durable-resume 이관 표기, PR2b rebase 선행 명기)의 직접 이행. 변경 의도와 완전히 정합.
  - 제안: 없음.

- **[INFO]** `node-cancellation-infrastructure.md`: §2에 cross-link 2줄 추가.
  - 위치: `plan/in-progress/node-cancellation-infrastructure.md` L208-209
  - 상세: consistency-check W4에서 명시된 "B3와 §2 코드 영역 겹침·직렬화 순서" 교차 참조. 기존 내용 수정 없이 NOTE 블록 2줄 append만 — 최소 범위.
  - 제안: 없음.

- **[INFO]** `spec-draft-exec-park-b2-durable.md`: 신규 spec draft (57줄).
  - 위치: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
  - 상세: PR-B2 착수 전 consistency-check(--spec) 권고에 따른 spec 변경 설계 문서. plan 관행상 `plan/in-progress/`에 보관하는 임시 draft. frontmatter(`worktree`/`started`/`owner`) 포함 — plan-lifecycle 준수.
  - 제안: 없음.

### Review 산출물 (파일 8-39) — 범위 내 (공정 산출물)

- **[INFO]** `review/consistency/2026/06/06/01_19_37/**` (--impl-prep), `02_22_45/**` (--spec), `02_33_35/**` (--spec 재시도), `02_43_56/**` (--spec 최종): 4회의 consistency-check 산출물 전체.
  - 위치: `review/consistency/2026/06/06/`의 4개 세션 디렉토리
  - 상세: CLAUDE.md와 developer SKILL에 따라 구현 착수 전 `--impl-prep` + spec draft 검토 `--spec`을 의무 수행한 결과물. 각 세션의 SUMMARY.md, 개별 checker .md, meta.json, _retry_state.json이 포함됐다. 이 파일들은 review 산출물 경로(`review/consistency/YYYY/MM/DD/hh_mm_ss/`) 규약을 준수한다.
  - 제안: 없음. 단, `_retry_state.json` 파일들(파일 9, 17, 25, 33)이 `"agents_success": []` — 즉 초기 상태로 커밋됐다. 이는 워크플로 실행 전 초기 상태 스냅샷일 수 있어 정보 가치가 낮으나 삭제 의무는 없음.

### Spec 파일 (파일 40-41) — WARNING 1건

- **[WARNING]** `spec/5-system/4-execution-engine.md` §4.3 구현 메모: "Phase B 완료형" → "단계 롤아웃 중(PR-B2 미적용 명기)" 역방향 수정.
  - 위치: `spec/5-system/4-execution-engine.md` L221, L224
  - 상세: 이전 커밋(e0dec39b, PR-B1 완료)에서 이미 "Phase B 완료형"으로 기술됐던 §4.3 구현 메모 2개 블록을 이번 커밋에서 다시 "단계 롤아웃 중·PR-B2 미적용" 과도기 표현으로 되돌렸다. 이는 PR-B1 구현이 실제로는 완료형이 아님(멀티턴 AI가 아직 in-memory 코루틴 사용)을 인정하는 "정직화(honesty fix)"다. consistency-check 02_33_35의 convention_compliance W1("과도기 인라인 주석 잔존")이 이 되돌림을 요구한 것으로 보인다. 내용 자체는 타당하나, PR-B1 리뷰 사이클이 이미 완료된 시점에 spec을 수정하는 것이 현재 PR(PR-B2 착수 준비)의 변경 의도인지 명확히 확인이 필요하다. 이 spec 수정이 PR-B2 구현과 별도 커밋으로 분리되지 않으면 PR-B1 리뷰 resolution 이후 추가 spec 변경이 PR-B2 diff에 혼합된다.
  - 제안: 이 변경이 의도적인 "PR-B1 spec 정직화" 커밋임을 커밋 메시지나 plan에 명기했는지 확인. 이미 plan의 `spec-draft-exec-park-b2-durable.md` C5에서 "PR-B1 정직화 → 완료형" 전환을 PR-B2와 동시 랜딩으로 계획했으므로 이 수정은 C5의 선행 단계(정직화)에 해당 — 그렇다면 범위 내이나, PR-B2 코드 미포함 상태에서 먼저 spec만 "과도기" 표현으로 되돌리는 것이 spec-impl 정합에 미치는 영향을 확인할 것.

- **[INFO]** `spec/5-system/4-execution-engine.md` §6.3 표 Multi-turn resume 행: D3 frozen 범위 cross-ref 추가.
  - 위치: `spec/5-system/4-execution-engine.md` L233
  - 상세: consistency-check 01_19_37 W1("D3 번복이 §6.3에 미전파") 권고의 직접 이행. `frozen 범위 = 한 turn` cross-ref 1줄 추가 — 최소 범위.
  - 제안: 없음.

- **[INFO]** `spec/5-system/13-replay-rerun.md` §14.3: D3 fresh-config-per-turn 단서 추가.
  - 위치: `spec/5-system/13-replay-rerun.md` L197
  - 상세: consistency-check 01_19_37 W1 권고의 이행. 기존 문장 말미에 D3 설명 1문장 append — 최소 범위, 기존 내용 수정 없음.
  - 제안: 없음.

---

## 요약

변경 범위는 전반적으로 PR-B2 착수 준비 및 consistency-check 권고 이행이라는 의도에 부합한다. 핵심 구현(V087 마이그레이션 + 엔티티 + 타입), plan 업데이트(착수조건 명기·이관 표기·spec draft), consistency-check 산출물, spec 갱신(§6.3·§14.3 D3 cross-ref) 모두 명시된 작업 범위 내다. 주목할 점은 `spec/5-system/4-execution-engine.md` §4.3 구현 메모 블록 2개를 "완료형"에서 "과도기(PR-B2 미적용)" 표현으로 되돌린 부분으로, 이는 PR-B1 이후 발견된 spec 과오 수정(정직화)으로 이해되나 이미 완료된 PR-B1 리뷰 사이클 산출물과의 정합성 추적이 필요하다. 불필요한 리팩토링·무관한 수정·포맷팅 혼합·사용하지 않는 임포트 추가·의도하지 않은 설정 파일 변경은 발견되지 않았다.

---

## 위험도

LOW
