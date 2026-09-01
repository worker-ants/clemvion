# 변경 범위(Scope) 리뷰 — 아바타 이미지 업로드(공개 버킷 + 공개 URL), 리뷰 7라운드

## 컨텍스트

이 세션(00:55:27)은 6라운드 커밋(`4d32e0734`, `refactor(users): 리뷰 6R — 부팅 경고 판정을
순수 함수로`) 이후의 상태를 리뷰한다. `git log` 로 확인한 라운드별 코드 커밋:

```
07d322c92  (base)
d51954999  feat: 아바타 업로드 신설
8d06f4944  fix: 1R 반영
a1b381678  fix: 2R 반영 (lost update + ListBucket 노출)
72c19b780  fix: 3R 반영 (localhost 근접사고 + 부팅 경고 도입)
ab401eca6  fix: 4R 반영 (부팅 경고 기본값 케이스 누락 정정)
ecaa785bd  test: 5R 반영 (버킷 정책 e2e + vacuous 테스트 정정)
4d32e0734  refactor: 6R 반영 (부팅 경고 판정 순수 함수화 + 주석 중복 정리) ← 이번 라운드 신규 델타
```

`git diff 07d322c92..HEAD --stat` 로 누적 diff 를 확인했다 — `codebase/` 안에서 손댄 파일은
`users.controller.ts`·`users.service.ts`·`users.module.ts`·`s3.config.ts`·`s3.service.ts`·
`main.ts`·`.env.example`·관련 `*.spec.ts`/e2e-spec 뿐이며, 기능과 무관한 모듈·설정 파일은
없다.

## 이번 라운드 신규 델타(6R 커밋) 검토

`4d32e0734` 는 5라운드 리뷰의 WARNING 2건(부팅 경고 조합 판정이 유닛 테스트로 안 물림,
`ExpressNS` 리네임 근거 주석이 두 문단으로 중복)에 대한 수정으로 한정된다.

- `s3.config.ts`: `shouldWarnPublicBaseIsPrivate(env)` 순수 함수 신설. 기존 `main.ts` 인라인
  조합(`NODE_ENV==='production' && isPrivateHost(resolvePublicBaseUrl(...))`)을 그대로
  옮긴 것 — 새 정책·새 판정 기준을 추가하지 않았다.
- `main.ts`: 위 함수를 호출하도록 교체. `isPrivateHost` 직접 import 는 제거되고 `s3.config`
  재노출로 대체 — 동작 변화 없음.
- `s3.config.spec.ts`: 신설 함수에 대한 단위 테스트 11건 추가. 기존 `resolvePublicBaseUrl`
  테스트는 그대로 두고 새 `describe` 블록만 이어 붙였다.
- `users.controller.ts`: `ExpressNS` 리네임 근거 주석 두 문단을 하나로 병합(중복 제거) —
  코드 동작 변경 없음, 순수 주석 정리이며 정리 사유(5라운드 중복 지적)도 명확하다.
- `plan/in-progress/spec-sync-user-profile-gaps.md`: "프런트엔드 아바타 업로드 UI 부재"
  추적 항목 1건 추가 — 이번 PR 이 backend 전용임을 스스로 명시하고 후속 PR 에 위임하는
  형태로, 이번 PR 의 코드 범위를 넓히지 않는다.
- 나머지는 `review/code/2026/09/01/00_35_24/**` 산출물 커밋(직전 라운드 리뷰 산출) —
  본 프로젝트 컨벤션상 `review/code/**` 는 정식 저장 위치이므로 scope creep 이 아니다.

이 델타 자체에서 의도 밖 변경·불필요한 리팩토링·무관한 파일 수정은 발견되지 않았다.

## 발견사항 (누적 diff 기준, 참고용 재확인)

이전 4개 라운드(22:12·22:44·23:19·23:46, 그리고 확인 가능한 00:11·00:35)의 scope 리뷰가
동일한 결론(LOW)에 수렴해 왔고, 이번 라운드 신규 델타는 그 결론에 영향을 주는 코드 변경을
포함하지 않는다. 과거 라운드가 반복 기록한 "정당화된 collateral" 3건은 여전히 유효하며
새로 반증되지 않았다:

- **[INFO]** `ExpressNS` 리네임이 아바타 업로드와 무관한 두 기존 메서드의 파라미터 타입
  표기까지 함께 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `changePassword`,
    `verifyEmailChange` 의 `@Req()`/`@Res()` 타입(`Express.Request`/`Response` →
    `ExpressNS.Request`/`Response`)
  - 상세: 전역 `Express` 네임스페이스 가림(`@types/multer` 의 `Express.Multer.File`
    미해석, 실측: `Namespace 'e' has no exported member 'Multer'`)을 해소하기 위한
    import 리네임이며, 파일 안의 모든 `Express.*` 참조를 함께 고치는 것이 기계적으로
    불가피하다. 순수 타입 표기 변경으로 런타임 동작 변화가 없고, CHANGELOG·주석·plan 에
    사유·영향범위(4곳)가 명시돼 있다.
  - 제안: 조치 불필요 — 6R 에서 근거 주석 중복까지 정리돼 문서화 품질도 개선됐다.

- **[INFO]** `UsersService.update()`(범용 PATCH, 호출부 다수) 에 아바타 정리 로직이
  추가돼 "업로드 신설" 범위를 넘어 기존 엔드포인트의 부수효과를 넓힌다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`update()` 내
    `'avatarUrl' in data` 조건부 블록)
  - 상세: `PATCH /users/me` 로 `avatarUrl` 을 직접 덮어써도 옛 S3 객체가 고아로 남는
    문제를 2라운드 리뷰가 지적해 포함시킨 이력이 plan 문서에 남아 있다. 조건부 가드로
    나머지 호출부(로그인 시도 카운터 등 핫패스)는 영향받지 않게 스코프를 최소화했다.
  - 제안: 조치 불필요 — 의도적 확장이며 근거·범위 제한이 문서화돼 있다.

- **[INFO]** `toProfileData()` 헬퍼 추출이 `getMe`/`updateMe` 기존 두 엔드포인트의
  응답 조립 코드도 함께 리팩터링한다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts`
  - 상세: 신규 `uploadAvatar` 가 같은 응답 봉투를 세 번째로 필요로 하게 되면서, 기존
    두 곳의 인라인 리터럴을 공통 헬퍼로 추출한 순수 리팩터(로직 변경 없음). DRY 근거가
    이 PR 범위 안에서 성립한다.
  - 제안: 조치 불필요.

## 요약

이번 라운드(7R, 00:55:27)에서 새로 반영된 코드 델타는 직전 라운드가 WARNING 으로 지적한
"부팅 경고 조합 판정이 유닛 테스트로 안 물림"·"근거 주석 중복" 두 건만을 좁게 고친
것으로, 기능 신규 추가나 무관한 파일 수정 없이 순수 함수 추출 + 주석 정리 + plan 추적
항목 1건에 그친다. 누적 diff(base `07d322c92` 대비) 전체를 봐도 `codebase/` 변경은
`users` 모듈과 `S3Service`/`s3.config`/`main.ts`/`.env.example` 로 국한되며, 기능과
무관한 모듈·설정 파일은 손대지 않았다. 과거 라운드가 반복 확인한 세 건의 "정당화된
collateral"(Express 네임스페이스 리네임의 파급, `update()` 의 정리 로직 확장,
`toProfileData` 추출)은 전부 필요성·근거·범위 축소가 코드 주석·CHANGELOG·plan 문서에
명시돼 있어 "의도 이상의 변경"으로 보기 어렵다는 기존 판정을 유지한다. 새로 발견된
scope 이탈은 없다.

## 위험도

LOW
