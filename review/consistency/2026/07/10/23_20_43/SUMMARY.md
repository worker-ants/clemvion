# Consistency Check SUMMARY — `--impl-done`

- **모드**: `--impl-done` (구현 완료 후 사후 일관성 검토, spec `code:` glob 매칭 → 의무)
- **대상 spec**: `spec/5-system/14-external-interaction-api.md`
- **changeset**: `git diff origin/main...HEAD` (`getStatus()` 2단계 컬럼 projection)
- **일시**: 2026-07-10 23:20:43

## BLOCK: NO

Critical 0건. 5개 checker 전원 `STATUS: OK`.

| checker | STATUS | 위험도 | Critical | Warning |
| --- | --- | --- | --- | --- |
| cross_spec | OK | NONE | 0 | 0 |
| rationale_continuity | OK | NONE | 0 | 0 |
| convention_compliance | OK | — | 0 | 0 |
| naming_collision | OK | NONE | 0 | 0 |
| plan_coherence | OK | LOW | 0 | 1 |

## 핵심 확인

- **신규 요구사항 ID 없음** (cross_spec): `git diff | grep -oE "EIA-[A-Z]{2,3}-[0-9]{2}"` 신규 추가분 0건 — 과거 `--impl-done` 오탐(ID 미등재 BLOCK) 클래스에 해당하지 않음을 diff 로 직접 실증.
- **spec 파일 무변경** (cross_spec, convention): `git diff --stat -- 'spec/**'` 0건. §5.3/§R17 은 wire·노출범위·마스킹만 규정하고 **DB 조회 전략은 명세하지 않으므로** spec 갱신 의무 없음. `status: partial` / `pending_plans` 갱신도 불요(미구현 surface 를 남기지 않음).
- **§R17 불변식 코드 수준 성립** (rationale): `interaction.service.ts` 의 2단계 재조회 결과와 SSE emit 3곳(`button-interaction.service.ts` / `form-interaction.service.ts` / `ai-turn-orchestrator.service.ts`)이 **동일한 `thread-renderer.ts` 의 `redactThreadForPublic`** 를 공유. 기각 대안 (a)(SSE 전용 회귀)/(b)(NodeExecution 재구성) 재도입 없음.
- **PROJECT.md 동반 갱신 매트릭스 22개 행 전수 대조** (convention): 매칭 행 없음.
- **명명 충돌 0** (naming): `STATUS_PROJECTION_COLUMNS` 는 backend 전역 유일. 테스트의 `THREAD`/`DURABLE_THREAD` 는 **형제 describe 의 독립 클로저**라 shadowing 없음.
- **plan 체크박스 = 실제 상태** (plan_coherence): git log 3커밋 · e2e 로그 · ai-review 산출물 실존 확인. 과대·과소 표시 없음.

## Warning → 조치 완료

### W-A [plan_coherence] `spec-sync-external-interaction-api-gaps.md:17` line-range 재-stale

impl-prep 의 W3 로 `247-296` → `276-351` 로 한 번 고쳤으나, 이후 fix commit(`f2764f3a9`)이 `STATUS_PROJECTION_COLUMNS` 상수+JSDoc 을 **블록 위쪽에** 추가하면서 같은 블록이 `288-364` 로 다시 밀렸다.

→ **조치**: 라인 인용이 리팩터마다 stale 화되는 구조적 문제이므로, 숫자를 세 번째로 고치는 대신 **심볼 인용**(`getStatus()` 의 `WAITING_FOR_INPUT` 분기)으로 고정. 실제 블록이 288-364 임은 직접 확인.

## Info

- `RESOLUTION.md` 의 `commit` 열이 실제 hash 대신 `(본 commit)` — 같은 commit 안에서 자기 hash 를 적을 수 없는 chicken-egg. 프로젝트 내 다른 RESOLUTION 도 유사 표기 선례 있음.
- `satisfies (keyof Execution)[]` 는 backend 최초 사용 — 위반 아니며 참조 선례로 적합.
