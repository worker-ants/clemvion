/**
 * `audit-action-binding-guard` 의 **형태 커버리지 fixture**.
 *
 * 라이브 소스에 형태 커버리지를 걸면 **자기반증 테스트**가 된다 — 가드가 없애려는 형태
 * (맨 `AuditAction`)가 소스에서 사라지는 것이 목표인데, 그 형태의 존재를 단언하면 목표
 * 달성이 곧 테스트 실패가 된다. 그래서 판정해야 하는 형태를 여기 **불변으로** 박아 둔다.
 *
 * 이 파일은 **파싱 대상 문자열**일 뿐 실행되지 않는다. `MODULES_DIR` 밖이라 가드의 실제
 * 스캔 범위에도 들어가지 않는다.
 */

/** 가드가 **통과**시켜야 하는 형태 — 리소스에 묶인 타입. */
export const BOUND_SOURCE = `
class A {
  private recordAudit(params: {
    workspaceId: string;
    action: AuditActionFor<typeof FOO_RESOURCE_TYPE>;
    resourceId: string;
  }): Promise<void> { return this.x.record(params); }
}
`;

/** 가드가 **잡아야** 하는 형태 1 — 맨 union. 이것이 auth-configs 에 실재했던 구멍이다. */
export const BARE_UNION_SOURCE = `
class B {
  private recordAudit(params: {
    workspaceId: string;
    action: AuditAction;
    resourceId: string;
  }): Promise<void> { return this.x.record(params); }
}
`;

/** 가드가 **잡아야** 하는 형태 2 — `action` 프로퍼티 자체가 없음. */
export const NO_ACTION_SOURCE = `
class C {
  private recordAudit(params: {
    workspaceId: string;
    resourceId: string;
  }): Promise<void> { return this.x.record(params); }
}
`;

/** 가드가 **잡아야** 하는 형태 3 — 파라미터가 positional (객체 타입이 아님). */
export const POSITIONAL_SOURCE = `
class D {
  private recordAudit(action: AuditAction, resourceId: string): Promise<void> {
    return this.x.record({ action, resourceId });
  }
}
`;

/** 가드가 **잡아야** 하는 형태 4 — 이름만 비슷한 다른 타입(`AuditActionOf`). */
export const LOOKALIKE_TYPE_SOURCE = `
class E {
  private recordAudit(params: {
    action: AuditActionOf<'foo'>;
    resourceId: string;
  }): Promise<void> { return this.x.record(params); }
}
`;

/**
 * 가드가 **잡아야** 하는 형태 5 — 화살표 함수 클래스 필드에 맨 union.
 *
 * NestJS 서비스에서 `this` 바인딩용으로 흔한 문법인데, 종전 가드는 `MethodDeclaration` 만
 * 봐서 이 형태를 **존재하지 않는 것처럼** 통과시켰다(실측: 탐지 0건). 즉 이 PR 이 막으려는
 * 결함이 문법만 바꾸면 그대로 재도입됐다.
 */
export const ARROW_FIELD_BARE_SOURCE = `
class G {
  private recordAudit = (params: {
    workspaceId: string;
    action: AuditAction;
    resourceId: string;
  }): Promise<void> => this.x.record(params);
}
`;

/** 화살표 필드라도 **묶여 있으면** 통과해야 한다 (형태가 아니라 바인딩으로 판정). */
export const ARROW_FIELD_BOUND_SOURCE = `
class H {
  private recordAudit = (params: {
    action: AuditActionFor<typeof FOO_RESOURCE_TYPE>;
    resourceId: string;
  }): Promise<void> => this.x.record(params);
}
`;

/** 가드가 **무시**해야 하는 형태 — 이름이 다른 메서드. */
export const UNRELATED_METHOD_SOURCE = `
class F {
  private logSomething(params: { action: AuditAction }): void {}
}
`;
