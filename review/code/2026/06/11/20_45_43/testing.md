# Testing Review

## 발견사항

### **[INFO]** 회귀 테스트가 실제 버그를 명확히 재현
- 위치: `model-config.controller.spec.ts` L162–188 `ListModelConfigsQueryDto whitelist` describe 블록
- 상세: `CustomValidationPipe`를 직접 인스턴스화해 실제 파이프 동작을 검증하는 회귀 테스트를 추가했다. `whitelist+forbidNonWhitelisted`가 `kind`를 거부했던 원래 버그를 구체적으로 재현하며, 수정 후에는 통과함을 확인할 수 있다. 테스트 코드 상단에 이유를 상세히 주석으로 설명한 점도 가독성 면에서 우수하다.
- 제안: 현 수준으로 충분.

### **[INFO]** `findAll / parseKind` 테스트 시그니처가 컨트롤러 변경에 정확히 대응
- 위치: `model-config.controller.spec.ts` L107–159
- 상세: `@Query('kind') kind` → `@Query() query: ListModelConfigsQueryDto` 변경에 맞춰 기존 4개 케이스를 모두 수정했다. 각 케이스는 `query` 객체 내에 `kind`를 포함시키는 올바른 형태로 업데이트되었다.
- 제안: 현 수준으로 충분.

### **[WARNING]** `pipe.transform` 호출 시 `metadata` 객체가 `describe` 블록 스코프에 `const`로 선언됨 — 테스트 간 공유 상태 위험
- 위치: `model-config.controller.spec.ts` L168–172
  ```ts
  const pipe = new CustomValidationPipe();
  const metadata = {
    type: 'query' as const,
    metatype: ListModelConfigsQueryDto,
  };
  ```
- 상세: `pipe`와 `metadata`가 `beforeEach` 밖 `describe` 블록 최상단에 선언되어 두 테스트 간에 공유된다. `CustomValidationPipe`는 상태를 갖지 않고 `metadata`도 리터럴 객체이므로 현재는 문제가 없다. 그러나 만약 향후 `pipe`에 캐시/상태가 추가되거나 `metadata`가 테스트 내부에서 돌연변이 된다면 격리가 깨질 수 있다.
- 제안: 큰 위험은 아니나, `beforeEach`에서 새 인스턴스를 생성하거나 각 `it` 블록에서 로컬로 선언하면 완전한 격리를 보장할 수 있다.

### **[WARNING]** `pipe.transform` 결과 타입 검증이 부분적 — `page`·`sort`·`order` 필드 미검증
- 위치: `model-config.controller.spec.ts` L174–181
  ```ts
  const result = (await pipe.transform(
    { kind: 'chat', limit: '100' },
    metadata,
  )) as ListModelConfigsQueryDto;
  expect(result.kind).toBe('chat');
  expect(result.limit).toBe(100);
  ```
- 상세: `@Type(() => Number)` 변환이 `limit: '100'` → `100`으로 올바르게 변환됨은 검증하지만, `page` 미제공 시 기본값(`1`) 적용, `sort`/`order` 기본값 적용, `kind`에 숫자가 들어왔을 때 `@IsString`으로 거부되는 케이스는 커버되지 않는다.
- 제안: 선택적 추가 케이스 예시:
  - `page` 없이 전달 시 `result.page === 1` 확인
  - `kind: 123` (숫자) 전달 시 validation 실패 확인
  - `kind: ''`(빈 문자열) 전달 시 `parseKind`가 BadRequestException을 던지는지 확인 (`@IsString`은 통과하지만 `parseKind`에서 걸리는 케이스)

### **[WARNING]** `kind=''` (빈 문자열) 엣지 케이스 미테스트
- 위치: `model-config.controller.spec.ts` `findAll / parseKind` describe 블록
- 상세: 현재 `undefined`(L251)와 유효하지 않은 문자열(`'unknown'`, L257)에 대한 테스트는 있다. 그러나 빈 문자열 `kind=''`는 `@IsString`을 통과하고 `parseKind` 내 `!kind` 조건도 통과하지만(`'' → falsy`이므로 `BadRequestException`을 던진다), 이 경로가 명시적으로 테스트되지 않는다. 향후 `@IsNotEmpty()`를 추가하거나 DTO 동작을 변경할 때 이 케이스가 무언가를 깨뜨릴 수 있다.
- 제안:
  ```ts
  it('throws BadRequestException when kind is empty string', async () => {
    await expect(
      controller.findAll('ws-1', { kind: '', page: 1, limit: 20 } as any),
    ).rejects.toThrow(BadRequestException);
  });
  ```

### **[INFO]** 프론트엔드 `modelConfigsApi.list()` — `limit: 9999` → `limit: 100` 변경에 대한 직접 단위 테스트 없음
- 위치: `codebase/frontend/src/lib/api/model-configs.ts` L809
- 상세: 프론트엔드 측 `list()` 함수는 직접적인 단위 테스트가 없다. 이 변경은 API 레이어에서 `params`만 수정하는 것이므로 통합 테스트(e2e) 없이 단위 수준에서는 검증이 안 된다. `modelConfigsApi.list()`를 호출하는 컴포넌트/훅 테스트들(`use-default-embedding-model-config-id.test.tsx`, `model-config-manager.test.tsx` 등)은 모두 `vi.mock`으로 API를 전체 교체하므로 실제 파라미터 값이 `100`인지 확인하지 않는다.
- 제안: `list()` 함수에 대해 `apiClient.get`을 spy해 `params.limit === 100`임을 확인하는 단위 테스트 추가를 권장한다. 중요도가 낮을 수 있으나 주석에서 `@Max(100)` 제약을 이유로 명시적으로 `100`을 선택한 만큼, 미래에 누군가 다시 올리는 것을 방어하기 위한 테스트 가치가 있다.

### **[INFO]** e2e 테스트에 `GET /model-configs?kind=` 엔드포인트 커버 없음
- 위치: `codebase/backend/test/` 디렉토리
- 상세: 백엔드 e2e 테스트 파일 중 `model-config`를 직접 다루는 파일이 없다. 이번 버그(`kind` 파라미터가 `whitelist+forbidNonWhitelisted`에 의해 400으로 거부)는 컨트롤러 단위 테스트로 어느 정도 커버되었지만, 실제 NestJS 앱에서 전역 파이프가 바인딩된 상태의 엔드투엔드 HTTP 레벨 테스트는 부재하다. 기존 회귀가 e2e 없이 지나쳤던 점이 이를 방증한다.
- 제안: `test/model-configs.e2e-spec.ts` 를 신규 생성해 최소한 `GET /model-configs?kind=chat`이 200을, `GET /model-configs`(kind 없음)이 400을 반환하는지 검증하면 이와 동일한 유형의 회귀를 방지할 수 있다.

### **[INFO]** `CustomValidationPipe` 테스트가 whitelist 동작을 직접 검증하는 것의 Mock 적절성
- 위치: `model-config.controller.spec.ts` L167–188
- 상세: 이 회귀 테스트는 실제 `CustomValidationPipe` 인스턴스를 사용해 mock 없이 진짜 class-validator 동작을 테스트한다. 이는 테스트 의도에 완벽히 부합하는 올바른 선택이다. 파이프가 실제로 `whitelist+forbidNonWhitelisted`를 적용하는지 확인하기 위해 mock을 사용하면 의미가 없다.
- 제안: 현 수준 유지.

## 요약

이번 변경은 `PaginationQueryDto`에 없던 `kind` 쿼리 파라미터가 전역 ValidationPipe의 `whitelist+forbidNonWhitelisted`에 의해 HTTP 400으로 거부되던 버그를 수정한다. 테스트는 충실하며, 회귀 방지를 위한 `ListModelConfigsQueryDto whitelist` describe 블록은 실제 파이프 동작을 직접 검증해 신뢰도가 높다. 기존 `findAll / parseKind` 케이스도 새 시그니처에 맞게 빠짐없이 수정되었다. 다만 `kind=''`(빈 문자열) 엣지 케이스, `page`/`sort` 기본값 검증 부재, 프론트엔드 `list()` `limit` 값의 미검증, 백엔드 e2e 테스트 부재라는 커버리지 갭이 존재한다. 전체적으로 단위 테스트 품질은 양호하나 e2e 계층의 부재가 같은 유형의 회귀를 다시 허용할 수 있는 구조적 약점이다.

## 위험도

LOW
