# 보안(Security) 코드 리뷰 — patch-null-validation (2R, 18_13_53)

## 개요

`@IsOptional()` 이 `null` 도 "값 없음"으로 취급해 PATCH 엔드포인트가 `null` 을 그대로 엔티티에 병합, 저장 시 Postgres NOT NULL 위반(500) · 노드 라벨 중복 오검(409) · 웹훅 수신 경로 조용한 삭제(200)를 유발하던 결함을 공용 데코레이터 `IsOptionalNonNull()`(`ValidateIf(v !== undefined)` + `IsDefined`)로 43개 필드(14개 DTO, 13라우트)에서 막는 변경이다. 이번 라운드(2R)는 1R 리뷰(`review/code/2026/09/27/17_47_49/security.md`, 위험도 NONE)의 W1(모델 설정 PATCH 유효값 e2e 부재, testing)·W2(`endpointPath` null 거부 미문서화, documentation) 조치 커밋(`e5de5226c`)과 그 조치를 기록한 문서 커밋들을 추가로 포함한다. 두 조치 모두 security 관점 항목이 아니었고, 실제 반영을 직접 확인했다.

## 발견사항

- **[INFO]** 1R 이 발견해 백로그에만 남긴 IDOR/교차 워크스페이스 참조 의심 지점 — 이번 diff 는 여전히 건드리지 않음(재확인)
  - 위치: `plan/in-progress/patch-null-validation.md` "범위 밖 관찰(미검증 · 보안 성격)" 문단, 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` "PATCH null 후속" 항목("교차 워크스페이스 참조(미검증 · 보안 성격)")
  - 상세: `workflows.folderId` · `nodes.containerId`/`toolOwnerId` · assistant `llmConfigId` 의 PATCH 갱신 경로가 같은 워크스페이스 소속인지 검사하지 않는 것으로 보인다고 developer 자신이 조사 중 곁눈으로 관찰해 기록했다(대조군인 폴더 `parentId`, 트리거 `authConfigId` 는 `validateParentChange`/`assertAuthConfigInWorkspace` 로 검사). 확인되면 OWASP A01(Broken Access Control)/IDOR 에 해당할 수 있으나, 이 PR 의 diff 파일(DTO 43필드 null-거부 데코레이터)에는 포함되지 않고 재현도 되지 않았다는 점을 developer 스스로 밝혔다. 후속 트래커 항목에 "미검증 · 착수 전 e2e 로 재현부터"로 명시돼 있어 판단을 흐리지 않는다.
  - 제안: 이번 diff 를 막을 사유 아님. 이미 트래커에 있으므로 신규 조치 불요 — 다음 세션이 "이미 코드 리뷰가 봤다"는 이유로 재검토를 건너뛰지 않도록 이번 라운드에도 재기재한다.

- **[INFO]** W1 조치(모델 설정 PATCH 유효값 e2e) 반영 확인 — `codebase/backend/test/patch-null-rejection.e2e-spec.ts` 의 `모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다` 테스트가 `provider`/`name`/`defaultModel`/`defaultParams` 4필드 유효값 PATCH → 200 + 응답 일치, 이어 빈 바디 PATCH → 200 + 값 유지를 검증한다. 보안 관점에서 새 벡터는 없지만, 1R 이 지적한 "happy path 회귀 안전망 부재" 갭이 메워졌음을 확인(테스트 관점 항목이라 이 리뷰의 판정에는 영향 없음, 기록용).
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts` (267~288행 부근)

- **[INFO]** W2 조치(`endpointPath` null 거부 문서화) 반영 확인 — `update-trigger.dto.ts` 의 JSDoc 과 `@ApiPropertyOptional` description 양쪽에 "`null` 은 400 `VALIDATION_ERROR` — 경로를 유지하려면 키를 생략한다. 종전 `@IsOptional()` 은 null 을 통과시켜 웹훅 수신 경로가 200 과 함께 조용히 지워졠다"가 추가됐다. 이 필드는 예전엔 API 문서만 보고 null 을 보내면 조용히 웹훅 경로가 삭제되는(가용성/무결성 성격) 회귀가 있었던 자리라, 계약을 명시적으로 드러낸 것은 긍정적이다.
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` (JSDoc 및 Swagger description)

## 점검 관점별 확인 결과

1. **인젝션**: SQL/XSS/커맨드/경로 탐색 해당 없음 — 변경은 class-validator 데코레이터 적용과 DTO 애노테이션·JSDoc/문서 문구 추가뿐이며, 사용자 입력이 쿼리·셸·경로에 직접 삽입되는 지점이 없다.
2. **하드코딩 시크릿**: 없음 — e2e 테스트의 `apiKey: 'stub-not-used'` 는 실 자격증명이 아닌 스텁 문자열이며, 격리된 테스트 워크스페이스에서만 쓰인다. 새로 추가된 review 산출물(RESOLUTION.md 등)에도 시크릿·토큰 문자열 없음.
3. **인증/인가**: 이번 diff 자체는 인가 로직을 바꾸지 않는다(가드/인터셉터/워크스페이스 스코프 미변경). 유일하게 관련된 것은 위 IDOR INFO 항목으로, 기존 갭이며 범위 밖이다.
4. **입력 검증**: 이 PR 의 핵심 목적이자 개선점. `IsOptionalNonNull()` 은 `undefined`(키 생략)만 검증을 건너뛰고 `null` 은 `IsDefined` + 원래 타입 검증기 전체를 통과시켜 400 `VALIDATION_ERROR` 로 거부한다 — `optional-non-null.ts` 구현, `optional-non-null.spec.ts` 4개 단위 테스트, `patch-null-rejection.spec.ts` 43필드 표(전제 `toHaveLength(43)` 포함), `patch-null-rejection.e2e-spec.ts` 33케이스(+2R 유효값 케이스)로 다층 검증됨.
5. **OWASP Top 10**: A03(Injection) 해당 없음. A01(Broken Access Control) 은 위 IDOR INFO 항목 외 이번 diff 가 새로 만드는 이슈 없음(기존 갭 재확인). A05(Security Misconfiguration) 관련 없음.
6. **암호화**: 해당 변경 없음.
7. **에러 처리**: 개선 방향 유지 — 이전엔 Postgres 23502 위반이 전역 예외 필터를 거쳐 500 `INTERNAL_ERROR` 로 응답(구현에 따라 내부 제약조건 정보 노출 위험이 있었음)했으나, 이제 입구(DTO)에서 400 `VALIDATION_ERROR` + `details[].field` 로 조기 거부한다. 응답에 담기는 `field` 값은 요청자가 스스로 보낸 바디의 키 이름이므로 추가 정보 노출이 아니다.
8. **의존성 보안**: 새 의존성 추가 없음 — 기존 `class-validator`/`class-transformer` API(`IsDefined`, `ValidateIf`)만 조합해 사용.

## 저장소 상태

리뷰 중 저장소 파일을 수정하지 않았다(뮤테이션 없음, `Read`/`Grep`/직접 파일 열람만 사용). `git status --short` 는 이 리뷰 세션 디렉터리(`review/code/2026/09/27/18_13_53/`)만 untracked 로 보이며, 그 밖의 변경은 없다.

## 요약

이번 변경(43개 PATCH 필드에 대한 `IsOptionalNonNull()` 적용 + 후속 2R 조치인 모델 설정 e2e 보강과 `endpointPath` 문서화)은 새로운 인젝션·인증 우회·시크릿 노출 벡터를 추가하지 않는 순수 입력 검증 강화이며, 오히려 (a) 미처리 예외로 인한 500 응답을 줄여 잠재적 정보 노출면을 축소하고 (b) 웹훅 `endpointPath` 가 null 로 조용히 지워지던 가용성/무결성 결함을 막는다. 1R 이 발견한 W1(테스트)·W2(문서화) 항목은 이번 diff 에서 실제로 반영된 것을 확인했다. 유일하게 짚을 만한 것은 developer 스스로 발견해 백로그에 남긴, 이 PR 범위 밖의 기존 IDOR 의심 지점(폴더/노드/어시스턴트 FK 필드의 워크스페이스 소속 미검증)이며, 이는 이미 후속 트래커에 "미검증 · 재현부터"로 등재돼 있어 이번 병합을 막을 사유가 아니다.

## 위험도

NONE
