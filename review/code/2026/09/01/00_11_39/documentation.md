# 문서화(Documentation) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 개요

CHANGELOG·README·`.env.example`·`k8s/README.md`·`configmap.yaml`·신규 `scripts/minio/README.md`,
그리고 `s3.config.ts`/`s3.service.ts`/`users.service.ts`/`users.controller.ts` 의 JSDoc·인라인
주석 전 계층을 실제 소스(`Read`)와 대조했다. 이 PR 은 이미 4라운드 리뷰를 거쳤고, 그중
문서화 관점 지적은 대부분 반영돼 있다(부팅 가드 CHANGELOG 누락 → 추가, spec SoT 가
"미구현"으로 남아 있다는 경고 → JSDoc 에 캐버트 추가 등). 이번 라운드에서 실제 코드를
`Read`/`jest` 로 재검증한 결과, **이미 한 번 고쳐졌던 문제가 그 후속 라운드의 코드 변경으로
다시 stale 해진 사례**를 하나 발견했다 — 아래 WARNING.

## 발견사항

- **[WARNING]** plan 문서 두 곳이 인용하는 회귀 테스트 건수 "30건"이 다시 실제 파일과
  어긋난다 — 3라운드에서 한 번 고쳐진 뒤, 4라운드가 테스트 5건을 더 추가하면서 재발했다
  (regression of an already-fixed doc-accuracy issue)
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md:41`
    (`**회귀 테스트 — 착수 시 13건(3축), 리뷰 3라운드 대응까지 마친 시점 실측 30건.**`),
    `plan/in-progress/spec-update-avatar-upload-implemented.md:89-90`
    (``- 회귀: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` — **30건**
    (§6.1 핵심 3축 13건 + 리뷰 1~3라운드 대응 17건). 실측: `jest --silent <file>` ``)
  - 상세: 두 plan 문서 모두 "30건"을 인용하고, 두 번째 문서는 그 숫자를 뒷받침하는 검증
    명령까지 `jest --silent <file>` 로 명시한다. 그 명령을 실제로 돌리면:

    ```
    $ npx jest --silent users-avatar.service.spec.ts
    Tests:       35 passed, 35 total
    ```

    이 "30건"이라는 숫자 자체는 **3라운드 시점에는 정확했다** — 3라운드 리뷰가 같은 이유로
    "13건"을 지적했고(`review/code/2026/08/31/23_19_39/documentation.md`), 그 RESOLUTION
    (`review/code/2026/08/31/23_19_39/RESOLUTION.md:95-104`)이 `jest --silent` 로 실측해
    "30건"으로 정정한 이력이 남아 있다. 그런데 바로 다음 라운드(4라운드,
    `review/code/2026/08/31/23_46_40/RESOLUTION.md` 의 "뮤테이션이 드러낸 커버리지 갭 둘"
    항목 #7·#8)가 이 스위트에 테스트를 5건 더 추가했다 — `png` 단일 단언을
    5개 확장자 전수 `it.each` 로 확장(+4)하고, 대문자 확장자(`ME.PNG`) 양성 케이스를
    신설(+1)했다. `30 + 5 = 35` 로 현재 실측치와 정확히 맞아떨어진다. 즉 **같은 클래스의
    결함이 같은 PR 안에서 두 번째로 재발**한 것이고, 4라운드의 문서화 리뷰
    (`review/code/2026/08/31/23_46_40/documentation.md`)는 이 카운트를 재검증하지 않고
    통과시켰다.
  - 제안: "30건"을 "35건(§6.1 핵심 3축 13건 + 리뷰 1~4라운드 대응 22건)"처럼 실측치로
    다시 정정한다. 근본적으로는 이 PR 이 리뷰 라운드를 거칠 때마다 테스트가 늘어나는
    구조이므로, 숫자를 하드코딩해 반복적으로 stale 해지게 두기보다 "정확한 건수는
    `jest --silent <file>` 로 확인하라"는 문구만 남기고 숫자 자체는 빼는 편이 이 특정
    plan 문서의 남은 수명 동안 더 안전하다.

- **[INFO]** `S3Service.getPublicUrl` JSDoc에 `@returns` 설명이 여전히 없음 (3라운드 INFO,
  미조치 상태 유지 — 재확인만)
  - 위치: `codebase/backend/src/common/services/s3.service.ts:69-86` (JSDoc 블록 전체,
    특히 `:84` `@param key` 다음 줄)
  - 상세: 같은 파일의 `deleteMany` 는 반환 형태를 설명하지만 `getPublicUrl` 은 `@param`
    만 있고 반환값 설명(`@returns`)이 없다. 3라운드 문서화 리뷰가 이미 지적했고 우선순위가
    낮아 미조치로 남아 있다 — 이번에도 여전히 없음을 확인했다. 새 결함은 아니다.
  - 제안: 선택 사항. `@returns 공개 GET URL (base/bucket/encoded-key)` 한 줄 추가.

- **[INFO]** `AVATAR_MAX_BYTES` JSDoc과 `FileInterceptor` 옆 주석의 프레이밍이 여전히
  다르다 (3라운드 INFO, 미조치 상태 유지 — 재확인만)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:51`
    (`/** 아바타 크기 상한. 컨트롤러의 multer 한도와 **같은 값이어야** 한다. */`) vs
    `codebase/backend/src/modules/users/users.controller.ts` 의
    `limits: { fileSize: UsersService.AVATAR_MAX_BYTES }` 옆 주석
    (`상수를 **직접 참조**하므로 서비스와 갈릴 수 없다`)
  - 상세: 컨트롤러 쪽은 "직접 참조라 갈릴 수 없다"(사실 — 리터럴 복제가 아니라 참조)고
    정확히 서술하는데, 서비스 쪽 JSDoc은 여전히 "같은 값이어야 한다"(마치 두 상수를 손으로
    동기화해야 하는 것처럼 읽힘)로 남아 있다. 실질적 위험은 낮음 — 실제 참조 관계는
    코드로 이미 강제돼 있어 두 주석이 갈려도 드리프트가 발생하지는 않는다.
  - 제안: 선택 사항. `AVATAR_MAX_BYTES` JSDoc을 "컨트롤러의 multer `limits.fileSize`가 이
    값을 직접 참조한다(리터럴 중복 아님)"로 맞추면 일관성이 좋아진다.

## 검증한 항목 (문제 없음 확인 — 재확인)

- `users.controller.ts`·`users.service.ts`·`s3.service.ts`·`main.ts`·`s3.config.ts` 의 JSDoc·
  인라인 주석을 `Read` 로 직접 열어 실제 코드와 대조 — 전부 일치. 특히 `s3.service.ts`
  생성자의 "`?? endpoint` 는 2차 방어이지 SoT 사본이 아니다" 주석은 3라운드에서 지적됐던
  "주석이 SoT라 단언하는데 코드가 두 번째 폴백을 가진다"는 결함을 정확히 정정한 상태였다.
- `main.ts` 의 production 부팅 가드 주석("`isPrivateHost` 는 loopback·RFC1918·link-local·
  ULA·IPv4-mapped IPv6 를 다루고 DNS 이름엔 `false` 를 돌려준다")을
  `common/utils/ssrf.util.ts` 실제 구현과 대조 — 정확.
  `ALLOW_PRIVATE_HOST_TARGETS` 참조도 실제로 존재하는 기존 플래그임을 확인.
- CHANGELOG 가 이번 PR 이 넣은 production 부팅 가드를 문단으로 명시(4라운드에서 추가된
  것으로 보이며, 3라운드가 지적한 누락은 현재 해소돼 있다).
- `scripts/minio/avatars-public-read.json`(신규)의 버킷명(`workflow-storage`)이
  `docker-compose.yml`/`docker-compose.e2e.yml`/`codebase/backend/.env.example` 의
  `S3_BUCKET` 값과 일치. `scripts/minio/README.md`(신규)가 `mc anonymous set download`
  기각 근거를 실측 로그와 함께 상세히 남긴다.
- `users-avatar.service.spec.ts` 최상단 파일 docstring·각 `describe` 블록의 리뷰-라운드
  귀속 주석(`리뷰 2라운드`, `리뷰 3라운드` 등)은 실제 코드 동작과 일치하며, "왜 캐너리인가"
  (`OAuth 연동 경로가 아바타 정리를 우회한다`)처럼 vacuous 단언을 피하는 근거까지 상세히
  설명한다 — 테스트 문서화 품질이 높다.
- `plan/in-progress/spec-update-avatar-upload-implemented.md` 는 spec `9-user-profile.md`
  뿐 아니라 `0-overview.md §2.7`·`data-flow/4-file-storage.md`·`5-system/3-error-handling.md`
  까지 누락 SoT 문서를 열거하고, developer 가 `spec/` 를 직접 고치지 않고 planner 트랙으로
  위임한 근거("자기-반증형 소정정 예외 미해당")를 명시 — CLAUDE.md 규약과 일치.

## 요약

이 PR의 문서화 밀도·정확도는 전반적으로 이례적으로 높다 — "왜 이 설계인가"(공개 버킷의
대가, `mc anonymous set download` 실측 기각, lost-update 회피를 위한 컬럼 단위 UPDATE,
prototype-chain 우회 방어)를 코드 JSDoc·인라인 주석·테스트 docstring·CHANGELOG·plan 문서
다섯 계층에서 일관되게, 그리고 실측을 곁들여 설명한다. 다만 이번 라운드에서 실제로 `Read`+
`jest` 로 재검증한 결과, **plan 문서의 "회귀 테스트 30건" 이라는 측정 수치가 다시
stale 해진 것**(실측 35건)을 발견했다 — 이 정확한 결함 클래스는 3라운드에서 이미 한 번
지적·수정됐던 것인데, 4라운드가 테스트를 5건 추가하면서 재발했고 그 사이 문서화 리뷰가
재검증 없이 통과시켰다. 기능적 영향은 없지만, "실측: `jest --silent <file>`" 이라고 스스로
검증 명령까지 적어 둔 문서가 그 명령을 돌리면 곧바로 반증되는 상태로 남아 있다는 점에서
정정할 가치가 있다. 나머지 두 건(`@returns` 누락, `AVATAR_MAX_BYTES` 프레이밍 불일치)은
3라운드 때부터 있던 낮은 우선순위 INFO 로, 이번에도 미조치 상태임을 재확인했을 뿐 새로
발견한 것은 아니다.

## 위험도

LOW
