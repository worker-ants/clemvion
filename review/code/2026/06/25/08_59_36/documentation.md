# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `parseMessage` 반환 타입에 명명 인터페이스 부재
- 위치: `codebase/channel-web-chat/src/lib/eia-events.ts` `parseMessage` 함수 반환 타입
- 상세: `parseAiMessage` 는 `ParsedAiMessage` 인터페이스를 반환하고 JSDoc 과 함께 명명 타입이 공개돼 있는 반면, `parseMessage` 는 익명 인라인 `{ presentations?: Array<Record<string, unknown>> }` 를 반환한다. 소비처(`use-widget.ts`)에서는 구조 분해만 사용해 현재는 문제없으나, 향후 소비처가 추가될 경우 타입 참조가 불편해진다.
- 제안: `ParsedMessage` 또는 `ParsedPresentation` 인터페이스를 `ParsedAiMessage` 와 동일 패턴으로 정의하고 반환 타입으로 사용. 즉시 수정 필요도는 낮음(현 소비처가 1곳이므로).

### [INFO] `websocket.service.ts` `ExecutionEventType.EXECUTION_MESSAGE` JSDoc — 권위 출처(`outputData`) 언급 불충분
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `EXECUTION_MESSAGE` enum 멤버 JSDoc
- 상세: JSDoc 에 "AI 가 생성한 메시지가 아님"·"WS 에러코드 명칭 충돌 방지" 등은 잘 기술돼 있으나, plan 에서 강조했던 "영속 `NodeExecution.outputData` 가 SoT(권위 출처), 본 이벤트는 실시간 렌더용 비권위 신호" 임을 JSDoc 본문에서 명시하지 않는다. spec `R18` 에는 기술돼 있으나 코드 문서로는 누락.
- 제안: JSDoc 끝에 `@see` 또는 본문 1줄 추가: "본 이벤트는 표시 목적의 실시간 신호이며, 권위 출처는 영속 `NodeExecution.outputData` 다."

### [INFO] `execution-engine.service.ts` 인라인 주석 — spec 레퍼런스 경로 스타일 비일관
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 신규 블록 끝 주석
- 상세: 인라인 주석에 `spec: spec/5-system/14-external-interaction-api.md §5.2` 를 참조하고 있어 유용하다. 다만 spec 문서 경로가 절대 파일 경로 형식(`spec/...`)인 반면 다른 곳은 섹션 참조만 사용하는 등 스타일이 혼재한다. 기능 문제는 아님.
- 제안: 코드 주석 spec 참조 형식을 프로젝트 관례(기존 코드에서 사용하는 방식)와 통일. 현 상태 자체는 기능적으로 무해.

### [INFO] `live-preview.tsx` `postCommand` 인라인 주석 — 멀티라인 분리 권장
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` `postCommand` 함수 위 주석
- 상세: `postCommand` 함수 위 인라인 주석이 1줄에 모든 설명을 담아 가독성이 낮다. 다른 함수들(`postBoot`, `useEffect` 블록)은 멀티라인 주석으로 역할·조건·설계 이유를 구분해 기술한다.
- 제안: 멀티라인 또는 JSDoc 블록으로 분리. 선택 사항이나 `postBoot` 와의 대칭성을 위해 권장.

### [INFO] `use-widget.ts` `apiRef` 주석 — `newChat` 추가 맥락 미기술
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `apiRef` ref 갱신 블록 주석
- 상세: 코드에서 `apiRef` 객체에 `newChat` 이 추가됐는데, 해당 블록 위 주석(`// host 명령은 1회 등록 핸들러에서 최신 함수를 참조해야 함(stale closure 회피).`)은 그대로다. 주석이 틀린 것은 아니지만 `newChat` 이 이 패턴의 적용 대상임을 언급하지 않아 맥락이 완전하지 않다.
- 제안: 주석에 `newChat` 이 `resetSession` command handler 용 stale closure 회피 목적임을 1줄 병기. 현 상태는 코드만 보면 이해 가능하므로 INFO.

### [INFO] `spec/7-channel-web-chat/5-admin-console.md` §1 화면 구조 ASCII 다이어그램 — "새 세션" 버튼 미표기
- 위치: `spec/7-channel-web-chat/5-admin-console.md` §1 화면 구조 ASCII 다이어그램
- 상세: §6 본문에 2-column 배치와 "새 세션" 버튼이 기술됐고 R7 Rationale 도 추가됐으나, §1 다이어그램에 "새 세션" 버튼 위치가 표기돼 있지 않다. spec 산문(§6)에 기술됐으므로 허용 범위지만 완전성을 위해 언급.
- 제안: 다이어그램 미리보기 헤더 영역에 `[새 세션]` 버튼 표기 추가 검토. 낮은 우선순위.

### [INFO] `spec/5-system/6-websocket-protocol.md` §4.4 이벤트 카탈로그 `execution.message` 추가 여부 미확인
- 위치: `spec/5-system/6-websocket-protocol.md` §4.4 (변경 diff 에 포함 안 됨)
- 상세: plan `Phase 4` 항목 4 가 "필요하면 동반 추가"로 조건부 처리됐고, 실제 diff 에는 해당 파일 변경이 없다. EIA `§5.2` 에는 이미 추가됐으나, WebSocket 프로토콜 §4.4 이벤트 카탈로그가 별도 이벤트 목록을 유지하면 누락됐을 수 있다.
- 제안: `spec/5-system/6-websocket-protocol.md` §4.4 를 확인해 `execution.message` 포함 여부 검토. 해당 카탈로그가 EIA §5.2 를 단순 참조하는 구조라면 추가 불필요.

## 요약

이번 변경은 문서화 수준이 전반적으로 우수하다. 신규 공개 상수(`PRESENTATION_NODE_TYPES`)에 JSDoc 이 충실히 작성됐고, 신규 SSE 이벤트 타입(`EXECUTION_MESSAGE`) enum 멤버에 JSDoc 이 부여됐으며, 위젯 파싱 함수(`parseMessage`)와 타입(`ExecutionMessageEvent`)에도 JSDoc 이 존재한다. spec 문서 3곳(`14-external-interaction-api.md §5.2+R18`, `2-sdk.md §3`, `5-admin-console.md §6+R7`)이 구현과 동일 커밋에서 갱신돼 단일 진실 원칙을 준수했다. i18n 키(en/ko 양쪽)도 완전히 추가됐다. 인라인 주석이 비차단 분기의 의도와 설계 결정을 충실히 설명한다. 발견된 사항은 모두 INFO 등급(명명 인터페이스 부재, 권위 출처 언급 누락, 소소한 주석 스타일 및 다이어그램 미갱신)으로 기능·유지보수성에 즉각적 위험을 주지 않는다.

## 위험도

NONE
