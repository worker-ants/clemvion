## 검토 대상

- target PR: `eia-getstatus-column-projection` (getStatus() 2단계 컬럼 projection, `interaction.service.ts`)
- 배경: 직전 impl-done(`review/consistency/2026/07/10/23_20_43/`)은 BLOCK: NO, Warning 1건(spec-sync 트래커 line-range stale). 그 Warning 은 `b5d0203bc`에서 조치(라인 인용→심볼 인용). 이후 `c807d4d1b`로 plan 이 `plan/complete/`로 이동. 코드 변경 0(mtime 만 갱신)이라 guard 재발화 재검토.

## 발견사항

없음. Critical / Warning / Info 어느 등급도 발견되지 않았다.

### 참고 확인 사항 (문제 없음, 판단 근거로 기록)

1. **`plan/complete/` 이동 정당성** — `plan/complete/eia-getstatus-column-projection.md` 체크리스트 0~9c 전항목 `[x]`, 미해결 follow-up 0건(본문에 "후속"/"TODO"/"결정 필요" 섹션 없음). 이동 commit `c807d4d1b`는 `git mv` 로 `plan/{in-progress => complete}/...` 단일 rename(0 insertions/0 deletions) — history 보존 확인. 커밋 메시지 `chore(plan): mark eia-getstatus-column-projection complete` 형식 준수. `plan-lifecycle.md §3` "이동은 마지막 작업 PR 안에서" 요건은 이번 검토 대상이 마지막 PR 자체라 직접 검증 불가하나(별도 PR 분리 여부는 push 시점 확인 사항), 최소한 이동 commit 이 review/impl-done 완료 commit(`b5d0203bc`) 바로 다음 commit 으로 같은 작업 흐름 안에 있다.
2. **Gate C `spec_impact: none` 타당성** — `git diff --stat cc3dafa8c..HEAD -- 'spec/**'` 결과 0줄(spec 파일 무변경 실증). frontmatter comment 도 "wire·DTO·에러코드 무변경의 순수 내부 조회 최적화"로 근거 명시. `started: 2026-07-10`(cutoff 2026-06-04 이후)이라 Gate C 대상이지만 값 자체(list 아닌 `none` 리터럴)가 스키마 요구(`spec-plan-completion.test.ts`)를 충족.
3. **spec-sync 트래커 line 17 심볼 인용 정확성** — `interaction.service.ts` 실제 코드에서 `getStatus()`(264행 시작) 내부에 `if (execution.status === ExecutionStatus.WAITING_FOR_INPUT)`(288행) 분기가 실존. 심볼 인용(`getStatus()` 의 `WAITING_FOR_INPUT` 분기)은 향후 리팩터로 라인 번호가 또 drift 해도 유효하다는 점에서 라인 인용보다 추적성이 견고 — 수용 가능. 같은 라인이 두 번 연속 라인-드리프트로 stale 화됐던 이력(직전 impl-done Warning)을 감안하면 심볼로의 전환이 재발 방지책으로 합리적.
4. **dangling 참조** — `grep -rn "in-progress/eia-getstatus-column-projection"` 결과는 전부 `review/**` 산출물(시점 기록) 안에만 존재. `plan-lifecycle.md §3` "인입 참조: `review/**` 같은 시점 기록 문서는 옛 경로 유지"에 따라 이는 정상 동작이며 갱신 대상 아님. `review/**` 밖(spec/, plan/ 등 살아있는 문서)에는 옛 경로 참조 0건.
5. **다른 in-progress plan 과의 충돌** — `getStatus`/`interaction.service`를 언급하는 4개 plan(`ai-agent-tool-connection-rewrite.md`, `self-hosting-deployment.md`, `merge-p2-async-fanin.md`, `node-output-redesign/*.md`) 확인 결과 전부 SSE payload namespace·monotonic seq·structured `resumed` emit 등 **다른 관심사**(WS/SSE emit 로직)를 다루며, 본 PR 의 REST `getStatus()` DB column projection 과 직접 충돌하는 미해결 결정은 없음.
6. **`14-external-interaction-api.md` frontmatter `pending_plans` 갱신 필요 여부** — 현재 `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 만 등재돼 있고 `eia-getstatus-column-projection.md`는 애초에 등재된 적 없음. 이는 정당하다 — `pending_plans`는 "미구현 surface 를 책임지는 plan"(spec-impl-evidence.md §2.1) 전용이고, 본 plan 은 spec 이 이미 약속한 surface 의 순수 내부 성능 최적화(spec_impact: none)라 애초에 spec gap 을 추적하는 plan 이 아니다. 갱신 불요.

## 요약

`plan/complete/` 로의 이동은 체크리스트 전항목 완료·`git mv` history 보존·Gate C `spec_impact: none`(spec diff 0 실증) 모두 정당하다. 직전 Warning(spec-sync 트래커 line-range stale)은 라인→심볼 인용 전환으로 실제 코드와 일치하게 해소됐고, 이 전환은 향후 재발(라인 드리프트) 방지 측면에서도 개선이다. dangling 참조는 `review/**` 시점 기록에만 남아 있어 규약상 정상이며, 다른 in-progress plan 과의 결정 충돌도 발견되지 않았다. 이번 재검토는 코드 내용 변경 없이 mtime 만 바뀐 재발화 케이스이며, plan 정합성 관점에서 신규 이슈는 없다.

## 위험도

NONE

STATUS: OK
