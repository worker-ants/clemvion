# 부작용(Side Effect) 리뷰 — patch-null-validation (재검토, HEAD `3eec5f8be`)

## 발견사항

- **[INFO]** 43개 필드의 `@IsOptional()` → `@IsOptionalNonNull()` 치환은 공개 REST API(PATCH 21라우트 중 13라우트)의 관측 가능한 응답 계약을 바꾼다 — `null` 전송 시 종전 500(31건)·엉뚱한 409(노드 `label`)·조용한 값 삭제(200, 트리거 `endpointPath`)였던 것이 전부 `400 VALIDATION_ERROR`로 바뀐다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts` 의 `IsOptionalNonNull` (파일 3), 그 적용 지점은 파일 4~18 전체(예: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:70` `endpointPath`, `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:22` 부근 `label`)
  - 상세: 이것은 이 PR 의 의도된 수정이며 `CHANGELOG.md`(파일 1, `Unreleased — PATCH 에 null 을 보내면 500 대신 400`) 에 사용자 대상으로 명시돼 있다. `plan/in-progress/patch-null-validation.md` §범위가 프런트엔드는 이 43필드에 `null` 을 보내는 자리가 0건임을 grep 으로 확인했다고 적는다. 다만 이 DTO 들은 공개 API 표면이므로, 문서화되지 않은 외부 클라이언트가 이 필드에 우연히 `null` 을 보내던 경우가 있었다면 그 호출은 여전히 실패하지만(500/409/200→400) 상태 코드·에러 바디 형태가 달라진다 — 실패가 실패로 이어지므로 파괴적 회귀는 아니나 관측 가능한 인터페이스 변경이다.
  - 제안: 추가 조치 불필요. CHANGELOG 공지, `--impl-prep`/`--impl-done` 리뷰 게이트, api_contract 리뷰(동일 세션)가 이미 breaking-change 여부를 평가해 LOW 로 수렴했다. 기록 목적의 INFO.

- **[INFO]** `IsOptionalNonNull()` 이 `validationOptions` 를 `ValidateIf`·`IsDefined` 두 데코레이터에 그대로 전달하고, `IsDefined` 쪽은 `{ message: 고정문구, ...validationOptions }` 순서라 호출자가 `message` 를 넘기면 "생략하면 값이 유지된다"는 안내 문구가 조용히 사라진다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:19-27`
  - 상세: 저장소 전체에서 `IsOptionalNonNull()` 은 인자 없이만 14개 DTO·43필드에 쓰인다(파일 4~18, 전수 확인) — 지금은 실행되지 않는 잠재 경로다. `optional-non-null.spec.ts`(파일 2)도 옵션 인자 전달 케이스는 테스트하지 않는다. 스프레드 순서 자체는 "호출자가 넘긴 옵션이 기본값을 덮는다"는 통상적 설계라 버그는 아니다.
  - 제안: 조치 불필요 — 위험이 현실화되지 않는다. 향후 옵션 인자를 넘기는 호출이 생기면 안내 메시지가 사라지는 것이 의도인지만 확인.

- **[INFO]** 새 e2e 스펙(`test/patch-null-rejection.e2e-spec.ts`)이 `beforeAll` 에서 폴더·워크플로·노드·인증 설정·트리거·알림 규칙·테스트 데이터셋·스케줄·모델 설정·어시스턴트 세션 등 다수의 실제 DB 레코드와 계정·워크스페이스를 생성하고(네트워크 호출은 test 대상 `backend-e2e` 서비스로 한정), `afterAll` 은 `db.end()` 만 하고 생성한 레코드를 명시적으로 삭제하지 않는다. 모델 설정 라우트에 대해 이번 fix 커밋(`e5de5226c`)이 추가한 "유효 값 PATCH → 200, 이어서 빈 바디 PATCH → 값 유지" 케이스(`test/patch-null-rejection.e2e-spec.ts:267-288`)도 같은 레코드를 두 번 더 PATCH 해 상태를 변경하지만 그 자체가 테스트 대상이다.
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:42-104`(`beforeAll`), `:106-108`(`afterAll`), `:267-288`(W1 로 추가된 신규 케이스)
  - 상세: 저장소의 다른 e2e 스펙들도 동일하게 `afterAll` 에서 개별 리소스 삭제 없이 `db.end()` 만 수행하는 컨벤션을 따른다 — 이 PR 이 새로 도입한 패턴이 아니다. `BASE_URL`(`process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011'`, `:20`)도 다른 e2e 스펙과 동일한 환경변수 읽기 패턴이며 새 환경 변수를 도입하지 않는다.
  - 제안: 조치 불필요. 기존 컨벤션 확인 차 기록.

## 뮤테이션 검증

가설 확인에 저장소 파일을 고칠 필요가 없어 `Read`/`Bash(grep, git diff --name-only)` 만 사용했다. 리뷰 시작·종료 시점 모두 `git status --short` 는 이 세션 산출 디렉터리(`review/code/2026/09/27/18_13_53/`, untracked)만 보였고, `git diff --stat HEAD` 는 빈 출력이다 — 저장소 트리를 변경하지 않았다.

## 요약

핵심 변경(신규 순수 함수형 데코레이터 `IsOptionalNonNull` + 14개 DTO 파일 43필드의 `@IsOptional()` → `@IsOptionalNonNull()` 치환, 그리고 이번 라운드에 추가된 model-configs 유효값 e2e 케이스·`endpointPath` 문서 보강)은 전역 상태·전역 변수·파일시스템·환경 변수·의도치 않은 네트워크 호출·이벤트/콜백 어디에도 관여하지 않는다. 시그니처가 바뀌는 것은 NestJS DTO 클래스 필드의 검증 데코레이터뿐이며 필드 타입 자체는 그대로다. 유일한 실질적 "부작용"은 의도된 것 — PATCH 13라우트 43필드가 `null` 입력에 대해 500/409/조용한 삭제 대신 400 `VALIDATION_ERROR` 를 반환하도록 공개 API 응답 계약이 바뀐다는 점이며, CHANGELOG 에 명시돼 있고 프런트엔드 호출부 영향은 grep 으로 0건 확인됐다. 이전 라운드(`review/code/2026/09/27/17_47_49/side_effect.md`)가 NONE 으로 판정한 내용과 이번 재검토 결과가 일치하며, 그 사이 추가된 W1(model-configs happy-path e2e)·W2(endpointPath 문서) fix 커밋도 새로운 부작용을 만들지 않는다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
