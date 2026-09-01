# 문서화(Documentation) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 중앙 에러 카탈로그에 아직 없음
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`UsersService.updateAvatar` 내 두 `throw new BadRequestException({code: 'FILE_REQUIRED' | 'INVALID_FILE_TYPE', ...})`)
  - 상세: `spec/5-system/3-error-handling.md` §1 에는 이 두 코드가 등재되어 있지 않다(직접 grep 확인 — `INVALID_FILE_TYPE` 은 `spec/data-flow/4-file-storage.md` 의 KB 업로드용으로만 존재하고, 이번 아바타용은 별도 카탈로그 항목이 없다). 다만 이 갭은 새로 발견한 문제가 아니라 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 할 일 목록(§관련 항목)에 명시적으로 추적되고 있고, 코드 자체는 `code` 필드를 갖춘 표준 에러 봉투 형태를 지키고 있다.
  - 제안: 별도 조치 불필요 — 해당 planner 트랙 항목 처리 시 함께 등재되면 된다. (문서화 관점에서 "미등재 상태로 방치"가 아니라 "추적됨"이라는 점을 확인차 기록.)

- **[INFO]** `k8s/README.md` 의 `S3_PUBLIC_BASE_URL` 표 행이 한 줄에 배포 선행 조건·정책 예시·실패 증상까지 모두 담겨 있어 다른 행 대비 밀도가 매우 높다
  - 위치: `k8s/README.md` (`S3_PUBLIC_BASE_URL` 표 행, `k8s/base/configmap.yaml`·`k8s/overlays/*` 옆에서 참조되는 문서)
  - 상세: 내용 자체는 정확하고(`avatars/` 접두 정책·`ListBucket` 금지·`scripts/minio/README.md` 링크 모두 실측과 일치) 다른 행들도 이미 축약된 스타일이라 저장소 컨벤션과 크게 어긋나지는 않는다. 다만 표 셀 안에 3~4개의 독립된 사실(주소 성격·버킷 정책·실패 증상·참조 링크)이 몰려 있어 표 형태의 가독성 이점이 줄어든다.
  - 제안: 필수 조치는 아님 — 표 아래에 짧은 각주 한 줄로 분리하면 가독성이 개선될 수 있다는 참고 사항.

## 그 외 점검 결과 (문제 없음 — 근거와 함께)

- **CHANGELOG.md**: 신설 엔드포인트·설계 결정(공개 버킷/서명 URL/프록시 3안 중 선택)·정정된 위험 5축(키 UUID, Content-Type 화이트리스트, 삭제 순서, 컬럼 단위 UPDATE, prototype-chain 우회)·배포 선행 조건(버킷 정책)·부팅 가드·부수 리네임(`ExpressNS`)·spec 배지 flip 위임까지 모두 실제 코드와 대조해 일치함을 확인했다. `mc anonymous set download` 기각 근거(`ListBucket` 동반 노출)도 `scripts/minio/README.md` 의 실측 로그와 정확히 일치한다.
- **README.md / `.env.example` / k8s manifest 4종(`configmap.yaml`, `configmap-patch.yaml`, `prod|staging/kustomization.yaml`)**: `S3_PUBLIC_BASE_URL` 신규 env 가 전부 등재되어 있고, "브라우저가 도달하는 주소" vs "`S3_ENDPOINT`=백엔드 내부 주소"라는 구분이 다섯 곳 모두 같은 문구로 일관되게 반복된다. `docker-compose.yml`/`docker-compose.e2e.yml` 의 `mc anonymous set-json` 볼륨 마운트·주석도 이 서술과 일치한다.
- **JSDoc/독스트링**: `s3.config.ts` 의 `resolvePublicBaseUrl`·`shouldWarnPublicBaseIsPrivate`, `s3.service.ts` 의 `getPublicUrl`, `users.service.ts` 의 `updateAvatar`·`deletePreviousAvatarObject`·`avatarKeyPrefix`·`AVATAR_CONTENT_TYPES` 모두 "왜"를 설명하는 JSDoc 을 갖추고 있고, 실측(뮤테이션 리뷰 라운드에서 발견된 결함)까지 근거로 인용해 이후 독자가 같은 실수를 반복하지 않도록 되어 있다. 특히 `s3.service.ts` 생성자의 `?? endpoint` 주석은 "초판 주석이 틀렸다"는 사실을 스스로 정정하고 있어 오래된 주석(stale comment) 위험이 이미 능동적으로 해소되어 있다.
- **인라인 주석**: `updateAvatar` 의 "컬럼 단위 update" 근거, `deletePreviousAvatarObject` 의 URL→key 복원 로직, `main.ts` 부팅 경고의 판정 위치를 순수 함수로 뺀 이유(뮤테이션 85건 GREEN 실측) 등 복잡한 로직마다 그 결정을 반증 가능한 근거와 함께 설명한다.
- **주석 정확성**: `users.controller.ts` 의 `ExpressNS` 리네임 사유(전역 `Express` 네임스페이스 가림, `Namespace 'e' has no exported member 'Multer'` 실측 에러 인용)가 실제 import 문(`import ExpressNS from 'express'`)·사용처(`ExpressNS.Request`/`ExpressNS.Response`)와 정확히 일치한다. CHANGELOG 의 리네임 서술도 같은 이름(`ExpressNS`)을 쓴다.
- **테스트 내 문서화**: `s3.service.spec.ts`·`s3.config.spec.ts`·`users-avatar.service.spec.ts`·`users-login-attempts.service.spec.ts`·`users-avatar-upload.e2e-spec.ts`·`users-avatar-swagger-sync.spec.ts` 전부 파일 상단 독스트링에 "왜 이 테스트가 필요한가"(리뷰 라운드별 실측 결함)를 명시해, 테스트가 무엇을 방지하는지 코드만으로 즉시 파악 가능하다. `users-avatar-swagger-sync.spec.ts` 는 Swagger 산문(설명 텍스트)과 상수(`AVATAR_MAX_BYTES`, `AVATAR_CONTENT_TYPES`) 간 드리프트를 회귀 테스트로 고정해, API 문서 갱신 필요성 자체를 코드 차원에서 강제하고 있다.
- **예제 코드**: `.env.example` 에 실제 키 형태(`avatars/{userId}/{uuid}.{ext}`)·버킷 정책 예시 파일 경로·재현 명령 위치까지 명시되어 있어 별도 사용 예제 문서가 추가로 필요하지는 않다.
- **spec 쓰기 경계**: `9-user-profile.md` 의 "미구현 (Planned)" 배지 flip 은 developer 가 직접 고치지 않고 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 정확히 위임되어 있으며, 그 plan 문서 자체도 "배지만 뒤집지 말고 공개된다는 사실을 함께 적어야 한다"는 요구사항까지 미리 명시해 다음 planner 턴이 놓치기 어렵게 만들어 두었다. `0-overview.md §2.7`·`data-flow/4-file-storage.md` 의 stale 키 패턴(`{workspaceId}/avatars/...`)까지 별도로 짚어, "SoT 여러 곳에 흩어진 stale 서술"이라는 실제 위험(운영자가 잘못된 버킷 정책을 설계할 수 있음)을 근거로 들었다.
- **프런트엔드 사용자 가이드**: `password-and-sessions.mdx` 동반 갱신 필요성은 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 "프런트엔드 UI 가 없어 아직 미트리거"로 명시 추적되어 있다 — 이번 PR 이 backend 전용이라는 점과 일치하며 새로 지적할 누락이 아니다.

## 요약

이번 PR 의 문서화 수준은 이례적으로 높다 — CHANGELOG 는 설계 결정과 그 대가, 다섯 개 위험 축과 각각의 실측 근거를 서술하고, 신규 env(`S3_PUBLIC_BASE_URL`)는 README·`.env.example`·k8s manifest 5곳에서 동일한 문구("브라우저가 도달하는 주소" vs "백엔드 내부 주소")로 일관되게 문서화되어 있으며, 모든 신규 공개 함수(`resolvePublicBaseUrl`, `shouldWarnPublicBaseIsPrivate`, `getPublicUrl`, `updateAvatar` 등)에 "왜"를 설명하는 JSDoc 이 있고 다수는 실제 리뷰 라운드에서 발견된 결함을 근거로 인용한다. 오래된 주석(stale comment) 문제는 오히려 이 PR 자체가 스스로 발견·정정한 사례(예: `s3.service.ts` 생성자 주석, `users.controller.ts` `FileInterceptor` 주석)로 나타나며, 그 정정 과정 자체가 투명하게 남아 있다. spec 쓰기 권한 경계(배지 flip)도 정확히 지켜져 planner 트랙으로 위임되었고, 위임 문서 자체가 "배지만 뒤집지 말라"는 요구사항까지 선제적으로 못박아 두었다. 유일하게 남는 항목은 신규 에러 코드 2개(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)의 중앙 에러 카탈로그 미등재인데, 이 역시 이미 plan 에 추적되어 있어 새로운 결함이 아니라 인지된 문서 부채다. Critical/Warning 급 문서화 결함은 발견되지 않았다.

## 위험도

NONE
