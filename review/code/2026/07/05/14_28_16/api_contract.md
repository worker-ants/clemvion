# API 계약(API Contract) 리뷰

대상: `PATCH /api/folders/:id` — `parentId` 변경 시 계층 무결성(같은 워크스페이스·비순환·최대 깊이 5) 검증 추가. 이전에는 무검증으로 통과되던 요청이 이제 `400 VALIDATION_ERROR` 로 거부된다.

## 발견사항

- **[INFO]** 의도된 breaking change — 이전에 성공(200)하던 일부 요청이 이제 400 으로 거부됨
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:790-804` (`update`), `folders.controller.ts:142-162`
  - 상세: `parentId` 를 (a) 자기 자신, (b) 존재하지 않거나 타 워크스페이스의 폴더, (c) 자신의 자손, (d) 최종 깊이가 5 를 초과하게 되는 폴더로 변경하는 기존 클라이언트 호출은 종전에는 silently 성공(cycle 은 오히려 `getDepth` 무한루프 유발 가능성)했으나 이제 `400 VALIDATION_ERROR` 로 거부된다. 이는 **버그 수정 성격의 breaking change**로, 데이터 무결성을 위해 바람직한 방향이지만 API 계약 관점에서는 "이전엔 되던 요청이 이제 안 됨"이라는 사실 자체는 명시적으로 인지해야 한다.
  - 제안: 현 변경 방향(무결성 강제)이 맞다. 다만 프론트엔드/기존 통합 클라이언트가 이 케이스(순환·타 workspace·깊이 초과 이동)를 실제로 호출하고 있었는지 확인 필요(정상 UI 플로우라면 애초에 이런 요청을 만들지 않으므로 실사용 영향은 낮을 것으로 추정). ApiOperation description 에 이미 이 사실이 명시되어 있어(`"위반 시 400 VALIDATION_ERROR"`) 문서화는 적절함.

- **[INFO]** 에러 코드 재사용 — 신규 코드 미도입, 기존 관례 일치
  - 위치: `folders.service.ts:650-694` (`validateParentChange`)
  - 상세: 신규 케이스(cycle, cross-workspace parent, depth exceed) 모두 기존 `create()` 의 깊이초과와 동일하게 `VALIDATION_ERROR` 를 재사용한다. 저장소 전역에서 `VALIDATION_ERROR`는 400 대표 코드로 광범위하게 재사용되는 컨벤션이며(`main.ts:70`, `error-response.dto.ts`, `triggers.service.ts`, `interaction.service.ts` 등), 다른 도메인(`CONTAINER_CYCLE`, `CYCLE_DETECTED` — 노드/그래프 순환)과 의도적으로 구분해 혼동을 피한 것도 주석에 명시되어 있음. 컨벤션 위반 없음.
  - 제안: 없음(적절함). 다만 `details` 필드를 채우지 않아 클라이언트가 3가지 위반 사유(cycle/cross-workspace/depth)를 코드로 구분할 수단이 `message` 문자열 파싱 외에는 없다는 점은 아래 WARNING 참고.

- **[WARNING]** 세 가지 검증 실패 사유를 `message` 문자열로만 구분 — `details` 부재로 클라이언트 분기 어려움
  - 위치: `folders.service.ts:661-693`
  - 상세: cycle(자기 자신/자손), cross-workspace/not-found, depth 초과 3가지 케이스 모두 `{ code: 'VALIDATION_ERROR', message: '...' }` 만 반환하고 `details` 를 채우지 않는다. 저장소 내 다른 곳(`triggers.controller.ts:114`, `interaction.service.ts:360`)은 `details.field`/`details.disallowed`/`details[{field,message,code}]` 형태로 세부 사유를 구조화해 프런트가 사유별로 다른 UX(예: "다른 폴더 선택" vs "더 얕은 위치로 이동")를 보여줄 수 있게 한다. 현재 구현은 `message` 영어 문자열만 파싱해야 클라이언트가 원인을 구분할 수 있어, 다국어 UI 요구 시 취약하다.
  - 제안: `details: { reason: 'CYCLE' | 'CROSS_WORKSPACE' | 'DEPTH_EXCEEDED', maxDepth?: number }` 형태를 추가하면 프런트 처리가 더 견고해진다. 다만 이번 PR 스코프(서버 측 검증 도입) 자체는 이 필드 없이도 정상 동작하므로 blocking 은 아님.

- **[INFO]** `ApiBadRequestResponse` 문서가 새 검증 실패 시나리오를 개별 명시하지 않음
  - 위치: `folders.controller.ts:151` (`@ApiBadRequestResponse({ description: '입력값 검증 실패' })`)
  - 상세: `create()` 엔드포인트는 `ApiBadRequestResponse` description 에 "중첩 깊이 초과"를 명시(`:130`)하지만, `update()` 는 여전히 일반 문구("입력값 검증 실패")만 있고 신규 cycle/cross-workspace/depth 사유는 `@ApiOperation.description` 쪽에만 기술되어 있다. Swagger UI 상 `ApiBadRequestResponse` 블록만 보는 소비자는 세부 사유를 놓칠 수 있다.
  - 제안: `create()` 와 동일하게 `ApiBadRequestResponse({ description: '입력값 검증 실패, 부모 변경 시 순환·타 워크스페이스·깊이 초과 포함' })` 형태로 맞추면 일관성이 개선된다. Nit 수준.

- **[INFO]** HTTP 상태 코드·응답 포맷 일관성
  - 위치: `folders.service.ts`, `http-exception.filter.ts:99-108`
  - 상세: `BadRequestException({ code, message })` → `GlobalExceptionFilter` 가 `{ error: { code, message, requestId } }` 봉투로 정상 직렬화됨을 확인. 상태 코드 400 은 클라이언트 입력(parentId) 문제이므로 적절(422 아님 — 리소스 상태 충돌이 아닌 요청 값 자체의 문제로 400 이 맞음).
  - 제안: 없음.

- **[INFO]** 요청 검증(DTO) 레이어와 서비스 레이어 검증의 역할 분리는 적절
  - 위치: `update-folder.dto.ts:32-35`, `folders.service.ts:790-804`
  - 상세: DTO 는 `parentId` 가 UUID 형식인지(구문)만 검증하고, 계층 무결성(의미)은 서비스에서 처리한다. `data.parentId !== undefined && data.parentId !== folder.parentId` 가드로 "parentId 미포함"(부분 수정, 변경 없음)과 "parentId: null"(루트로 이동) 을 구분해 불필요한 재검증을 skip 하는 것도 PATCH 의미론(partial update)에 맞다.
  - 제안: 없음.

- **[INFO]** 페이지네이션/버저닝/인증·인가 — 해당 변경과 무관
  - 상세: 이번 diff 는 단건 리소스(`PATCH /folders/:id`)의 검증 로직 추가로, 목록 API 페이지네이션이나 API 버전 관리와는 무관하다. 인증(`@ApiBearerAuth`)·인가(`@Roles('editor')`) 는 기존 그대로 유지되며 변경 없음.

## 요약

`PATCH /api/folders/:id` 가 `parentId` 변경 시 `create()` 와 동일한 계층 무결성 규칙(같은 워크스페이스·비순환·최대 깊이 5)을 재사용하도록 확장한 변경이다. 신규 에러 코드를 도입하지 않고 기존 `VALIDATION_ERROR`(400)를 재사용해 저장소 전역 에러 코드 컨벤션과 정합하며, 응답 봉투(`{error:{code,message,requestId}}`)도 `GlobalExceptionFilter` 를 통해 기존 포맷 그대로 유지된다. 이전에는 silently 통과(또는 무한루프 위험)하던 순환/타 workspace/깊이초과 이동 요청이 이제 400 으로 거부되는 것은 사실상 breaking change 이나, 데이터 무결성 버그 수정 성격이고 정상 UI 플로우에서는 애초에 발생하지 않을 요청이라 실사용 영향은 제한적으로 판단된다. 세 가지 검증 실패 사유를 `message` 문자열로만 구분하고 `details` 구조화 필드가 없는 점, `update()` 의 `ApiBadRequestResponse` swagger 문서가 신규 사유를 개별 명시하지 않는 점은 사소한 개선 여지이나 병합을 막을 수준은 아니다.

## 위험도

LOW
