# RESOLUTION — trigger endpoint_path 리뷰 이월 (10_20_40)

리뷰 RISK=HIGH (CRITICAL=1, WARNING=3). **검증 결과 Critical 과 WARNING #1·#2 는 오탐**,
WARNING #3 은 pre-existing 범위 밖. 실제 코드 수정이 필요한 actionable Critical/Warning 0건.
근거를 아래 기록한다.

## 조치 항목

| SUMMARY # | 분류 | 판정 | 근거 / 조치 |
|---|---|---|---|
| Critical 1 | 요구사항 | **오탐 (무변경)** | 리뷰어는 system-status e2e 가 실패할 것이라 추정했으나 **실측 e2e 통과**: `_test_logs/e2e-20260628-101806.log` `493:PASS test/system-status.e2e-spec.ts`, `Tests: 219 passed`. 런타임이 `workspace-invitations-pruner` 큐를 등록(`system-status.constants.ts:75` via `WORKSPACE_INVITATIONS_PRUNER_QUEUE`)하므로 `EXPECTED_QUEUE_NAMES` 는 이를 **1회**(line 36) 보유해야 하며 현재 16개 = 런타임 16개로 일치. 리뷰어 제안대로 line 36 을 삭제하면 15개가 되어 **e2e 가 깨진다**. 내 변경은 PR #744 가 유입한 **중복**(2회 등재) 1건만 제거한 것이 정확. |
| WARNING 1 | SPEC-DRIFT | **오탐 (무변경)** | WH-MG-02(`spec/5-system/12-webhook.md:90`)가 이미 **"서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제(`@IsUUID('4')`)"** 라고 명시. 수정 DTO 강제는 spec 본문에 이미 있어 SPEC-DRIFT 아님. |
| WARNING 2 | 요구사항 | **오탐 (무변경)** | 위와 동일 근거 — JSDoc 의 `[Spec Webhook WH-SC-01·WH-MG-02]` 인용은 spec 실제 문구("생성/수정 DTO ... 강제")와 정합. 인용 부정확 아님. |
| WARNING 3 | 보안 | **범위 밖 (pre-existing)** | `external-interaction.e2e-spec.ts:1179-1180` JWT_SECRET 폴백 리터럴. 본 PR 미변경 라인(내 diff 는 ~86: endpoint_path UUID 화)이고 e2e 전용·`do-not-use-in-prod` 경고 포함. 리뷰어도 "PR 신규 도입 아닌 pre-existing" 명시. 본 trigger PR scope 밖. |

INFO 10건: 모두 비차단. 처리 방침은 §보류·후속 항목.

## TEST 결과

- **lint**: 통과 (`_test_logs/lint-20260628-005301.log`)
- **unit**: 통과 — backend 전건, frontend 4723 pass. **1 pre-existing 무관 red**(`spec-status-lifecycle.test.ts` node-cancellation.md pending_plans repoint 누락, PR #742, spec/ planner 영역) → `spawn_task task_104dac77` 분리. 본 PR 코드 무관.
- **build**: 통과 (background b3kr43678 exit 0)
- **e2e**: **통과 — 37 suites / 219 tests pass** (`_test_logs/e2e-20260628-101806.log`). 변경 영향 suite 전부 green: webhook-trigger(B2 비-UUID→400 포함)·external-interaction·chat-channel-slack/discord·system-status.

## 보류·후속 항목

- **INFO 4** (PATCH 비-UUID→400 e2e): 보류. UpdateTriggerDto `@IsUUID('4')` 거부는 unit(`trigger-dto-validation.spec.ts:135`)으로 이미 가드되고, POST e2e(B2)가 동일 ValidationPipe 스택을 실증. PATCH 변형은 한계효용 낮아 별도 추가 시 재-review 사이클 비용 대비 보류.
- **INFO 1/5** (V102 `VALIDATE CONSTRAINT` 승격 + 정규식 DB-level 테스트): 운영 endpoint_path 전수 UUID 클린 확인 후 별 migration(V103+) 로 승격하는 후속. plan 에 기록.
- **INFO 3** (service.spec 슬러그 픽스처 UUID 화): 선택적 일관성 정리, 본 PR scope 밖 별건.
- **INFO 2/7/8/9**: 비이슈 확인. INFO 2 — `ALTER TABLE trigger` 무따옴표는 기존 패턴(V001:209)이고 V102 가 e2e 에서 실제 적용됨. INFO 9 — v5 벡터는 version nibble=5 거부 의도 충족.
- **maintainability reviewer**: output_file 미존재(1건). 변경셋이 작아(JSDoc·migration·test 픽스처) 잔여 리스크 낮음 — 미재실행, 본 노트로 갈음.
