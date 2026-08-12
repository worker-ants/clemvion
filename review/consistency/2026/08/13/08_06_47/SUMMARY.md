# Consistency Check 통합 보고서

**BLOCK: YES** — `spec/conventions/redis-keys.md` 를 참조하는 미커밋 spec 편집이 실제로는 존재하지 않는 파일을 가리켜 `spec-link-integrity` 프론트엔드 게이트를 즉시 깨뜨림(재현 확인).

## 전체 위험도
**HIGH** — Critical 1건(죽은 spec 링크, 게이트 실측 RED) + WARNING 3건(같은 편집의 자기모순적 spec 서술, 병렬 오픈 PR 3건과의 동일 영역 충돌, target 파일 자체의 동시 편집).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 미커밋 spec 편집(`eia-failopen-wording` 턴)이 존재하지 않는 `spec/conventions/redis-keys.md` 를 참조 — `spec-link-integrity` 게이트 실측 RED (`npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` → `1 broken in-repo spec link(s)` `[DEAD] spec/data-flow/15-external-interaction.md:308 -> ../conventions/redis-keys.md`) | `plan/in-progress/backend-lint-gate-broken-on-main.md` "완료 (2026-08-13, planner 턴 `eia-failopen-wording`)" 서술 / 실체는 `spec/data-flow/15-external-interaction.md:308` §4 표 + 같은 문서 §Rationale "Fail-open 정책의 일관 표기" (둘 다 uncommitted) | `spec/conventions/redis-keys.md` — 이 브랜치엔 부재. 별도 미머지 오픈 PR `#1160`(`claude/eia-redis-key-registry`)이 그 파일을 신설하는 커밋(`a561e107e`)을 갖고 있으나 아직 미머지 | PR #1160 머지 후 rebase, 또는 머지 전까지 해당 링크를 `[execution-engine §9.1](../5-system/4-execution-engine.md#91-키-패턴)` 로 임시 정정(plan_coherence 가 지목한 실제 SoT 앵커) 후 커밋 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 의 근본 원인 — `spec/conventions/redis-keys.md` 신설 여부 및 병렬 PR 머지 순서 조율 —
> 은 `spec/` 쓰기 권한(project-planner 전용, CLAUDE.md §Skill 체계)과 병렬 세션 간 머지 조율의
> 영역이라 developer/consistency-checker 권한 밖이다. **BLOCK: YES 는 그대로 유지**하며, 이 표는
> 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/conventions/redis-keys.md` 신설 여부는 `spec/` 쓰기 결정(project-planner 전용)이고, 실제로 그 파일을 만드는 작업은 이미 별도 미머지 PR `#1160` 에서 진행 중 — 이 세션이 임의로 새 spec 문서를 만들거나 다른 PR 의 결과를 가정할 권한이 없다 | project-planner (PR #1160 담당 세션 또는 현재 세션의 planner 턴) | `spec/data-flow/15-external-interaction.md:308` §4 외부 의존 표의 `conventions/redis-keys.md` 링크를 (a) PR #1160 머지 후 실제 파일로 확정하거나 (b) 머지 전이면 `4-execution-engine.md §9.1` 앵커로 임시 정정. 병행해 `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속의 "EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다" 항목이 이 결정에 종속됨을 명시 | `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 (line 724 부근), PR `#1160`(`claude/eia-redis-key-registry`) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 같은 `eia-failopen-wording` 편집이 SoT spec 에 "`statusCode` 가 유효 HTTP 범위(100~599)까지 검증된다"고 사실로 단정했으나, 실제 구현(`isIdempotencyEntry()`)은 `typeof === 'number'` 만 검사 — target 자신이 열어 둔 "readKey/hashBody 경계값 테스트 부재" 항목과 정면 모순. 같은 브랜치에서 "문서한 보장이 구현보다 넓다" 클래스의 4번째 재발 | `spec/5-system/14-external-interaction-api.md` §R8 Rationale, 1068행(uncommitted) | `plan/in-progress/backend-lint-gate-broken-on-main.md` 684행 "readKey/hashBody 경계값 테스트 부재"(`- [ ]`, PR 범위 밖 명시 유예) / `idempotency.interceptor.ts:370-378` | spec 문장에서 "유효 HTTP 범위까지 본다" 를 제거하거나 "값 범위는 아직 미검사(선재 갭)"로 정정. 또는 `isIdempotencyEntry()` 에 실제 100~599 범위 검사를 추가해 구현을 spec 에 맞추고 684행 체크박스를 함께 닫음 |
| 2 | cross_spec | target 이 "미해결"로 남긴 backlog 3건(CCH-SE-02 dedup 미배선 / EIA Redis 키 레지스트리 누락 / readKey·hashBody 경계값 테스트 부재)이 이미 병렬 오픈 PR 로 진행 중이며, 그중 `#1161` 은 target 파일 자체도 수정 중 — 동시 편집·머지 충돌 위험 | `plan/in-progress/backend-lint-gate-broken-on-main.md` 미해결(`[ ]`) 항목 (line 712, 724, 703) | 오픈 PR `#1161`(`claude/cch-se02-dedup`) · `#1160`(`claude/eia-redis-key-registry`) · `#1159`(`claude/eia-idem-key-boundary`) — `#1161` 은 `gh pr diff 1161 --name-only` 확인 결과 target 파일 자체를 포함 | push 직전 `git log origin/main` + 세 PR 상태 재확인(메모리 `feedback_parallel_session_backlog_collision` 절차). 델타 0(이미 해결)이면 backlog 항목을 해당 PR 참조로 정리·제거 |
| 3 | cross_spec | (기존 항목 재확인, 여전히 미해결) `spec/5-system/15-chat-channel.md` CCH-SE-02 가 서술하는 dedup 메커니즘이 EIA-AU-08 의 in-process 우회 아키텍처와 문자 그대로 양립 불가 | target 문서 line 712-723 backlog 항목 | `spec/5-system/15-chat-channel.md:88`(CCH-SE-02) vs `spec/5-system/14-external-interaction-api.md` §3.3 EIA-AU-08/§3.3.1 | 오픈 PR `#1161`(`chat-channel-dedup.service.ts` 신설)이 다루는 것으로 보임 — 병합 시 CCH-SE-02 문구가 "in-process 전용 dedup 서비스"로 SoT 갱신됐는지 planner 확인 필요 |
| 4 | plan_coherence | 위 Critical 과 동일 근본 원인(죽은 링크)의 상세 버전 — plan_coherence 는 독립적으로 재현·확인(`ls spec/conventions/`, `grep -rn conventions/redis-keys.md`)하고 실제 SoT 앵커(`execution-context.md:62` 가 쓰는 패턴)를 제시 | 상동 | 상동 | Critical #1 과 동일 조치로 해소됨 (중복 병합) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `execution-engine.md §9.1` "모든 Redis 키" 전칭 명제가 target 이 적어 둔 것보다 범위가 크게 어긋남을 PR #1160 이 이미 실측(13계열 키 중 `workspaceId` 세그먼트 보유 0개, §9.2 phantom 키 2건 발견) | target line 724-732 | 착수 재개 불요 — PR #1160 병합 여부만 추적 |
| 2 | convention_compliance | EIA Redis 키 레지스트리 갭의 SoT 는 `spec/conventions/**` 가 아니라 `spec/5-system/**` — `spec/conventions/` 안에는 Redis 키 네이밍 규약 문서가 아예 없음(확인: `grep -rl Redis spec/conventions/`) | target §후속 미해결 항목 | 별도 조치 불필요, 향후 라벨 구분 권고(규약 갱신 성격 제안, 필수 아님) |
| 3 | naming_collision | EIA 계열 Redis 키(`interaction:idempotency:*`)가 `4-execution-engine.md` §9.1/§9.2 레지스트리 표에 미등재 — 네임스페이스 분리로 실제 키 충돌은 없음, 등재 누락일 뿐 | `idempotency.interceptor.ts:21` REDIS_KEY_PREFIX | target 이 이미 자체 발견·기록한 방침(§9.1 범위 축소 또는 EIA 계열 묶어 등재)에 동의, 별도 제안 없음 |
| 4 | naming_collision | `ChannelUpdate.idempotencyKey` 가 `hooks.service.spec.ts` mock 과 `chat-channel/types.ts:129` 양쪽에 나타나지만 동일 타입·동일 의미 — 이름 재사용에 의한 혼선 아님 | `chat-channel/types.ts:129` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | 죽은 `redis-keys.md` 링크(CRITICAL, 게이트 실측 RED) + 병렬 오픈 PR 3건과의 동일 영역 충돌(WARNING, `#1161` 은 target 파일 자체도 동시 편집) |
| rationale_continuity | NONE | 기각 대안 재도입·무근거 번복·invariant 우회 없음. R8/Rationale 계승이 문구 단위로 정확, 권한 밖 항목은 planner 인계로 정상 처리 |
| convention_compliance | NONE | `spec/conventions/**`(secret-store, error-codes, spec-impl-evidence) 직접 위반 없음. Redis 키 레지스트리 갭은 SoT 가 `spec/5-system/` 이라 이 관점 밖(INFO) |
| plan_coherence | MEDIUM | 오늘 완료 처리된 uncommitted 편집 자체의 두 자기모순: (1) 죽은 링크(Critical 과 동일 근본 원인) (2) spec 이 미구현 statusCode 범위 검증을 "이미 있다"고 단정(같은 브랜치 4번째 "문서한 보장 > 구현" 재발) |
| naming_collision | LOW | CRITICAL/WARNING 급 이름 충돌 없음. Redis 키 네임스페이스 분리(등재 누락, 충돌 아님)만 INFO |

## 권장 조치사항
1. **(BLOCK 해소, planner 인계)** `spec/data-flow/15-external-interaction.md:308` 의 `conventions/redis-keys.md` 링크를 커밋 전 처리 — 가장 빠른 경로는 `[execution-engine §9.1](../5-system/4-execution-engine.md#91-키-패턴)` 로 임시 정정(§planner 인계 #1). PR #1160 이 먼저 머지되면 그 위로 rebase 하는 대안도 가능.
2. **(WARNING #1)** `spec/5-system/14-external-interaction-api.md` §R8 Rationale, 1068행의 "statusCode 유효 HTTP 범위까지 검증" 문장을 실제 구현(`typeof === 'number'` 만)과 일치시킨다 — 문장 정정 또는 `isIdempotencyEntry()` 구현 보강 중 택일.
3. **(WARNING #2·#4)** push 직전 `git log origin/main` + PR `#1159`/`#1160`/`#1161` 상태 재확인. 델타 0 이면 target 문서 backlog 항목을 해당 PR 참조로 정리.
4. **(WARNING #3, 기존 미해결)** CCH-SE-02 문구 정정은 PR #1161 병합과 함께 planner 확인 필요 — 이번 라운드 조치 대상 아님, 추적만.
5. INFO 항목들(§9.1 전칭 명제 어긋남, Redis 키 등재 누락, `ChannelUpdate.idempotencyKey` 중복)은 target 이 이미 적절히 처분해 두었으므로 이번 라운드에서 추가 조치 불필요.
