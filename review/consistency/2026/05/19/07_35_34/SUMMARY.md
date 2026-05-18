# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 대상: `plan/in-progress/loop-count-policy.md`
검토 모드: plan draft 검토 (--plan)
검토 시각: 2026-05-19T07:35:34

---

## 전체 위험도

**MEDIUM** — Critical·BLOCK 사유 없음. WARNING 2건(output.count 3중 불일치 / worktree slug 미준수)이 해소되어야 spec 수정 품질과 plan 추적 정확도가 보장된다.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `output.count` 필드: `node-output.md §9.2` 와 `0-common.md §9.1/§11` 은 `{ iterations, count }` 로 명시하나 `3-loop.md §5.2` 는 `output.count` 를 명시적으로 제외하고 Principle 1.1 준수를 사유로 기재 — 3개 문서가 정면 충돌 | `plan/in-progress/loop-count-policy.md` (spec 수정 항목: `3-loop.md §5` 수정) | `spec/conventions/node-output.md §9.2`, `spec/4-nodes/1-logic/0-common.md §9.1(line 168)/§11(line 201)` | `3-loop.md` 수정 작업 범위에 다음 중 하나를 포함: (a) `node-output.md §9.2`·`0-common.md §9.1/§11` loop 행의 `count` 제거 + "횟수는 `meta.iterations` 또는 `output.iterations.length` 를 사용" 으로 정합화. (b) `3-loop.md §5.2` 를 `{ iterations, count }` 로 복원하고 §5.2 note 의 Principle 1.1 예외 사유 삭제. 결정 방향은 `3-loop.md §8 Rationale` 에 인라인 기록 |
| W-2 | Convention Compliance | frontmatter `worktree: loop-count-policy` — CLAUDE.md 가 요구하는 `<task_name>-<slug>` 형식 미준수 (slug 누락). plan_coherence checker 가 이 필드로 worktree 디렉토리를 대조하므로 실제 디렉토리명과 불일치 시 추적 오류 발생 가능 | `plan/in-progress/loop-count-policy.md` frontmatter `worktree` 필드 | `CLAUDE.md §Worktree 기반 작업 정책 §명명 규칙` | 실제 worktree 디렉토리명에 맞게 `worktree: loop-count-policy-<slug>` 로 갱신. 이미 slug 없이 생성된 경우 디렉토리명도 함께 재생성하거나, 최소한 frontmatter 를 실제 디렉토리명과 일치시켜야 함 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec + Rationale Continuity + Convention Compliance | i18n Principle 3 삭제 방향 적용 명시 — `loop:no-count` warningRule 제거 시 `backend-labels.ts:328` 제거가 동일 commit/PR 이어야 함. plan 항목이 존재하나 Principle 3 가드가 삭제 방향도 검출하는지 명기가 없고, 체크리스트 순서 분리 시 중간 빌드가 깨질 수 있음 | `plan/in-progress/loop-count-policy.md` 작업 항목 (schema 제거 vs labels 제거) | `loop.schema.ts` warningRule 제거와 `backend-labels.ts:328` 제거를 동일 commit 에 포함. 해당 작업 항목에 "i18n Principle 3 가드 통과 확인 — 삭제 방향 포함" 단문 주석 추가 |
| I-2 | Cross-Spec + Plan Coherence | sweep PR 선행 순서 미명시 — `node-config-required-defaults-sweep.md` 가 아직 PR merge 전(체크리스트 3개 미완)이며, 두 worktree 모두 `spec/4-nodes/1-logic/3-loop.md` 를 수정하는 항목 포함. base commit 관계가 plan 에 기록되지 않아 diverge/충돌 위험 | `plan/in-progress/loop-count-policy.md §배경·§관련 문서` | plan §배경 또는 §관련 문서에 "sweep PR merge 이후 착수 권장" 한 줄 추가. 착수 전 `git log --oneline -1 spec/4-nodes/1-logic/3-loop.md` 로 최신 sweep 변경 포함 여부 확인 |
| I-3 | Plan Coherence | sweep plan follow-up 마킹 작업의 책임 worktree 미명시 — `loop-count-policy.md` 의 해당 `[ ]` 항목이 어느 worktree 에서 수행하는지 불분명, 경합 위험 | `plan/in-progress/loop-count-policy.md` 작업 항목 | 해당 항목에 "loop-count-policy worktree 책임" 명시. 또는 `node-config-required-defaults-sweep.md` 의 해당 follow-up bullet 옆에 "(→ loop-count-policy 로 분리 예정)" 주석을 선행 추가 |
| I-4 | Rationale Continuity | 에러 코드 표 제거 범위 불명확 — L57 "L170 에러 코드 표에서 count 미설정 행 제거" 가 warningRule 경로만인지, handler.validate 경로까지 포함하는지 불명확 | `plan/in-progress/loop-count-policy.md §작업 항목` (L57) | "L170 행 전체 제거 (warningRule·handler.validate 양 경로 모두 zod default 로 인해 발화 불가)" 로 명시. 또는 handler.validate 행을 별도 유지하는 의도라면 그 구분을 작업 항목에 기술 |
| I-5 | Naming Collision | 신규 식별자 3종 충돌 없음 확인 — `loop-count-policy.md` 파일명, `3-loop.md §8 Rationale` 섹션번호, "최소 반복 1회 정책" 정책명 모두 기존 코퍼스와 충돌 없음. `0-common.md §8`("캔버스 요약")과 `3-loop.md §8`("Rationale") 번호 중복은 별도 파일 + 링크 명시 경로로 앵커 혼동 없음 | `plan/in-progress/loop-count-policy.md` 전체 | 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `output.count` 3중 문서 충돌(pre-existing, 이번 PR 정리 적기) + sweep worktree 순서 미명시 |
| Rationale Continuity | LOW | i18n Principle 3 삭제 방향 명시 부재, 에러 코드 표 제거 범위 불명확 — 모두 INFO |
| Convention Compliance | LOW | frontmatter `worktree` slug 누락(WARNING) — plan 구조·Rationale·git mv 항목은 규약 부합 |
| Plan Coherence | LOW | sweep PR merge 전 동일 spec 파일 수정 경합 위험, follow-up 마킹 책임 미명시 — 모두 INFO |
| Naming Collision | NONE | 신규 식별자 3종 충돌 없음, 제거 대상 식별자는 검토 제외 |

---

## 본 PR 처리 결과

- **W-1** — pre-existing cross-spec 충돌, 본 PR scope("loop.count default 정책") 외. sweep plan 및 본 plan 의 후속 follow-up 에 "loop output.count 3중 문서 정합화" 별 항목 추가.
- **W-2** — frontmatter `worktree: loop-count-policy` ↔ 실제 디렉토리명 `loop-count-policy` 일치. plan_coherence 추적 동작상 OK. CLAUDE.md strict 컨벤션은 별 정착 follow-up 으로 본 plan 에 기록.
- **I-1** — schema 변경 + i18n 매핑 제거 + tests + spec 갱신을 **단일 commit** 으로 묶음 (plan 머리말에 명시).
- **I-2** — sweep PR (#188) 이미 2026-05-18 22:11Z 머지 완료. plan §배경에 머지 완료 + base 명시.
- **I-3** — 본 PR 안에서 sweep plan 의 해당 follow-up bullet 을 "→ loop-count-policy 로 분리" 로 직접 마킹.
- **I-4** — plan 작업 항목에 "행 전체 제거 (warningRule + handler.validate 양 경로 모두 zod default 로 인해 발화 불가)" 로 명시.
- **I-5** — 별도 조치 불필요 (충돌 없음 확인).
