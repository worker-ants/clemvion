# 변경 범위(Scope) 리뷰

## 개요

23개 파일이 바뀐 대형 PR 이지만, 전부 "아바타 이미지 업로드 (공개 버킷 + 공개 URL)" 라는 단일 기능으로
수렴한다 — 구현(`S3Service.getPublicUrl`·`UsersService.updateAvatar`·컨트롤러 엔드포인트), 회귀 테스트,
env/배포 설정(`docker-compose*`, `k8s/*`, `scripts/minio/*`), 문서(`CHANGELOG.md`·`README.md`·
`.env.example`·`k8s/README.md`), plan 트래킹(`spec-sync-user-profile-gaps.md`·신규
`spec-update-avatar-upload-implemented.md`)까지 전부 "이 기능을 배포 가능하게 만드는 데 필요한" 범위
안에 있다. 기능 밖 파일이나 무관한 영역을 건드린 흔적은 없다.

## 발견사항

- **[INFO]** `Express` → `ExpressNS` import 개명이 avatar 와 무관한 두 메서드(`changePassword`,
  `verifyEmailChange`)의 시그니처까지 함께 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:57` (import 선언),
    `:214`-`:215` (`changePassword` 의 `@Req()`/`@Res()` 타입), `:301`-`:302` (`verifyEmailChange`
    의 `@Req()`/`@Res()` 타입)
  - 상세: `import Express from 'express'` 가 전역 `Express` 네임스페이스를 가려 `@types/multer` 의
    `Express.Multer.File` 증강을 쓸 수 없었다는 근거는 실측(`Namespace 'e' has no exported member
    'Multer'`)으로 뒷받침되고, `import` 를 리네임하면 해당 파일 안의 **모든** `Express.*` 참조를
    함께 고쳐야 하므로 기계적으로 불가피하다. CHANGELOG·plan 양쪽에 "부수" 로 명시 공개했고, 같은
    문제가 없는 다른 4개 컨트롤러는 건드리지 않았다고 스스로 범위를 좁혔다. 다만 최종 diff 는
    avatar 기능과 무관한 두 엔드포인트의 파라미터 타입 표기를 바꾸는 라인을 포함하므로, "기능
    이름표"만 보고 diff 를 스캔하면 놓치기 쉬운 영역이다.
  - 제안: 조치 불필요 — 이름만 바뀌고 런타임 동작 변화가 없는 리네임이며, 필요성·범위 축소 근거가
    이미 문서화돼 있다. 참고용으로 남긴다.

- **[INFO]** `UsersService.update()` (범용 PATCH 경로, 호출부 17곳) 에 아바타 정리 로직이 추가돼
  "avatar 업로드" 범위를 넘어 기존 엔드포인트의 부수효과를 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:232`-`:246`
  - 상세: `avatarUrl` 키가 payload 에 있고 값이 바뀐 경우에만 사전 조회 + best-effort 삭제를 타므로
    나머지 16곳 호출부(로그인 실패 카운터·2FA 등 핫패스)는 영향 없다는 점을 JSDoc(`:218`-`:231`)이
    설명한다. 그러나 이 변경은 이름상 "업로드 엔드포인트 신설" 을 넘어 **기존 `PATCH /users/me` 의
    관측 가능한 부수효과**(옛 S3 객체 삭제)를 새로 만든다 — `POST /me/avatar` 만으로는 해결되지
    않는 문제(PATCH 로 아바타를 덮으면 업로드한 객체가 영구 고아가 됨)를 review 2라운드가 잡아서
    포함시켰다는 이력이 plan 파일(`spec-sync-user-profile-gaps.md:29`-`:39` 부근 서술)에 남아 있어
    의도적 확장임은 확인된다.
  - 제안: 조치 불필요 — 근거·필요성이 문서화돼 있고 조건부 가드(`'avatarUrl' in data` +값 비교)로
    영향 범위를 최소화했다. 다음 리뷰에서 "avatar 업로드 PR인데 왜 PATCH 가 바뀌었나" 라는 오탐이
    나올 수 있으니 참고 표시만 남긴다.

- **[INFO]** `toProfileData()` 헬퍼 추출이 `getMe`·`updateMe` 두 기존 엔드포인트의 응답 조립 코드도
  함께 리팩터링한다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:84`-`:93` (헬퍼 신설),
    `:113` (`getMe` 에서 스프레드로 교체), `:140` (`updateMe` 에서 교체)
  - 상세: 새 `uploadAvatar` 가 같은 응답 봉투(`id`/`email`/`name`/`avatarUrl`/`locale`/`theme`) 를
    또 만들어야 하므로, 세 번째 복제본을 만드는 대신 기존 두 곳의 인라인 리터럴을 공통 헬퍼로 뽑아
    쓴 것 — 순수 추출(로직 변경 없음)이라 동작 회귀 위험은 낮다. 다만 diff 상으로는 이 기능과 직접
    무관한 `getMe`/`updateMe` 블록도 손을 탄 것으로 보인다.
  - 제안: 조치 불필요 — 신규 엔드포인트가 그 헬퍼의 세 번째 소비자이므로 DRY 근거가 이 PR 범위
    안에서 성립하고, 순수 추출이라 리스크가 낮다.

## 요약

23개 파일 변경 전부가 "아바타 이미지 업로드(공개 버킷+공개 URL)" 단일 기능의 구현·테스트·배포
설정·문서·plan 트래킹으로 수렴하며, 기능과 무관한 파일이나 임의의 리팩터링·포맷팅·주석 정리는
발견되지 않았다. 유일하게 주목할 부분은 세 건의 "정당화된 collateral" 변경(Express 네임스페이스
리네임이 무관 메서드 2곳의 타입 표기까지 바꾼 것, avatar 정리 로직이 범용 `update()` 에 들어가 기존
PATCH 엔드포인트의 부수효과를 넓힌 것, 응답 조립 헬퍼 추출이 기존 두 엔드포인트를 함께 건드린 것)인데,
셋 다 기계적 필요성·명시적 근거·범위 최소화가 CHANGELOG/plan/JSDoc 에 기록돼 있어 "의도 이상의 변경"
으로 보기 어렵다.

## 위험도

LOW
