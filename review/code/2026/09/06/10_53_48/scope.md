# 변경 범위(Scope) 리뷰

## 개요

이 diff(`origin/main...HEAD`, 34개 파일, `96d3856a9` feat + `4d49aa575` fix 두 커밋)는
plan 항목("`User` 엔티티에 컬럼 수준 방어를 둘지 결정")을 닫는 작업과, 그 첫 라운드
`/ai-review`(`review/code/2026/09/06/10_13_22`)가 찾아낸 Critical 1 + WARNING 3, 그리고
`/consistency-check`(`review/consistency/2026/09/06/10_13_23`)가 찾아낸 WARNING 3 을
같은 세션에서 처분(fix)한 결과다. `git show --stat` 로 두 커밋을 분리 확인한 결과, feat
커밋(10 files)과 fix 커밋(RESOLUTION.md 가 적은 항목만 건드리는 32 files)이 각자 선언한
범위와 실제 diff 가 정확히 일치한다 — "고쳤다"고 적은 파일 목록 밖의 변경은 없다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 추가는 "User 컬럼 방어"라는 1차 목표 밖의 곁가지 산출물이다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto`, 필드 `joinedAt`)
  - 상세: 이번 작업의 핵심은 `User` 관계를 투영 없이 싣는 자리를 잡는 두 검출 축(`user-entity-exposure-guard.ts`/`user-secret-absence.ts`)이다. `joinedAt` 필드는 그 핵심과 무관하게, 신규 e2e(`workspace-rbac.e2e-spec.ts` 케이스 `J`)가 `assertMatchesContract` 를 처음 배선하면서 부수적으로 드러난 §5.4 선언 갭이다. 범위 확장으로 보이긴 하지만 (a) `WorkspacesService.listMembers` 가 이미 무조건 `joinedAt` 을 실어 왔다는 것을 실측으로 확인해 wire 동작 변경이 아니고, (b) CHANGELOG·plan 완료 노트·DTO 자체 JSDoc 세 곳 모두에서 "곁가지"임을 명시적으로 disclose 했으며, (c) 직전 라운드(`review/code/2026/09/06/10_13_22/scope.md`, `api_contract.md`)가 이미 같은 항목을 INFO 로 처분한 바 있다. 새로 지적할 것은 없고 기존 판정을 재확인하는 수준이다.
  - 제안: 조치 불요. 다만 이런 "테스트가 드러낸 계약 갭"은 별도 후속 커밋으로 분리하는 편이 diff 리뷰 시 관심사 분리에 유리하다는 점만 참고로 남긴다.

- **[INFO]** fix 커밋이 직전 리뷰/컨시스턴시 세션 산출물(`review/code/2026/09/06/10_13_22/**`, `review/consistency/2026/09/06/10_13_23/**`, 총 20개 파일)을 코드 수정과 한 커밋에 묶어 커밋했다
  - 위치: `review/code/2026/09/06/10_13_22/*.md`·`meta.json`·`_retry_state.json`, `review/consistency/2026/09/06/10_13_23/*.md`·`meta.json`·`_retry_state.json`
  - 상세: `CLAUDE.md` 의 "코드 리뷰 산출물"·"일관성 검토 산출물" 저장 위치 규약과 이 저장소의 기존 관례(`review/**` 는 gitignore 대상이 아니며 RESOLUTION.md 로 처분을 기록해 커밋하는 패턴이 반복 관찰됨, 예: `f5d97aa39`)에 부합하므로 원칙적으로 결함은 아니다. 다만 `_retry_state.json` 두 파일은 오케스트레이터의 내부 진행 상태(절대경로·subagent 호출 목록)를 담은 harness 메타데이터라, 산출물이라기보다 임시 상태 파일에 가깝다 — 다른 리뷰 세션에서도 같은 파일이 매번 커밋되는지(즉 관례인지, 누락된 `.gitignore` 인지)는 이 diff 만으로는 판단할 수 없다.
  - 제안: 조치 불요(관례를 벗어난 근거가 없음). 다만 `_retry_state.json` 을 리뷰 세션마다 영구 보존할 의도인지 한 번 확인해 두면, 다음에 이 패턴을 보는 사람이 "이것도 커밋해야 하나"를 반복 판단하지 않아도 된다.

- **[INFO]** e2e 라벨 재사용(`F.` 중복) — 1차 리뷰가 지적한 그대로 fix 커밋에서 정확히 정정됨, 재발 없음
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 신규 케이스가 `it('J. GET /:id/members …')` 로 확정(원래 `F.` 였던 것을 fix 커밋이 2줄만 바꿔 재명명)
  - 상세: `4d49aa575` 의 diff stat 이 `workspace-rbac.e2e-spec.ts` 에서 `2 insertions, 2 deletions` 만 보이고, `review/code/.../10_13_22/RESOLUTION.md` 가 "전수로 세어 미사용 레터를 골랐다 → `J.`" 라고 적은 것과 실제 코드가 일치한다. 범위를 벗어난 추가 리네이밍이나 부수 편집은 없다.
  - 제안: 없음 — 정상 처분 확인.

## 요약

두 커밋 모두 자신이 선언한 목적(feat: 검출 2축 신설, fix: 리뷰가 찾은 Critical 1 + WARNING 6 처분)과 실제 diff 파일 목록이 정확히 일치하고, 무관한 리팩토링·포맷팅·불필요 임포트·설정 변경은 발견되지 않았다. 유일하게 핵심 범위(`User` 컬럼 노출 검출)를 살짝 벗어나는 것은 신규 e2e 가 드러낸 `WorkspaceMemberDto.joinedAt` 선언 보강인데, wire 동작 변경이 없고 세 문서에서 투명하게 disclose 됐으며 직전 라운드 scope 리뷰도 같은 결론(INFO, 조치 불요)에 도달한 바 있어 재차 문제 삼지 않는다. 리뷰/컨시스턴시 세션 산출물 20개 파일이 fix 커밋에 함께 실린 것도 이 저장소의 명시된 저장 위치 규약과 일치하는 정상 관례로 판단한다. Critical/Warning 급 범위 이탈은 없다.

## 위험도

NONE
