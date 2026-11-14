import { IntegrationOAuthService } from '../integration-oauth.service';
import { PendingInstallWriter } from '../pending-install-writer';

/*
 * `IntegrationOAuthService` 단위 spec 의 공용 팩토리.
 *
 * spec 은 서비스 생성자를 직접 부르지 않고 이 함수로 만든다. 생성자 인자가 바뀌면 이 파일만 고친다. 대역은 이름으로
 * 넘기고 넘기지 않은 협력 객체는 아래 기본값을 쓴다.
 *
 * - `pendingInstallWriter`: 넘긴 `dataSource` 로 만든 실제 `PendingInstallWriter`. Nest 가 주입하는 것과 같은 클래스라
 *   begin 의 설치 대기 행 쓰기를 `dataSource.transaction` 대역 그대로 시험한다.
 * - `configService` · `installNonceCache` · `workspacesService`: 없음. 생성자의 `@Optional()` 인자라 없을 때의 폴백
 *   동작(빈 oauth 설정, 재생 검사 생략, 콜백 재판정 거부)을 그대로 따른다.
 *
 * 대역 타입은 `unknown` 이다. spec 의 대역(`Record<string, jest.Mock>` 등)은 TypeORM 저장소 타입을 채우지 못하므로 그동안
 * 호출부마다 `as never` 로 넘겼다. 그 캐스트를 여기 한 곳에 모은다.
 */
export interface IntegrationOAuthServiceDeps {
  integrationRepo: unknown;
  stateRepo: unknown;
  previewRepo: unknown;
  dataSource: unknown;
  pendingInstallWriter?: unknown;
  configService?: unknown;
  installNonceCache?: unknown;
  workspacesService?: unknown;
}

export function createIntegrationOAuthService(
  deps: IntegrationOAuthServiceDeps,
): IntegrationOAuthService {
  const pendingInstallWriter =
    deps.pendingInstallWriter ??
    new PendingInstallWriter(deps.dataSource as never);
  return new IntegrationOAuthService(
    deps.integrationRepo as never,
    deps.stateRepo as never,
    deps.previewRepo as never,
    deps.dataSource as never,
    pendingInstallWriter as never,
    deps.configService as never,
    deps.installNonceCache as never,
    deps.workspacesService as never,
  );
}
