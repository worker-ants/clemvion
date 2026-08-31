# 문서화(Documentation) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** CHANGELOG 가 이 PR 이 함께 들여온 `incrementLoginAttempts`/`isLocked` 의 보안-관련 동작 변경(원자적 `UPDATE … RETURNING` 재작성 + 신규 쓰기/읽기 시계 비대칭)을 언급하지 않는다
  - 위치: `CHANGELOG.md:1-66` (`## Unreleased — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)` 섹션 전체 — 특히 "부수로" 를 다루는 `CHANGELOG.md:58-61`) / 실제 변경 지점: `codebase/backend/src/modules/users/users.service.ts` `incrementLoginAttempts`(325-373행)·`isLocked`(382-404행)
  - 상세: 이 PR 은 계정 잠금 카운터(`incrementLoginAttempts`)를 `findOneOrFail → save(user)` 스냅샷 저장에서 단일 원자 `UPDATE … RETURNING` 으로 재작성했다 — `git diff origin/main...HEAD -- codebase/backend/src/modules/users/users.service.ts` 로 실측: 해당 함수 전체와 새 JSDoc 이 이번 diff 의 `+` 라인이다. 이 재작성은 리뷰 7라운드가 발견한 CRITICAL(아바타 업로드의 컬럼 단위 정리가, 로그인 카운터의 전체-엔티티 `save()` 에 의해 반대 방향으로 무효화되던 lost-update)을 해소하려고 이 PR 이 직접 도입한 collateral 수정이며, 그 부산물로 "쓰기는 DB `NOW()`, 읽기(`isLocked`)는 앱 서버 시계" 라는 새 비대칭이 생겼다(리뷰 8라운드 WARNING #1, `users.service.ts:385-396` JSDoc 에 의도적으로 disclose 됨).
    코드 자체(JSDoc)와 `plan/in-progress/spec-sync-user-profile-gaps.md:98-121`(전제 반증·재확인 표까지 포함)는 이 변경을 매우 상세히 기록하고 있어 **은폐**는 아니다. 문제는 **CHANGELOG 와의 비대칭**이다 — 이 PR 의 CHANGELOG 항목은 "부수로 `users.controller.ts` 의 `import Express` 를 `ExpressNS` 로 개명했다" 는, 런타임 동작에 영향이 없는 순수 타입-레벨 리네임까지 한 문단을 들여 disclose 하면서(`CHANGELOG.md:58-61`), 계정 잠금이라는 **인증 보안 경로의 실제 쓰기 방식이 바뀌고 새 타이밍 리스크가 생긴** 이번 변경은 CHANGELOG 어디에도 없다(`grep -n "incrementLoginAttempts\|isLocked\|시계" CHANGELOG.md` → 매치 0). CHANGELOG 를 훑는 다음 사람(운영자·보안 리뷰어)은 "아바타 업로드만 추가됐다" 고 읽고, 로그인 잠금 로직이 이번 릴리스에서 바뀌었다는 사실 자체를 놓친다.
  - 제안: CHANGELOG 의 "아바타 이미지 업로드" 섹션(또는 별도 `## Unreleased` 항목)에 한 문단 추가 — "이 PR 이 해소한 collateral CRITICAL: `incrementLoginAttempts` 를 원자 `UPDATE … RETURNING` 으로 재작성했고, 그 결과 로그인 잠금 판정에 쓰기(DB 시계)·읽기(앱 서버 시계) 비대칭이 새로 생겼다 — 영향은 시계 드리프트만큼의 초 단위 오차, 재개 신호는 `users.service.ts` JSDoc 참조" 정도. `ExpressNS` 리네임과 같은 급의 disclose 문단이면 충분하다.

- **[INFO]** `k8s/README.md` 의 `S3_PUBLIC_BASE_URL` 표 행이 여전히 한 셀에 4개 사실(주소 성격·버킷 정책·`ListBucket` 금지·실패 증상)을 담아 밀도가 매우 높다 — 직전 라운드(01_19_27)가 이미 지적했고 RESOLUTION 이 "가독성 개선 여지, 필수 아님" 으로 판단해 의도적으로 그대로 둔 항목
  - 위치: `k8s/README.md:183`
  - 상세: 내용 자체는 정확하다(`avatars/` 접두 정책·`ListBucket` 배제·`scripts/minio/README.md` 링크 모두 실측과 일치, 재확인함). 표 셀 밀도 문제만 남아 있고 새로 생긴 결함은 아니다.
  - 제안: 조치 불필요 — 참고용 재확인.

## 그 외 점검 결과 (문제 없음 — 근거와 함께)

- **CHANGELOG.md**: 위 WARNING 을 제외하면, 신설 엔드포인트·설계 결정(3안 중 공개 URL 선택)·5축 위험(키 UUID, Content-Type 화이트리스트, 삭제 순서, 컬럼 단위 UPDATE, prototype-chain 우회)·배포 선행 조건(버킷 정책)·부팅 가드·spec 배지 flip 위임까지 실제 코드와 대조해 전부 일치함을 재확인했다. `mc anonymous set download` 기각 근거(`ListBucket` 동반 노출)도 `scripts/minio/README.md` 의 실측 로그와 정확히 일치한다.
- **README.md / `.env.example` / k8s manifest 4종(`configmap.yaml`, `configmap-patch.yaml`, `prod|staging/kustomization.yaml`)**: `S3_PUBLIC_BASE_URL` 이 전부 등재돼 있고 "브라우저가 도달하는 주소" vs "`S3_ENDPOINT`=백엔드 내부 주소" 구분이 다섯 곳 모두 동일 문구로 일관 반복된다. `docker-compose.yml`/`docker-compose.e2e.yml` 의 `mc anonymous set-json` 볼륨 마운트·주석도 이 서술과 일치한다.
- **JSDoc/독스트링**: `s3.config.ts` 의 `resolvePublicBaseUrl`·`shouldWarnPublicBaseIsPrivate`, `s3.service.ts` 의 `getPublicUrl`, `users.service.ts` 의 `updateAvatar`·`deletePreviousAvatarObject`·`avatarKeyPrefix`·`AVATAR_CONTENT_TYPES`·`incrementLoginAttempts`·`isLocked` 전부 "왜" 를 설명하는 JSDoc 을 갖추고, 다수는 실제 리뷰 라운드에서 드러난 결함(뮤테이션 실측 포함)을 근거로 인용한다.
- **주석 정확성**: `s3.service.ts` 생성자의 `?? endpoint` 주석은 "초판 주석이 폴백은 config 한 곳이라고 잘못 단언했었다" 는 사실을 스스로 정정한 상태로 남아 있어(오래된 주석 문제를 PR 자신이 발견·해소), 현재 코드(`?? endpoint` 가 실제로 존재)와 주석 서술이 일치한다. `users.controller.ts` 의 `ExpressNS` 리네임 사유(전역 `Express` 네임스페이스 가림, 실측 에러 인용)도 실제 import·사용처와 정확히 일치한다. `users.service.ts` `isLocked` 의 시계 비대칭 disclose 도 실제 코드 동작(쓰기 `NOW()` vs 읽기 `new Date()`)과 일치함을 직접 확인했다.
- **인라인 주석**: `updateAvatar` 의 컬럼 단위 update 근거, `deletePreviousAvatarObject` 의 URL→key 복원 로직과 버킷 세그먼트 미검증 트레이드오프, `main.ts` 부팅 경고의 판정을 순수 함수로 뺀 이유(뮤테이션 85건 GREEN 실측)까지 복잡한 로직마다 반증 가능한 근거와 함께 설명되어 있다.
- **테스트 내 문서화**: `s3.service.spec.ts`·`s3.config.spec.ts`·`users-avatar.service.spec.ts`·`users-avatar-swagger-sync.spec.ts`·`users-avatar-upload.e2e-spec.ts` 전부 파일/블록 상단에 "왜 이 테스트가 필요한가" 를 리뷰 라운드별 실측 결함과 함께 명시한다. `users-avatar-swagger-sync.spec.ts` 는 Swagger 산문과 상수(`AVATAR_MAX_BYTES`, `AVATAR_CONTENT_TYPES`) 간 드리프트를 회귀 테스트로 고정해 API 문서 갱신 필요성 자체를 코드 차원에서 강제한다.
- **예제 코드**: `.env.example` 에 실제 키 형태(`avatars/{userId}/{uuid}.{ext}`)·정책 예시 파일 경로·재현 명령까지 명시돼 있어 별도 사용 예제가 추가로 필요하지 않다. `scripts/minio/README.md` 도 실측 커맨드(`curl`·`mc`)를 그대로 재현 가능한 형태로 남겨 두었다.
- **spec 쓰기 경계**: `9-user-profile.md` 의 "미구현 (Planned)" 배지는 이 PR 이 건드리지 않았음을 `git diff origin/main...HEAD -- spec/2-navigation/9-user-profile.md` 로 확인(diff 없음) — developer 가 정확히 planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 위임했다. 그 plan 문서 자체가 "배지만 뒤집지 말고 공개된다는 사실을 함께 적어야 한다" 는 요구사항, 그리고 `0-overview.md §2.7`·`data-flow/4-file-storage.md` 의 stale 키 패턴(`{workspaceId}/avatars/...`)까지 대상 줄 번호 단위로 선제 추적하고 있다.
- **신규 에러 코드 미등재**: `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 `spec/5-system/3-error-handling.md` §1 에 없는 것은 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 할 일 목록에 추적되어 있어 새 결함이 아니다.
- **프런트엔드 사용자 가이드**: `password-and-sessions.mdx` 동반 갱신 필요성은 backend 전용 PR 이라는 점과 함께 `plan/in-progress/spec-sync-user-profile-gaps.md:149-157` 에 이미 명시 추적되어 있다.

## 요약

이번 PR 의 문서화 수준은 전체적으로 이례적으로 높다 — CHANGELOG 는 설계 결정과 그 대가, 다섯 개 위험 축의 실측 근거를 서술하고, 신규 env(`S3_PUBLIC_BASE_URL`)는 README·`.env.example`·k8s manifest 5곳에서 동일 문구로 일관 문서화되며, 신규 공개 함수 전부가 "왜" 를 설명하는 JSDoc 을 갖췄다. 다만 이번 라운드에서 확인한 유일한 새 갭은, 이 PR 이 계정 잠금 로직(`incrementLoginAttempts`/`isLocked`)에 도입한 실질적 동작 변경 — 원자적 재작성 + 새 시계 비대칭 — 이 코드 JSDoc·plan 문서에는 상세히 disclose 되어 있으면서도 **CHANGELOG 에는 전혀 언급되지 않는다는 점**이다. 같은 CHANGELOG 섹션이 이보다 훨씬 사소한 순수 타입-레벨 리네임(`ExpressNS`)까지 한 문단으로 disclose 하고 있어, 이 비대칭은 "문서화가 부족해서" 가 아니라 "CHANGELOG 작성 시 그 collateral 변경을 누락해서" 발생한 것으로 보인다. 그 외 README/k8s 표 행 밀도(INFO, 이미 알려짐·조치 불요 판정됨) 정도를 제외하면 Critical 급 문서화 결함은 없다.

## 위험도

LOW
