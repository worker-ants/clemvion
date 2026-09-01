# 보안(Security) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `deletePreviousAvatarObject` 의 `decodeURIComponent` 가 try/catch 밖에 있어, 자기 소유
  `avatarUrl` 에 잘못된 percent-encoding 이 들어 있으면 **DB 저장은 이미 성공한 뒤** 처리되지 않은
  `URIError` 로 요청이 500 실패한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:125` (`decodeURIComponent(previousUrl.slice(at))`),
    호출 순서는 같은 파일 `:95-101`(`updateAvatar` — `save` 뒤 `deletePreviousAvatarObject` 호출).
  - 상세: `avatarUrl` 은 `PATCH /users/me` 로 사용자가 직접 설정할 수 있고 (`update-me.dto.ts`
    `@IsUrl({ require_tld: false })` 만 검증 — percent-encoding 정합성은 보지 않음), 그 값 안에
    `avatars/{userId}/` 마커 뒤에 잘못된 `%` 시퀀스(예: `%zz`)가 오면 다음 아바타 업로드 시
    `deletePreviousAvatarObject` 의 `decodeURIComponent` 호출이 `try` 블록 **밖**에서 던진다.
    이 시점엔 이미 `userRepository.save(user)` (신규 URL) 가 커밋된 뒤라, 클라이언트는 업로드가
    **실패**했다는 500 응답(`GlobalExceptionFilter` 가 일반화하므로 정보 노출은 없음)을 받지만
    실제로는 아바타가 이미 갱신돼 있다 — 상태와 응답이 어긋나는 에러 처리 결함이다. 자기 계정에만
    영향(공격자가 타인 URL 을 조작할 경로 없음)이고, 다음 업로드부터는 새로 생성되는
    `getPublicUrl` 출력이 항상 올바르게 인코딩돼 있어 1회성이다.
  - 제안: `decodeURIComponent` 호출도 같은 `try` 블록 안으로 옮기거나, 별도로 감싸서 파싱 실패 시
    `warn` 로깅 후 정리를 건너뛰도록 한다(최우선 목표는 "정리 실패가 업로드 성공 응답을 깨지 않는다"는
    이 함수의 기존 계약을 percent-decoding 실패에도 동일하게 적용하는 것).

- **[INFO]** `S3_PUBLIC_BASE_URL` 미설정 시 `S3_ENDPOINT`(백엔드 내부 주소)로 폴백해, 운영 배포에서
  설정을 빠뜨리면 `avatarUrl` 응답 필드로 **내부 호스트/IP 가 클라이언트에 노출**될 수 있다.
  - 위치: `codebase/backend/src/common/config/s3.config.ts:19-22` (`publicBaseUrl:
    process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT || 'http://localhost:9000'`).
  - 상세: 기능적으로는 이미 CHANGELOG·`.env.example`·plan 문서(§배포 선행 조건)에 "이미지만 403"
    증상으로 명시돼 있어 운영 실수가 곧바로 드러나긴 하지만, 그 사이(설정 누락 상태)에는
    `GET /users/me` 등 응답의 `avatarUrl` 에 내부 네트워크 주소(예: 컨테이너 호스트명·사설 IP)가
    그대로 담겨 인증된 클라이언트(및 그 응답을 열람할 수 있는 누구나)에게 내부 토폴로지 일부가
    노출된다. 코드 결함이라기보다 설정 누락에 대한 fail-safe 부재에 가깝다.
  - 제안: production 에서 `S3_PUBLIC_BASE_URL` 미설정 + `S3_ENDPOINT` 가 사설 대역/루프백으로
    보이면 boot 시 경고(또는 기존 `production-guards.ts` 패턴처럼 강한 가드)를 고려. 현재 수준의
    문서화(주석 경고)만으로는 최초 배포자가 놓치기 쉽다.

- **[INFO]** 이미지 콘텐츠 자체는 검증하지 않고 확장자 화이트리스트 + 강제 `Content-Type` 에만
  의존한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:41-47`(`AVATAR_CONTENT_TYPES`),
    `:77-86`(확장자 검사).
  - 상세: 클라이언트 `mimetype` 을 신뢰하지 않고 확장자 기반으로 `Content-Type` 을 강제하는 설계는
    저장형 XSS(`text/html` 오브젝트 실행)를 잘 차단한다(SVG 제외 포함, 의도 문서화됨). 다만 실제
    바이트가 유효한 이미지인지(매직 바이트) 검사하지 않으므로, `.png` 확장자를 단 임의 바이너리가
    `image/png` 로 저장·공개 서빙될 수 있다. Content-Type 이 고정돼 있어 브라우저 실행 위험은
    낮지만, 이미지 뷰어/파서를 겨냥한 악성 페이로드(압축폭탄·파서 취약점 트리거)에는 방어가 없다.
    설계상 인지된 트레이드오프로 보이며 심각도는 낮음.
  - 제안: 필요 시 `sharp` 등으로 실제 디코딩 가능 여부(매직 바이트)를 검증하는 2차 방어 추가 고려.

- **[INFO]** 공개 버킷 설계의 접근 통제가 전적으로 "버킷 정책이 `GetObject` 만 허용하고
  `ListBucket` 은 막는다"는 코드 밖 전제에 의존한다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts:63-89`(`getPublicUrl` 문서 주석에
    이미 "버킷 정책이 정한다"고 명시), `.env.example:155-156`.
  - 상세: 키에 `randomUUID()` 를 넣어 "키를 아는 사람만 접근"을 접근 통제로 쓰는 모델은, 버킷
    정책이 실수로 `s3:ListBucket` 까지 익명 허용하면 `avatars/` 프리픽스 전체를 나열해 무력화된다.
    이는 코드가 아니라 인프라 설정 문제이고 이미 문서(CHANGELOG·plan)가 "버킷 정책 필요"를
    명시했지만, "GetObject 전용, ListBucket 제외"라는 구체적 조건까지는 문서화돼 있지 않다.
  - 제안: 배포 선행 조건 문서(`.env.example`/CHANGELOG/spec)에 "ListBucket 은 허용하지 않는다"를
    명시적으로 추가하면 운영자의 오설정 여지가 줄어든다.

- **[INFO]** `POST /api/users/me/avatar` 에 엔드포인트 전용 `@Throttle` 이 없다(같은 컨트롤러의
  `email-change/*` 는 5/60s 로 별도 제한).
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:140-148`(uploadAvatar 데코레이터
    블록, `@Throttle` 부재).
  - 상세: 전역 `UserThrottlerGuard`(기본 100 req/60s, `app.module.ts:151-152`)가 이미 적용되므로
    무제한 남용은 아니지만, 요청당 최대 2MB 파일을 매번 S3 PUT + (교체 시) DELETE 하는 이 엔드포인트는
    다른 가벼운 엔드포인트와 같은 전역 한도를 공유해 비용/리소스 소모 프로파일이 다르다. 심각도는
    낮음(인증 필요 + 전역 한도 존재).
  - 제안: 필요시 이 엔드포인트에 별도의 더 낮은 `@Throttle` 을 고려.

## 요약

핵심 위협 모델(공개 버킷에서 키의 UUID = 접근 통제, 클라이언트 `mimetype` 불신 + 확장자 화이트리스트로
저장형 XSS 차단, SVG 명시적 제외, DB 저장 후 옛 객체 삭제 순서, `avatars/{userId}/` 앵커로 IDOR 없는
삭제 범위 제한)은 코드·주석·뮤테이션 테스트(13건/6축) 로 견고하게 뒷받침된다. `deletePreviousAvatarObject`
키 복원이 `avatars/{userId}/` 리터럴 접두로 고정돼 있어 S3 키에는 경로 순회 의미론이 없다는 점과 결합해
타 사용자 객체를 지울 수 있는 경로는 없다. 새 오브젝트 키·`Content-Type` 은 서버가 전적으로 통제하므로
전통적 인젝션·인증 우회·하드코딩 시크릿 문제는 발견되지 않았다. 유일한 실질 결함은 사용자 자신이
설정한(percent-encoding 이 깨진) `avatarUrl` 이 다음 업로드 시 처리되지 않은 예외를 던져 "DB 는 갱신됐지만
응답은 실패"로 어긋나는 에러 처리 버그(WARNING)이며, 그 외는 배포 설정(공개 버킷 정책·`S3_PUBLIC_BASE_URL`)
과 방어심층(이미지 매직바이트 검증·엔드포인트별 throttle) 수준의 낮은 심각도 관찰 사항이다.

## 위험도

LOW
