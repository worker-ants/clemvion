# 부작용(Side Effect) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[CRITICAL]** k8s `prod`/`staging` overlay 가 신규 env `S3_PUBLIC_BASE_URL` 을 패치하지 않는다 — 배포하면 아바타 URL 이 조용히 `http://localhost:9000` 으로 나간다
  - 위치: `k8s/base/configmap.yaml:28` (신규 도입) — 대조 대상은 `k8s/overlays/prod/kustomization.yaml:34`, `k8s/overlays/staging/kustomization.yaml:37` (둘 다 이번 PR 에서 **수정되지 않음**, 직접 `Read`/`grep` 으로 확인)
  - 상세: `k8s/base/configmap.yaml` 에 `S3_PUBLIC_BASE_URL: "http://localhost:9000"` 이 **리터럴 값**으로 새로 추가됐다(29줄 diff 컨텍스트 기준 게이트 28). `s3.config.ts` 의 코드 레벨 폴백(`S3_PUBLIC_BASE_URL → S3_ENDPOINT → localhost`)은 **env 변수가 아예 부재(undefined)** 일 때만 동작하는데, k8s 배포에서는 ConfigMap 이 이 키를 항상 명시적으로 채워 컨테이너에 주입하므로 코드 폴백은 트리거되지 않는다.
    `prod`/`staging` overlay 의 `kustomization.yaml` 패치 목록을 직접 열어 확인한 결과, 둘 다 `S3_ENDPOINT` 는 `op: replace` 로 외부 S3 주소로 교정하지만(`k8s/overlays/prod/kustomization.yaml:34`, `k8s/overlays/staging/kustomization.yaml:37`) **`S3_PUBLIC_BASE_URL` 패치는 없다.** 즉 base 의 `http://localhost:9000` 이 그대로 production/staging 에 실려, `avatarUrl` 응답 필드가 브라우저가 도달할 수 없는 `http://localhost:9000/...` 로 저장·응답된다.
    같은 PR 의 `k8s/README.md` 표(게이트 183)는 "`S3_PUBLIC_BASE_URL` … `S3_ENDPOINT` 가 내부 주소면 반드시 따로 준다" 고 문서화했지만, 그 지시를 실제 overlay 패치에 반영하는 작업은 이 PR 범위에서 누락됐다. `DB_HOST` 는 prod overlay 에서 `REPLACE_ME.rds.amazonaws.com` 같은 sentinel 로 패치돼 있어 미교정 시 즉시 연결 실패로 드러나는 반면, `S3_PUBLIC_BASE_URL` 은 "그럴듯하게 유효해 보이는" 값(`http://localhost:9000`)이라 배포 직후 에러 없이 통과하고, 업로드도 200 으로 성공한다 — 오직 브라우저에서 이미지를 열 때만, 그것도 로컬 환경이 아니면 실패한다. 이 CHANGELOG/plan 이 반복해서 경고하는 "동작은 하는데 잘못된 채로 동작" 패턴이 정확히 인프라 설정 자체에서 재현된다. 어떤 unit/e2e 테스트도 이 갭을 잡지 못한다(K8s manifest 는 테스트 대상이 아님).
  - 제안: `k8s/overlays/prod/kustomization.yaml`·`k8s/overlays/staging/kustomization.yaml` 의 `backend-config` 패치 목록에 `S3_PUBLIC_BASE_URL` replace 항목을 추가하거나(가능하면 CDN/공개 도메인으로), 최소한 base 값을 `REPLACE_ME` 류 sentinel 로 바꿔 미교정 시 눈에 띄게 만든다. 이 PR 을 그대로 prod/staging 에 배포하기 전에 반드시 해소할 것.

- **[WARNING]** `UsersService.update()` 가 범용 부분 갱신 메서드에 도메인-특정 부작용(S3 정리 호출)을 얹었다 — 17개 호출부 전체의 부작용 반경이 넓어짐
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `update()` 메서드 (파일 컨텍스트 게이트 232~246)
  - 상세: `avatarUrl` 키가 `data` 페이로드에 있으면 `update()` 는 이제 (1) 갱신 전 추가 `findOne` SELECT, (2) 값이 달라졌을 때 `deletePreviousAvatarObject` 를 통한 S3 `delete` 네트워크 호출을 수행한다. 이 메서드는 auth/totp/webauthn 등 17곳의 뜨거운 경로에서 공유되는데, 그중 프로필 수정·OAuth 재연동 두 경로만 `avatarUrl` 을 실어 조건을 만족시킨다는 전제로 설계됐다. 설계 자체는 문서화(JSDoc)·테스트(같은 값이면 지우지 않음, `avatarUrl` 없는 페이로드는 사전 조회 안 함, OAuth 우선순위 캐너리)로 잘 방어돼 있고, `users.service.spec.ts` 의 S3Service mock 도 "부르면 시끄럽게 실패"하도록 만들어 회귀를 잡게 되어 있다. 다만 이는 부작용 관점에서 "일반 목적 메서드에 도메인 부작용을 심는" 패턴이라, 향후 `update()` 를 호출하는 새 경로가 실수로 `avatarUrl` 을 페이로드에 포함시키면(예: 스프레드로 무심코 포함) 예상 못한 S3 delete 가 발동할 수 있음을 기록해 둔다. 이미 리뷰 2라운드에서 동시성(TOCTOU) 측면은 W5 로 유예 처리된 것으로 plan 에 명시돼 있다.
  - 제안: 현재 방어(문서화+테스트+캐너리)로 충분해 보이나, `update()` 를 호출하는 새 코드가 늘 때마다 "이 페이로드에 `avatarUrl` 이 실수로 포함되지 않았는가"를 셀프체크 항목으로 남겨 둘 것.

- **[INFO]** `S3Service` 가 `UsersModule` 에도 지역(non-global) provider 로 추가되어 DI 컨테이너에 독립적인 `S3Client` 인스턴스(자체 연결 풀)가 하나 더 생긴다
  - 위치: `codebase/backend/src/modules/users/users.module.ts` (게이트 22~24, `providers: [UsersService, S3Service]`)
  - 상세: `S3Service` 는 `@Global()` 이 아니고, 이미 `knowledge-base.module.ts` 에서도 같은 방식으로 지역 provider 로 등록돼 있다(`grep` 로 확인: `modules/knowledge-base/knowledge-base.module.ts`, `modules/users/users.module.ts` 두 곳뿐). 이번 변경은 그 기존 패턴을 그대로 답습한 것이라 새로운 위험 등급은 아니지만, 모듈이 늘 때마다 별도의 `S3Client`(및 그 내부 HTTP 연결 풀)가 프로세스당 하나씩 더 생기는 구조라는 점은 부작용 관점에서 기록해 둔다. stateless 클래스이므로 기능적 오류는 없다.
  - 제안: 조치 불요(기존 설계 선례 일치). 향후 S3 사용 모듈이 더 늘면 `@Global()` 전환을 고려할 수 있다는 정도의 참고 사항.

- **[INFO]** `toProfileData()` 추출로 `getMe`·`updateMe`·`uploadAvatar` 세 엔드포인트의 응답 형태가 한 헬퍼로 결합됨
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `toProfileData()` (게이트 84~93), 사용처 게이트 113·140·193
  - 상세: 의도된 리팩터로 JSDoc 에 "필드가 늘 때 세 군데를 따로 고치면 조용히 갈린다" 고 명시돼 있다. 부작용 관점에서는 이 헬퍼 하나를 고치면 세 엔드포인트의 응답이 **동시에** 바뀌는 반경으로 넓어졌다는 뜻이라, 앞으로 이 함수를 수정하는 사람은 세 소비처 전부를 염두에 둬야 한다. 현재는 의도된 통합이고 리스크로 보긴 어렵다.
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** `import Express from 'express'` → `import ExpressNS from 'express'` 리네임은 파일 내부 4개 사용처만 동반 변경되어 외부 영향 없음 확인
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` (import 게이트 57 근방, 사용처 게이트 214-215, 301-302)
  - 상세: 타입 전용 import 리네임이며 런타임 동작 변화 없음. 다른 4개 컨트롤러의 `import Express` 는 그대로 두었다고 CHANGELOG·plan 문서가 명시하고 있고, 실제로 이 리네임은 `users.controller.ts` 로컬 스코프에 한정된다. 공개 API·시그니처 변경 없음.
  - 제안: 조치 불요.

## 요약

이번 변경의 애플리케이션 코드(services/controller) 부작용은 대체로 잘 설계·문서화·테스트돼 있다 — S3 업로드/삭제/공개 URL 조회라는 새 네트워크 호출은 기능 자체가 요구하는 의도된 부작용이고, `UsersService.update()` 에 얹힌 조건부 S3 정리 호출도 "값이 바뀐 경우에만"이라는 명시적 게이트와 회귀 테스트·캐너리로 방어돼 있다. 다만 인프라 설정 계층에서 실제 배포 위험이 하나 발견됐다: `k8s/base/configmap.yaml` 에 새로 추가한 `S3_PUBLIC_BASE_URL` 기본값(`http://localhost:9000`)이 `prod`/`staging` overlay 의 kustomize 패치 목록에 반영되지 않아, 이 PR 을 그대로 배포하면 production/staging 환경에서 아바타 URL 이 조용히 `localhost` 를 가리키게 된다. 코드가 그렇게 애써 피하려던 "동작은 하는데 잘못된 채로 동작"이 정확히 인프라 설정에서 재현되는 사례라 CRITICAL 로 표시했다. 그 외에는 모듈 provider 중복 등록, 응답 헬퍼 결합, import 리네임 등 정보성 관찰만 남는다.

## 위험도
CRITICAL
