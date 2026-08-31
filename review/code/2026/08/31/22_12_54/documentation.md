# 문서화(Documentation) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[CRITICAL]** 이 기능이 명시적으로 "갱신 대상"이라고 못박아 둔 두 spec 문서(`spec/data-flow/4-file-storage.md`, `spec/0-overview.md §2.7`)가 이번 PR 에서 전혀 갱신되지 않았고, planner 위임 트래커에도 누락됐다.
  - 위치: `plan/in-progress/spec-update-avatar-upload-implemented.md:14` (Overview 섹션 — "그런데 `spec/2-navigation/9-user-profile.md` 는 여전히 미구현으로 서술한다" 로 시작하는 문단이 영향 spec 파일을 `9-user-profile.md` **하나만** 나열한다)
  - 상세:
    - `spec/data-flow/4-file-storage.md` §1.2 "(Spec 상 정의되지만 미구현) Form 첨부 / Avatar" 절은 스스로 *"Form 노드와 Avatar 기능이 도입될 때 본 문서를 갱신한다"* 라고 적어 뒀다. 이번에 Avatar 기능이 실제로 도입됐는데 이 자기-참조 TODO 가 이행되지 않았다.
    - 같은 문서 §2.1 Prefix/Key 패턴 표는 아바타 키를 `<workspaceId>/avatars/<userId>.<ext>` (상태: "spec 정의, 미구현") 로 서술한다. 그런데 실제 구현(`users.service.ts` `updateAvatar`)의 키는 **`avatars/{userId}/{uuid}.{ext}`** 다 — workspaceId prefix 가 없고, 대신 `userId` 뒤에 `uuid` 세그먼트가 붙는다. 이는 단순 오타 수준이 아니라 **접근 통제 설계 자체가 다르다**(uuid 유무가 이 PR 의 핵심 보안 완화책이라고 CHANGELOG·코드 주석이 반복 강조한다).
    - 같은 문서 §2.2 Postgres 참조 컬럼 표의 `user.avatar_url` 설명은 *"현재는 외부 URL 또는 빈 값. S3 직접 업로드 도입 시 prefix 정의 필요"* 라고 아직도 미도입 상태로 서술한다.
    - 같은 문서 §2.3 ConfigService 매핑 표는 `s3.bucket`/`s3.endpoint`/`s3.region`/`s3.accessKey`/`s3.secretKey` 5개만 나열하고, 이번에 추가된 **`s3.publicBaseUrl` / `S3_PUBLIC_BASE_URL`** 이 빠져 있다.
    - `spec/0-overview.md §2.7` 의 버킷 구조 다이어그램·상태 표도 동일하게 `{workspaceId}/avatars/{userId}.{ext}` 를 "계획 (코드 미구현)" 으로 서술한다 — 키 패턴·구현 상태 둘 다 stale.
  - 왜 CRITICAL 인가: 이 PR 의 CHANGELOG/`.env.example`/`s3.service.ts` 는 "버킷 정책이 `avatars/` 접두에 정확히 걸리지 않으면 업로드는 성공하고 이미지만 403 이 된다"는 위험을 반복해서 경고한다. 그런데 운영자가 (지금 시점 기준) SoT 인 `spec/data-flow/4-file-storage.md`/`spec/0-overview.md` 를 보고 버킷 정책을 `{workspaceId}/avatars/` 접두로 설계하면, 실제 키 접두(`avatars/{userId}/`)와 어긋나 바로 이 PR 이 경고하는 실패 모드를 그대로 재현한다. 즉 이 문서 drift 는 이 기능 자신이 명시한 배포 리스크를 스스로 유발할 수 있는 SoT 오류다.
  - 제안: `spec-update-avatar-upload-implemented.md` 의 대상 파일 목록에 `spec/data-flow/4-file-storage.md`(§1.2 자기-참조 TODO 이행, §2.1 키 패턴 정정, §2.2 avatar_url 설명 갱신, §2.3 `s3.publicBaseUrl` 행 추가)와 `spec/0-overview.md §2.7`(상태·키 패턴 정정)을 추가한다.

- **[WARNING]** 신규 필수 env `S3_PUBLIC_BASE_URL` 이 `codebase/backend/.env.example` 에는 잘 문서화됐지만, 실제 배포/로컬 오케스트레이션 설정과 그 가이드 문서에는 전파되지 않았다.
  - 위치: `codebase/backend/.env.example:150`-`157` (신규 env 추가 지점) — 대조 대상은 diff 밖의 `docker-compose.yml`(backend 서비스 `environment:` 블록, `S3_ENDPOINT: http://minio:9000` 만 있고 `S3_PUBLIC_BASE_URL` 없음), `docker-compose.e2e.yml`(동일 패턴), `k8s/base/configmap.yaml`(`S3_ENDPOINT` 만 있음), `k8s/overlays/local/configmap-patch.yaml`, `k8s/README.md` §3 "외부 DB / Redis / S3 endpoint" 표(운영자가 채워야 할 env 체크리스트에 `S3_PUBLIC_BASE_URL` 자체가 없음).
  - 상세: `docker-compose.yml`은 backend 컨테이너의 `S3_ENDPOINT` 를 컨테이너 내부 전용 주소(`http://minio:9000`, MinIO 포트는 host 로 `localhost:9000` 매핑돼 있음)로 명시 override 한다. `S3_PUBLIC_BASE_URL` 은 이 블록에 없으므로 `.env` 파일(env_file)에 의존하는데, **이번 PR 이전에 이미 존재하던 로컬 `.env` 파일**은 이 키를 갖고 있지 않다 — 그 경우 `s3.config.ts` 의 폴백이 `S3_ENDPOINT`(컨테이너 내부 호스트명 `http://minio:9000`)로 떨어져, 브라우저가 절대 도달할 수 없는 아바타 URL 이 조용히 생성된다. `k8s/overlays/local` 도 같은 구조(`S3_ENDPOINT: "http://minio:9000"`, `S3_PUBLIC_BASE_URL` 없음)라 동일한 문제가 생긴다. `k8s/README.md` 의 staging/prod 배포 체크리스트 표는 이 PR 의 CHANGELOG 가 스스로 "배포 선행 조건"이라고 명시한 신규 env 를 전혀 언급하지 않는다.
  - 제안: (a) `docker-compose.yml`/`docker-compose.e2e.yml` backend 블록에 `S3_PUBLIC_BASE_URL`(로컬은 `http://localhost:9000`)을 `S3_ENDPOINT` 처럼 명시적으로 추가해 `.env` 파일 최신화 여부에 의존하지 않게 한다. (b) `k8s/base/configmap.yaml`/`k8s/overlays/local/configmap-patch.yaml` 에도 대응 값을 추가한다. (c) `k8s/README.md` §3 표에 `S3_PUBLIC_BASE_URL` 행을 추가해 운영자가 놓치지 않게 한다.

- **[WARNING]** `POST /users/me/avatar` 의 파일 크기·확장자 제한이 Swagger 문서 3곳에 리터럴 문자열("최대 2MB", "png/jpg/jpeg/webp/gif")로 중복돼 있고, 그 값을 실제 상수와 동기화하는 테스트가 없다 — 인접 인라인 주석은 그런 보호 장치가 있다고 주장하지만 그 주장이 가리키는 대상이 실제 위험 지점과 다르다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:152`(`ApiOperation.description` "최대 2MB"), `:165`(`ApiBody` 의 `file.description` "최대 2MB"), `:175`(`ApiPayloadTooLargeResponse` description "파일 크기 초과 (2MB)"). 주석은 `:143`-`:145`.
  - 상세: `:143`-`:145` 의 주석은 *"`UsersService.AVATAR_MAX_BYTES` 와 같은 값이어야 한다 … 회귀 테스트가 두 값의 동일성을 고정한다"* 라고 적혀 있다. 하지만 `limits: { fileSize: UsersService.AVATAR_MAX_BYTES }`(`:146`)는 **상수를 직접 참조**하므로 애초에 두 값이 구조적으로 갈릴 수 없고(테스트가 지킬 "분기"가 없다), 그런 등가성 테스트도 이번 diff 에 존재하지 않는다(`users-avatar.service.spec.ts` 13건 어디에도 `fileSize`/`AVATAR_MAX_BYTES` 비교가 없다). 반대로 **실제로 드리프트 가능한 지점**은 위 세 곳의 리터럴 `"2MB"`/확장자 목록 문자열이다 — `AVATAR_MAX_BYTES` 나 `AVATAR_CONTENT_TYPES` 가 바뀌어도 이 Swagger 텍스트들은 자동으로 따라가지 않고, 이를 잡아내는 테스트도 없다. (참고로 서비스 쪽 에러 메시지 `` `Only ${Object.keys(UsersService.AVATAR_CONTENT_TYPES).join(', ')} images are allowed` ``(`users.service.ts:84`)는 상수에서 동적으로 파생돼 이 문제가 없다 — Swagger 쪽만 리터럴로 굳어 있다.)
  - 제안: 주석의 "회귀 테스트가 두 값의 동일성을 고정한다" 문구를 실제로 보호하는 대상(직접 참조라 항상 동일)으로 정정하거나, 반대로 Swagger 리터럴 3곳을 `AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES` 에서 파생시키는(또는 최소한 그 동기화를 검증하는 단위 테스트 하나를 추가하는) 방향으로 정정한다.

- **[INFO]** 루트 `README.md` 의 backend 환경변수 quick-reference 블록이 다른 S3 변수 4개(`S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET/S3_REGION`)는 모두 나열하면서 신규 `S3_PUBLIC_BASE_URL` 만 빠졌다.
  - 위치: `README.md:211` 부근 "S3 / MinIO" 블록 (diff 밖 — 이번 PR 이 건드리지 않은 기존 파일).
  - 상세: 이 블록은 `.env.example` 전체를 그대로 복사한 것이 아니라 선별된 서브셋(예: 이후 절의 `HOOKS_MAX_BODY_BYTES` 처럼 기능별로 의미 있는 항목을 상세 주석과 함께 포함)이라 완전한 목록은 아니다. 다만 같은 카테고리(S3)의 나머지 항목은 전부 있어서, 이 항목만 빠진 것은 의도적 생략이라기보다 갱신 누락으로 읽힌다. 순수 호스트(비-docker) 로컬 개발에서는 폴백값(`S3_ENDPOINT=http://localhost:9000`)이 우연히 올바른 값과 같아 기능상 문제는 없다.
  - 제안: `S3_PUBLIC_BASE_URL=http://localhost:9000` 한 줄과 짧은 설명을 같은 블록에 추가.

- **[INFO — 긍정 관찰]** 이번 diff 자체의 신규/변경 코드 문서화 품질은 높다. `S3Service.getPublicUrl`·`UsersService.updateAvatar`·`deletePreviousAvatarObject` 의 JSDoc 은 "왜"(공개 버킷 트레이드오프, uuid 가 접근 통제인 이유, 정리 순서를 뒤집으면 안 되는 이유, base URL 이 바뀐 뒤에도 키를 복원하는 이유)를 정확하고 코드와 일치하게 설명한다. `users-avatar.service.spec.ts` 의 파일 상단 독스트링은 "조용한 실패 축"이라는 테스트 설계 의도를 명확히 밝히고, 실제 13개 테스트·6개 뮤테이션 축과 정확히 대응한다(플랜 문서 `spec-sync-user-profile-gaps.md` 의 "13건/6축" 표와도 수치가 일치함을 확인). `ExpressModule` 리네임에 대한 인라인 주석(`users.controller.ts:52`-`:56`)은 실측 컴파일 에러 메시지까지 인용하며 근거가 정확하고, CHANGELOG·plan 문서 두 곳에 동일한 근거로 재서술돼 있어 cross-reference 가 일관된다. CHANGELOG.md 신규 항목은 배포 선행 조건(버킷 정책·env)까지 명시해 실전 배포 실패를 예방하려는 시도가 뚜렷하다(다만 위 CRITICAL/WARNING 항목이 그 시도의 사각지대다).

## 요약

코드 자체에 새로 작성된 JSDoc·인라인 주석·CHANGELOG·plan 트래커는 이례적으로 꼼꼼해서 "왜 이렇게 짰는가"를 코드 근처에서 바로 알 수 있다. 그러나 이 기능이 실제로 건드리는 SoT 문서 3곳(`9-user-profile.md`, `data-flow/4-file-storage.md`, `0-overview.md`) 중 개발자가 인지하고 planner 트랙으로 넘긴 것은 하나뿐이고, 나머지 둘은 스스로 "구현되면 갱신하라"고 적어 둔 자기-참조 TODO 를 포함한 채 방치돼 실제 키 패턴 불일치라는 구체적 오류를 남겼다 — 이는 이 PR 이 반복 경고하는 "버킷 정책이 접두와 어긋나면 이미지만 403" 시나리오를 스스로 유발할 수 있는 SoT drift 다. 신규 필수 env(`S3_PUBLIC_BASE_URL`)도 `.env.example`에는 모범적으로 문서화됐지만 docker-compose/k8s 배포 설정·가이드에는 전파되지 않아 자가-호스팅 경로에서 같은 실패 모드를 재현할 수 있다. 그 외 Swagger 리터럴 중복 등은 경미한 유지보수 리스크 수준이다.

## 위험도

HIGH
