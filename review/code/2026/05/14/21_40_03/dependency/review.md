### 발견사항

**[INFO]** `ConflictException` 신규 import — 기존 패키지 내 심볼 추가
- 위치: `integration-oauth.service.ts:1`
- 상세: `@nestjs/common` 에서 `ConflictException` 을 추가 import. 패키지 자체는 기존 의존성이므로 설치 비용 없음.
- 제안: 조치 불요.

**[INFO]** `isReauthorizeDisabled` — 내부 모듈 간 신규 익스포트 추가
- 위치: `status-badge.tsx` → `[id]/page.tsx`, `status-badge.test.tsx`
- 상세: 동일 `_shared/` 하위에서 단방향 소비. 의존 방향이 적절하며 순환 없음.
- 제안: 조치 불요.

**[INFO]** `ERROR_CLOSE_DELAY_MS` — 매직 숫자 상수 추출 및 재공유
- 위치: `oauth-callback.template.ts` → `oauth-callback.template.spec.ts`
- 상세: 동일 모듈에서 export 해 스펙이 구현과 동기화됨. 좋은 패턴.
- 제안: 조치 불요.

**[INFO]** `IntegrationMeta` 타입 삼중 정의
- 위치: `integrations.service.ts`, `integration-response.dto.ts`, `frontend/src/lib/api/integrations.ts`
- 상세: 백엔드 내 서비스 인터페이스 + DTO 응답 타입 + 프론트엔드 API 타입 세 곳에 동일 구조가 각각 정의되어 있음. 프론트/백엔드 경계 분리가 이유이므로 구조 자체는 정당하나, 필드가 늘어날 때 세 곳을 동시 갱신해야 하는 수동 동기화 부담이 있음.
- 제안: 즉각 변경 필요는 없으나, 필드가 확장될 경우 OpenAPI codegen 도입을 검토할 시점. 현재 범위에서는 허용.

**[INFO]** `useQueryClient` — React Query 훅 신규 사용
- 위치: `new/page.tsx` — `Cafe24PrivatePendingStep`
- 상세: `@tanstack/react-query` 는 이 프로젝트에 이미 설치된 의존성. `useQuery` 도 동일 컴포넌트에서 이미 사용 중이므로 추가 패키지 없음. `invalidateQueries` 호출을 위한 정상적 용법.
- 제안: 조치 불요.

---

### 요약

이번 변경에서 **신규 외부 패키지는 단 하나도 추가되지 않았다**. 모든 변경은 NestJS(`@nestjs/common`), TypeORM(`LessThan`), React Query(`useQueryClient`), React 기본 훅 등 이미 설치된 의존성의 심볼을 추가로 사용하거나, 프로젝트 내부 모듈 간 export를 새로 열어준 것에 불과하다. 내부 의존 방향은 단방향이고 순환 참조가 없으며, `IntegrationMeta` 타입의 삼중 정의는 프론트/백 경계 분리에 따른 불가피한 중복이다. 번들 크기, 라이선스, 취약점, 버전 충돌 어느 면에서도 새로운 위험은 없다.

### 위험도

**NONE**