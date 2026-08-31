# 테스트(Testing) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 방법론 메모

리뷰 대상 unit 테스트 88건(`users-avatar.service.spec.ts` 30건 포함)을 실제로 실행해
GREEN 을 확인했고, 세 가지 가설을 **뮤테이션으로 직접 검증**했다. 뮤테이션은 저장소 파일을
`scratch` 로 백업한 뒤 `python3`/`cp` 로 적용·복원했으며(요구 규약 준수), 각 단계 후
`git status --short` 로 원복을 확인했다 — 세 번의 개입 모두 최종적으로 clean 상태로
복귀했다(review 산출물 외 미추적 변경 없음).

## 발견사항

- **[WARNING]** `S3Service` 생성자의 "2차 방어" 폴백이 `s3.config.ts` 의 SoT 규칙과 연산자가 다르다 — 뮤테이션으로 무력함을 확인
  - 위치: `codebase/backend/src/common/services/s3.service.ts` 생성자 — `this.publicBaseUrl = this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;` (nullish coalescing, `??`)
  - 대조: `codebase/backend/src/common/config/s3.config.ts` — `S3_PUBLIC_BASE_URL || S3_ENDPOINT || 'http://localhost:9000'` (falsy coalescing, `||`)
  - 상세: 주석은 "이 줄은 규칙의 사본이 아니라 undefined 방어용 2차 방어"라고 정확히 서술하지만, 정작 `??`↔`||` 를 서로 바꿔도 **현재 테스트 스위트 전체(`s3.service.spec.ts` 40건, `users-avatar.service.spec.ts` 포함)가 GREEN 으로 남는다**(직접 뮤테이션 실측). 두 스위트 모두 `s3.publicBaseUrl` 값을 `undefined` 로만 비운다 — 빈 문자열(`''`)로 비우는 케이스가 없어 `??` 와 `||` 를 가르지 못한다. `s3.config.ts` 쪽 폴백 체인이 실제로 빈 문자열을 만들어낼 확률은 낮지만(세 env 모두 빈 문자열이어야 함), 그 확률이 0 이 아닌 이상 두 SoT 가 서로 다른 의미론으로 "복사"돼 있다는 사실 자체가 리스크다. `s3.config.spec.ts` 도 마찬가지로 `delete process.env[k]`(undefined)만 다루고 빈 문자열 케이스가 없다.
  - 제안: `S3Service` 테스트에 `'s3.publicBaseUrl': ''`(빈 문자열, `undefined` 아님) 케이스를 추가해 `??` 의 nullish 전용 의미론을 고정하거나, 두 SoT 를 같은 연산자로 통일한다.

- **[WARNING]** `AVATAR_CONTENT_TYPES` 매핑 값 중 `png` 만 실제 값이 단언된다 — `jpg`/`jpeg`/`webp`/`gif` 는 매핑이 뒤바뀌어도 감지 안 됨(뮤테이션 실측)
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `static readonly AVATAR_CONTENT_TYPES` (약 44행 부근), 관련 회귀 테스트는 `users-avatar.service.spec.ts` "확장자에서 파생한 image/* 를 싣는다" 테스트
  - 상세: `jpg: 'image/jpeg'` 을 일부러 `jpg: 'image/jpg'`(잘못된 값)로 바꿔 실행했더니 `users-avatar.service.spec.ts`(30건)와 `users-avatar-swagger-sync.spec.ts`(3건) 전부 GREEN 이었다. Swagger-sync 스펙은 **키 집합**(확장자 이름)만 대조하고 **값**(Content-Type 문자열)은 보지 않으며, 서비스 스펙은 `me.png` 하나만으로 매핑값을 검증한다. 나머지 4개 확장자는 "화이트리스트에 있다/없다"(거부 여부)만 `it.each` 로 커버되고, 화이트리스트를 통과한 뒤의 **실제 Content-Type 값**은 검증되지 않는다. 이 헤더는 공개 URL 에서 브라우저 렌더링 방식을 정하는 보안 경계(XSS 방지)라 서비스 코드 자체가 강조하는 축인데, 정작 4/5 확장자가 그 축에서 커버리지 밖이다.
  - 제안: `it.each(['png','jpg','jpeg','webp','gif'])` 로 확장해 각 확장자 → 기대 Content-Type 을 전수 대조한다(테스트 파일이 이미 `AVATAR_CONTENT_TYPES` 를 import 하므로 상수에서 기대값을 도출하면 하드코딩 중복도 피할 수 있다).

- **[WARNING]** 확장자 대문자(예: `ME.PNG`) 케이스가 검증되지 않는다 — `.toLowerCase()` 를 제거해도 30건 전부 GREEN(뮤테이션 실측)
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` — `const ext = file.originalname.split('.').pop()?.toLowerCase();`
  - 상세: 이 `.toLowerCase()` 는 두 가지 역할을 겸한다 — (1) 사용자가 대문자 확장자로 올려도 정상 허용, (2) `Object.prototype` 상속 이름(`toString`·`valueOf` 등)이 camelCase 라 소문자화로 차단(프로토타입 오염 가드의 절반). 프로토타입 오염 쪽은 `확장자 %s 를 거부한다` 테스트가 간접적으로 다루지만(소문자 상속 이름은 애초에 통과하므로 그 테스트는 `hasOwnProperty` 가드의 검증이지 `.toLowerCase()` 자체의 검증이 아니다), **정상 대문자 확장자가 정상 처리되는지 확인하는 양성(positive) 테스트가 없다**. `.toLowerCase()` 를 통째로 지워도 스위트가 통과하는 것이 이를 증명한다.
  - 제안: `it('대문자 확장자(ME.PNG)도 소문자화해 허용한다', ...)` 케이스를 축 2 에 추가한다.

- **[INFO]** `main.ts` 의 신규 SSRF 경고 분기가 유닛 테스트 대상 밖 — 다만 기존 형제 분기(`ALLOW_PRIVATE_HOST_TARGETS`)도 같은 상태라 이 PR 이 만든 새 결함은 아님
  - 위치: `codebase/backend/src/main.ts` `bootstrap()` 함수, `isPrivateHost(publicBase)` 분기 (149~172행대)
  - 상세: `production-guards.ts` 의 `isFlagOn`/`assertProductionConfig` 는 순수 함수로 추출돼 `production-guards.spec.ts` 로 검증되는데, 이번에 추가된 `S3_PUBLIC_BASE_URL` 사설 호스트 경고는 `bootstrap()` 본문에 인라인으로 박혀 있고 `bootstrap()` 자체는 어떤 스펙에도 걸리지 않는다(`main.spec.ts` 부재 확인). `isPrivateHost` 판정 로직 자체는 `ssrf.util.ts` 쪽에서 이미 검증되므로 판정 정확도 문제는 아니고, "production 에서 이 조건일 때 warn 이 실제로 호출되는가"라는 배선(wiring) 자체가 테스트 밖이라는 구조적 문제다. 바로 위 형제 블록(`ALLOW_PRIVATE_HOST_TARGETS` 경고)도 동일하게 미검증이라, 기존 관례를 답습한 것이지 이 PR 이 새로 낮춘 커버리지는 아니다.
  - 제안: (우선순위 낮음, 기존 부채와 동일 선상) 두 경고 블록을 함께 `evaluateProductionWarnings(env): string[]` 같은 순수 함수로 뽑아 `production-guards.spec.ts` 에 편입하면 `bootstrap()` 을 실행하지 않고도 검증 가능해진다.

- **[INFO]** `!file?.buffer?.length` 가드의 "파일은 있으나 0바이트" 분기가 미검증 — 현재는 `file === undefined` 케이스만 테스트
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` 앞부분, 대응 테스트는 `users-avatar.service.spec.ts` "빈 파일을 거부한다" (`service.updateAvatar(USER_ID, undefined)`)
  - 상세: 가드 조건은 `file` 자체가 없는 경우와 `file.buffer.length === 0`(빈 버퍼가 실린 파일 객체)인 경우를 한 조건식으로 함께 처리하는데, 테스트는 전자만 다룬다. multer 가 실제로 0바이트 파일에 대해 어떤 형태의 `file` 객체를 넘기는지에 따라 이 분기는 실사용 경로에서 밟힐 수 있다.
  - 제안: `makeFile()` 을 확장해 `buffer: Buffer.alloc(0)` 인 케이스를 `it.each` 에 추가한다.

- **[INFO]** OAuth 우회 캐너리 테스트는 소스 문자열의 정확한 텍스트를 `toContain` 으로 고정 — 포매팅만 바뀌어도 깨질 수 있는 브리틀 테스트지만, 트레이드오프가 테스트 파일 자체에 잘 문서화돼 있어 심각하지 않음
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` `describe('OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리', ...)`
  - 상세: `expect(src).toContain('avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined,')` 는 런타임 동작이 아니라 소스 텍스트를 고정한다. 왜 런타임 단언이 불가능한지(OAuth stub 모드가 두 분기를 구분 못 함)는 테스트 상단 주석에 이미 명확히 근거가 적혀 있어, 저자가 트레이드오프를 인지하고 의도적으로 선택한 형태임을 알 수 있다. 다만 그 대상 줄의 공백·줄바꿈이 prettier 재포맷 등으로 바뀌면 동작 변화 없이도 깨질 수 있다는 점은 남는 리스크다.
  - 제안: (선택) 정확한 문자열 대신 정규식(`/avatarUrl:\s*byEmail\.avatarUrl\s*\?\?\s*profile\.avatarUrl/`) 으로 완화하면 포매팅 변화에 덜 취약해진다. 다만 이 테스트의 목적("우선순위를 바꾸는 사람이 주석을 읽게 만든다")을 고려하면 현행 유지도 합리적 선택이다.

- **[INFO]** e2e 부재(공개 URL GET 200, 실제 MinIO 왕복, 413) — 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` W9 항목으로 유예·근거 기록됨. 새로 지적할 결함이 아니라 이미 잘 관리된 기술 부채임을 확인
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md` "`POST /api/users/me/avatar` e2e 부재 (리뷰 W9)"
  - 상세: 공개 URL 이 실제로 GET 200 을 내는지는 버킷 정책(인프라)이 정하므로 unit 으로 원리적으로 검증 불가능하다는 논리가 타당하고, 선행 조건(`createbuckets` 의 정책 적용)이 이번 PR 에서 이미 해소됐다는 점도 `docker-compose.yml`/`docker-compose.e2e.yml` diff 로 확인된다. 동시성 TOCTOU(W5, 고아 객체) 유예도 재개 신호가 프록시가 아닌 직접 측정 가능한 양으로 적혀 있어 적절하다.

## 요약

이 PR 의 테스트는 이례적으로 두텁다 — `users-avatar.service.spec.ts` 30건이 "조용히 실패하는" 세 위험 축(키 추측 가능성·Content-Type 신뢰·정리 순서/lost update)을 정면으로 겨냥하고, 뮤테이션 실측으로 각 가드가 실제로 걸리는지(RED)까지 리뷰 과정에서 반복 검증한 이력이 plan 문서에 남아 있다. `S3Service.getPublicUrl`·`s3Config.publicBaseUrl` 폴백·Swagger 문서-상수 동기화 등 "동작은 하지만 조용히 틀릴 수 있는" 지점마다 전용 회귀 테스트를 붙인 설계 태도도 일관적이다. 다만 본 리뷰가 뮤테이션으로 직접 확인한 결과, (1) `S3Service` 생성자의 2차 방어 폴백 연산자(`??`)가 `s3.config.ts` SoT 의 연산자(`||`)와 달라도 테스트가 못 잡고, (2) `AVATAR_CONTENT_TYPES` 매핑값은 `png` 외 4개 확장자가 검증 밖이며, (3) 대문자 확장자 정상 처리 양성 케이스가 없다 — 세 곳 모두 코드 변경 없이 뮤테이션만으로 생존이 확인된 실질적 커버리지 갭이다. 이 외에는 새 `bootstrap()` SSRF 경고 배선 미검증(기존 관례 답습)·0바이트 파일 분기 미세 커버리지·캐너리 테스트의 문자열 브리틀니스 정도의 경미한 지적뿐이며, e2e·동시성 유예는 이미 plan 에 근거와 함께 잘 추적되고 있다.

## 위험도

LOW
