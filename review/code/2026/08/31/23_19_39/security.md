# 보안(Security) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 업로드된 파일의 실제 바이트(매직 넘버)를 검증하지 않고 파일명 확장자만으로 `Content-Type` 을 결정한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:93-111` (`updateAvatar` — `ext` 파생 → `contentType` 결정 블록)
  - 상세: `AVATAR_CONTENT_TYPES` 화이트리스트 + `hasOwnProperty` 가드로 프로토타입 체인 우회는 막았고, 클라이언트가 보내는 `mimetype` 을 신뢰하지 않는 설계는 타당하다(HTML→XSS 저장 벡터를 원천 차단). 다만 파일명 확장자가 `png` 라고 해서 실제 바이트가 유효한 PNG 라는 보장은 없다 — 매직 넘버(파일 시그니처) 검증이 없다. `Content-Type` 이 `image/png` 로 고정되므로 브라우저가 그 바이트를 HTML/JS 로 실행할 위험은 낮지만(모던 브라우저는 명시된 image/* 타입을 신뢰), 폴리글랏 파일(유효 이미지+임베디드 페이로드)이 공개 버킷에 그대로 저장·배포되는 경로는 남는다.
  - 제안: 필수는 아니나 defense-in-depth 로 업로드 바이트의 매직 넘버(예: `file-type` 류 라이브러리)를 확장자와 대조하는 검증을 고려. SVG 배제 결정과 같은 급의 방어이므로 후속 항목으로 plan 에 남겨도 됨.

- **[WARNING]** 공개 버킷의 유일한 접근 통제인 "익명 GetObject 만 허용, ListBucket 은 차단" 버킷 정책을 검증하는 자동화된(CI) 회귀 테스트가 없다.
  - 위치: `scripts/minio/avatars-public-read.json:1-11`, 적용 지점 `docker-compose.yml:71-77`(`mc anonymous set-json` 엔트리포인트), `docker-compose.e2e.yml` 동일 패턴. 관련 추적: `plan/in-progress/spec-sync-user-profile-gaps.md:91-104`(리뷰 W9, e2e 부재로 유예 명시).
  - 상세: 이 기능의 보안 모델은 "키의 UUID 추측 불가능성"에 전적으로 의존하며, 그 전제가 성립하려면 버킷 정책이 정확히 `s3:GetObject` 만 허용하고 `s3:ListBucket` 은 거부해야 한다(README 가 실측으로 `mc anonymous set download` 를 기각한 이유와 동일). 현재는 이 정책의 정합성을 유닛 테스트가 원리적으로 검증할 수 없고(unit 은 `S3Service` 를 통째로 mock), e2e 테스트도 이 PR 범위에서 명시적으로 유예됐다. 즉 향후 누군가 `avatars-public-read.json` 을 되돌리거나(`set download` 로 회귀) `createbuckets` 단계를 삭제해도 CI 는 이를 잡지 못하고, 프로덕션에서 아바타 키 전체 열거(개인정보/멤버십 노출)로 이어질 수 있는 회귀가 조용히 배포될 수 있다.
  - 제안: plan 에 이미 재개 신호가 기록돼 있으므로 즉시 차단 사유는 아니나, 최소한 "정책 적용 여부"를 부팅 시 helth-check 성격으로 검증(예: 익명 `?list-type=2` 요청이 403 인지 스모크 체크)하는 경량 스크립트를 `createbuckets` 뒤에 추가하는 것을 다음 이터레이션에서 고려할 것을 권고.

- **[INFO]** (검증 확인, 결함 아님) `deletePreviousAvatarObject` 의 키 복원 로직이 타 사용자 객체 삭제(IDOR)로 이어지지 않는지 직접 추적했다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:149-194`
  - 상세: `avatarUrl` 은 `PATCH /api/users/me` 를 통해 사용자가 임의의 URL 문자열을 넣을 수 있는 필드다(`update-me.dto.ts` — `@IsUrl({ require_tld: false })`, 이 PR 범위 밖). `deletePreviousAvatarObject` 는 `previousUrl.indexOf(marker)` 로 **자신의 `avatars/{userId}/` 접두**가 나타나는 위치부터 문자열을 잘라 키로 쓰므로, 복원된 키는 항상 `avatars/{자신의 userId}/…` 로 시작한다. S3/MinIO 오브젝트 키는 파일시스템처럼 `..` 를 경로 탐색으로 해석하지 않는 flat 네임스페이스이므로, 이 문자열 조작만으로 타 사용자 접두(`avatars/{otherUserId}/…`)의 실제 키와 일치시킬 수 없다 — 실제로 `users-avatar.service.spec.ts:150-156` 의 "남의 아바타 키는 지우지 않는다" 테스트가 이를 고정한다. 별도 조치 불필요.

## 요약

아바타 업로드 기능은 "공개 버킷 + 공개 URL" 이라는 명시적 트레이드오프를 사용자 결정으로 채택하면서, 그 대가를 완화하는 세 가지 핵심 통제(키의 암호학적으로 안전한 UUID 무작위성 — `randomUUID()`, 확장자 화이트리스트 기반 `Content-Type` 강제 및 SVG 명시적 배제로 저장형 XSS 벡터 차단, 프로토타입 체인 우회 방지를 위한 `hasOwnProperty` 가드)를 모두 구현하고 각각을 뮤테이션 테스트로 고정했다. 타 사용자 아바타 객체를 지울 수 없도록 하는 접근 통제(userId 접두 앵커)도 코드·테스트 양쪽에서 확인된다. 버킷 정책 설계 역시 `mc anonymous set download` 가 의도치 않게 `ListBucket` 을 함께 여는 것을 실측으로 발견·기각하고 명시적 `GetObject`-only 정책으로 교체한 점이 눈에 띄는 보안 실천이다. 남은 잔여 리스크는 업로드 바이트의 매직넘버 미검증(낮은 우선순위 defense-in-depth)과, 이 기능의 유일한 접근 통제인 버킷 정책을 CI 가 검증하지 못한다는 테스트 커버리지 갭(이미 plan 에 유예 항목으로 기록됨) 정도이며, 둘 다 즉시 차단할 사유는 아니다. 하드코딩된 시크릿, 인증/인가 우회, SQL/커맨드 인젝션, 안전하지 않은 암호화 사용은 발견되지 않았다.

## 위험도

LOW
