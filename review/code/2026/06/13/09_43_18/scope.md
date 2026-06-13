# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** `auth.controller.spec.ts` 포맷팅 변경 — 기능 무관 줄바꿈 정렬
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.spec.ts` diff lines +179~183, +192~196
  - 상세: `await expect(controller.refresh(req, mockRes as never)).rejects.toThrow(/Origin not allowed/)` 호출의 줄바꿈 위치가 변경됐다. 기존 3줄 형태 → 2줄 형태로 prettier 스타일 정렬 변경이며 코드 의미 변화 없음. 감사 로그 기능 추가와 무관한 포맷팅 변경이 실질 변경과 섞여 있다.
  - 제안: 변경 규모가 2건으로 작아 허용 가능하나, 포맷팅 전용 변경은 별도 커밋으로 분리하는 것이 이상적.

- **[INFO]** `webauthn.service.ts` 구 단행 JSDoc 미삭제 — 주석 중복 잔존
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` diff 기준 `deleteCredential` 메서드 직전
  - 상세: 신규 multi-line JSDoc(`/** 개별 credential 삭제. 삭제 후 남은 credential 수(remaining)를 반환 ... */`)이 추가됐으나 기존 단행 JSDoc(`/** 개별 삭제. 마지막 credential 이면 user.webauthn_recovery_codes 도 NULL 화. */`)이 삭제되지 않아 두 주석이 공존한다. 반환 타입 변경(`void` → `{ remaining }`)은 감사 로그 `details.remainingCredentials` 필드 제공을 위해 범위 내 변경이나, 구 주석 제거는 누락됐다.
  - 제안: 구 단행 JSDoc 한 줄 삭제로 해소 가능. 기능 영향 없음.

- **[INFO]** `spec/data-flow/1-audit.md` Rationale 섹션의 call site 카운트 불일치
  - 위치: `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` Rationale 마지막 단락
  - 상세: §1.1 본문은 이번 변경에서 "7개 위치 18개 call site" 로 정확히 갱신됐으나, Rationale 마지막 단락("모든 도메인 service 가 호출하는 cross-cutting concern" 폐기 선언)에 남아있던 "4개 모듈 13개 call site" 구 수치 참조를 "한정된 위치(워크스페이스 도메인 service + user.* 인증 controller)" 식의 서술로 변경하면서 숫자 주장을 §1.1 표로 위임했다. 이 부분은 이미 이번 diff 에서 수정됐으므로 실제 잔존 불일치는 해소됐다. 이전 scope 리뷰(09_28_06)에서 지적된 동 건이 RESOLUTION 처리(INFO 2/15 Fixed)로 반영된 것이 확인된다.
  - 제안: 현재 상태에서 추가 조치 불필요 (이번 변경에 이미 반영됨).

- **[INFO]** `plan/complete/spec-draft-refactor-04-security-drift.md` 신규 생성 — 현재 PR 핵심 범위와 간접 관련
  - 위치: `/Volumes/project/private/clemvion/plan/complete/spec-draft-refactor-04-security-drift.md`
  - 상세: `audit-user-actions` PR 의 핵심 변경(user.* 감사 액션 구현)과 달리, refactor-04-security 의 SPEC-DRIFT 6건 정정 완료 처리(complete/ 이동)가 동봉됐다. 파일 frontmatter 의 `worktree: refactor-04-security-286de9` 로 다른 worktree 소속임이 명시되어 있으며, "stale in-progress 정리 차원에서 complete/ 이동 (audit 액션 구현 PR 에 동봉)"이라고 명시적으로 서술하고 있다. 코드 변경이 전혀 없는 plan 문서 이동이므로 기능 영향은 없으나, 별개 worktree 의 plan 정리가 이 PR 에 포함된 것이다.
  - 제안: 기능 영향 없는 행정적 plan 정리이며 plan-lifecycle 규약 준수 이동이므로 허용 가능. 단, 범위상 엄격히 구분하면 별도 PR 이 더 명확하다.

- **[INFO]** 이전 ai-review 결과물(`review/code/2026/06/13/09_28_06/`) 전체 포함
  - 위치: `/Volumes/project/private/clemvion/review/code/2026/06/13/09_28_06/` 하위 전체 (SUMMARY.md, RESOLUTION.md, agent별 review md, _retry_state.json, meta.json)
  - 상세: 이전 회차 리뷰 산출물이 이 PR 에 포함돼 있다. 프로젝트 규약(MEMORY.md: "review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋")에 따라 의도된 포함이다. 범위 관점에서는 추가된 파일들이 리뷰 프로세스의 정상 산출물이므로 이상 없음.
  - 제안: 규약 준수. 조치 불필요.

## 요약

이번 변경의 핵심 목적은 spec §4.1 / Rationale 4.1.B 에서 약속한 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 세 감사 액션을 controller 경계에서 구현하는 것이다. 이를 위해 필요한 모든 파일(audit-action.const.ts 상수 추가, 3개 controller 구현, 2개 module DI 등록, 서비스 반환 타입 변경, 단위 테스트 추가, spec 문서 갱신, plan 완료 처리)이 포함됐으며 범위를 벗어나는 실질적 기능 확장이나 불필요한 리팩토링은 없다. 소범위 이슈로는 `auth.controller.spec.ts` 2건의 포맷팅 변경이 기능 변경과 혼재하고, `webauthn.service.ts` 의 구 단행 JSDoc 이 미삭제 상태로 잔존한다. `plan/complete/spec-draft-refactor-04-security-drift.md` 의 동봉은 다른 worktree 의 plan 정리이나 기능 영향이 없는 행정 처리다. 전체적으로 의도된 범위에 충실하며 과도한 변경이나 무관한 수정은 발견되지 않았다.

## 위험도

LOW
