# 변경 범위(Scope) 리뷰 — `member-dup-remove` (라운드 3, `12_57_05`·`13_28_12` 두 라운드 후속 반영 후)

## 검토 방법

`origin/main...HEAD` 전체 diff(41개 파일)를 프롬프트 번들과 `git diff origin/main...HEAD --stat`,
`git show --stat <각 커밋>`, `git diff origin/main...HEAD -- codebase/`, `Read`/`sed -n`으로 워킹트리
원본과 대조했다. `codebase/` 변경은 정확히 3개 파일(413줄 삽입/20줄 삭제)로 확인했고, `plan/` 2개
파일(252줄), 나머지 36개는 전부 `review/code/2026/09/21/12_57_05/**`(15) · `review/code/2026/09/21/13_28_12/**`(13,
이번 라운드 직전 리뷰 산출물) · `review/consistency/2026/09/21/12_23_48/**`(8) 산출 아티팩트다. 저장소에
어떤 파일도 뮤테이션하지 않았다(`git status --short` 확인, `review/code/2026/09/21/13_53_04/` 는 이번
세션 산출 디렉터리).

## 발견사항

- **[INFO]** `throwMemberNotFound()` 헬퍼 추출이 `removeMember()`뿐 아니라 `updateMemberRole()`까지
  넓혀졌다 (이미 직전 라운드 `13_28_12/scope.md`가 INFO로 지적·수용한 사안의 재확인)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:310` (`updateMemberRole()`
    내부 `if (!member) this.throwMemberNotFound();`), 헬퍼 정의 `:342-347`, JSDoc `:332-341`
  - 상세: 이번 PR의 핵심 목적은 `removeMember()`의 동시 제거 감사 중복 수정이다. 라운드 1의
    maintainability WARNING #3 원문은 "`removeMember()` 안에서 리터럴이 두 번(구 `:788`, `:828`)
    중복"만 지적했는데, 실제 조치 커밋(`f022ae9fd`)은 `updateMemberRole()`의 동일 리터럴까지 함께
    헬퍼로 교체했다. `updateMemberRole()`은 이번 PR이 고치는 동시성 결함과 무관한 메서드다. 다만
    (a) 완전히 동일한 리터럴의 기계적 추출이라 동작 변경 위험이 사실상 없고, (b) 헬퍼 JSDoc
    자체가 "`updateMemberRole` · `removeMember`(두 판정)까지 세 곳에 복제돼 있었다"고 확장 사실을
    투명하게 기록하며, (c) 직전 라운드 scope 리뷰어가 이미 같은 사실을 확인하고 위험 낮음으로
    수용했다(재지적 아님, `git log -S`로 `f022ae9fd`가 실제 커밋임을 대조 확인).
  - 제안: 병합을 막을 사유 아님. 이미 두 라운드에 걸쳐 관찰·수용된 사안이므로 재조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이번 PR의 코드 수정과
  직접 관련 없는 백로그 항목(auth-configs/model-config/webauthn 3건, API 멱등성 각주, 컨트롤러별
  204/200 관례 차이, spec `code:` frontmatter 미등재)이 코드 수정 없이 계속 등재·정정된다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (origin/main 대비 +113줄,
    이번 라운드 직전 커밋 `6f1113a70`에서 +27줄 추가 정정 포함)
  - 상세: 전부 `member-dup-remove.md` §A의 전수 조사·리뷰 결과를 트래커에 기록만 하는 것이고,
    실제 코드(`auth-configs.service.ts`·`model-config.service.ts`·`webauthn.service.ts`·
    `workspaces.controller.ts`의 HTTP status)는 diff 어디에도 등장하지 않는다(`git diff
    origin/main...HEAD --stat -- codebase/`로 확인한 3개 파일 목록에 포함되지 않음). 형제 PR
    5건(#1369~#1372)이 반복해 온 "발견은 기록, 수정은 별도 PR"이라는 확립된 관례와 일치하며,
    직전 두 라운드의 scope 리뷰어도 동일 결론에 도달했다.
  - 제안: 없음 — 스코프 이탈 아님, 재조치 불요.

- **[INFO]** 이번 라운드 직전 커밋(`6f1113a70`)이 `codebase/` 안에서 건드린 유일한 자리는 e2e 파일의
  주석(JSDoc) 정정 하나뿐이다 — 실행 코드는 변경되지 않았다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 파일 최상단 JSDoc
    (「형제 다섯은 전부 204」 서술을 실측 기반으로 정정, 원문은 취소선 없이 문장 자체를 고쳐 씀)
  - 상세: `git show --stat 6f1113a70`로 확인한 결과 이 커밋이 `codebase/`에서 바꾼 파일은
    이 e2e 스펙 하나뿐이고 diff는 주석 8줄 교체다. 나머지 변경분(plan 2개, `review/code/2026/09/21/13_28_12/**`
    13개)은 앞서 다른 항목에서 다룬 그대로다. 자신이 직전에 쓴 주석을 실측으로 반증해 정정한 것으로,
    코드 실행 경로에는 영향이 없다(assert 값 자체는 이미 `[200, 404]`로 정확했었고, 주석의 근거
    서술만 "라우트 예외" → "컨트롤러별 차이"로 고쳤다).
  - 제안: 없음 — 정상 범위. 다만 이 정정 대상이 `codebase/` 내 주석이라 CLAUDE.md의
    "자기-반증형 소정정"(spec/ 전용) 조항이 적용되는 자리는 아님을 참고로 남긴다 — developer가
    `codebase/`를 고치는 것은 애초에 자유 재량이라 이 조항 자체가 필요 없는 사례다.

- **[INFO]** `codebase/` 실질 코드 변경은 여전히 정확히 3개 파일로 국한되며, 무관한 리팩터링·
  포맷팅·임포트 정리는 관찰되지 않는다 (직전 두 라운드와 동일 결론, 재확인)
  - 위치: `workspaces.service.ts`(`removeMember()` 원자적 `delete`+`affected===0` 전환,
    `updateMemberRole()`의 헬퍼 재사용 — 위 첫 항목), `workspaces.service.spec.ts`(신규
    `describe('removeMember — 동시 제거')`, `getAudit()` 최상위 승격, `DeleteResult` 임포트),
    신규 `member-remove-concurrency.e2e-spec.ts`
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`로
    직접 대조한 결과, 신규 임포트(`DeleteResult` from `'typeorm'`)는 신규 테스트에서 실제 사용되고
    (`memberRepo.delete.mockResolvedValue({...} as unknown as DeleteResult)`), 삭제된 지역 함수
    `getAudit()` 정의는 최상위로 승격된 동일 함수로 대체됐을 뿐 로직 손실이 없다. 새 `describe`
    블록의 6개 테스트 전부 `removeMember()`의 동시성 판정 경로(정상/패자/null·undefined 대조군/대상
    없음/owner/자가위임/권한거부)만을 검증한다.
  - 제안: 없음 — 정상.

## 요약

라운드 3(이번) diff의 `codebase/` 부분은 origin/main 대비 정확히 3개 파일(413줄 삽입/20줄 삭제)로
국한되며, 이전 두 라운드가 이미 확인한 범위와 동일하다 — 이번 라운드에서 새로 추가된 유일한
`codebase/` 변경은 e2e 파일 최상단 JSDoc 주석 하나를 실측 기반으로 정정한 것뿐이고 실행 코드는
그대로다. `throwMemberNotFound()` 추출이 `removeMember()` 밖의 `updateMemberRole()`까지 넓어진 것은
직전 두 라운드에서 이미 관찰·수용된 낮은 위험의 투명한 확장이라 재조치가 필요 없다. `plan/` 트래커에
누적되는 백로그 항목(auth-configs/model-config/webauthn, API 멱등성/상태코드 각주, spec frontmatter
미등재)은 전부 코드 수정 없이 "발견 기록"만 하는 것이며, 이 프로젝트가 형제 PR 5건에서 반복해 온
확립된 관례("전수 조사로 발견한 잔여 자리는 트래커에 등재하고 코드는 별도 PR로 미룬다")와 정확히
일치한다. `review/code/**`·`review/consistency/**` 36개 파일이 diff에 누적되는 것은 CLAUDE.md의
정보 저장 위치 표가 지정한 이 프로젝트의 표준 워크플로 산출물이며 매 라운드 scope 리뷰어가 반복
확인해 온 것과 같은 결론이다. 새로운 스코프 이탈, 불필요한 리팩토링, 기능 확장, 포맷팅 전용 변경,
무관한 임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
