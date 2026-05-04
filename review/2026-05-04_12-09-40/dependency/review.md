### 발견사항

- **[INFO]** 신규 외부 의존성 없음
  - 위치: `package.json` (frontend/backend)
  - 상세: 이번 변경에서 새로 추가된 npm 패키지가 없음. `lucide-react`의 `ArrowRightLeft` 아이콘은 이미 번들에 포함된 라이브러리에서 트리쉐이킹으로 가져오므로 사이즈 영향 없음.
  - 제안: 없음

- **[INFO]** `RolesGuard` 전역 등록으로 내부 의존 관계 단순화
  - 위치: `app.module.ts` +203, `workspaces.module.ts`
  - 상세: 기존에는 `WorkspacesModule`이 `RolesGuard`를 `providers`/`exports`에 포함하고, 각 컨트롤러가 `@UseGuards(RolesGuard)`로 개별 등록했음. 이제 `AppModule`의 `APP_GUARD`에만 등록됨. `WorkspacesModule`이 `@Global()`로 선언되어 있고 `WorkspacesService`를 export하므로 `RolesGuard`의 DI는 문제 없이 해결됨. 가드 실행 순서(Throttler → JwtAuth → Roles)는 배열 선언 순서대로 보장됨.
  - 제안: 없음

- **[WARNING]** `transferOwnership` 엔드포인트에 `@Roles` 데코레이터 부재
  - 위치: `workspaces.controller.ts`, `@Post(':id/transfer-ownership')`
  - 상세: 이 프로젝트의 워크스페이스 컨트롤러는 `rename`/`remove`/`leave` 등 모든 민감 엔드포인트가 service-level assertion을 쓰는 일관된 패턴을 채택하고 있음. `transferOwnership` 서비스도 `requesterMembership.role !== 'owner'`를 트랜잭션 내에서 체크한다. 그러나 가드 레벨 선언 없이 서비스 레이어에만 의존하는 구조는 Swagger 문서에 권한 요건이 드러나지 않고, 가드를 통과한 뒤 DB 조회를 한 번 더 거쳐야 거부됨.
  - 제안: `@Roles('owner')` 데코레이터를 메서드에 추가하거나, 워크스페이스 컨트롤러 전체에 대해 현재 service-level assertion 패턴을 유지한다는 결정을 주석 또는 CLAUDE.md에 명시적으로 문서화.

- **[INFO]** 테스트 픽스처에서 `WorkspacesService` mock 제거
  - 위치: `workflows.controller.spec.ts` -WorkspacesService mock
  - 상세: `RolesGuard`가 전역 `APP_GUARD`로 이동하면서 컨트롤러 단위 테스트에서는 가드가 적용되지 않으므로 `WorkspacesService` mock이 더 이상 불필요. 올바른 정리.
  - 제안: 없음

---

### 요약

이번 변경은 신규 외부 패키지를 전혀 추가하지 않았으며, 내부 의존 관계는 `RolesGuard`의 전역 등록으로 오히려 정리되었다. `WorkspacesModule`에서 `RolesGuard` provider/export를 제거한 것도 전역 `APP_GUARD` 등록과 일관성 있는 결정이다. 유일한 주의점은 `transferOwnership` 엔드포인트가 서비스 레이어 외에 가드 레이어 선언이 없다는 점인데, 이는 기존 워크스페이스 컨트롤러의 일관된 패턴이므로 기술적 결함이라기보다 문서화 공백에 가깝다.

### 위험도

**LOW**