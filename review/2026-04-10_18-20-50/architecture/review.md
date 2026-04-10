### 발견사항

---

- **[CRITICAL]** 서비스 레이어에서 HTTP 응답 봉투(Response Envelope) 형식 적용
  - 위치: `integrations.service.ts:90`, `llm.service.ts:69–79`
  - 상세: 비즈니스 로직을 담당하는 서비스 레이어가 `{ data: { ... } }` HTTP 응답 포맷을 직접 반환하고 있습니다. 서비스 레이어는 도메인 객체를 반환해야 하며, 응답 형식 변환은 프레젠테이션 레이어(Controller 또는 Interceptor)의 책임입니다. 이는 레이어 책임 분리 원칙을 위반하며, 서비스가 HTTP 컨텍스트에 결합됩니다.
  - 제안: NestJS의 `TransformInterceptor`를 전역으로 적용하여 모든 응답을 일관되게 `{ data: ... }` 형식으로 변환하고, 서비스는 도메인 객체만 반환하도록 수정

```typescript
// transform.interceptor.ts (신규 생성)
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(map(data => ({ data })));
  }
}
```

---

- **[CRITICAL]** 프론트엔드의 방어적 이중 언래핑 패턴
  - 위치: `frontend/src/lib/api/llm-configs.ts:68`
  - 상세: `data?.data ?? data` 패턴은 API 응답 계약(Contract)이 불일치함을 의미하는 명확한 코드 스멜입니다. 응답 포맷이 `{ data: { ... } }` 또는 `{ ... }` 두 가지 모두 가능하다는 방어 로직을 클라이언트에 작성해야 하는 상황은 API 설계 문제를 나타냅니다.
  - 제안: 서버에서 일관된 응답 포맷을 보장(Interceptor 사용)하면 이 방어 코드가 불필요해짐

---

- **[WARNING]** 동일 서비스 내 응답 포맷 불일치
  - 위치: `integrations.service.ts`
  - 상세: `testConnection()`은 `{ data: { ... } }`를 반환하지만, 동일 서비스의 `reauthorize()`는 `{ authUrl: string; state: string }`을 직접 반환하고, `findById()`는 엔티티를 반환합니다. 같은 서비스 내에서도 응답 형식이 일관되지 않아 응집도가 낮습니다.
  - 제안: 서비스 레이어는 도메인 타입을 일관되게 반환하도록 통일

---

- **[WARNING]** Controller에서 직접 응답 봉투 적용
  - 위치: `executions.controller.ts:49`
  - 상세: `continueExecution`은 컨트롤러에서 직접 `{ data: { success: true } }`를 조립합니다. 다른 엔드포인트들은 서비스 반환값을 그대로 전달하는데, 이 메서드만 수동으로 포맷팅합니다. 포맷 변환 책임이 분산되어 있습니다.
  - 제안: Interceptor 도입 후 `return { success: true }`를 서비스에서 반환하거나, 응답 포맷 변환을 단일 지점으로 통합

---

- **[WARNING]** 비동기 fire-and-forget의 에러 전파 부재
  - 위치: `executions.controller.ts:47`
  - 상세: `continueExecution`은 `await` 없이 `this.executionEngineService.continueExecution()`을 호출하고 즉시 `{ data: { success: true } }`를 반환합니다. 실행이 실패해도 클라이언트는 성공 응답을 받으며, 에러가 어디에서도 처리되지 않으면 UnhandledPromiseRejection이 발생할 수 있습니다.
  - 제안: fire-and-forget 의도가 명확하다면 명시적으로 `.catch()` 핸들러를 추가하거나, 주석으로 의도를 문서화

```typescript
// 명시적 에러 핸들링
this.executionEngineService
  .continueExecution(id, body?.formData)
  .catch(err => this.logger.error('Continue execution failed', err));
```

---

- **[INFO]** 응답 타입 반환에 제네릭 래퍼 타입 부재
  - 위치: `llm.service.ts:69`, `integrations.service.ts:90`
  - 상세: `Promise<{ data: { success: boolean; error?: string } }>` 형식이 반복적으로 사용됩니다. 공통 래퍼 타입이 정의되지 않아 형식 정의가 중복됩니다.
  - 제안: `type ApiResponse<T> = { data: T }` 공통 타입을 정의하여 재사용 (단, Interceptor 방식으로 전환하면 자연스럽게 해결됨)

---

### 요약

이번 변경의 핵심 목적은 API 응답 형식을 `{ data: ... }` 봉투 구조로 통일하는 것이나, 이를 달성하는 방식에 근본적인 아키텍처 문제가 있습니다. 응답 포맷 변환 책임이 서비스 레이어, 컨트롤러 레이어에 분산되어 있어 레이어 책임 분리(SRP, 레이어드 아키텍처) 원칙을 위반하며, 동일 서비스 내에서도 일부 메서드만 봉투 구조를 적용하는 불일치가 발생합니다. 프론트엔드의 `data?.data ?? data` 방어 코드는 이 불일치의 직접적인 증거입니다. NestJS의 `TransformInterceptor`를 전역 적용하여 응답 변환을 단일 지점에서 처리하고, 서비스 레이어는 도메인 객체만 반환하도록 리팩터링하는 것이 올바른 아키텍처 방향입니다.

### 위험도

**HIGH**