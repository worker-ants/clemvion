# RESOLUTION — auth-config-audit (rebase 재검토 22_36_21)

본 세션은 **origin/main rebase 후**(#545 model-mgmt cleanup·rerank_config DROP + #546 code-node isolated-vm) 최종 코드 기준 재검토다. PR #547 이 GitHub 에서 §4.1 conflict(=#545 의 const 링크 경로 수정 vs 본 PR 의 W-6 문장) 를 일으켜 rebase·conflict 해소 후 freshness 재확보를 위해 재실행.

RISK **LOW**, Critical **0**, Warning **4**. 4건 모두 직전 `22_12_03` 라운드에서 이미 처분한 재발 항목으로, 동일 disposition 유지. 상세 근거는 [`22_12_03/RESOLUTION.md`](../22_12_03/RESOLUTION.md) 참조.

## 0. conflict 해소
`spec/5-system/1-auth.md §4.1` Action naming 단락 — #545 의 const 링크 경로(`../../codebase/backend/...`)와 본 PR 의 auth_config 현재형 근거 문장을 **둘 다 반영**해 병합. data-flow/code 무충돌. rebase 후 lint·build(isolated-vm npm install)·unit 6606·e2e 188 전부 통과.

## 1. Warning 처분 (22_12_03 와 동일, 재확인)

| # | 발견 | 처분 |
|---|------|------|
| W-1 | regenerate·remove 테스트 `workspaceId` 검증 | **부분 FP** — regenerate 는 이미 `workspaceId: WS` 검증함(L248). remove 만 미검증이나, 동일 `record()` 페이로드의 workspaceId 는 create/update 테스트에서 검증되고 remove 의 record 호출 경로·인자는 코드상 동일. 누락 필드는 assertion completeness nicety(비차단). 코드 fix 시 본 세션 stale→재리뷰 루프 유발하므로 위생 PR 로 이월 |
| W-2 | controller `userId`/`req.ip` 전파 단위 테스트 부재 | **e2e 커버** — webhook-trigger·audit-logs e2e(188 통과)가 인증 사용자 id·ip 의 audit 기록을 end-to-end 검증. 단위 컨트롤러 테스트는 위생 백로그 |
| W-3 | `crypto` namespace+named 이중 import | **pre-existing** (본 PR 미도입). 내 diff 밖 위생 → 백로그 (G-01 review 에서도 동일 처분) |
| W-4 | update/regenerate/remove JSDoc `@param` | **결정** — `{@link create}` 단일 참조로 param·best-effort 계약 중앙화(리뷰어가 허용한 옵션). 4메서드 @param 중복 대신 단일 SoT |

INFO 20건: 전부 비차단. req.ip §2.3 IP정책(#1, plan §3 추적)·reveal rate-limit(#6, plan §4)·Object.assign·constantTime·basic_auth regenerate(#5/#17/#19/#20, project-planner spec 결정)·audit 헬퍼/AuditContext(#9/#13 중기)·getUsage 병렬화/magic20(#8/#15)·USER 중복(#14) 등 — pre-existing/설계결정/별건. 상세 [`22_12_03/RESOLUTION.md §2`](../22_12_03/RESOLUTION.md).

## 2. 비수렴 노트
리뷰어가 라운드마다 동일 WARNING(test workspaceId·controller test·crypto·@param) + 신규 INFO 를 재보고한다(22_12_03: 25 INFO → 22_36_21: 20 INFO). 모두 INFO/비차단 위생이며 기능 결함 아니다. LOW·Critical 0·gates green 에서 종결하고 위생 항목은 별도 PR/§2~4 후속에서 일괄 처리한다.

## 3. TEST 결과 (rebase 후 재실행)
- **lint**: 통과 (eslint 0)
- **unit**: 통과 (backend 334 suites / 6606 passed — #545 rerank 테스트 제거 반영; auth-configs+audit-logs 47)
- **build**: 통과 (`nest build` clean; #546 isolated-vm 의존성 `npm install` 로 보충)
- **e2e**: 통과 (32 suites / 188 passed)
- **consistency --impl-done**: (rebase 후 재실행 — 본 RESOLUTION 과 동반 커밋)

## 4. 후속 (별건)
audit SoT 위생(test workspaceId·controller test·crypto import·audit 헬퍼) + spec-sync(project-planner) + `auth-config-webhook-followups.md` §2~4. 위 비수렴 위생 항목은 별도 hygiene PR 권장.
