# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위 요약

diff-base `origin/main` 대비 이번 브랜치의 변경은 (1) `eslint 9 → 10` 상향(backend +
`packages/*` 8개), (2) frontend·`channel-web-chat` 은 upstream(`eslint-config-next` 의
react/jsx-a11y/import 플러그인) 이 막아 eslint 9 유지 결정 + 근거 주석, (3) `@eslint/js@10`
`recommended` 신설 룰(`no-useless-assignment`, `preserve-caught-error`) 위반 15건 수정, (4)
`eslint-plugin-unicorn@56→73` 상향에 따른 `parseGteFloor` 파서 확장(`>=X`/`>=X.Y` 지원) +
회귀 테스트, (5) `dependabot.yml` unicorn major ignore 해제. **`spec/5-system/**` 자체는 이번
diff 에서 전혀 수정되지 않았다** (`git diff origin/main -- spec/5-system/` = 빈 결과, plan
본문도 동일하게 실측해 명시).

## 발견사항

- **[INFO]** 담당 plan 이 이미 자기 완결적으로 cross-plan 중복을 배제해 뒀다
  - target 위치: 해당 없음 (target 은 spec/5-system/ 이며 diff 로 건드리지 않음)
  - 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트 하단 —
    2026-08-28 `11_15_50` `--impl-prep spec/5-system/` 사전 검토 기록
  - 상세: 이 plan 자신이 이번 작업 착수 직전 `--impl-prep spec/5-system/` 을 이미 돌려
    WARNING 4건(①JWT role 클레임 각주 ②동시 세션 한도 표면 정리 ③`OAUTH_STATE_MISMATCH`
    미등재 ④execution-engine/embedding-pipeline/graph-rag 소급 caveat)을 확인했고, 그중
    ③④는 각각 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    · `plan/in-progress/update-returning-tuple-shape.md` 가 이미 위임해 둔 항목이라 "신규
    등재 불요" 로 명시적으로 판단해 뒀다. 이번 `--impl-done` 재검토에서도 diff 가
    `spec/5-system/**` 를 건드리지 않았으므로 이 판단은 그대로 유효하다 — 새로 확인할
    내용 없음.
  - 제안: 조치 불요. (수렴 확인 메모)

- **[INFO]** 라인 번호 참조 무결성 — `execution-engine.service.ts` 편집이 타 plan 의 라인
  앵커를 깨지 않는다
  - target 위치: 코드 diff `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`@@ -4915,7 +4915,7 @@`)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    §"UPDATE … RETURNING 튜플 shape" 후속 표 —
    `execution-engine.service.ts` 의 `failFirstSegmentSetup(:645)` · `runExecution(:4657)` ·
    `finalizeFailedExecution(:4844)` 등 정확한 라인 번호로 함수를 앵커링
  - 상세: 이번 diff 는 `let live: Execution | null = null;` → `let live: Execution | null;`
    처럼 초기화 제거(no-useless-assignment)만 수행하며 **줄 수 변화가 없는** 1:1 치환이다
    (`expression-resolver.service.ts`·`code.handler.ts` 는 `{ cause: err }` 추가로 각 +2줄
    이지만, 두 파일 모두 다른 plan 이 라인 번호로 앵커링하지 않는 파일이라 drift 영향
    없음). 따라서 위 plan 의 `:645`/`:4657`/`:4844` 등 라인 앵커는 이번 PR 이후에도 유효.
  - 제안: 조치 불요. (예방적 확인 — 향후 동일 파일에 줄-수 변화가 있는 PR 이 들어오면
    이 앵커들의 재검증이 필요함을 참고용으로 남김)

- **[INFO]** §3 "frozen 게이트 사각지대" 미결정 사항은 이번 diff 의 범위 밖으로 올바르게
  분리돼 있다
  - target 위치: 해당 없음
  - 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` §3
    (`typeorm → ioredis` peer 가 실제 런타임 경로인지 미판정 — (b)/(c) 택일 보류)
  - 상세: 이번 diff 는 `typeorm`/`ioredis`/`pnpm-workspace.yaml` peer 억제 규칙을 전혀
    건드리지 않는다. §3 는 체크리스트에 `[ ]` 로 정직하게 열려 있고, 이번 작업(§1·§2)의
    범위 밖임이 본문에 명시돼 있어 일방적 결정 없이 보류가 유지된다.
  - 제안: 조치 불요.

- **[INFO]** plan 체크리스트의 TEST WORKFLOW 항목은 이번 검토가 끝나야 갱신 가능
  - target 위치: 해당 없음
  - 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트
    `- [ ] TEST WORKFLOW + /ai-review` 하위 `/consistency-check --impl-done` 항목
  - 상세: 지금 수행 중인 이 검토가 바로 그 미체크 항목의 실행 그 자체다. 정합성 위반은
    아니며, 이 검토(및 뒤이은 `/ai-review`, e2e)가 끝난 뒤 plan 체크박스를 갱신해야
    한다는 절차적 참고 사항.
  - 제안: 이 검토 결과 반영 후 plan 체크박스 갱신 (developer 워크플로 통상 절차, 새로운
    plan 작업 아님).

## 요약

이번 PR 은 `spec/5-system/**` 문서를 전혀 수정하지 않는 순수 의존성/lint 업그레이드
(eslint 9→10 + 부수 recommended 룰 수정)이며, 담당 plan(`deps-peer-gating-and-eslint10.md`)
이 착수 전 `--impl-prep` 로 이미 관련 spec drift 4건을 확인해 그중 2건을 타 in-progress
plan(`spec-update-node-cancellation-shutdown-classification.md`,
`update-returning-tuple-shape.md`)의 기존 위임 항목과 중복되지 않도록 명시적으로
배제해 두었다. 코드 diff 중 다른 plan 이 라인 번호로 앵커링하는 `execution-engine.service.ts`
편집은 줄 수 변화가 없는 치환이라 그 앵커들을 깨지 않는다. §3(frozen 게이트 사각지대)의
미결정 사항도 이번 diff 범위 밖으로 올바르게 격리돼 있어 일방적 결정이 없다. Plan
정합성 관점에서 미해결 결정과의 충돌·선행 plan 미해소·후속 항목 누락 어느 것도 발견되지
않았다.

## 위험도

NONE
