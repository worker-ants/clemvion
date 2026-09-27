# 보안(Security) 코드 리뷰 — patch-null-validation

## 개요

`@IsOptional()` 이 `null` 도 "값 없음"으로 취급해 PATCH 엔드포인트가 `null` 을 그대로 엔티티에
병합, 저장 시 Postgres NOT NULL 위반(500) · 라벨 중복 오검(409) · 웹훅 경로 조용한 삭제(200) 를
유발하던 결함을 공용 데코레이터 `IsOptionalNonNull()`(`ValidateIf(v !== undefined)` +
`IsDefined`) 로 43개 필드에서 막는 변경이다. 보안 관점에서는 **입력 검증 강화 + 정보 노출 축소
(500 → 통제된 400) + 가용성 결함(웹훅 경로 조용한 삭제) 수정**으로, 새로운 공격 표면을 추가하지
않는다.

## 발견사항

- **[INFO]** 이 PR 이 스스로 찾아 백로그에만 남긴 IDOR/교차 워크스페이스 참조 의심 지점 — 이번 diff 는 건드리지 않음
  - 위치: `plan/in-progress/patch-null-validation.md:84` ("범위 밖 관찰(미검증 · 보안 성격)")
  - 상세: 조사 중 `workflows.folderId` · `nodes.containerId`/`toolOwnerId` · assistant `llmConfigId` 의 PATCH 갱신 경로가 **같은 워크스페이스 소속인지 검사하지 않는 것으로 보인다**(대조군인 폴더 `parentId`, 트리거 `authConfigId` 는 `validateParentChange`/`assertAuthConfigInWorkspace` 로 검사)고 developer 자신이 명시했다. 확인되면 다른 워크스페이스 소유 리소스를 FK 로 가리키게 하는 접근통제 우회(IDOR) 로, OWASP Top 10 A01(Broken Access Control) 에 해당할 수 있다. 이 PR 의 diff 파일(DTO 43필드)에는 포함되지 않았고 재현도 안 됐다는 점을 developer 스스로 밝혔다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "PATCH null 후속" 항목에 등재돼 있으므로 신규 조치는 불요. 다만 이 항목이 해소되지 않은 채 병합되므로, 본 리뷰에서도 존재를 명시해 다음 세션이 "코드 리뷰가 이미 봤다"는 이유로 재검토를 건너뛰지 않게 한다.

- **[INFO]** 새 NOT NULL 필드가 추가돼도 `IsOptionalNonNull()` 대신 `@IsOptional()` 을 쓰면 이번 회귀가 재발하는데, 이를 자동으로 잡는 가드가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:28`("새 필드는 자동으로 들어오지 않는다") 및 `plan/in-progress/patch-null-validation.md:91`
  - 상세: 43필드 표는 DTO 단위 테스트가 하드코딩한 목록이라, 향후 PATCH DTO 에 NOT NULL 컬럼용 필드를 추가하며 실수로 `@IsOptional()` 을 쓰면 같은 종류의 500(및 잠재적 스택트레이스/에러 상세 노출) 이 조용히 재발해도 이 테스트가 잡지 못한다. developer 도 한계로 명시.
  - 제안: 신규 조치 불요(문서화된 한계). 다만 리뷰 관점에서 "회귀 방지 자동화 갭"으로 기록.

- **[INFO]** `avatarUrl` 필드의 기존 SSRF 완화 근거는 이번 PR 에서 변경되지 않았다(참고용)
  - 위치: `codebase/backend/src/modules/users/dto/update-me.dto.ts` (전체 파일 컨텍스트 55~59행, `@IsUrl({ require_tld: false })` 주석)
  - 상세: `avatarUrl` 은 여전히 `@IsOptional()` 유지 — 클라이언트가 `<img src>` 로만 소비하고 서버가 fetch 하지 않는다는 기존 주석이 diff 밖에서 그대로 남아 있다. 이번 변경이 손대지 않은 영역이므로 회귀 아님. 확인 차 기재.

## 점검 관점별 확인 결과

1. **인젝션**: SQL/XSS/커맨드/경로 탐색 해당 없음 — 변경은 class-validator 데코레이터와 DTO 애노테이션뿐이며, 사용자 입력이 쿼리·셸·경로에 직접 삽입되는 지점이 없다.
2. **하드코딩 시크릿**: 없음 — e2e 테스트의 `apiKey: 'stub-not-used'` 는 실제 자격증명이 아닌 스텁 문자열이며 워크스페이스 격리된 테스트 계정으로만 사용된다.
3. **인증/인가**: 이번 diff 자체는 인가 로직을 바꾸지 않는다. 유일하게 관련된 것은 위 IDOR INFO 항목(기존 갭, 범위 밖).
4. **입력 검증**: 이 PR 의 핵심 목적. `IsOptionalNonNull()` 은 `undefined`(생략)만 스킵하고 `null` 은 `IsDefined` + 타입 검증기 전체를 통과시켜 400 으로 거부한다 — `optional-non-null.ts:14-29`, `optional-non-null.spec.ts` 4개 테스트, `patch-null-rejection.spec.ts` 43필드 표, `patch-null-rejection.e2e-spec.ts` 33케이스로 검증됨. `ValidateIf` 조건이 `value !== undefined` 로 정확히 걸려 있어 "생략은 통과·null 은 거부"라는 의도된 분기와 일치한다(뮤턴트 M1~M4 로 실측 확인됨, plan 기재).
5. **OWASP Top 10**: A03(Injection) 해당 없음. A01(Access Control) 은 위 INFO 항목 외 새로운 이슈 없음. A05(Security Misconfiguration) 관련 없음.
6. **암호화**: 해당 변경 없음.
7. **에러 처리**: 개선 방향 — 이전에는 Postgres 23502 위반이 전역 예외 필터를 거쳐 500 `INTERNAL_ERROR` 로 응답했고(내부 DB 제약조건 정보가 필터 구현에 따라 노출될 위험이 있었음), 이제는 입구에서 400 `VALIDATION_ERROR` + `details[].field` 로 명확하게 거부한다. 응답에 포함되는 `field` 값은 클라이언트가 보낸 요청 바디의 키 이름 그 자체이므로 추가 정보 노출이 아니다.
8. **의존성 보안**: 새 의존성 추가 없음 — 기존 `class-validator`/`class-transformer` API(`IsDefined`, `ValidateIf`) 조합만 사용.

## 요약

이번 변경은 43개 PATCH 필드에서 `null` 입력을 입구(DTO)에서 400 `VALIDATION_ERROR` 로 조기 거부하도록 만드는 순수한 입력 검증 보강으로, 새로운 인젝션·인증 우회·시크릿 노출 벡터를 추가하지 않는다. 오히려 (a) 처리되지 않은 예외로 인한 500 응답을 줄여 잠재적 정보 노출면을 축소하고, (b) 웹훅 `endpointPath` 가 `null` 로 조용히 지워지던 가용성 결함을 막는 등 보안 사후 효과가 긍정적이다. 유일하게 짚을 만한 것은 developer 스스로 발견해 백로그에 올린, 이 PR 범위 밖의 기존 IDOR 의심 지점(폴더/노드/어시스턴트 FK 필드의 워크스페이스 소속 미검증)이며, 이는 이미 후속 트래커에 등재돼 있어 이번 병합을 막을 사유는 아니다.

## 위험도
NONE
