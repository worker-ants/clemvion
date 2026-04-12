### 발견사항

- **[WARNING]** `SlackHandler`가 `execute()` 호출마다 새 `WebClient` 인스턴스를 생성
  - 위치: `slack.handler.ts` — `execute()` 내 `const client = new WebClient(token)`
  - 상세: `@slack/web-api`의 `WebClient`는 내부적으로 `p-queue` 기반 rate-limit 큐를 보유합니다. 호출마다 새 인스턴스를 생성하면 각 실행이 독립적인 큐를 가지게 되어, 동일 token에 대한 동시 워크플로우 실행들이 Slack의 per-token rate limit을 조율 없이 동시에 소비합니다. 높은 동시성 환경에서는 `429 Too Many Requests`가 빈번해집니다.
  - 제안: token을 키로 하는 `Map<string, WebClient>` 캐시를 `IntegrationsService` 또는 핸들러 생성자 수준에서 유지하여 token 당 단일 인스턴스를 공유하세요. 단, token 갱신 시 캐시 무효화 로직이 필요합니다.

- **[WARNING]** `DatabaseQueryHandler`가 호출마다 `new PgClient()` 생성 (연결 풀링 없음)
  - 위치: `database-query.handler.ts` — `const client = new PgClient(buildPgConnection(...))`
  - 상세: 각 `execute()` 호출이 새 TCP 연결을 열고 쿼리 후 닫습니다. 다수의 워크플로우가 동시에 실행될 경우 PostgreSQL의 `max_connections` 한도를 빠르게 소진할 수 있습니다. 기존 NestJS 앱 전체의 TypeORM 연결 풀과는 별개로 동작하는 추가 연결들입니다.
  - 제안: `pg.Pool`을 `integration.id`를 키로 하는 Map에 캐싱하거나, 연결이 완료된 후 pool을 반환하는 팩토리 패턴을 사용하세요. 풀 크기는 DB 연결 한도를 고려해 제한해야 합니다.

- **[INFO]** `catch` 블록 내 `logUsage()` 오류가 원본 오류를 삼킴
  - 위치: `database-query.handler.ts:execute()`, `slack.handler.ts:execute()`, `http-request.handler.ts:execute()`
  - 상세: 아래 패턴에서 `logUsage`가 예외를 던지면 `throw err`에 도달하지 않아 원본 오류가 소실됩니다.
    ```ts
    } catch (err) {
      await this.logUsage(...);  // logUsage가 throw하면
      throw err;                 // ← 이 줄에 도달하지 않음
    }
    ```
    `logUsage` 실패 자체도 사용자에게 숨겨집니다.
  - 제안: `logUsage`를 별도의 try-catch로 감싸거나, `IntegrationHandlerBase.logUsage`가 내부에서 오류를 삼키도록 강화하세요.
    ```ts
    } catch (err) {
      await this.logUsage(...).catch(() => {}); // fire-and-forget
      throw err;
    }
    ```

- **[INFO]** `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않아 integration 검증 로직이 중복됨
  - 위치: `send-email.handler.ts` — `safeLogUsage`, integration 검증 전체가 인라인
  - 상세: `DatabaseQueryHandler`/`SlackHandler`는 `IntegrationHandlerBase.resolveIntegration()`을 사용하지만, `SendEmailHandler`는 동일한 `serviceType` 검증, `status` 검증, `logUsage` 호출을 직접 구현합니다. 동시성 버그는 아니나, 향후 `IntegrationHandlerBase`에 연결 캐싱 등 동시성 제어 로직이 추가될 때 `SendEmailHandler`만 누락될 위험이 있습니다.
  - 제안: `SendEmailHandler`도 `IntegrationHandlerBase`를 상속받아 `resolveIntegration()`을 활용하세요.

---

### 요약

변경된 코드는 전반적으로 stateless한 핸들러 설계(호출마다 로컬 변수 사용, `this`에 가변 상태 없음)를 따르고 있어 경쟁 조건이나 데드락 위험은 낮습니다. 주요 동시성 위험은 두 가지입니다: `SlackHandler`의 per-call `WebClient` 생성으로 인한 rate-limit 조율 실패, 그리고 `DatabaseQueryHandler`의 per-call `PgClient`로 인한 연결 풀 소진 가능성. 두 경우 모두 단일 워크플로우 실행에서는 무관하지만, 다수의 워크플로우가 동시에 동일 integration을 사용하는 프로덕션 환경에서는 서비스 장애로 이어질 수 있습니다.

### 위험도
**MEDIUM**