# Rationale 연속성 검토 — spec/2-navigation/ (--impl-done)

## 검토 방법

- scope(`spec/2-navigation/`) 델타는 0개 파일 — 이 PR 은 spec 을 바꾸지 않았다. 검토는 **구현 diff(10개 파일/654줄)가
  spec/2-navigation 의 기존 `## Rationale` 결정·원칙과 충돌하는지** 를 판정하는 것이며, 프롬프트 번들에서 예산 절단된
  `git diff` 본문과 `spec/2-navigation/1-workflow-list.md`(§2.3 settings 관련) · `6-config.md` 는 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/patch-omit-undefined`)에서 절대경로로 직접 재확인했다.
- 실제 코드 diff: `codebase/backend/src/common/utils/omit-undefined.ts`(배열 거부 타입가드 추가, JSDoc 확장),
  `workflows.service.ts`(`update()` 의 `rest`/`settings` 병합에 `omitUndefined` 적용 + `settings != null` 가드),
  `nodes.service.ts`(`update()` 에 `omitUndefined` 적용 + 응답에서 `workflow` relation 제거),
  `auth-configs.service.ts`(`update()` 의 `rest` 병합에 `omitUndefined` 적용). 성격은 PATCH 부분 본문이 보내지 않은
  필드로 로드된 값을 덮던 결함의 수정이다 (커밋 `fd21691c9`, 회귀 수정 `edd79ca40`).
- 참고: 같은 브랜치의 이전 `--impl-prep` 라운드(`review/consistency/2026/09/27/13_11_33/rationale_continuity.md`)가
  `1-workflow-list.md` §2.3 "상태" 필터 행의 stale 경고 문구(이미 해소된 `?isActive=`/`?status=` 불일치를 여전히
  "현재 어긋난다"로 서술)를 WARNING 으로 지적했다. 워킹트리에서 재확인한 결과 그 문구는 이 PR 이후에도 그대로 남아 있다.
  **다만 이 PR 은 `1-workflow-list.md` 를 전혀 건드리지 않았으므로 이번 diff 가 만들거나 악화시킨 문제가 아니다** — 새 발견사항으로
  세지 않고 참고로만 남긴다.

## 발견사항

없음 — 아래 핵심 후보 세 갈래를 확인했으나 CRITICAL/WARNING 수준의 Rationale 위반은 찾지 못했다.

1. **`1-workflow-list.md` Rationale §2 (Import 의 permissive config 정책, 2026-07-04)** — "워크플로우 `settings`(admission-gate
   파라미터)는 permissive 예외에 포함되지 않는다 … strict nested DTO(`WorkflowSettingsDto`)로 hard-fail 한다"는 명시적 원칙이
   있다. 이번 diff 는 `UpdateWorkflowDto.settings`/`WorkflowSettingsDto` 의 검증 로직(class-validator whitelist +
   forbidNonWhitelisted)을 전혀 건드리지 않았다 — `omitUndefined`/`settings != null` 가드는 **검증을 통과한 뒤의 병합 단계**에서만
   동작한다. 미지 키·비양수·비정수를 여전히 400 으로 거부하는지 `workflows.service.spec.ts`/`workflow-settings.dto.ts` diff
   부재로 확인 — hard-fail 정책은 보존된다. 재도입된 기각 대안도, 우회된 invariant 도 없다.
2. **`workflow.settings` 병합을 "전체 교체가 아니라 spread-merge"로 유지하는 기존 결정(커밋 `07b6d598f`, "workspace
   대칭")** — 이 PR 의 핵심 결함(케이스 B: `{ settings: {} }` 가 저장된 `maxConcurrentExecutions` 를 지움)은 오히려 이 **기존
   합의 원칙("DB 잔여 키를 보존한다")을 실제로 어기고 있던 회귀를 고친 것**이다. `settings != null` 가드가 "top-level `null` =
   no-op"으로 처리하는 것도 새로 만든 규칙이 아니라 — 최초 도입 커밋(`07b6d598f`)에서 `settings !== undefined` 가드 + `...settings`
   spread 조합이 이미 그렇게 동작했음을 `git log -p` 로 확인했다(`{ ...obj, ...null }` 은 JS 스펙상 no-op). 이번 PR 의 중간
   커밋(`fd21691c9`)이 `omitUndefined(settings)`를 끼우며 `null` 입력에 대해 예외를 던지는 회귀를 만들었으나, 후속 커밋
   (`edd79ca40`, 코드 리뷰 1R Critical 처분)이 그 회귀를 원래 동작으로 되돌렸다 — "무근거 번복"이 아니라 **의도치 않은 이탈 →
   같은 PR 내 복원**이며, 그 사실이 코드 주석·plan(`plan/in-progress/patch-omit-undefined.md`)·커밋 메시지에 모두 근거와 함께
   남아 있다.
3. **`6-config.md` §A.2 PATCH 서술** ("편집 폼은 name·IP·비-비밀 config 만 변경하고 … 백엔드 `update` 는 `config` 를 통째 대체하지
   않고 shallow-merge") — `auth-configs.service.ts` 변경은 `rest`(name/ipWhitelist/isActive 등) 병합에만 `omitUndefined` 를
   적용했고, `config`/비밀값 shallow-merge 로직(R-2 근거)은 diff 밖이다. 부분 PATCH 가 "보내지 않은 필드는 유지"라는 스펙 서술과
   방향이 같다 — 오히려 이전 코드(`Object.assign(config, rest)`, undefined 를 그대로 덮음)가 이 서술을 어기고 있었다.

## 참고 (비차단, INFO 성격 — 이미 다른 트랙에서 처분됨)

- 같은 diff 를 본 code review 세션(`review/code/2026/09/27/14_20_00/SUMMARY.md`)이 INFO#4 로 "`settings` 최상위 필드는 명시적
  `null` 을 no-op 으로, `description`/`folderId` 등 스칼라 필드는 명시적 `null` 을 "값 지움"으로 처리해 같은 엔드포인트 안에서
  null 의미론이 필드마다 다르다"는 점을 지적했고, "이 PR 이 만든 설계가 아니며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 인계 항목으로 등재됨"으로 처분했다. Rationale 연속성 관점에서도 이 비일관성은 **새로 도입된 반전이 아니라
  사전 존재 설계**이고 이미 트래커가 있으므로 별도 CRITICAL/WARNING 으로 올리지 않는다 — 다만 향후 `1-workflow-list.md` Rationale
  §2 를 갱신할 기회가 생기면 "settings 최상위 `null` = no-op(그대로 유지), 개별 키 `null` = 그 키 초기화"를 한 문장으로 명문화해
  두면 다음 검토자가 같은 질문을 반복하지 않는다 (INFO, 비차단).

## 요약

이번 diff 는 `spec/2-navigation` 관련 API(`PATCH /workflows/:id`, `PATCH /auth-configs/:id`)의 부분 본문 처리가 로드된 값을
`undefined` 로 덮어 응답을 틀리게 하거나(케이스 A/D) DB 에 저장된 키 자체를 지우던(케이스 B) 결함을 고친 것으로, 오히려
`1-workflow-list.md`·`6-config.md` 에 이미 서술된 "부분 PATCH·잔여 키 보존" 원칙에 코드를 맞추는 방향이다. `settings` 의 strict
hard-fail 검증 정책(Rationale §2)은 이번 병합-단계 수정과 독립적으로 보존됐고, PR 내부에서 있었던 유일한 "번복"(중간 커밋이
`settings: null` 500 회귀를 만든 것)은 같은 PR 안에서 실측·근거와 함께 정정됐다(코드 리뷰 1R Critical → 처분 완료, 2R Critical
0건). Rationale 에서 기각된 대안을 이유 없이 재도입하거나, 합의 원칙을 우회하거나, 근거 없이 결정을 뒤집은 사례는 발견하지
못했다. 이전 `--impl-prep` 라운드가 지적한 `1-workflow-list.md` §2.3 상태 필터 stale 경고는 이 diff 와 무관하게 여전히
미해소 상태이나, 이 PR 이 만들거나 악화시킨 문제가 아니므로 이번 판정에는 반영하지 않는다.

## 위험도

NONE
