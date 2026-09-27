# 보안(Security) 코드 리뷰 — patch-null-validation (3R)

## 컨텍스트

이 diff 는 `origin/main` 대비 전체 브랜치 diff로, 핵심 변경(`codebase/backend`, 19개 파일, +547/-47) 은
1R(`review/code/2026/09/27/17_47_49`)·2R(`review/code/2026/09/27/18_13_53`) 에서 이미 보안 검토를 마쳤다.
이번 3R 에서 새로 추가된 커밋은 `634297632`(JSDoc 한 단락 추가 — 응답측 `response-contract.ts` 와의 계층 구분 설명)와
`27191021c`(plan/tracker 문서 갱신 + consistency-check 산출물)뿐이며, 둘 다 `codebase/**` 를 건드리지 않는다
(`git diff --stat 634297632~1 634297632`, `git diff --stat 27191021c~1 27191021c` 로 확인 — 전자는
`optional-non-null.ts` 주석 3줄 추가, 후자는 `plan/`·`review/consistency/` 문서뿐). 따라서 이번 라운드의 실제
보안 검토 대상은 1R/2R 과 동일한 코드 diff이고, 아래는 그 결론을 독립적으로 재확인한 결과다.

## 발견사항

- **[INFO]** (1R·2R 과 동일, 재확인) 이 PR 이 스스로 찾아 백로그에만 남긴 IDOR/교차 워크스페이스 참조 의심 지점 — 이번 diff 는 건드리지 않음
  - 위치: `plan/in-progress/patch-null-validation.md` "범위 밖 관찰" 절 / `plan/in-progress/spec-draft-nullable-notation-followups.md` "PATCH null 후속" 항목
  - 상세: `workflows.folderId` · `nodes.containerId`/`toolOwnerId` · assistant `llmConfigId` 등 FK 필드의 PATCH 갱신 경로가 같은 워크스페이스 소속인지 검사하지 않는 것으로 보인다는 관찰이 developer 자신에 의해 기록돼 있다(대조군인 폴더 `parentId`, 트리거 `authConfigId` 는 각각 `validateParentChange`/`assertAuthConfigInWorkspace` 로 검사). 확인되면 OWASP A01(Broken Access Control) 성격의 IDOR 이 될 수 있다. `git diff --stat origin/main...HEAD -- codebase/` 로 이번 브랜치가 실제로 건드린 19개 파일을 대조한 결과 이 FK 필드들(`folderId`·`containerId`·`toolOwnerId`·`llmConfigId`·`authConfigId` 등)은 이번 diff 어디에도 포함되지 않았다 — 순수히 범위 밖이며, 이미 트래커에 "미검증·보안 성격 — 착수 전 e2e 로 재현부터" 로 등재돼 있다.
  - 제안: 이번 PR 을 막을 사유 아님. 신규 조치 불요 — 이미 트래커에 등재된 항목을 재확인한 것뿐.

- **[INFO]** (재확인) 새 NOT NULL 필드가 추가돼도 `IsOptionalNonNull()` 대신 `@IsOptional()` 을 쓰면 이번 회귀(500 노출)가 재발하는데, 이를 자동으로 잡는 정적 가드가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` 상단 docblock("새 필드는 자동으로 들어오지 않는다") — `TABLE` 은 손으로 유지되는 43필드 표
  - 상세: 이 한계는 파일 자체 주석에 이미 명시돼 있어 은폐된 문제가 아니고, 이 PR 의 스코프(기존 43필드 교정)를 벗어난 후속 개선 사안이다.
  - 제안: 조치 불요 — 문서화된 기지의 한계.

- **[INFO]** 신규 JSDoc(`634297632`)이 요청측(`IsOptionalNonNull`)과 응답측(`shared/testing/response-contract.ts` §5.4) "생략 가능·null 불가" 검증의 계층 구분을 명시적으로 문서화한 것을 확인
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:14-15`
  - 상세: 두 메커니즘이 서로 다른 계층(요청 DTO 입구 검증 vs 응답 계약 검증기)에서 독립적으로 동작함을 확인했다 — 하나가 다른 하나를 무력화하거나 우회 경로를 만들지 않는다. 순수 문서 추가로 보안적으로 중립.
  - 제안: 없음(확인용 기록).

## 점검 관점별 확인 결과

1. **인젝션**: SQL/XSS/커맨드/경로 탐색 해당 없음. 변경은 `class-validator` 데코레이터(`IsOptionalNonNull` = `ValidateIf`+`IsDefined` 합성)와 DTO 애노테이션뿐이며, `CustomValidationPipe`(`codebase/backend/src/common/pipes/validation.pipe.ts`, 이번 diff 밖·수정 없음)를 직접 열어 확인한 결과 에러 응답의 `details[].message` 는 class-validator 가 생성한 상수 템플릿 문자열(`$property` 치환)일 뿐 사용자가 보낸 원본 값이나 내부 스택트레이스를 반영하지 않는다.
2. **하드코딩된 시크릿**: 없음 — `git diff origin/main...HEAD -- codebase/ | grep -inE "(api[_-]?key|secret|password|token|bearer)\s*[:=]\s*['\"][^'\"]{6,}"` 실행 결과 매치 0건(신규 e2e 의 `apiKey: 'stub-not-used'` 는 실제 자격증명이 아닌 명시적 스텁 문자열).
3. **인증/인가**: 이번 diff 는 가드·인터셉터·권한 검사 로직을 바꾸지 않는다. 유일하게 관련된 것은 위 IDOR INFO 항목(기존에 존재하던 갭이며 이 diff 범위 밖으로 확인).
4. **입력 검증**: 이 PR 의 핵심 목적이자 개선 방향. `IsOptionalNonNull()` 은 `value !== undefined` 조건으로 `ValidateIf` 를 걸어 "생략만 스킵, null 은 `IsDefined`+타입 검증기 전체를 통과"하도록 만든다 — 소스(`optional-non-null.ts`)·유닛(`optional-non-null.spec.ts` 4케이스)·전수 표(`patch-null-rejection.spec.ts` 43필드)·e2e(`patch-null-rejection.e2e-spec.ts` 33케이스 null-거부 + 1케이스 유효값/생략 happy-path)로 전 계층에서 일관되게 검증됨을 직접 확인했다.
5. **OWASP Top 10**: A03(Injection) 해당 없음. A01(Broken Access Control) 은 위 INFO 항목(범위 밖, 이미 트래커) 외 새 이슈 없음. A05(Security Misconfiguration) 관련 없음. A04(Insecure Design) 관점에서도 "입구에서 조기 거부" 설계가 방어적이다.
6. **암호화**: 해당 변경 없음.
7. **에러 처리**: 개선 방향으로 확인됨 — 이전에는 Postgres NOT NULL 위반(23502)이 전역 예외 필터를 거쳐 500 `INTERNAL_ERROR` 로 응답했으나(DB 제약조건 내부 정보 노출 위험 존재), 이제는 DTO 입구에서 400 `VALIDATION_ERROR` + `details[].field` 로 명확하게 조기 거부한다. `details[].field` 값은 클라이언트가 보낸 요청 바디의 키 이름 그 자체이므로 추가 정보 노출이 아니다.
8. **의존성 보안**: 새 의존성 추가 없음 — 기존 `class-validator`/`class-transformer` API(`IsDefined`, `ValidateIf`) 조합만 재사용.

## 저장소 상태

이 리뷰 중 저장소 파일을 수정하지 않았다(Read/Grep/git diff 만 사용, 뮤테이션 없음). `git status --short` 는
이 세션 산출 디렉터리(`review/code/2026/09/27/18_48_42/`)만 untracked 로 보인다.

## 요약

이번 3R diff의 핵심 보안 관련 변경은 1R·2R에서 이미 검토된 것과 동일하다 — PATCH DTO 43개 필드에서 `null` 입력을 입구(DTO)에서 400 `VALIDATION_ERROR`로 조기 거부하도록 만드는 순수 입력 검증 보강이며, `CustomValidationPipe`를 직접 확인해 에러 상세에 원본 값·스택트레이스가 노출되지 않음을 재확인했다. 새로운 인젝션·인증 우회·시크릿 노출 벡터는 추가되지 않고, 오히려 처리되지 않은 예외로 인한 500 응답(잠재적 정보 노출면)을 줄이고 웹훅 `endpointPath`가 `null`로 조용히 지워지던 가용성 결함을 막는 등 보안 사후 효과가 긍정적이다. 이번 라운드에 새로 추가된 커밋(`634297632`, `27191021c`)은 `codebase/`를 건드리지 않는 문서/트래커 전용 변경으로 확인되어 신규 위험을 만들지 않는다. 유일하게 짚을 만한 것은 developer 스스로 발견해 백로그에 올린, 이 PR 범위 밖의 기존 IDOR 의심 지점(폴더/노드/어시스턴트 FK 필드의 워크스페이스 소속 미검증)이며, 이번 diff가 실제로 그 FK 필드들을 건드리지 않았음을 `git diff --stat`으로 재확인했다 — 이미 후속 트래커에 등재돼 있어 이번 병합을 막을 사유는 아니다.

## 위험도

NONE
