# 변경 범위(Scope) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `Express` → `ExpressNS` 리네임이 신규 엔드포인트와 무관한 기존 엔드포인트 2곳까지 건드린다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:57`(import), `:217-218`(`changePassword`), `:304-305`(`verifyEmailChange`)
  - 상세: 신규 `uploadAvatar` 가 `Express.Multer.File` 타입을 쓰려면 전역 `Express` 네임스페이스가 살아 있어야 하는데, 기존 `import Express from 'express'` 가 그 전역을 가려 컴파일이 깨졌다(실측: `Namespace 'e' has no exported member 'Multer'`, CHANGELOG·plan 에 명시). 그래서 default import 를 `ExpressNS` 로 개명했는데, 그 결과 이 파일의 기존 두 엔드포인트(`changePassword`, `verifyEmailChange`)가 쓰던 `Express.Request`/`Express.Response` 타입 참조도 함께 바뀌었다. 순수 리네임이라 런타임 동작 변화는 없지만, "아바타 업로드 엔드포인트 추가"라는 의도 범위 밖의 두 지점이 diff 에 섞였다.
  - 제안: CHANGELOG·plan 문서에 부수 변경으로 명시적으로 disclose 되어 있고 기술적으로 불가피한 side-effect 이므로 그대로 두는 것이 합리적이다 — 다만 다음 리뷰어가 "왜 changePassword 도 diff 에 있지?"로 오인하지 않도록 커밋 메시지에도 한 줄 언급을 권장.

- **[INFO]** `UsersService.update()`(호출부 17곳, OAuth/TOTP/WebAuthn 등 인증 핫패스 포함)의 동작이 이번 PR 에서 확장됐다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:234`(`async update`), `:236`(`'avatarUrl' in data`)
  - 상세: 신규 엔드포인트(`uploadAvatar`)만 추가하는 것을 넘어, 기존 범용 `update()`(`PATCH /users/me` 를 포함해 17개 호출부가 공유)에 "`avatarUrl` 이 페이로드에 있고 값이 바뀌면 사전 SELECT 후 옛 S3 객체를 정리한다"는 새 분기가 추가됐다. 즉 아바타 파일 업로드 기능 하나를 위해 기존 공용 경로의 동작이 변경된다.
  - 상세(정당성): `PATCH /users/me` 로 `avatarUrl` 을 외부 URL로 바꾸는 것도 "아바타 교체"의 다른 경로이므로, 옛 업로드 객체를 정리하는 불변식이 두 경로 모두에 적용돼야 일관적이다. 이는 `uploadAvatar` 의 `@ApiOperation` description(`users.controller.ts` 부분)에도 명시돼 있고, plan(`spec-sync-user-profile-gaps.md`)에 "호출부 17곳의 비용"을 직접 계산해 조건부 SELECT 로 최소화한 근거가 기록돼 있다. 기능적으로 스코프 밖이 아니라 "아바타 교체" 라는 요구사항의 두 진입점(업로드/URL 지정) 모두를 커버하기 위한 의도된 확장으로 판단된다.
  - 제안: 조치 불요. 다만 통합 리뷰에서 "새 엔드포인트 추가"만 기대했다면 이 부분이 기존 공용 메서드 변경이라는 점을 인지시킬 필요가 있다.

- **[INFO]** production 부팅 가드(`main.ts`) 추가는 엔드포인트 구현 자체보다 넓은 방어적 하드닝이다
  - 위치: `codebase/backend/src/main.ts:160-173`(`if (process.env.NODE_ENV === 'production') { … isPrivateHost(publicBase) … }`)
  - 상세: "`POST /api/users/me/avatar` 구현"이라는 핵심 요구를 넘어, 신규 env(`S3_PUBLIC_BASE_URL`)가 production 에서 사설/loopback 주소로 잘못 설정될 경우 경고 로그를 남기는 부팅 가드를 추가했다. CHANGELOG·plan 서술에 "k8s prod/staging overlay patch 를 빠뜨려 localhost 기본값이 실릴 뻔한 근접사고가 실제로 있었다"는 근거가 명시돼 있어, over-engineering 이라기보다 이번 PR 이 도입한 신규 env 하나에 한정된 좁은 방어(SoT 함수 재사용, 기존 `ALLOW_PRIVATE_HOST_TARGETS` 정책과 동일 패턴)로 보인다.
  - 제안: 조치 불요 — 범위가 새 env 변수 하나로 좁게 유지되고 있고 기존 유사 가드 패턴을 재사용해 새 추상을 만들지 않았다.

- **[INFO]** `toProfileData` private 헬퍼 추출은 요청 범위를 살짝 넘는 DRY 리팩토링이다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:84-92`(`private toProfileData`), `:113`(`getMe` 사용), `:143`(`updateMe` 사용), `:196`(`uploadAvatar` 사용)
  - 상세: 신규 `uploadAvatar` 가 `getMe`/`updateMe` 와 동일한 프로필 응답 봉투를 반환해야 하므로, 기존 두 곳에 인라인돼 있던 매핑 로직을 헬퍼로 뽑아 세 곳이 공유하게 했다. 기존 `getMe`/`updateMe` 코드도 함께 수정됐지만 동작 변화는 없다(순수 구조적 리팩토링). 새 엔드포인트가 필요로 하는 최소한의 중복 제거이며 그 이상으로 번지지 않았다.
  - 제안: 조치 불요 — 세 곳이 실제로 같은 모양을 내보내야 하는 신규 요구 때문에 발생한 최소 범위 리팩토링이다.

## 요약

핵심 변경(신규 `POST /api/users/me/avatar` 엔드포인트, `S3Service.getPublicUrl`, `S3_PUBLIC_BASE_URL` 신규 env 전파, 버킷 정책 인프라, 관련 테스트·문서)은 "아바타 이미지 업로드(공개 버킷 + 공개 URL)"라는 의도된 범위에 정확히 부합한다. `review/code/2026/08/31/{22_12_54,22_44_14,23_19_39,23_46_40}/**` 다수 파일은 새 코드가 아니라 이 작업의 이전 4라운드 리뷰 산출물이며 프로젝트 컨벤션(`review/code/**`)상 정상적인 워크플로 트레일이다. 발견된 항목은 전부 INFO 수준으로, "업로드 엔드포인트 추가"만이 아니라 그와 직접 연결된 기존 코드(공용 `update()`, `Express` import, 프로필 응답 매핑, production 부팅 가드)까지 손을 댄 흔적이지만, 각각이 CHANGELOG·plan 문서에 명시적 근거와 함께 disclose 돼 있고 최소 범위로 억제돼 있어 무관한 리팩토링·기능 확장·포맷팅 혼입·불필요한 임포트/설정 변경으로 볼 근거는 없다.

## 위험도

LOW
