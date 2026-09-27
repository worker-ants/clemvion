# Rationale 연속성 검토 — cross-workspace-refs (`--impl-prep`, scope=spec/2-navigation/)

## 대상

- plan: `plan/in-progress/cross-workspace-refs.md` (요청 본문 참조 id 전수 — (X) 3 · (D) 7 · 대조군 8, 처방: 저장 전 400 `VALIDATION_ERROR` + `details.field`)
- 관련 spec: `spec/5-system/3-error-handling.md` §1.3/§1.11, `spec/5-system/2-api-convention.md` §5.3, `spec/1-data-model.md` §2.5~§2.8, `spec/2-navigation/1-workflow-list.md` §3.1/Rationale §3, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/4-integration.md` Rationale(2026-09-25), `spec/data-flow/12-workspace.md` Rationale(2026-09-25), `spec/5-system/10-graph-rag.md`

## 발견사항

### [INFO] 400 `VALIDATION_ERROR`(generic) 선택은 §1.11 의 top-level 특화 코드 선례와 표면적으로만 달라 보인다 — 실제로는 다수 패턴을 따른다

- target 위치: `plan/in-progress/cross-workspace-refs.md` §처방("400 `VALIDATION_ERROR` + `details: { field, code: 'INVALID_FIELD' }`")
- 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.11(`AUTH_CONFIG_NOT_FOUND`, top-level 특화 코드) · `spec/5-system/2-api-convention.md` §5.3(top-level 교체 vs `details[].code` 판별 기준)
- 상세: §1.11 은 정확히 같은 문제(트리거 `authConfigId` 의 cross-workspace 참조)에 대해 top-level 을 도메인 특화 코드 `AUTH_CONFIG_NOT_FOUND` 로 바꿨다. 겉보기엔 target 이 이 선례를 따르지 않고 generic `VALIDATION_ERROR`+`details.field`로 가는 것처럼 보인다. 그러나 실제 코드(`triggers.service.ts:950` `assertAuthConfigInWorkspace` 의 주석)를 확인하면 "`details[].code` 를 실은 13자리 중 12곳은 top-level 이 `VALIDATION_ERROR`이고 이 자리만 예외"라고 명시돼 있고, 그 예외 지위 자체가 §5.3 미해결 판정 사안으로 트래커에 올라 있다. 즉 target 이 택한 generic 패턴은 **기각된 대안의 재도입이 아니라 실제 다수 관행(12/13)을 따르는 것**이며, `AUTH_CONFIG_NOT_FOUND` 를 일반화하지 않는 쪽이 오히려 §5.3 의 "이 표를 일반화하지 말 것" 경고에 부합한다.
- 제안: 추가 조치 불필요. 다만 target 의 "에러 코드 · 필드명의 spec 미러링은 planner 몫" 문구에 이 대조(§1.11 은 예외, 12/13 이 다수)를 한 줄 남겨 두면 이후 planner 턴이 §5.3 재논쟁을 반복하지 않는다.

### [INFO] 폴더 생성 경로 소속 검사 추가는 새 결정이 아니라 기존 Rationale 과 코드 사이의 잠복한 drift 를 해소하는 것

- target 위치: `plan/in-progress/cross-workspace-refs.md` §처방("폴더 `parentId` 는 생성 경로에 소속 검사를 더한다")
- 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` Rationale §3 "폴더 계층 무결성은 생성·부모 변경 양쪽에서 강제 (§3.1, 2026-07-05)" — "`(data-model §2.5)`의 '최대 깊이 5 / 같은 워크스페이스 / 비순환'은 **폴더 생성뿐 아니라** `PATCH` 부모 변경에서도 hard-fail 로 강제한다"
- 상세: 2026-07-05 Rationale 은 "같은 워크스페이스" 검사가 생성 경로에 **이미** 있다는 전제로 쓰였다. 그런데 실제 `folders.service.ts` `create()`→`getDepth()` 를 읽으면, 다른 워크스페이스의 `parentId` 를 주면 `findOne({ id, workspaceId })` 가 `undefined` 를 반환하고 `currentId = undefined?.parentId ?? null` 로 즉시 루프가 끝나 `depth=1`(< 5)로 통과한다 — 즉 코드는 워크스페이스 경계를 실제로 검사하지 않고 있었다. target 의 수정은 이 Rationale 이 이미 선언한 설계를 코드에 뒤늦게 맞추는 것이라 **새 Rationale 이 필요한 결정 번복이 아니다**. 다만 2026-07-05 Rationale 문구 자체가 "이미 강제한다"는 투로 읽혀, 이번 수정 전까지는 사실과 어긋난 서술이었다는 점은 기록해 둘 가치가 있다.
- 제안: target 커밋/CHANGELOG 에 "생성 경로는 2026-07-05 Rationale 이 선언한 검증을 실제로는 갖추지 못하고 있었다"는 사실을 실측으로 남기면, 이후 §3 Rationale 을 다시 읽는 사람이 "역사적으로도 항상 지켜졌다"고 오독하지 않는다. spec 문구 자체를 바꿀 필요는 없다(코드가 뒤늦게 선언에 도달하는 케이스).

### [INFO] Edge/Node 의 "같은 workflow_id" 불변식은 이미 데이터 모델에 명시돼 있고 target 은 이를 강제하는 방향 — 충돌 아님

- target 위치: `plan/in-progress/cross-workspace-refs.md` §처방(캔버스 저장 `containerId`/`toolOwnerId`/엣지 끝점을 "이번 페이로드의 노드 id 집합" 안으로 제한)
- 과거 결정 출처: `spec/1-data-model.md` §2.7 Edge "제약 조건" — "source_node와 target_node는 같은 workflow_id에 속해야 함"
- 상세: 이 불변식은 이미 스펙에 명문화돼 있으나 DB 제약(UNIQUE `(source_node_id, source_port, target_node_id, target_port)`)에는 `workflow_id` 가 없어 앱 계층에서만 지켜지고 있었고, target 의 조사(plan (X) 표 3행)는 `syncNodes`/`syncEdges` 가 이를 실제로는 강제하지 못함을 확인했다. target 의 처방은 이 기존 불변식을 저장 시점에 강제하는 것이므로 **기각된 대안의 재도입이나 원칙 위반이 아니라 선언과 구현의 간극을 메우는 방향**이다.
- 제안: 없음(정보성 확인).

## 확인했으나 충돌이 없었던 항목 (기록)

- `spec/2-navigation/4-integration.md` Rationale "Personal 통합 소유자 강제(2026-09-25)" — OAuth `reauthorize` 모드의 `integrationId` 미검사 결함은 이미 그 Rationale 로 닫혔고, target 의 "대조군"(저장 전 검사가 있는 자리) 목록의 "OAuth begin `integrationId`" 서술과 부합한다. 재발 없음.
- `spec/data-flow/12-workspace.md` Rationale "경로 파라미터 워크스페이스도 가드가 본다(2026-09-25)" — 이는 **경로 파라미터** 워크스페이스 가드(403/404 계열)를 다루고, target 은 **요청 본문**의 교차 참조(400 계열)를 다룬다. §1.11 이 이미 이 두 표면을 분리해 두었고 target 은 그 분리를 그대로 따른다. 충돌 없음.
- `spec/2-navigation/2-trigger-list.md` §3 API 표(연결 워크플로우 `workflowId` = "워크스페이스 워크플로우 목록"에서 선택) — 클라이언트 UI 는 처음부터 같은 워크스페이스 워크플로우만 보여주는 설계였고, 서버 미검증은 그 설계 의도에 대한 방어선 부재였다. target 의 서버측 검증 추가는 이 UI 의도와 정합한다.
- `spec/5-system/15-chat-channel.md` R-CC-21 및 트리거 `config` 안의 비밀 참조 — target 은 이를 명시적으로 **이 PR 밖으로** 넘기면서 R-CC-21 의 비밀 회전 정책이 얽혀 있음을 이유로 들었다. R-CC-21 의 정책을 우회하거나 재해석하지 않고 별도 트랙으로 미루는 것이라 원칙 위반 아님.
- `spec/5-system/10-graph-rag.md` / KB `extractionLlmConfigId`·rerank 설정의 "미지정 시 워크스페이스 default" 폴백 — 이는 **필드 미지정** 시의 폴백이고, target 이 다루는 것은 **잘못된(다른 워크스페이스) 값이 명시적으로 지정된** 경우다. 서로 다른 축이라 target 의 저장 전 거부가 기존 폴백 정책을 훼손하지 않는다.

## 요약

target(`cross-workspace-refs` plan, `--impl-prep`)이 제안하는 저장 전 소속 검사·400 `VALIDATION_ERROR` 처방은 기존 spec 의 Rationale 들과 정면으로 충돌하는 지점을 찾지 못했다. 오히려 (1) 에러 코드 선택은 `AUTH_CONFIG_NOT_FOUND` 를 일반화하지 말라는 §5.3/§1.11 의 경고와 실제 코드 주석이 밝힌 "12/13 다수는 generic" 관행에 부합하고, (2) 폴더 생성 경로 검사 추가는 2026-07-05 Rationale 이 이미 선언했던(그러나 코드가 못 미쳤던) 설계를 뒤늦게 실현하는 것이며, (3) Edge/Node 의 "같은 workflow_id" 요구는 데이터 모델에 이미 명문화된 불변식을 강제 지점으로 끌어올리는 것이다. 트리거 OAuth reauthorize·경로 파라미터 워크스페이스 가드·chat-channel 비밀 회전·KB 설정 폴백 등 인접한 기존 Rationale 들과도 표면이 분리돼 겹치지 않는다. 다만 이번 target 자체는 `spec_impact: none` 으로 스펙 문구를 바꾸지 않고 "에러 코드·필드명 spec 미러링은 planner 몫"이라 미뤄 두었으므로, 후속 planner 턴이 §1.11 의 예외 지위 대조와 폴더 Rationale §3 의 사실 관계 정정(코드가 뒤늦게 선언에 도달했다는 점)을 반영하는지는 별도로 지켜볼 필요가 있다.

## 위험도

LOW
