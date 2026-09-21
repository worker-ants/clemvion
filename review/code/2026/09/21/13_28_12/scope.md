# 변경 범위(Scope) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 + 이전 리뷰(12_57_05) 후속 조치

## 발견사항

- **[INFO]** `throwMemberNotFound()` 추출이 `removeMember()` 뿐 아니라 `updateMemberRole()` 까지 넓혀짐 — 직전 리뷰 WARNING #3 이 지적한 범위(2곳, 모두 `removeMember` 내부)보다 한 곳 더 넓다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:310`(`updateMemberRole()` 내부 `if (!member) this.throwMemberNotFound();`), 헬퍼 정의 `:342`(JSDoc `:332-341`)
  - 상세: 이번 PR 의 핵심 목적은 `removeMember()` 의 동시 제거 감사 중복 수정이다. `RESOLUTION.md` 의 SUMMARY WARNING #3 원문은 "`removeMember()` 안에서 `MEMBER_NOT_FOUND` 리터럴이 두 번(:788, :828) 중복됨"만 지적했는데, 실제 커밋(`f022ae9fd`)은 `updateMemberRole()`(:307-313)의 동일 리터럴까지 함께 `throwMemberNotFound()` 로 교체했다. 이 메서드는 이번 PR 이 고치는 동시성 결함과 무관하다. 다만 (a) 완전히 동일한 리터럴(`code: 'MEMBER_NOT_FOUND'`, 동일 메시지)의 기계적 추출이라 동작 변경 위험이 사실상 없고, (b) 커밋 메시지("MEMBER_NOT_FOUND 리터럴 **3중** 복제")와 헬퍼 JSDoc(":334-336 `updateMemberRole` · `removeMember`(두 판정)까지 세 곳에 복제돼 있었다")이 확장 사실을 은폐하지 않고 명시적으로 기록했다.
  - 제안: 이번 PR 을 막을 사유는 아니다(형제 PR `triggers`/`schedules`/`integrations` 선례와 동일한 헬퍼 패턴이고 위험이 낮다). 다만 리뷰 SUMMARY 조치 항목 표가 "원문 지적 범위=2곳"으로만 적혀 있어, 실제 조치가 그보다 넓었다는 사실이 `RESOLUTION.md` 표에는 드러나지 않는다 — 다음에 조치 이력을 되짚을 사람을 위해 `RESOLUTION.md` #3 항목에 "`updateMemberRole` 까지 포함해 3곳" 한 문구를 보태는 것을 권장한다(선택 사항).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 PR 의 코드 수정과 직접 관련 없는 백로그 3건(`auth-configs`/`model-config`/`webauthn`)과 spec 문서 참조 확장이 함께 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 `4874`~`4893`(신규 백로그 3항목), `4912`~`4914`·`4921`~`4925`(spec 문서 참조·각주 주의사항 확장)
  - 상세: 이 항목들은 이번 PR 이 실제로 고치는 `removeMember()` 결함과는 다른 자리(`auth-configs.service.ts:287`, `model-config.service.ts:404`, `webauthn.service.ts:532`)를 다루며, 코드는 전혀 건드리지 않고 트래커에 등재만 한다. `member-dup-remove.md` §A 의 전수 조사 과정에서 부수적으로 발견된 것이며, 형제 PR 5건(#1369~#1372)이 반복해 온 "전수 조사 중 발견한 잔여 자리를 트래커에 등재하고 코드는 건드리지 않는다"는 확립된 관례와 일치한다(이전 라운드 scope 리뷰어도 동일 결론). 코드 스코프 확장이 아니라 문서화 스코프이므로 문제 삼지 않는다.
  - 제안: 없음 — 현행 유지. 프로젝트 관례에 부합.

- **[INFO]** 실제 `codebase/` 변경은 정확히 3개 파일(`workspaces.service.ts`, `workspaces.service.spec.ts`, 신규 `member-remove-concurrency.e2e-spec.ts`)로 국한되며, 전부 `removeMember()` 의 동시 제거 감사 중복 수정이라는 목표에 직접 부합한다
  - 위치: 파일 1~3 전체
  - 상세: 무락 `remove(member)` → 원자적 `delete({id, workspaceId})` + `affected===0` 판정 전환, 그에 따라 기존 테스트(`:1298` mock 명시), 신규 unit `describe` 블록, 신규 e2e 스펙이 모두 이 하나의 변경을 검증하는 데 쓰인다. 불필요한 포맷팅·임포트 정리·무관 리팩토링은 관찰되지 않았다. 신규 임포트(`DeleteResult` from `'typeorm'`)는 신규 테스트에서 실제로 사용된다(`workspaces.service.spec.ts:1530`). 삭제된 stale 주석(`// remove() 는 in-memory id 를...`)도 해당 코드 경로 제거와 정확히 짝을 이룬다.
  - 제안: 없음 — 정상.

- **[INFO]** `review/code/2026/09/21/12_57_05/*`, `review/consistency/2026/09/21/12_23_48/*` 산출물이 diff 에 다수 포함되어 있으나, 이는 이전 리뷰/일관성 검토 라운드의 산출물을 커밋하는 프로젝트 컨벤션(`review/` 는 gitignore 대상이 아니며 산출물을 이력으로 남긴다)에 부합한다
  - 위치: 파일 6~28 전체
  - 상세: 이 파일들은 이번 세션이 새로 생성한 코드가 아니라, 직전 `/ai-review`(12_57_05)·`/consistency-check`(12_23_48) 실행 결과와 그 조치 기록(`RESOLUTION.md`, `_resolution_log.md`, `_resolution_state.json`)이다. `0d976e6e3` 커밋 메시지("docs(review): ... RESOLUTION 기록")와 `--stat` 확인 결과 15개 파일 전부 `review/code/2026/09/21/12_57_05/` 하위이며 코드 변경은 0건이다.
  - 제안: 없음 — 스코프 이탈 아님.

## 요약

핵심 코드 변경은 `WorkspacesService.removeMember()` 의 동시 제거 감사 중복이라는 명시된 목표에 정확히 국한되며(파일 3개), 무관한 리팩토링·포맷팅·임포트 정리는 발견되지 않았다. 유일하게 주목할 점은 직전 리뷰 WARNING #3 의 조치(`throwMemberNotFound()` 추출)가 원 지적 범위(`removeMember` 내부 2곳)를 넘어 무관한 메서드 `updateMemberRole()` 까지 확장됐다는 것인데, 완전히 동일한 리터럴의 기계적 통합이라 위험이 낮고 커밋 메시지·JSDoc 에 확장 사실이 투명하게 기록돼 있어 은폐된 스코프 확장은 아니다. `spec-draft-nullable-notation-followups.md` 의 추가 백로그 항목(auth-configs/model-config/webauthn)과 spec 참조 확장은 코드를 건드리지 않는 문서 등재이며 형제 PR 5건이 반복해 온 확립된 관례다. 종합적으로 스코프 관점에서 병합을 막을 사유는 없다.

## 위험도

LOW
