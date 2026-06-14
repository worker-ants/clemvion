# Consistency Check 통합 보고서 (--impl-done, scope=form §6.2)

**BLOCK: NO** — Critical 발견 없음. WARNING 3건(2건은 false-positive/이미 조치), INFO 7건.

## 전체 위험도
**LOW** — 구현은 EIA/form spec 과 정합. WARNING 은 spec-corpus 트렁케이션 또는 main-vs-worktree 비교 아티팩트이며 worktree 본문은 이미 정정 완료.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | 판정 |
|---|---------|------|------|
| W-1 | Cross-Spec | WS spec §4.2 에 `VALIDATION_ERROR` 미등재 주장 | **false-positive** — `6-websocket-protocol.md` §4.2 에 `VALIDATION_ERROR` 행 이미 존재(본 PR 추가). related_specs 컨텍스트 트렁케이션으로 미인식 |
| W-2 | Cross-Spec | `chat-channel-adapter.md`·`slack.md` 구형 `VALIDATION_FAILED + fieldErrors` 잔존 | **이미 조치** — worktree 본문은 `VALIDATION_ERROR + error.details[]` 로 정정 완료 (grep 검증: 해당 3파일 VALIDATION_FAILED 0건). 체커 I-7 도 "worktree 는 갱신 완료" 확인. main 미반영분은 본 PR 머지로 해소 |
| W-3 | Naming Collision | `ValidationDetail` 이중 선언 — `workflow-errors.ts`(export) vs `validation.pipe.ts`(file-private, 동일 shape) | **DEFERRED-BACKLOG** — 두 레이어(execution-engine vs common pipe) 별개 관심사. `common`→`modules` import 는 의존 방향 위반이라 직접 통합 불가. `src/common/types/` 승격은 별도 cleanup plan 으로 추적 |

## 참고 (INFO)

- I-1/I-6: `9-foreach.md` 의 `VALIDATION_FAILED` 는 **ForEach item-level 전용 별개 코드** — form `VALIDATION_ERROR` 와 의미 충돌 없음 (확인 완료, 조치 불요).
- I-2: i18n `VALIDATION_ERROR` 번역 매핑 등재 여부 — 별도 점검(advisory).
- I-3/I-4: Swagger 데코레이터 description 스타일 — 기존 컨트롤러 관행과 동일, 무시 가능.
- I-5: `ErrorCode.VALIDATION_ERROR`/`INVALID_FIELD` enum 신설 후 인라인 리터럴 점진 교체 — 별도 cleanup plan(backlog).
- I-7: `chat-channel-adapter.md` main 잔존분은 본 PR 머지로 해소.

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | WS §4.2 행 존재(W-1 false-positive), adapter 본문 정정 완료(W-2) |
| Rationale Continuity | LOW | adapter/slack 정정 완료 |
| Convention Compliance | NONE | 에러 코드 명명·응답 shape 준수 |
| Plan Coherence | NONE | spec(Planned 표기) ↔ plan(spec-sync-form-gaps) 정합 |
| Naming Collision | LOW | ValidationDetail 이중 선언(W-3, deferred) |

## 결론
BLOCK: NO. 구현 ↔ form/EIA/WS spec 정합 확인. WARNING 은 false-positive 또는 이미 조치/backlog-deferred.
