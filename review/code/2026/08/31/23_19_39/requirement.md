# 요구사항(Requirement) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** k8s `prod`/`staging` overlay 가 `S3_ENDPOINT` 는 실 AWS S3 로 patch 하면서 신규 `S3_PUBLIC_BASE_URL` 은 patch 하지 않는다 — base 의 `http://localhost:9000` 기본값이 그대로 새어 나간다.
  - 위치: `k8s/overlays/prod/kustomization.yaml` (본 PR 변경 파일 아님) — `patches[0].patch` 블록, `/data/S3_ENDPOINT` 항목 옆(:34) / `k8s/overlays/staging/kustomization.yaml` 동일 위치(:37). 기본값 출처는 본 PR 변경분 `k8s/base/configmap.yaml:28` (`S3_PUBLIC_BASE_URL: "http://localhost:9000"`).
  - 상세: kustomize JSON6902 patch 는 명시된 `path` 만 치환하고 나머지는 base 리소스를 그대로 물려받는다. `S3_ENDPOINT`·`DB_HOST`·`REDIS_HOST` 는 두 overlay 모두에서 `REPLACE_ME`/실 AWS 값으로 patch 됐지만, 같은 커밋이 base 에 새로 추가한 `S3_PUBLIC_BASE_URL` 은 어느 overlay 에도 patch 항목이 없다. 그 결과 실제 배포(`kubectl apply -k k8s/overlays/prod`)에서 backend 는 `S3_PUBLIC_BASE_URL=http://localhost:9000` 를 그대로 갖게 되고, `S3Service.getPublicUrl()` 이 만드는 아바타 URL 이 프로덕션 브라우저에서 `http://localhost:9000/...` 를 가리켜 이미지가 전혀 뜨지 않는다. `k8s/README.md` 의 신규 표 행은 "**브라우저가 도달하는** 주소" 를 요구한다고 문서화하지만, 그 요구를 실제로 강제하는 overlay 스캐폴딩(예: `REPLACE_ME` placeholder patch)은 이 PR 에 없다. 이 PR 이 CHANGELOG·`.env.example`·`k8s/README.md` 전체에 걸쳐 반복적으로 경계하는 바로 그 실패 유형("동작은 하는데 잘못된 채로 동작"·"업로드는 성공하고 이미지만 깨진다")이 정작 k8s 배포 경로에서 재현된다.
  - 제안: `prod`/`staging` kustomization.yaml 의 `S3_ENDPOINT` patch 옆에 `S3_PUBLIC_BASE_URL` 항목을(다른 환경별 값처럼 `REPLACE_ME` placeholder 또는 CDN 도메인으로) 추가한다.

- **[SPEC-DRIFT][WARNING]** `spec/2-navigation/9-user-profile.md` §5.1(:136)·§6.1(:334) 이 여전히 `POST /api/users/me/avatar` 를 "미구현 (Planned)" 으로 서술하고, `spec/0-overview.md` §2.7(:265-276)·`spec/data-flow/4-file-storage.md` §2.1/§2.2/§2.3 은 실제 구현(`avatars/{userId}/{uuid}.{ext}`, `S3_PUBLIC_BASE_URL`)과 다른 키 레이아웃(`{workspaceId}/avatars/{userId}.{ext}`)·서빙 전략 부재를 서술한다.
  - 위치: `spec/2-navigation/9-user-profile.md:136,334` / `spec/0-overview.md:265-276` / `spec/data-flow/4-file-storage.md:58,71,78,84-87` — 모두 본 diff 밖(developer 는 `spec/` 쓰기 권한이 없어 미변경).
  - 상세: 실측(`Read`) 결과 spec 본문이 코드와 line-level 로 어긋난다(엔드포인트 존재 여부, 키 패턴, `s3.publicBaseUrl` 설정 매핑 미등재). 이는 실수가 아니라 developer 가 **의도적으로** delegate 한 것 — 신설 `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 정확히 이 세 문서·행을 지목하고 "developer 는 `spec/` 쓰기 권한 밖, 자기-반증형 소정정 예외도 미해당" 이라고 스스로 근거를 밝힌다. 코드가 옳고 spec 이 낡은 전형적 SPEC-DRIFT 이며, 처리 경로(planner 트랙 위임)도 올바르다.
  - 제안: 코드는 그대로 두고, `spec-update-avatar-upload-implemented.md` 의 planner 턴이 착수될 때 `9-user-profile.md`(§5.1·§6.1 배지 flip + 계약 명시) · `0-overview.md §2.7` · `data-flow/4-file-storage.md §2.1/§2.2/§2.3` 세 문서를 함께 갱신한다(이미 plan 에 명시돼 있으므로 별도 조치 불요 — 상태 추적용으로만 등재).

- **[INFO]** 이번 diff 23개 파일 중 `codebase/frontend/**` 변경이 없다 — `POST /api/users/me/avatar` 를 호출하는 UI 가 아직 없어 기능이 최종 사용자에게 도달 불가능하다.
  - 위치: `codebase/frontend/src/lib/api/users.ts` — `avatarUrl?: string` 필드만 존재, 업로드 호출부 없음(파일 자체는 본 diff 밖).
  - 상세: `plan/in-progress/spec-sync-user-profile-gaps.md` 의 해당 항목은 "완료 (2026-08-31)" 로 체크됐지만 실제로는 backend + 배포 인프라 범위로 한정된 완료다. 다른 트래커 항목(예: 테마 System)은 "backend + frontend 완료" 로 명시해 범위를 구분하는데, 이 항목은 그 구분이 본문에 없어 다음 사람이 "사용자가 이미 아바타를 올릴 수 있다" 고 오독할 수 있다. 기능적 결함은 아니고(스코프 판단의 문제), spec §6.1 배지 flip 도 별도 planner 트랙이라 시점상 자연스럽다.
  - 제안: 트래커 항목에 "backend + 배포 인프라만, frontend UI 는 별도" 를 한 줄 명시하면 다음 세션이 재조사 없이 스코프를 알 수 있다.

- **[INFO]** `updateAvatar` 의 "빈 파일 거부" 축은 `file === undefined` 케이스만 회귀 테스트로 고정돼 있고, `Buffer.alloc(0)` 같은 "파일은 존재하지만 buffer 길이 0" 케이스는 별도로 단언되지 않는다.
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:124-130`(`빈 파일을 거부한다` — `updateAvatar(USER_ID, undefined)` 만 검증) / 구현은 `codebase/backend/src/modules/users/users.service.ts:83`(`!file?.buffer?.length`)에서 두 케이스를 동일하게 처리.
  - 상세: 구현 자체는 `file?.buffer?.length` 로 두 케이스(파일 부재·빈 버퍼)를 동일한 optional-chaining 표현식 하나로 처리하므로 실제 결함 가능성은 낮다. 다만 `?.length` → `.length` 로 축약하는 뮤테이션이 있으면 "buffer 존재하지만 길이 0" 분기는 이 스위트에서 잡히지 않는다(빈 배열이 아니라 빈 버퍼라 falsy 판정이 다르게 갈릴 수 있는 축).
  - 제안: `makeFile()` 변형으로 `buffer: Buffer.alloc(0)` 케이스를 `it.each` 에 추가하면 커버리지 공백이 닫힌다. 필수는 아님.

## 요약

핵심 기능(§6.1 아바타 업로드: 확장자 화이트리스트·`Content-Type` 서버 파생·UUID 키·컬럼 단위 `update`(lost-update 회피)·DB 저장 후 정리(orphan 순서)·`hasOwnProperty` 프로토타입 체인 가드·퍼센트 인코딩 파싱을 try 안으로·`PATCH /users/me` 경유 정리와 값-비교 가드)는 이전 두 라운드 리뷰에서 잡힌 CRITICAL 들이 전부 코드에 반영돼 있고, 회귀 테스트(468줄 unit + swagger 동기화 + s3 config/service 테스트)가 예측한 실패 축들을 실제로 고정하고 있음을 소스 대조로 확인했다. spec 본문(`9-user-profile.md`·`0-overview.md`·`data-flow/4-file-storage.md`)과의 line-level 불일치는 실재하지만 developer 가 자체 권한 밖임을 인지하고 전용 planner-track plan 문서로 정확히 위임했다(SPEC-DRIFT, 처리 경로 정상). 실질적으로 새로 발견된 결함은 코드 밖 배포 설정 한 건이다 — `k8s/overlays/{prod,staging}` 가 신규 `S3_PUBLIC_BASE_URL` 을 patch 하지 않아 프로덕션에서 아바타 URL 이 `localhost:9000` 을 가리키게 되는데, 이는 이 PR 자체가 반복해서 경계하는 "업로드는 성공, 표시만 깨짐" 실패 유형이 다른 설정 축(버킷 정책 대신 k8s ConfigMap)에서 재현된 것이다.

## 위험도

MEDIUM — 애플리케이션 코드 자체의 CRITICAL 은 없으나, k8s prod/staging 배포 시 아바타 이미지가 조용히 깨지는 실제 운영 결함이 남아 있어 배포 전 조치가 필요하다.
