# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `@HttpCode` 데코레이터의 삽입 위치가 파일마다(또는 같은 파일 안에서도) 일관되지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:209`(=`@Post('preview-test')` 바로 다음)와 `codebase/backend/src/modules/integrations/integrations.controller.ts:525`(=`@Post(':id/rotate')` → `@Roles('editor')` → `@HttpCode`), `codebase/backend/src/modules/schedules/schedules.controller.ts:187`, `codebase/backend/src/modules/workflows/workflows.controller.ts:452`
  - 상세: 이번 PR 이 14개 라우트에 `@HttpCode(HttpStatus.OK)` 를 동일한 목적으로 추가하면서, 어떤 자리는 `@Post(...)` 바로 아래에, 어떤 자리는 `@Roles(...)` 아래에 끼워 넣었다. NestJS 데코레이터 순서가 기능에 영향을 주지는 않지만(선례: `knowledge-base.controller.ts` 안에서도 `@Post → @HttpCode → @Roles` 와 `@Post → @Roles → @HttpCode` 두 순서가 이미 혼재), 같은 커밋에서 14곳을 동시에 손대는 지금이 규칙을 정할 좋은 기회였다. 다음 사람이 새 라우트를 추가할 때 어느 순서를 따라야 할지 판단 기준이 없다.
  - 제안: 강제할 정도는 아니지만, `spec/conventions/` 또는 컨트롤러 작성 가이드에 "라우트를 여는 데코레이터(`@Get/@Post/...`) 바로 다음에 `@HttpCode`" 같은 한 줄 규칙을 정해 두면 이후 신규 라우트의 diff 가 더 예측 가능해진다.

- **[INFO]** `ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)` 호출이 동일한 인자 조합으로 두 곳에 중복돼 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:96-101`(`wrapperResponseStatuses`)과 같은 파일 `290-295`(`scanHttpStatusAdvertised`)
  - 상세: 두 함수 모두 파일을 읽어 TS AST 로 파싱하는 동일한 4줄짜리 준비 코드를 반복한다. 지금은 옵션이 고정값이라 문제가 드러나지 않지만, 나중에 `ts.ScriptKind` 지정이나 인코딩 처리가 필요해지면 두 자리를 함께 고쳐야 한다는 사실을 놓치기 쉽다.
  - 제안: `parseSourceFile(file: string): ts.SourceFile` 같은 사설 헬퍼로 추출해 한 곳에서만 옵션을 관리.

- **[INFO]** `judgeHandler` 함수가 "데코레이터 분류 → 실제 코드 결정 → 위반 판정" 세 단계를 한 함수 안에서 처리해 길이(약 65줄)와 분기(6-way if/else-if 체인 + 이후 조건 2개)가 다소 크다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:201-266`
  - 상세: `statusOf`/`apiResponseStatus`/`isSuccess` 로 세부 로직은 이미 잘 추출돼 있어 당장 읽기 어렵지는 않지만, 데코레이터 순회 루프(`for (const d of ts.getDecorators(method) ?? [])`)와 이후의 "unresolved 여부 → Nest 기본값 계산 → violation 조립" 로직이 한 함수에 섞여 있어 두 책임(사실 수집 vs 판정)이 분리돼 있지 않다.
  - 제안: 데코레이터 순회로 `{ verb, httpCode, excluded, advertised, unresolved }` 형태의 중간 구조체를 만드는 부분과, 그 구조체로부터 violation 을 계산하는 부분을 별도 함수로 나누면 각 함수의 책임이 한 문장으로 설명 가능해진다. 지금 구조로도 동작·가독성에 문제는 없어 필수는 아니다.

- **[INFO]** `swaggerResponseStatuses()`가 `@nestjs/swagger` 의 비공개(미-export) 메타데이터 키 문자열 `'swagger/apiResponse'`(`http-status-advertised-guard.ts:37`)에 의존한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:37`, 사용처 `:72`
  - 상세: 패키지 내부 구현에 의존하는 리플렉션 트릭(익명 `Probe` 클래스에 데코레이터 팩토리를 직접 적용해 메타데이터를 읽는 방식)이라 라이브러리 업그레이드로 키가 바뀌면 조용히 빈 표가 될 위험이 있다. 다만 이는 주석에 명시적으로 설계 이유가 남아 있고, 형제 spec 파일(`http-status-advertised.spec.ts` `swaggerStatuses.size > 40` 단언)이 이 표가 비었을 때 즉시 실패하도록 vacuity guard 를 두고 있어 위험이 이미 완화돼 있다. 새로 이 파일을 읽는 사람이 "왜 문자열 상수를 손으로 적었나"를 이해하는 데 시간이 걸릴 수 있다는 점만 남는다.
  - 제안: 현재 수준의 문서화 + 테스트로 충분하다고 판단되며 추가 조치는 불필요. 참고로만 기록.

## 요약

이번 변경은 14개 라우트에 대한 `@HttpCode(HttpStatus.OK)` 데코레이터 추가(기계적·저위험), 초대 취소 라우트의 응답 데코레이터 교체(`ApiNoContentResponse` → `ApiOkWrappedResponse(OkResultDto)`, 이미 다른 4개 라우트가 쓰는 동일 DTO 재사용으로 일관성 양호), 그리고 이를 지키는 신규 정적 가드(`http-status-advertised-guard.ts` + spec + 대조군 fixture)와 e2e 보강, 약 20개 e2e 파일의 `expect([200, 201]).toContain(...)` → `expect(...).toBe(200)` 단순화로 구성된다. 신규 가드 코드는 기존 `repo-guards/__tests__/*-guard.ts` + `*.spec.ts` + `fixtures/<name>/` 3분할 컨벤션을 그대로 따르고, 헬퍼(`decoratorCallName`, `toPosixRelative`)도 기존 공용 유틸을 재사용해 중복을 만들지 않았다. 함수·변수 네이밍이 목적을 명확히 드러내고(`swaggerResponseStatuses`, `wrapperResponseStatuses`, `judgeHandler`, `HttpStatusViolation`/`HttpStatusUnresolved`), 설계 근거(왜 표를 손으로 안 쓰는지, 왜 `@Res()` 를 면제하지 않는지)를 코드·spec 헤더 주석에 남겨 다음 사람이 판단을 재현할 수 있게 해 둔 점이 특히 좋다. e2e 파일들의 상태 코드 단언 완화는 이전의 이중 수용(`[200, 201]`)이 만들던 모호함을 제거하는 방향이라 중복이 아니라 의도적 정리다. 위에서 지적한 항목들은 모두 INFO 수준의 사소한 스타일·DRY 개선 여지이며 병합을 막을 이유는 없다.

## 위험도
LOW
