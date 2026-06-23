# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] 기존 /api/triggers 엔드포인트 재사용 — 하위 호환성 유지
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` — `useWebChatInstances`, `useCreateWebChat`
- 상세: 웹채팅 기능이 신규 백엔드 엔드포인트 없이 기존 `GET /triggers` 및 `POST /triggers`를 재사용한다. 기존 클라이언트 코드에 영향을 주지 않으며 하위 호환성이 완전히 유지된다. 서버 계약 변경이 없다.
- 제안: 해당 없음.

### [INFO] `POST /triggers` 요청 바디 — `interaction` 필드 위치 주의
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` L2373-2378
- 상세: `useCreateWebChat` 의 `mutationFn` 은 `POST /triggers` 에 다음 바디를 전송한다.
  ```
  {
    type: "webhook",
    workflowId: ...,
    name: ...,
    endpointPath: crypto.randomUUID(),
    interaction: { enabled: true, tokenStrategy: "per_execution" }
  }
  ```
  기존 트리거 API 스키마에서 `interaction` 이 최상위 필드인지, 아니면 `config.interaction` 으로 중첩되어야 하는지 확인이 필요하다. `TriggerListItem` 타입 정의(`use-web-chat.ts` L2183-2193)에서 응답 측은 `config.interaction.enabled` 구조인데, 요청 바디에서는 `interaction` 이 `config` 없이 최상위에 위치한다. 서버가 두 형식을 모두 수용하거나 변환한다면 문제 없지만, 서버 스키마가 `config: { interaction: {...} }` 를 요구한다면 API 계약 불일치다.
- 제안: 백엔드 `POST /triggers` 스키마를 확인해 요청 바디의 `interaction` 필드가 `config.interaction` 으로 중첩되어야 하는지 검토. 응답과 요청의 구조를 일치시킬 것.

### [INFO] `GET /triggers` 페이지네이션 — limit=100 하드코딩
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` L2213-2218
- 상세: `useWebChatInstances` 가 `limit: 100` 으로 고정 조회한다. 트리거 수가 100개를 초과하면 웹채팅 인스턴스가 누락될 수 있다. `useWorkflowOptions` (`GET /workflows?limit=100`) 도 동일하다.
- 제안: 현재 운영 환경에서 100개 초과 케이스가 없다면 INFO 수준으로 유지할 수 있으나, 향후 페이지네이션 또는 `totalItems > limit` 시 경고 처리 추가를 고려할 것.

### [INFO] `GET /workflows` 응답 정규화 — 이중 접근 패턴
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` L2244
- 상세: `useWorkflowOptions` 에서 `res.data?.data ?? res.data ?? []` 로 응답을 정규화한다. 반면 `useWebChatInstances` 는 `normalizePagedResponse` 헬퍼를 사용한다. 동일한 API 클라이언트에서 호출함에도 정규화 경로가 불일치한다.
- 제안: `GET /workflows` 에도 `normalizePagedResponse` 를 사용하거나, 별도의 `workflowsApi` 헬퍼로 추상화해 응답 형식 일관성을 보장할 것.

### [INFO] `endpointPath` 클라이언트 측 UUID 생성
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` L2377
- 상세: `endpointPath: crypto.randomUUID()` 를 클라이언트가 직접 생성해 서버에 전달한다. 커밋 메시지에 `spec 2-trigger-list §2.5` 로 명시되어 있어 의도된 설계이다. API 계약 관점에서 서버가 이 값을 수용·저장하고 URL 경로에 사용하므로, 서버가 중복 검사나 형식 검증을 수행하는지 확인이 필요하다.
- 제안: 서버 측에서 `endpointPath` 의 유일성·UUID 형식 유효성 검증이 구현되어 있는지 확인. 클라이언트 생성 키를 서버가 blind trust 하는 것은 API 계약상 취약점이 될 수 있다.

### [INFO] `useCreateWebChat` 반환값 타입 안전성
- 위치: `codebase/frontend/src/components/web-chat/create-web-chat-dialog.tsx` L1395
- 상세: `const id = (created as { id?: string } | undefined)?.id;` 로 `any` 캐스팅을 사용한다. `use-web-chat.ts` 의 `mutationFn` 이 `data` (응답 전체) 를 반환하는데, API 응답 스키마가 명시적으로 타이핑되지 않아 런타임 오류 가능성이 있다.
- 제안: `POST /triggers` 응답 타입을 명시적 인터페이스로 정의하고, `mutationFn` 반환 타입을 타이핑해 `as` 캐스팅 제거.

## 요약

이 변경은 신규 백엔드 API 없이 기존 `GET/POST /triggers` 엔드포인트를 재사용하는 순수 프론트엔드 웹채팅 콘솔 증분이다. 하위 호환성은 완전히 유지되며 breaking change 가 없다. 주요 주의 사항은 `POST /triggers` 요청 바디에서 `interaction` 필드의 위치(최상위 vs `config.interaction` 중첩)가 응답 스키마와 불일치할 가능성과, 클라이언트 생성 `endpointPath` UUID 에 대한 서버 측 유효성 검증 여부다. 응답 정규화 경로 불일치(`normalizePagedResponse` vs 인라인 옵셔널 체이닝)는 일관성 개선 여지가 있으나 기능 오동작으로는 이어지지 않는다. 전반적으로 API 계약 위험도는 낮다.

## 위험도

LOW
