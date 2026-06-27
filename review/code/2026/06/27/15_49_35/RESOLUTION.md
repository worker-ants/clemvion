# RESOLUTION — 확인용 재리뷰 2026/06/27/15_49_35

**대상**: `claude/mc-endpoint-hardening-dca699`
**결과**: Critical 0 / Warning 3 (전부 scope) / Risk LOW
**맥락**: 직전 ai-review `15_32_28` 의 코드/문서/테스트 Warning(W1–W5) fix(커밋 `547a332e`) 후 확인용 재리뷰. 그 Warning 들은 전부 해소 확인됐고, 본 재리뷰 잔여 Warning 은 scope 3건뿐이다.

## Critical

없음.

## Warning 처리 — scope 3건, 전부 justified(keep)

세 Warning 모두 동일 성격이다: reviewer 가 브랜치명(`mc-endpoint-hardening`)+CHANGELOG 로 의도를 "코드 hardening" 으로 추론해, 동반된 doc/plan 편집을 범위 외로 본 것이다. **실제 의도는 사용자가 명시 요청한 "A(코드 hardening) + B(doc-sync) 묶음 PR"** 이며, 핵심 구현 커밋 `7eb45204` 제목이 "model-config 부속 엔드포인트 hardening + doc-sync" 로 doc-sync 를 명시한다(reviewer 가 제시한 "커밋 메시지에 의도 명시" 대안 충족).

| # | 파일 | 처리 |
|---|------|------|
| W1 | `plan/complete/web-chat-loader-queue-replay-arguments.md` | KEEP — `spec_impact: [] → none`. Gate C(plan-completion spec-consistency)가 빈 배열을 거부해 **plan-touching PR 전부의 unit/CI 를 막던 #715 main breakage** 를 해소하는 필수 unblock. 제거 시 본 PR 의 unit 게이트 자체가 실패. #715 는 코드-only(spec 무변경) 확인 → `none` 이 정확. (분리 hotfix 도 가능하나 repo-wide 차단이라 동행 처리가 합리적) |
| W2 | `plan/in-progress/refactor/02-architecture.md` | KEEP — C-2 cluster 4 "PR 대기" stale → PR #714·#716 머지 완료 기록. **본 작업의 impl-prep consistency(`15_04_16`)가 직접 처방한 WARNING** 해소. doc-sync(B) 범위 |
| W3 | `plan/in-progress/spec-sync-auth-gaps.md` | KEEP — dead link `in-progress/`→`complete/auth-config-webhook-followups.md`. consistency-check 가 직전 짚은 정합성 정리. doc-sync(B) 범위 |

> 향후 교훈: "hardening" 같은 코드 중심 브랜치명에 doc-sync 를 묶을 때는 CHANGELOG/PR 제목에 doc-sync 범위를 명시해 scope reviewer 의 의도 추론과 어긋나지 않게 한다.

## INFO 처리

- **requirement SPEC-DRIFT** (spec §3 표에 invalid type→400 미기술): **defer** — reviewer 가 project-planner 경로로 라우팅. 400 동작은 이미 Swagger(`@ApiBadRequestResponse`·`@ApiQuery enum`)+CHANGELOG 에 문서화돼 있어 미문서 아님. spec §3 표 한 줄 보강은 planner 후속 후보.
- maintainability `MODEL_TYPE_ENUM` unexported: defer(현 계약 영향 없음).
- `@Throttle {ttl,limit}` 순서: 코드베이스 컨벤션 정렬(의도적), no-op.
- 기타 api-contract/documentation/side-effect INFO: pre-existing/defer.

## ESCALATE

없음.

## e2e

통과 — `.claude/tools/run-test.sh e2e` 215 pass (2026-06-27 15:46, `_test_logs/e2e-20260627-154638.log`). 마지막 코드 커밋(`547a332e`) 다음 수행. 케이스 H 에 `?type=bogus→400` 단언 포함. (코드 변경 없는 재리뷰라 추가 e2e 불요.)
