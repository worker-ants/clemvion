# 부작용(Side Effect) 리뷰

## 검토 대상 요약

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`, `codebase/backend/src/common/utils/uuid.ts`: JSDoc/docstring 주석만 변경. 실행 코드(함수 바디·정규식·export 시그니처) 는 diff 게이트 범위 내에서 1바이트도 바뀌지 않았다.
- `plan/complete/spec-draft-auth-invariants-sync.md` (신규) / `plan/in-progress/spec-draft-auth-invariants-sync.md` (삭제): plan 완료 이동(`git mv` 상당) + 체크박스·frontmatter `status` 갱신 + 인입 링크 상대경로 조정.
- `plan/in-progress/auth-guard-reflection-hardening.md`: §후속 체크박스 갱신 + 링크 경로 조정.
- `review/consistency/2026/08/09/20_34_07/*` (SUMMARY.md, _retry_state.json, meta.json, 4개 checker 리포트): `/consistency-check --impl-prep` 실행 산출물 신규 커밋.

## 발견사항

- **[INFO]** 실제 애플리케이션 코드(`.ts`) 변경은 순수 docstring 정정이며 side-effect 표면이 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:26-34`, `codebase/backend/src/common/utils/uuid.ts:25-41` (게이트 기준)
  - 상세: `git show 43d3b79e5 -- codebase/` 로 실측 확인 — 변경분은 전부 `* ` 로 시작하는 JSDoc 라인이며, `countWorkspaceIdConsumingRoutes`/`assertWorkspaceIdReflectionWorks`/`isValidUuid`/`isUuidShaped` 의 로직·시그니처·리턴값·정규식은 동일하다. 따라서 상태 변경·전역 변수·시그니처/인터페이스 변경·환경변수·네트워크 호출·이벤트/콜백 어느 항목에도 해당하지 않는다. 정정 내용(테스트 인용 교체)도 실제 존재하는 테스트명과 대조해 확인함 — `uuid.spec.ts:55` `accepts UUID-shaped values that isValidUuid rejects (nil / v6+ / 비-RFC variant)`, `workspace-context.util.spec.ts:134` `Postgres 가 파싱할 수 있는 값은 통과시킨다 (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)` 둘 다 실재.
  - 제안: 없음 (정상).

- **[INFO]** `review/consistency/2026/08/09/20_34_07/**` 신규 파일 8개 커밋 — 의도된 파일시스템 부작용
  - 위치: `review/consistency/2026/08/09/20_34_07/SUMMARY.md`, `_retry_state.json`, `meta.json`, `convention_compliance.md`, `cross_spec.md`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md` (전부 신규 생성 diff, 게이트 없음 — new file)
  - 상세: `/consistency-check --impl-prep` 실행이 생성하는 표준 산출물이며, CLAUDE.md 정보 저장 위치 표("일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")와 일치한다. `review/` 는 gitignore 대상이 아니라 커밋 대상이 맞다(메모리 `feedback_plan_checkbox_actual_state`). `_retry_state.json` 은 절대경로(`/Volumes/project/private/...worktrees/uuid-canary-docstring-fix-40b186/...`)를 그대로 담고 있어 워크트리별로 값이 달라지는 아티팩트이지만, 이는 세션 진행상황 추적용 임시 상태 파일이 커밋된 것으로 이 저장소의 기존 관례(다른 세션들도 동일 패턴)와 일치해 이번 PR 고유의 이상 신호는 아니다.
  - 제안: 없음 — 의도된 관례. 다만 절대경로가 박힌 `_retry_state.json` 을 영구 보관할 가치가 있는지는 이 PR 범위 밖(프로젝트 관례 질문)이라 별도 논의 대상으로만 남긴다.

- **[INFO]** plan 파일 이동(`in-progress/` → `complete/`) 자체는 side-effect 관점에서 무해 — 링크 정합성 실측 확인
  - 위치: `plan/complete/spec-draft-auth-invariants-sync.md` (신규), `plan/in-progress/spec-draft-auth-invariants-sync.md` (삭제), `plan/in-progress/auth-guard-reflection-hardening.md:250-251`(게이트 기준, `../complete/spec-draft-auth-invariants-sync.md` 로 링크 경로 갱신)
  - 상세: `git diff 602f677cd:plan/in-progress/... f28dba6f3:plan/complete/...` 로 대조한 결과 `status: in-progress → complete`, 체크박스 전수 `[x]`, 인입/인출 상대경로(`auth-guard-reflection-hardening.md` → `../in-progress/auth-guard-reflection-hardening.md` 등) 만 바뀌었고 본문 내용은 그대로다. `auth-guard-reflection-hardening.md` 쪽도 대응하는 역방향 링크(`../complete/spec-draft-auth-invariants-sync.md`)로 동시에 갱신돼 dangling link 가 생기지 않는다.
  - 제안: 없음 (정상).

- **[INFO]** 코드 리뷰 대상 함수의 순수성 재확인 — 전역/공유 상태 변경 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (`countWorkspaceIdConsumingRoutes`, `assertWorkspaceIdReflectionWorks`)
  - 상세: 이번 diff 는 두 함수를 건드리지 않았으나, 참고로 `assertWorkspaceIdReflectionWorks` 는 `app.get(DiscoveryService)`/`app.get(MetadataScanner)` 를 통해 Nest DI 컨테이너를 읽기만 하고 부팅 실패 시 `throw` 하는 것 외에는 외부 상태를 변경하지 않는다(기존 동작, 이번 PR 로 변경되지 않음). 이번 PR 로 인한 신규 부작용이 아님을 확인 차 기록.
  - 제안: 없음.

## 요약

이번 diff 의 실질 대상은 두 개의 TS 파일에서 JSDoc 주석만 정정한 것이며(`git show 43d3b79e5` 로 코드 바디·시그니처 무변경 확인), 나머지는 plan 라이프사이클 이동(체크박스/링크 경로 갱신)과 `/consistency-check` 표준 산출물 신규 커밋뿐이다. 전역 상태 변경, 함수 시그니처/공개 인터페이스 변경, 환경변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경 어느 항목에도 해당하는 코드가 없으며, 유일한 파일시스템 부작용(`review/consistency/**` 신규 파일, plan 파일 이동)은 모두 프로젝트 컨벤션이 명시적으로 요구하는 의도된 동작이다. Critical/Warning 급 부작용 없음.

## 위험도

NONE
