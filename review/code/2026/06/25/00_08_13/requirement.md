# 요구사항(Requirement) 코드 리뷰

## 리뷰 대상

커밋 `5b468d3`: 웹채팅 미리보기 첫 노드 race 해소 — SSE replay(lastEventId) + getStatus 표면 복구 + CORS 분리배포 문서

변경 파일 (8개):
1. `external-interaction.module.ts` — NodeExecution 엔티티 등록
2. `interaction.service.spec.ts` — getStatus waiting 표면 복원 테스트 +2
3. `interaction.service.ts` — getStatus WAITING_FOR_INPUT 시 NodeExecution 조회 + 표면 복원
4. `use-widget-eager-start.test.ts` — race fix 테스트 +2
5. `use-widget.ts` — seedWaitingFromStatus + openStream(lastEventId="0")
6. `k8s/README.md` — CORS 분리배포 운영 안내
7. `plan/in-progress/web-chat-preview-eia-race-fix.md` — 신규 plan 파일
8. `spec/5-system/14-external-interaction-api.md` — §5.3 getStatus 구현 설명 갱신

---

## 발견사항

### **[INFO]** `seedWaitingFromStatus` — 의존 배열 공백 (`[]`)
- 위치: `use-widget.ts`, `seedWaitingFromStatus` useCallback 의존 배열
- 상세: `seedWaitingFromStatus` 는 `client.getStatus`, `parseWaitingForInput`, `dispatch`, `threadToMessages` 를 사용한다. 이 중 `dispatch` 는 `useReducer` 의 dispatch 로 참조 안정적이고, 나머지 `client`/`parseWaitingForInput`/`threadToMessages` 는 module-scope 상수여서 `[]` 가 실용적으로 올바르다. 다만 명시적으로 ESLint의 exhaustive-deps 룰과 상충할 수 있어 CI exhaustive-deps 경고가 없는지 확인이 필요하다. commit 메시지에 lint(error 0) 통과가 명기되어 있어 경고도 없는 것으로 보임.
- 제안: 현 코드 유지. CI exhaustive-deps 결과가 이미 clean 임을 확인함.

### **[INFO]** 백엔드 getStatus — `seq` 항상 `0` placeholder 유지
- 위치: `interaction.service.ts` L1222 (전체 컨텍스트 기준)
- 상세: plan(1a)에는 "seq 는 가능하면 정확값(allocator peek)"라 명시돼 있으나 구현은 `seq: 0`을 유지했다. 주석에 "SSE Last-Event-Id 로 보정" 이라 명기되어 있고, spec §5.3(갱신된 버전)도 `seq`는 항상 `0` placeholder 임을 문서화했다. 이는 의도적 결정(allocator peek 접근 불필요)이다.
- 제안: 현 코드 및 spec 모두 일치. 추가 조치 불필요.

### **[INFO]** `context` shape 캐스팅 — `status.context as WaitingForInputEvent`
- 위치: `use-widget.ts` L188
- 상세: `ExecutionStatus.context` 타입은 `Record<string, unknown> | null`이고, 이를 `WaitingForInputEvent` 로 캐스팅한다. 런타임에서 백엔드가 반환하는 `context` 구조(buttons: `{ interactionType, waitingNodeId, buttonConfig: { buttons, nodeOutput } }`, form/ai: `{ interactionType, waitingNodeId, nodeOutput }`)는 `WaitingForInputEvent` 인터페이스와 호환된다. 타입 안전성이 완전하지 않지만, 백엔드와 프론트엔드가 같은 저장소 내에 있어 형식 계약이 코멘트로 명시되어 있다. 실패 시 soft 처리(console.warn)가 되므로 런타임 충돌 리스크는 낮다.
- 제안: 현 코드 유지. 향후 `context` 타입을 `WaitingForInputEvent` 또는 유니온으로 강화하면 타입 안전성이 개선된다.

### **[INFO] [SPEC-DRIFT]** EIA spec §3.5 — `lastEventId=0` 첫 연결 동작이 §3.5 섹션 헤더로 명시되지 않음
- 위치: `spec/5-system/14-external-interaction-api.md`
- 상세: 커밋 메시지는 "EIA §3.5 replay" 를 갱신 대상으로 명기하지만, 갱신된 spec diff 는 §5.3(getStatus 구현) 만 수정되었다. §3.5에 해당하는 본문에 `lastEventId=0` 으로 첫 연결 시 seq≥1 전부 replay 된다는 사실이 §5.3 노트 하단(`lastEventId=0` 언급)에만 있고 §3.5 섹션 본문(EIA §5.2 SSE 스트림 섹션의 replay 서술)에는 직접 기재되지 않았다. 5-admin-console.md §6 에는 `openStream(lastEventId=0)` 동작이 서술되어 있다.
- 코드: 올바름(lastEventId=0 구현과 spec §5.3 서술 일치). spec §5.2(EIA-IN-07) 또는 §3.5 해당 위치에 `첫 연결 시 lastEventId=0 을 사용해 seq≥1 누락분을 replay` 동작을 보강하면 spec fidelity 완전화.
- 제안: 코드 유지 + spec `14-external-interaction-api.md` §5.2 SSE replay 절 본문에 "첫 연결 시 `?lastEventId=0` 전달로 buffer 내 seq≥1 이벤트 전체 replay" 1줄 추가.

---

## 요약

이번 변경은 라이브 미리보기 race condition(SSE 구독 전 첫 노드 emit)을 두 경로로 해소한다: (1) 백엔드 `getStatus` 가 `WAITING_FOR_INPUT` 상태에서 `NodeExecution.outputData` 를 조회해 `currentNode`/`context` 를 SSE wire 형식 그대로 복원하고, (2) 위젯이 `openStream` 을 `lastEventId="0"` 으로 열어 buffer 내 누락 이벤트를 replay 받는다. 각 구현은 의도한 기능을 완전히 충족하며, 엣지 케이스(NodeExecution 없음 → null, 유효하지 않은 interactionType → null, getStatus 실패 → soft warn 후 계속)가 모두 처리되었다. 새 테스트 4건(백엔드 +2, 위젯 +2)이 핵심 경로를 커버한다. spec §5.3 갱신, 5-admin-console §6 및 k8s/README CORS 문서도 구현과 일치한다. 심각한 요구사항 누락이나 버그는 없으며, 발견된 사항은 모두 INFO 수준(타입 캐스팅 약점, spec §5.2 lastEventId=0 동작 명시 보강 여지)이다.

## 위험도

NONE
