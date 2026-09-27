# 부작용(Side Effect) 리뷰 — patch-null-validation (3R)

## 컨텍스트

이 프롬프트 번들은 브랜치 전체 diff(base 대비)로, 이미 두 차례(`review/code/2026/09/27/17_47_49` 1R, `review/code/2026/09/27/18_13_53` 2R) side-effect 리뷰가 돌아 둘 다 **위험도 NONE**으로 수렴한 코드를 포함한다. `git log`(`15a094c6a` 2R 수렴 → `e5de5226c`/`3eec5f8be`는 1R 이전) 대조 결과, 2R 이후 `codebase/`에 가해진 유일한 변경은 커밋 `634297632`(`codebase/backend/src/common/utils/optional-non-null.ts`에 JSDoc 3줄 추가, 동작 변경 없음)뿐이고 `27191021c`는 plan/tracker 문서만 건드린다. 따라서 이번 라운드의 실질 검토 대상은 "새로 생긴 부작용이 있는가"이며, 답은 없다 — 아래는 그 확인 결과와 기존 2회 리뷰 결론의 재확인이다.

## 발견사항

- **[INFO]** PATCH 43필드의 `@IsOptional()` → `@IsOptionalNonNull()` 치환은 공개 REST API(PATCH 21라우트)의 관측 가능한 응답 계약을 바꾼다 — `null` 전송 시 이전엔 500(NOT NULL 위반)·엉뚱한 409(노드 `label`)·조용한 값 삭제(200, 트리거 `endpointPath`)였던 것이 전부 `400 VALIDATION_ERROR`로 바뀐다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:17-32`(데코레이터 본체), `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:69`(`endpointPath`), 그 외 파일 4~18 전체의 `@IsOptionalNonNull()` 적용 지점
  - 상세: 이것은 이 PR 의 의도된 수정 자체이며 `CHANGELOG.md:26-35`에 사용자 대상으로 명시돼 있다. 다만 이 DTO들은 공개 REST 표면이므로, 문서화되지 않은 외부 API 클라이언트가 이 43필드에 우연히 `null`을 보내 500/409/200을 받던 경우가 있었다면 응답 코드·바디 형태가 달라진다는 점은 "부작용" 관점에서 사실이다 — 실패 자체는 계속되므로 파괴적은 아니다. `codebase/backend/test/patch-null-rejection.e2e-spec.ts`와 `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts`가 이 43필드 전수를 고정한다.
  - 제안: 추가 조치 불필요 — CHANGELOG 공지가 이미 있고 버그 수정의 자연스러운 결과다. 1R/2R side_effect 리뷰(`review/code/2026/09/27/17_47_49/side_effect.md`, `.../18_13_53/side_effect.md`)와 같은 결론.

- **[INFO]** `IsOptionalNonNull` 자체는 전역 상태·환경 변수·파일시스템·네트워크·이벤트/콜백 어디에도 관여하지 않는 순수 데코레이터 팩토리다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:17-32`
  - 상세: 함수는 `class-validator`의 `ValidateIf`/`IsDefined`를 호출해 대상 프로퍼티에 검증 메타데이터를 등록할 뿐이다(이것이 프로퍼티 데코레이터의 정상 동작이지 "의도치 않은" 부작용이 아니다). 모듈 스코프에 새 전역 변수·싱글턴·캐시가 없고, `process.env` 읽기/쓰기 없고, 파일 I/O·HTTP 호출 없다. 각 DTO 필드의 TS 타입(`field?: T`)도 그대로라 시그니처(타입) 자체는 바뀌지 않았다 — 바뀐 것은 런타임 검증 동작뿐이다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 e2e(`patch-null-rejection.e2e-spec.ts`)는 `beforeAll`에서 폴더·워크플로·노드·인증설정·트리거·알림규칙·테스트데이터셋·스케줄·모델설정·어시스턴트세션 등 다수의 실제 DB 레코드를 생성하고(`:57-104`), `afterAll`(`:106-108`)은 `db.end()`만 하고 명시적 삭제를 하지 않는다.
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:42-108`
  - 상세: 이 저장소의 다른 e2e 스펙들도 동일하게 `afterAll`에서 `db.end()`만 수행하는 것이 기존 컨벤션이며(1R side_effect 리뷰가 이미 대조 확인함), 이번 PR 이 새로 도입한 패턴이 아니다. `it.each(cases)`(`:246-263`)는 전부 `null` 전송 → 400 거부만 확인해 실제 상태 변경이 일어나지 않으므로 케이스 간 side effect 전파도 없다. 유일하게 상태를 실제로 바꾸는 것은 마지막 단일 테스트(`:267-288`, 모델 설정 PATCH 유효 값)뿐이고, 그 뒤 빈 바디 PATCH로 값 유지를 확인하는 것도 같은 레코드 안에서 끝난다.
  - 제안: 조치 불필요 — 기존 컨벤션 준수 확인 차 기록.

- **[INFO]** `settings.maxConcurrentExecutions`(`WorkflowSettingsDto`/`UpdateWorkspaceSettingsDto`)는 이번 스윕에서 의도적으로 제외되어 여전히 `@IsOptional()`이다 — 이 diff가 만들지 않은 기존 갭이지만, "43필드가 전부"라는 인상과 달리 인접한 nullable 취급 필드가 하나 남아 있다는 점을 부작용 관점에서도 재확인해 둔다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 "PATCH null 후속" JSONB 항목), `review/consistency/2026/09/27/18_23_40/SUMMARY.md` WARNING #2
  - 상세: 이 필드에 `null`을 보내면 여전히 검증을 통과해 하위 로직까지 도달한다(에러 0건, 실측은 consistency checker가 이미 수행). 이번 diff 범위 밖이고 이미 트래커에 등재돼 있어 새로운 발견은 아니다.
  - 제안: 조치 불필요(이미 트래커에 있음). 후속 PR에서 `IsOptionalNonNull` 전환 여부를 결정.

## 뮤테이션 검증

가설 확인에 저장소 파일 수정이 필요하지 않았다 — `Read`(`optional-non-null.ts`, `update-trigger.dto.ts`, `patch-null-rejection.e2e-spec.ts` 전체 파일 컨텍스트)와 `git show 634297632`/`git show 27191021c`로 2R 이후 델타가 JSDoc-only/문서-only임을 직접 확인했다. `git status --short` 결과는 이 세션 디렉터리(`review/code/2026/09/27/18_48_42/`) untracked 하나뿐 — 워크트리에 아무것도 쓰지 않았다.

## 요약

2R(`review/code/2026/09/27/18_13_53`)이 Critical 0·Warning 0·`codebase/` 수정 0건으로 수렴한 뒤, 이번 3R 대상 델타는 `optional-non-null.ts`에 동작 없는 JSDoc 3줄(커밋 `634297632`)과 plan/tracker 문서 갱신(`27191021c`)뿐이라 새로운 부작용 표면은 없다. 누적 diff 전체를 다시 훑어도 핵심 변경(`IsOptionalNonNull` 데코레이터 + 14개 모듈 43필드의 검증기 교체)은 전역 상태·환경 변수·파일시스템·네트워크·이벤트/콜백 어디에도 관여하지 않는 순수 검증 로직이며, 유일한 실질적 "부작용"은 의도되고 CHANGELOG에 공지된 것 — PATCH 43필드가 `null` 입력에 대해 500/409/조용한 데이터 삭제 대신 400 `VALIDATION_ERROR`를 반환하도록 공개 API 응답 계약이 바뀐다는 점이다. e2e 신규 테스트의 DB 레코드 미정리는 기존 컨벤션과 동일하고, `maxConcurrentExecutions` 제외는 이미 트래커에 등재된 기존 갭이다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
