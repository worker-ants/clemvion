### 발견사항

---

**[WARNING] 에러 메시지를 통한 내부 정보 노출**
- 위치: `execution-engine.service.ts` — `emitExecutionEvent`, `emitNodeEvent` 호출부 (EXECUTION_FAILED, NODE_FAILED)
- 상세: `error instanceof Error ? error.message : String(error)` 로 에러 메시지를 WebSocket 이벤트에 그대로 포함. 스택 트레이스나 DB 오류 메시지, 내부 경로 등 민감 정보가 클라이언트에 노출될 수 있음.
- 제안: 에러 메시지를 사용자 친화적 메시지로 정제하거나 에러 코드 기반으로 분류하여 전송. 상세 에러는 서버 로그에만 기록.

---

**[WARNING] `saveCanvas` 엔드포인트에 인증/인가 검증 부재**
- 위치: `workflows.controller.ts:110` — `saveCanvas` 메서드
- 상세: `execute` 엔드포인트는 `@CurrentUser()` 데코레이터로 인증된 사용자 정보를 확인하지만, `saveCanvas`는 `workspaceId`만 검증하고 `userId`를 검증하지 않음. 워크플로우 소유자/편집 권한 확인 없이 캔버스 수정이 가능.
- 제안: `saveCanvas`에도 `@CurrentUser()` 추가 후 해당 사용자가 워크플로우 수정 권한이 있는지 검증.

```typescript
// 현재
async saveCanvas(
  @Param('id', ParseUUIDPipe) id: string,
  @WorkspaceId() workspaceId: string,
  @Body() dto: SaveCanvasDto,
)

// 권장
async saveCanvas(
  @Param('id', ParseUUIDPipe) id: string,
  @WorkspaceId() workspaceId: string,
  @CurrentUser() user: JwtPayload,
  @Body() dto: SaveCanvasDto,
)
```

---

**[WARNING] 노드 ID의 신뢰 문제 (Mass Assignment / IDOR)**
- 위치: `workflows.service.ts` — `saveCanvas` 내 node upsert 로직
- 상세: 클라이언트가 제출한 `nodeDto.id`를 그대로 DB에 저장. 클라이언트가 다른 워크플로우의 노드 ID를 제출할 경우 `existingNodeMap.get(nodeDto.id)`가 miss되어 새로운 노드가 생성되지만, UUID 충돌 가능성 및 `workflowId`가 현재 id로 강제되므로 직접적 탈취는 어렵. 그러나 `SaveCanvasNodeDto.id`에 `@IsUUID()` 검증이 없어 임의 문자열(최대 36자) 입력이 가능.
- 제안: `SaveCanvasNodeDto.id`에 `@IsUUID()` 데코레이터 추가.

```typescript
@IsUUID()
@MaxLength(36)
id: string;
```

---

**[WARNING] `config` 필드에 대한 입력 검증 없음**
- 위치: `save-canvas.dto.ts` — `SaveCanvasNodeDto.config`, `SaveCanvasEdgeDto.condition`
- 상세: `config`와 `condition`은 `Record<string, unknown>`으로 선언되어 임의의 중첩 객체를 허용. 나중에 이 데이터가 템플릿 렌더링, 표현식 평가, SQL 쿼리 등에 사용될 경우 인젝션 벡터가 됨. 현재 Phase 1에서는 직접적 위험은 낮지만 구조적으로 취약.
- 제안: 노드 타입별 config 스키마 검증 레이어 추가 또는 최소한 중첩 깊이 제한 적용.

---

**[INFO] 실행 입력 데이터 크기 제한 없음**
- 위치: `workflows.controller.ts:90` — `execute` 메서드 `body?.input`
- 상세: 실행 시 전달되는 `input` 객체에 크기 제한이 없어 대용량 payload로 메모리 부하를 유발할 수 있음. NestJS 기본 body 크기 제한(100kb)이 있지만 명시적 제한 없음.
- 제안: `input` 필드에 대한 DTO 클래스 생성 및 크기 제한 설정, 또는 글로벌 body size limit 명시적 설정.

---

**[INFO] `console.error`를 통한 에러 로깅 (프론트엔드)**
- 위치: `editor-toolbar.tsx:52`, `editor-store.ts:138`
- 상세: `console.error`로 에러 출력 시 브라우저 개발자 도구에서 민감 정보(API 응답 포함)가 노출될 수 있음. 프로덕션 환경에서는 구조화된 로깅으로 대체 필요.
- 제안: 프로덕션 빌드에서 `console.error` 제거 또는 에러 추적 서비스(Sentry 등)로 대체.

---

**[INFO] WebSocket 이벤트 구독 인가 검증**
- 위치: `workflow-editor.tsx` — `useExecutionEvents({ executionId })`
- 상세: `executionId`로 WebSocket 이벤트를 구독할 때 해당 실행이 현재 사용자의 것인지 서버 측에서 검증하는지 확인 필요. 리뷰 대상에 WebSocket 게이트웨이 코드가 포함되지 않아 직접 확인 불가.
- 제안: WebSocket 이벤트 룸/채널 구독 시 JWT 검증 및 실행 소유권 확인 로직이 게이트웨이에 구현되어 있는지 확인.

---

### 요약

전반적으로 코드는 `ParseUUIDPipe`, workspace 기반 격리, DTO 유효성 검증 등 기본적인 보안 체계를 갖추고 있어 구조적 위험도는 낮은 편이다. 그러나 `saveCanvas` 엔드포인트의 사용자 인가 검증 누락, 에러 메시지를 WebSocket으로 그대로 노출하는 패턴, 노드 ID의 UUID 형식 미검증, 그리고 `config`/`condition` 필드의 무제한 중첩 구조 허용은 향후 기능 확장(표현식 평가, 코드 실행 노드 등) 시 인젝션 공격 벡터로 발전할 수 있어 조기 보완이 필요하다.

### 위험도

**MEDIUM**