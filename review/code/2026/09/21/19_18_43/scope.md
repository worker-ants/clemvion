# 변경 범위(Scope) 리뷰 — WebAuthn credential 동시 삭제 중복 감사 수정 (아홉 번째/마지막 자리, 4차 라운드)

## 검토 방법

`git log --oneline origin/main..HEAD`(11개 커밋) + `git diff --stat origin/main..HEAD`로 실제
변경 파일을 재확인했다. 코드/문서 실질 변경은 정확히 6개 파일(`CHANGELOG.md`,
`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`,
`webauthn.service.spec.ts`, 신규 `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts`,
`plan/in-progress/webauthn-dup-delete.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)이고
나머지는 이 세션 자신이 생성한 `review/code/2026/09/21/{18_03_54,18_31_57,18_58_48}/**` +
`review/consistency/2026/09/21/17_39_06/**` 리뷰 산출물이다. `webauthn.service.ts`·
`webauthn-credential-delete-concurrency.e2e-spec.ts`·`spec-draft-nullable-notation-followups.md`·
`CHANGELOG.md`는 저장소에서 직접 `git show`/`git diff`로 전문을 재대조했다. 최종 커밋
`15da527e7`은 개별로 `git show`해 내용을 확인했다. 이전 3라운드의 scope.md
(`review/code/2026/09/21/18_03_54/scope.md`, `18_31_57`은 이번 세션 fix로 신규 WARNING 없음,
`18_58_48/scope.md`)를 전문 대조해 독립적으로 같은 결론에 도달하는지 검증했다. 저장소에
뮤테이션은 가하지 않았다(`git status --short` 결과 이 세션의 산출 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 핵심 버그 수정(`affected` 판정)과 소유권 스코핑 강화(`userId` 조건 추가)가 같은 SQL
  호출에 묶여 있음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `deleteCredential()`,
    `const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId })`
  - 상세: PR 표제 결함("동시 DELETE 두 건이 감사를 두 번 남긴다")을 고치는 데 필요·충분한 변경은
    `affected` 판정 추가뿐이다. 조건절의 `userId` 추가는 바로 위 `findOne` 단계에서 이미 JS
    비교로 걸러지는 조건이라 정상 경로에는 관측 가능한 차이가 없는 부가 방어(defense-in-depth)다.
    다만 `plan/in-progress/webauthn-dup-delete.md` §B에 사전 근거가 명시돼 있고, 형제 8개
    PR(#1369~#1375)이 동일하게 조건절에 스코프를 추가해 온 확립된 패턴이며, 변경 자체가 파라미터
    1개 추가로 매우 작다. 3차례 선행 scope 리뷰가 동일 관찰을 남기고 조치 불요로 판정했고, 이번
    독립 재조사에서도 같은 결론에 도달했다.
  - 제안: 조치 불요(재확인).

- **[INFO]** `throwCredentialNotFound()` 헬퍼 추출이 이번 버그와 직접 무관한 `renameCredential()`
  의 기존 두 throw 지점까지 포함함
  - 위치: `webauthn.service.ts` — `renameCredential()`(헬퍼 호출 2곳) 및 신설
    `private throwCredentialNotFound(): never`
  - 상세: "동시 삭제 감사 중복" 결함 수정 자체에는 `renameCredential`의 리터럴 통합이 필수가
    아니다. 다만 이 리팩터는 별도 커밋(`d3127c8a6`)으로 분리돼 있고, 같은 세션의 1차 리뷰
    라운드(`18_03_54/maintainability.md` WARNING — "형제 두 파일이 이미 적용한 헬퍼 추출 패턴을
    이 파일만 놓쳤다")에 대한 명시적 조치다. `git log -S` 근거 없이도 커밋 메시지
    ("SUMMARY#3 404 헬퍼 추출")와 RESOLUTION.md 기록이 그 인과를 확인해 준다 — "요청하지 않은
    기능 추가"가 아니라 "리뷰가 지적한 정리"에 해당한다.
  - 제안: 조치 불요(재확인).

- **[INFO]** `CHANGELOG.md`에 마크다운 `~~...~~`와 HTML `<del>...</del>` 취소선이 혼용됨
  - 위치: `CHANGELOG.md` — `model_config` 섹션(마크다운 `~~`) 대비 `auth_config` 섹션(HTML `<del>`)
  - 상세: `auth_config` 섹션 쪽은 취소 대상 문장 안에 이미 중첩된 `~~캐시 무효화 통지...~~`
    취소선이 있어 마크다운을 한 번 더 씌우면 파싱이 모호해지는 것을 피하려는 의도적 선택(커밋
    `7b71e9a4a` 메시지에 명시)이다. 포맷 불일치처럼 보이나 근거 있는 선택이며, 직전 라운드가
    지적한 "절반만 취소선 처리" WARNING이 이 커밋으로 이미 해소됐음을 `18_58_48/documentation.md`
    가 재확인했고, 이번 재조사에서도 `git show 7b71e9a4a`로 그 커밋이 auth_config 섹션 문장
    전체를 하나의 `<del>` 블록으로 감쌌음을 직접 확인했다.
  - 제안: 조치 불요.

- **[INFO]** 최종 커밋(`15da527e7`)은 자기 자신이 앞선 라운드에서 남긴 줄 번호 인용이 같은 PR의
  후속 커밋으로 stale해진 것을 실측·정정한 것으로, 극소 범위 self-correction
  - 위치: `webauthn.service.ts`(JSDoc 1줄 — `verifyAuthentication(:403)` → `verifyAuthentication()`)
    및 `plan/in-progress/webauthn-dup-delete.md`(§0 결정 1 인접 문단, `:403`·`:497`·`:504`·`:527`
    를 메서드명 지목으로 교체 + "왜 줄 번호로 적지 않는지" 각주 추가)
  - 상세: `git show 15da527e7`로 전체 diff를 직접 확인한 결과, 코드/plan 변경분은 두 파일 각
    한 문단 수준이며 커밋에 함께 포함된 16개 파일 중 나머지 14개는 `review/code/2026/09/21/18_58_48/**`
    (3차 라운드 리뷰 산출물, 이번 diff의 파일 37~50번과 동일)다. 커밋 메시지가 "라운드 2가 만든
    stale 줄 번호를 라운드 2 자신의 다른 파일 편집이 즉시 다시 만들었다"는 인과를 명시적으로
    설명하고 있어, 반복되는 패턴에 대한 근본 조치(메서드명 지목으로 전환)로 보이며 새로운
    스코프 이슈를 만들지 않는다.
  - 제안: 조치 불요.

## 검증한 사항 (문제 없음 확인)

- `git diff --stat origin/main..HEAD -- codebase/ plan/ CHANGELOG.md` 결과 617 insertions/18
  deletions, 6개 파일 — `webauthn.controller.ts`를 포함해 그 외 어떤 백엔드/프런트엔드 파일도
  건드리지 않았다.
- `webauthn.service.spec.ts`의 diff는 기존 `describe('deleteCredential', ...)` 블록 끝에 새
  `describe('동시 삭제', ...)` 하나만 추가하며 기존 테스트·import·설정을 건드리지 않는다(직접
  `git diff`로 재확인).
- 신규 e2e 파일(`webauthn-credential-delete-concurrency.e2e-spec.ts`, 228줄)은 이 결함과 이미
  반증된 인접 가설(WARNING #4) 두 케이스만 검증하며 기존 e2e 파일을 수정하지 않는다.
- 포맷팅 전용 변경(공백·줄바꿈만 바뀐 hunk), 사용하지 않는 임포트, 설정 파일 변경은 6개
  코드/문서 파일 어디에도 없다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`의 변경분(91줄)은 이 PR의 착수
  게이트 이행 표시, 두 신규 후속 항목(§1.11 오류, e2e 헬퍼 추출 결정) 등재, 트래커 스냅샷 목록에
  WebAuthn 자리 추가에 한정되며, 트래커의 다른 무관한 섹션은 건드리지 않는다(직접 diff 대조).
  같은 문서 안에서 "e2e 공용 헬퍼 추출"과 "`isDeleteMiss()` 유틸 미추출"을 이번 PR에 넣지 않고
  각각 후속 PR/근거-보존으로 명시적으로 분리해 둔 것도 스코프 절제로 확인된다.
- `review/code/2026/09/21/{18_03_54,18_31_57,18_58_48}/**` + `review/consistency/2026/09/21/17_39_06/**`
  총 46개 산출물 파일은 이 프로젝트가 강제하는 REVIEW WORKFLOW(`CLAUDE.md` "구현 완료 후 자동
  review/fix는 상시 승인된 강제 의무")의 정상 부산물이며 `review/`는 gitignored 대상이 아니다 —
  스코프 이탈로 보지 않는다.
- 이전 라운드 WARNING fix 커밋(`89566e3d5`·`ee6fd5d56`·`7b71e9a4a`·`d3127c8a6`·`69bd6ea84`)을
  각각 `git show --stat`로 확인한 결과, 예외 없이 그 WARNING이 지목한 파일(들)만 건드렸다 —
  fix-루프 자체의 스코프 이탈은 없다.

## 요약

핵심 프로덕션 변경은 여전히 `webauthn.service.ts`의 `deleteCredential()` 한 곳(`affected` 판정
추가)으로, 표제 결함 수정에 근접하게 좁혀져 있다. 4차례 독립 스코프 검토(선행 3라운드 + 이번
재조사)가 동일한 결론에 수렴한다 — 같은 hunk의 `userId` 조건 추가와 `renameCredential`까지
포함한 헬퍼 추출은 둘 다 plan 문서의 사전 근거·형제 PR과의 일관성·직전 리뷰 라운드의 명시적
지적에 대한 조치로 뒷받침되어 우려할 스코프 이탈이 아니다. 최종 커밋(`15da527e7`)은 자신이 이전
라운드에 남긴 줄 번호 인용이 같은 PR의 리팩터 커밋으로 stale해진 것을 실측·정정한 극소 범위
self-correction(코드 1줄 + plan 한 문단)이며 새로운 스코프 이슈를 만들지 않는다. 46개에 달하는
`review/**` 산출물은 프로젝트가 강제하는 REVIEW WORKFLOW의 정상 부산물이지 무관한 파일 수정이
아니다. 포맷팅·불필요 임포트·무관한 파일·설정 변경은 이번 재조사에서도 발견되지 않았다.

## 위험도

LOW
