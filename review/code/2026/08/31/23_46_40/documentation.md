# 문서화(Documentation) 코드 리뷰

## 개요

아바타 업로드(`POST /api/users/me/avatar`, 공개 버킷 + 공개 URL 서빙) PR. 26개 변경 파일 중
다수가 문서 자체(CHANGELOG, README, `.env.example`, `k8s/README.md`, 신규 `scripts/minio/README.md`,
plan 문서 2건)이거나 문서화 밀도가 매우 높은 코드(JSDoc, 인라인 주석, self-referential 테스트
docstring)다. 아래 실제 소스 파일을 직접 열어 diff 의 주장과 대조했다.

## 검증한 항목 (문제 없음 확인)

- `spec/2-navigation/9-user-profile.md:136,334` — `plan/in-progress/spec-update-avatar-upload-implemented.md`
  가 인용하는 두 줄("미구현 (Planned)")이 실제로 정확히 그 줄 번호·내용으로 존재함을 `grep` 으로 확인.
  spec 배지 flip 을 developer 가 직접 고치지 않고 planner 트랙(`spec-update-avatar-upload-implemented.md`)
  으로 위임한 판단은 CLAUDE.md 의 "자기-반증형 소정정" 5조건에 해당하지 않는 케이스(제품 정의 서술이지
  developer 자신이 쓴 예고 문장이 아님)로, 올바르게 분리됐다.
- `spec/0-overview.md:269,276` 와 `spec/data-flow/4-file-storage.md:58,71,78` — plan 문서가 주장하는
  "다른 두 SoT 문서가 `{workspaceId}/avatars/{userId}.{ext}` 라는 실제 구현과 다른 키 패턴을 정의한 채
  미구현으로 남아 있다"는 서술을 `grep` 으로 확인 — 정확하다. 이미 별도 planner 항목(`spec-update-avatar-upload-implemented.md`
  §같은 사실을 말하는 다른 SoT 문서)에 세 문서 전부 열거돼 있어 새로 지적할 것은 없음.
- `users.controller.ts` 의 `@ApiBody`/`@ApiOperation`/`@ApiPayloadTooLargeResponse` 의 "2MB", 확장자
  목록(`png/jpg/jpeg/webp/gif`)이 `UsersService.AVATAR_MAX_BYTES`·`AVATAR_CONTENT_TYPES` 와 실제로
  일치하며, 이를 고정하는 `users-avatar-swagger-sync.spec.ts` 가 신설돼 향후 드리프트를 잡는다.
  (초판이 "회귀 테스트가 동일성을 고정한다"고 적었다가 실제로는 없었음을 스스로 잡아 정정한 이력도
  `users.controller.ts` 주석에 남아 있음 — 정확.)
- `s3.config.ts`/`s3.service.ts`/`README.md`/`.env.example`/`k8s/README.md`/`k8s/base/configmap.yaml`/
  `k8s/overlays/{local,prod,staging}` 전부에서 `S3_PUBLIC_BASE_URL` 폴백 규칙("`S3_PUBLIC_BASE_URL` →
  `S3_ENDPOINT` → localhost")과 "정책이 닫혀 있으면 업로드는 성공하고 이미지만 403" 경고 문구가 반복되며
  서로 모순 없이 일치. `scripts/minio/avatars-public-read.json` 의 버킷명(`workflow-storage`)도
  `docker-compose.yml`/`docker-compose.e2e.yml` 의 `S3_BUCKET` 값과 일치.
- `main.ts` 신규 production 가드의 주석("`isPrivateHost` 는 DNS 이름에 false 를 돌려준다")을
  `common/utils/ssrf.util.ts` 의 실제 구현과 대조 — 정확 (IPv4 정규식 미매치 시 `return false`).
- `s3.service.ts` 생성자의 "2차 방어" 주석("`s3Config` 가 로드된 경로에서는 이 분기를 타지 않는다")은
  `s3.service.spec.ts` 의 신설 테스트가 오히려 그 분기가 실제로 뚫려 있었다는 사실(가드 없이 지워도
  81건 GREEN)을 실측해 주석을 코드에 맞게 정정한 이력이 남아 있어 신뢰할 만하다.
- `plan/in-progress/spec-sync-user-profile-gaps.md` 가 인용하는 두 리뷰 세션 경로
  (`review/code/2026/08/31/22_44_14`, `.../23_19_39`)는 실제로 디스크에 존재함을 확인.

## 발견사항

- **[WARNING]** CHANGELOG 신규 항목이 이 기능의 위험·완화를 매우 상세히 기록하면서도, 같은 PR 이 도입한
  **production 부트 가드**(운영 환경에서 `S3_PUBLIC_BASE_URL` 이 사설/loopback 주소면 경고 로그를 남기는
  로직)는 전혀 언급하지 않는다.
  - 위치: `CHANGELOG.md` (신규 `## Unreleased — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)` 섹션) ·
    `codebase/backend/src/main.ts` 게이트 숫자 `159`~`172` (`if (process.env.NODE_ENV === 'production')`
    블록, `isPrivateHost` 호출)
  - 상세: `main.ts` 의 인라인 주석 자체가 "실제로 이 변수를 도입하면서 k8s prod/staging overlay 에
    patch 를 빠뜨려 base 의 localhost 기본값이 실릴 뻔했다(리뷰 3라운드)"는 근접사고(near-miss) 이력을
    적어 둘 만큼 이 가드가 실질적 가치를 가졌음을 스스로 증언한다. 그런데 CHANGELOG 는 코드로 고정한
    "세 가지 위험"(키 UUID·Content-Type·정리 순서)과 배포 선행조건(버킷 정책)만 다루고, 운영자가 부팅
    로그에서 실제로 마주칠 `[CONFIG] S3_PUBLIC_BASE_URL 이 사설/loopback 주소입니다 …` 경고의 존재·의미는
    CHANGELOG 어디에도 없다. `k8s/README.md`·`configmap.yaml`·`.env.example` 도 이 부트 가드 자체는
    언급하지 않고 env 값 설명만 한다 — 이 가드에 대한 유일한 문서는 `main.ts` 소스 주석뿐이다.
  - 제안: CHANGELOG 항목에 한 줄 추가 — "production 부팅 시 `S3_PUBLIC_BASE_URL` 이 사설/loopback
    주소로 판정되면(`isPrivateHost`) 경고 로그를 남긴다(k8s overlay patch 누락 방지용 backstop)."
    최소 변경이므로 CRITICAL 이 아니라 WARNING 으로 분류.

- **[INFO]** `S3_PUBLIC_BASE_URL` 을 두 문서가 서로 다른 위치에 배치해, 나란히 비교할 때 순서가 어긋난다.
  - 위치: `README.md:212` (`S3_ENDPOINT` 바로 다음 줄에 삽입) vs
    `codebase/backend/.env.example:150` (`S3_REGION` 다음, 블록 맨 끝에 삽입)
  - 상세: 내용은 서로 일치하고 기능적 문제는 없다. 다만 두 파일이 같은 S3 설정 블록을 두 번 문서화하는
    구조이므로, 신규 변수 삽입 위치가 다르면 두 문서를 나란히 대조하는 사람이 잠깐 혼동할 수 있다.
  - 제안: 선택 사항 — 굳이 통일할 필요는 없으나, 다음에 같은 블록을 편집할 사람을 위해 한쪽에 맞추는
    것을 고려.

## 요약

CHANGELOG·README·`.env.example`·`k8s/README.md`·신규 `scripts/minio/README.md`·JSDoc·인라인 주석·
plan 문서(spec 배지 flip 위임 포함) 전 계층에 걸쳐 문서화 밀도와 정확도가 매우 높다. 특히 "왜 이
설계인가"(공개 버킷의 대가, `mc anonymous set download` 실측 기각, lost-update 회피를 위한 컬럼 단위
UPDATE, prototype-chain 화이트리스트 우회)를 코드·테스트·plan·README 네 곳에서 일관되게 서술하고, 실제
spec 파일(`9-user-profile.md`, `0-overview.md`, `4-file-storage.md`)의 인용 줄 번호까지 실측 대조해
정확함을 확인했다. 유일한 실질적 공백은 이 PR 이 함께 도입한 production 부트 경고(사설 호스트 감지)가
CHANGELOG 에서 누락된 것이며, 이는 그 가드 자신이 남긴 근접사고 이력과 대비해 보면 기록할 가치가 있는
변경이다. 나머지는 순서상의 사소한 불일치(INFO) 하나뿐이다.

## 위험도

LOW
