# 테스트(Testing) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 사전 확인 (회귀)

관련 스위트를 실행해 기존 테스트가 diff 이후에도 유효함을 실측했다:

```
npx jest src/modules/users src/common/config/s3.config.spec.ts src/common/services/s3.service.spec.ts --silent
Test Suites: 9 passed, 9 total
Tests:       115 passed, 115 total
```

리포지토리에는 뮤테이션(파일 수정)을 가하지 않았다 — 정적 리딩 + 테스트 실행만 수행. `git status --short` 는 이 리뷰 세션이 만든 출력 디렉터리(`review/code/2026/09/01/01_19_27/`) 하나만 보인다.

## 발견사항

- **[WARNING]** `S3Service.upload()` 실패(외부 S3 장애) 경로가 어떤 테스트에도 없다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:131` (`await this.s3Service.upload(key, file.buffer, contentType);`), 대응 테스트 파일: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` 전체
  - 상세: 이 파일은 축 3("교체 시 옛 객체 정리")에서 `s3.delete` 실패(best-effort, `:215-223`), `userRepository.update` 실패(`:225-238`)를 각각 전용 케이스로 고정한다. 그런데 그 사이에 있는 `s3Service.upload()` 자체가 reject 하는 경로 — 실제 운영에서 가장 흔할 실패 모드(S3/MinIO 다운, 네트워크 타임아웃) — 는 `upload.mockRejectedValue(...)` 를 쓰는 테스트가 하나도 없다(`grep` 확인, 매치 0건). 현재 구현은 `upload` → `getPublicUrl`/`update` 가 순차 `await` 라 업로드가 던지면 그 뒤 로직(DB 갱신)이 실행되지 않을 것으로 코드 읽기로는 보이지만, 그 사실 — 예외가 그대로 전파되는지, `userRepository.update` 가 **호출되지 않아** 존재하지 않는 오브젝트를 가리키는 `avatarUrl` 이 저장되지 않는지 — 를 고정하는 테스트가 없다. 이 PR 이 스스로 채택한 원칙("동작은 하는데 잘못된 채로 동작하는 축만 테스트가 잡는다")과 정확히 같은 클래스의 결함 표면인데, 다른 축(업로드 성공 후 삭제/저장 실패)은 촘촘히 잠갔으면서 업로드 자체의 실패만 비어 있다.
  - 제안: `s3.upload.mockRejectedValue(new Error('s3 down'))` 케이스를 추가해 (1) 예외가 그대로 전파되는지(`rejects.toThrow`), (2) `repo.update`(및 `s3.delete`)가 호출되지 않는지를 단언한다.

- **[INFO]** 파일 크기 상한의 "정확히 경계값"에서 성공하는 케이스가 없다
  - 위치: `codebase/backend/test/users-avatar-upload.e2e-spec.ts:118-133` (`it('2MB 를 넘으면 413 이고...')`)
  - 상세: `AVATAR_MAX_BYTES + 1`(초과) 거부만 e2e 로 검증된다. 정확히 `AVATAR_MAX_BYTES`(2MB) 크기의 파일이 성공하는지는 유닛·e2e 어디에도 없다. multer `limits.fileSize` 비교가 `<`↔`<=` 로 어긋나는 off-by-one 회귀가 있어도 현재 스위트는 "초과 시 거부" 방향만 보므로 잡지 못한다. 다만 이 비교 자체는 앱 코드가 아니라 `multer`/`@nestjs/platform-express` 내부 로직이라 우선순위는 낮다.
  - 제안: 필요하면 `Buffer.alloc(AVATAR_MAX_BYTES)` 로 200 을 기대하는 케이스를 e2e 에 추가. 비용 대비 우선순위는 낮음.

- **[INFO]** `main.ts` 의 부팅 경고 **호출부** 자체는 어떤 테스트도 실행하지 않는다 — 의도된 기존 관례와 일치하지만 문서화가 비대칭
  - 위치: `codebase/backend/src/main.ts` (`shouldWarnPublicBaseIsPrivate`/`resolvePublicBaseUrl` import 및 `if (shouldWarnPublicBaseIsPrivate(process.env)) { logger.warn(...) }` 블록 — diff 상 `s3.config.ts` import 직후, bootstrap 본문 중간)
  - 상세: 판정 로직(`shouldWarnPublicBaseIsPrivate`)은 `codebase/backend/src/common/config/s3.config.spec.ts` 가 8개 케이스로 촘촘히 고정한다 — 이 분리는 리뷰 6라운드가 "부트스트랩 본문 안의 조합은 `if (false && …)` 뮤테이션에도 85건 GREEN" 을 실측한 데 대한 정당한 대응이고 타당하다. 다만 그 분리의 결과로 `main.ts` 쪽 **호출부 배선**(조건이 참일 때 실제로 `logger.warn` 이 불리는지)은 여전히 어떤 자동화 테스트 대상도 아니다 — `if` 블록을 통째로 지워도 어떤 테스트도 RED 가 되지 않는다(`main.spec.ts` 부재 확인). 이는 이 저장소의 `main.ts`/`production-guards` 전반이 공유하는 기존 한계라 이 PR 이 새로 만든 결함은 아니다.
  - 제안: 필수 아님. 다만 관련 주석/CHANGELOG 문구가 "판정을 순수 함수로 뺐다"까지만 말하고 "호출부 배선 자체는 여전히 미검증"이라는 점은 적지 않아, 다음 사람이 "이제 전부 테스트로 고정됐다"고 오독할 여지가 있다 — 한 줄 부기를 권장.

## 그 외 점검 결과 (문제 없음 — 특히 잘 된 점)

- **동시성(TOCTOU) 갭은 테스트 부재가 아니라 의도된 스코프 제외다.** `updateAvatar`/`update` 의 동시 업로드 시 "패자" 오브젝트가 고아로 남는 문제는 `plan/in-progress/spec-sync-user-profile-gaps.md:83-120` 에 리뷰 W5 로 명시 등재돼 있고, CHANGELOG 도 "여기서 '경쟁을 없앴다' 고 넓게 읽으면 안 된다" 고 스스로 경계를 긋는다. 회귀가 아니라 확인된 유예.
- **lost-update CRITICAL(구 리뷰 라운드가 지목한 `save(user)` 패턴)은 현재 코드에서 이미 `userRepository.update(userId, { avatarUrl })` 컬럼 단위로 고쳐져 있고**, `users-avatar.service.spec.ts:343-397`(`'update 는 avatarUrl 단 하나만 싣는다'`, `Object.keys(patch)).toEqual(['avatarUrl'])`)와 `users-login-attempts.service.spec.ts` 양쪽에서 회귀 테스트로 고정돼 있다. `repo.save` 를 호출하면 즉시 throw 하는 stub 을 심어 read-modify-write 로의 회귀를 시끄럽게 잡는 패턴도 두 파일에 일관되게 적용됨.
- **엣지 케이스 커버리지가 이례적으로 촘촘하다** — Content-Type 매핑 전수 대조(`it.each` 5종, 값 하나하나 단언 — 부분 단언이면 놓칠 뮤테이션을 리뷰 4라운드가 실측), 대문자 확장자, 프로토타입 체인 우회(`constructor`/`__proto__`, 어떤 5개가 `.toLowerCase()` 로 이미 막히는지까지 주석으로 구분), URL 에 쿼리/프래그먼트가 붙은 경우, base URL 이 바뀐 뒤의 옛 URL 복원, 깨진 퍼센트 인코딩(`%zz`) 등 "조용히 실패"할 수 있는 축을 골라 각각 fixture 를 갈리게 설계했다(뮤테이션 검증 코멘트가 각 테스트에 남아 있음 — vacuous 회피가 실측 기반).
- **Mock 적절성**: `S3Service` 는 유닛 전반에서 통째로 mock 되지만, 그 구현 자체(`getPublicUrl`)는 `s3.service.spec.ts` 가 별도로 실행해 검증한다("소비 테스트들이 mock 하기 때문에 이 구현 자체는 어디서도 실행되지 않았다"는 자기 인식 코멘트가 파일 헤더에 있음). 이 저장소 관례(회귀 시 시끄럽게 죽는 throw-stub)와 일치.
- **테스트 격리**: `s3.config.spec.ts` 는 `process.env` 를 직접 조작하지만 `beforeEach`/`afterEach` 로 원래 값을 저장·복원한다. 각 avatar 유닛 테스트는 `setup()`/`build()` 헬퍼로 매번 새 `TestingModule` 을 구성해 공유 가변 상태가 없다.
- **컨트롤러 위임 테스트 신설**은 다른 6개 엔드포인트와의 비대칭(컨트롤러 레벨 테스트 부재)을 스스로 지적하고 메운 사례 — `payload.sub`/`file` 위임과 `pendingEmail` 미노출을 함께 고정.
- **e2e 는 유닛이 원리적으로 못 보는 것만 문는다** — 버킷 정책(익명 GET 200 / List 403), Content-Type 이 실제 오브젝트 메타데이터로 저장되는지, 413 매핑, 교체 후 옛 키 404. `S3_PUBLIC_BASE_URL` 을 직접 fetch 하지 않고 응답에서 키만 추출해 컨테이너 망 주소로 치는 설계는 "환경 설정 정확성"과 "버킷 정책"을 의도적으로 분리해 시험 대상을 좁힌 것 — 근거가 파일 헤더 주석에 명시돼 있다.

## 요약

전반적으로 테스트 품질이 매우 높다 — 여러 리뷰 라운드를 거치며 각 축(키 추측 불가능성·Content-Type 위조·고아 객체·lost update·프로토타입 오염·퍼센트 인코딩·형제 엔드포인트 응답 일관성)마다 "지우면 실제로 RED 가 되는지"를 실측한 흔적이 테스트 코드 자체에 코멘트로 남아 있고, 기존 취약 지점(`incrementLoginAttempts` 의 무테스트 read-modify-write)까지 이번 기회에 별도 스위트로 고정했다. 남은 갭은 크지 않다 — 유일하게 WARNING 으로 올린 것은 `S3Service.upload()` 실패(외부 장애) 경로가 이 정도로 촘촘한 스위트에서 유독 비어 있다는 점이고, 나머지 둘(크기 상한 경계값, `main.ts` 호출부 미검증)은 우선순위가 낮은 INFO 다. 동시 업로드 TOCTOU 는 결함이 아니라 plan 에 명시적으로 유예 등재된 기지(既知) 스코프 제외다. 관련 스위트 115건은 실측 기준 diff 이후에도 전부 GREEN.

## 위험도

LOW
