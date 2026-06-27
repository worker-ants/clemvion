# Testing Review

## 발견사항

### [WARNING] UpdateTriggerDto — 유효한 v4 UUID 통과 케이스 부재
- 위치: `trigger-dto-validation.spec.ts` — `endpointPath — v4 UUID 강제 (W1 보안)` describe 블록 마지막 케이스
- 상세: `UpdateTriggerDto`에서 비-UUID 거부 케이스 (`endpointPath: 'webhook'` → 실패) 만 테스트하고, 유효한 v4 UUID가 통과하는지 확인하는 케이스가 없다. CreateTriggerDto 쪽은 통과/실패 대칭이 잘 잡혀 있지만 UpdateTriggerDto는 실패 케이스만 존재해 실제로 `@IsUUID('4')` 데코레이터가 UpdateTriggerDto에 적용되었는지(회귀 탐지 관점)를 충분히 검증하지 못한다.
- 제안: 아래 케이스 추가.
  ```ts
  it('UpdateTriggerDto — 유효한 v4 UUID 통과', async () => {
    const dto = plainToInstance(UpdateTriggerDto, { endpointPath: VALID_UUID });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeUndefined();
  });
  ```

### [WARNING] WorkspaceInvitationsPrunerService — upsertJobScheduler opts 미검증
- 위치: `workspace-invitations-pruner.service.spec.ts` — `onModuleInit 이 매일 04:00 Asia/Seoul repeatable scheduler 를 등록` 테스트
- 상세: 세 번째 인자(`expect.objectContaining({ name: expect.any(String) })`)에서 `removeOnComplete` / `removeOnFail` 설정을 검증하지 않는다. 이 retention 설정이 누락되거나 잘못 설정되면 Redis에 완료된 잡이 무기한 누적되어 메모리 압박을 줄 수 있다. 특히 `removeOnComplete: { age: 7 * 24 * 60 * 60 }` 같은 구체적 값이 의도적으로 선택된 설정이므로 테스트로 고정하는 것이 적절하다.
- 제안:
  ```ts
  expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
    'workspace-invitations-pruner-daily',
    expect.objectContaining({ pattern: '0 4 * * *', tz: 'Asia/Seoul' }),
    expect.objectContaining({
      name: expect.any(String),
      opts: expect.objectContaining({
        removeOnComplete: expect.objectContaining({ age: expect.any(Number) }),
        removeOnFail: expect.objectContaining({ age: expect.any(Number) }),
      }),
    }),
  );
  ```

### [INFO] v3/v5 UUID 거부 케이스 미테스트
- 위치: `trigger-dto-validation.spec.ts` — `endpointPath — v4 UUID 강제 (W1 보안)` describe 블록
- 상세: v1 UUID(시간 기반) 거부는 테스트하지만, v3(MD5 네임스페이스) / v5(SHA-1 네임스페이스) UUID 거부 케이스가 없다. `@IsUUID('4')`가 이를 거부하는 것은 라이브러리 동작이라 당연하지만, 보안 요구사항(WH-SC-01)이 명시적으로 v4 비밀성에 의존하는 맥락에서 v3/v5는 예측 가능성이 낮지 않아 명시 테스트가 문서화 가치를 갖는다.
- 제안: 아래 케이스 하나 추가.
  ```ts
  it('실패 — v5 UUID (SHA-1 기반 — v4 만 허용)', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      endpointPath: '74738ff5-5367-5958-9aee-98fffdcd1876', // version nibble = 5
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeDefined();
  });
  ```

### [INFO] non-Error 예외(문자열 throw) 처리 미테스트
- 위치: `workspace-invitations-pruner.service.spec.ts` — `에러를 swallow + 로그` 테스트
- 상세: 서비스 catch 블록에서 `err instanceof Error ? err.message : String(err)` 분기를 사용하는데, 현재 테스트는 `new Error('db down')`(Error 객체) 경로만 검증한다. `Promise.reject('raw string error')` 같은 non-Error throw 경로는 미테스트다.
- 제안: 선택적 추가 — 운영 환경에서 non-Error throw는 드물지만, 서비스 코드가 해당 분기를 명시적으로 처리하므로 커버리지 완결성 차원에서 추가를 권장한다.

### [INFO] e2e — 비-UUID endpointPath 거부 케이스 부재
- 위치: `webhook-trigger.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`
- 상세: W1 보안 변경(DTO `@IsUUID('4')` 강제)이 단위 테스트에서 충분히 커버되지만, e2e 레벨에서 `endpointPath: 'my-integration'`을 POST /api/triggers에 보낼 때 400이 반환되는지 확인하는 케이스가 없다. 단위 테스트가 ValidationPipe 스택 바깥(실제 NestJS 미들웨어 파이프)까지 완전히 검증하지 못하는 점을 보완할 수 있다.
- 제안: `webhook-trigger.e2e-spec.ts` 또는 별도 파일에 아래 케이스 추가.
  ```ts
  it('W1 — 비-UUID endpointPath → 400 VALIDATION_ERROR', async () => {
    const res = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ workflowId, type: 'webhook', name: 'bad-path', endpointPath: 'my-integration' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  ```

### [INFO] webhook-trigger.e2e-spec.ts 테스트 B — 비-UUID 경로 사용
- 위치: `webhook-trigger.e2e-spec.ts` line ~ `'no-such-path-xyz'`
- 상세: 존재하지 않는 경로에 대한 404 테스트가 `'no-such-path-xyz'`(비-UUID)를 사용한다. 트리거 생성 DTO가 UUID 형식을 강제해도 webhook 수신 라우팅(`/api/hooks/:endpointPath`)이 경로 형식을 검증하지 않는다면 이 테스트는 여전히 유효하다. 다만 일관성 차원에서 `crypto.randomUUID()`(DB에 없는 UUID)를 사용하는 것이 더 명확하다.
- 제안: `const res = await request(BASE_URL).post('/api/hooks/' + crypto.randomUUID()).send({});` 로 변경. 실제 동작은 동일하나 테스트 의도가 더 명확해진다.

### [INFO] logger private 접근 — any 캐스트 패턴
- 위치: `workspace-invitations-pruner.service.spec.ts` — `(service as any).logger`
- 상세: `private` 멤버에 `any` 캐스트로 접근하는 흔한 NestJS 테스트 패턴이지만, 서비스 리팩터링 시 멤버명이 바뀌어도 컴파일 오류가 발생하지 않아 테스트가 조용히 깨질 수 있다. 치명적이지 않으나 인지할 필요 있다.
- 제안: 개선이 필요하다면 `logger`를 `protected`로 바꾸고 테스트용 하위 클래스에서 접근하거나, NestJS Logger를 DI로 주입해 mock 교체하는 방식으로 전환한다. 현재 코드베이스 패턴이 이미 `any` 캐스트라면 일관성 유지로 허용 가능하다.

---

## 요약

이번 변경의 테스트 품질은 전반적으로 양호하다. `endpointPath` UUID 강제(W1 보안)에 대한 단위 테스트(`trigger-dto-validation.spec.ts`)는 유효한 v4 UUID 통과, 옵셔널 미설정 통과, 비-UUID 경로 거부, v1 UUID 거부 등 핵심 케이스를 잘 커버한다. `WorkspaceInvitationsPrunerService` 단위 테스트도 스케줄러 등록, 위임 흐름, 로그 분기(0건 vs 1건+), 에러 swallow 동작을 모두 테스트한다. e2e 파일들은 `crypto.randomUUID()` 로의 전환이 기존 커버리지를 해치지 않으면서 DTO 변경과 일관성을 맞춘다. 개선 포인트로는 UpdateTriggerDto의 통과 케이스 부재(WARNING), upsertJobScheduler opts 미검증(WARNING), e2e에서 비-UUID 경로 거부 케이스 부재(INFO) 등이 있으나, 핵심 보안 변경의 검증 자체는 충분하다.

## 위험도

LOW
