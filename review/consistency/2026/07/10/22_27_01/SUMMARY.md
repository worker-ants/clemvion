# Consistency Check SUMMARY — spec-draft-pr874-deferred-docs

- 대상: `plan/in-progress/spec-draft-pr874-deferred-docs.md` (spec-only 문서 보강 3건)
- 모드: `--spec` (project-planner 의 `spec/` 쓰기 직전 의무 검토)
- 실행 checker: cross-spec / rationale-continuity / convention-compliance / plan-coherence / naming-collision (5/5)

## BLOCK: NO

Critical 0건. 아래 WARNING 3건은 **draft 문구를 국소 정정하면 해소**되며, 구조(스코프 경계·frontmatter/§4 표 갱신·R 번호)는 그대로 채택 가능하다.

## Critical (0)

없음.

## Warning (3)

| # | checker | 내용 | 조치 |
|---|---|---|---|
| W1 | rationale-continuity, cross-spec | R7 의 "기각된 대안" 2문장(booting 큐잉 / 종료 명령 단일화)이 **실제 PR #874 리뷰·plan 이력에 없는 사후 구성**. draft 자신의 "신규 결정 없음(산문 승격)" 자기규정과 모순 | **삭제** — 순수 승격으로 되돌림 |
| W2 | cross-spec, convention-compliance | §9 예외의 "6-way" 프레이밍이 위젯의 실제 wire 도메인(backend 5값)과 어긋남. `system_error` 는 frontend-합성(§1.1.1)이라 위젯에 **도달 불가** | 구체 열거 + `system_error` 도달 불가 명시로 **정정** |
| W3 | plan-coherence | spec 본문이 "backlog/잔여"로 명시한 2항목이 `plan/in-progress/**` 미등재 — (a) host `resetSession` booting 중 중복 webhook 가드, (d) EIA §R17 잔여 `nodeOutput` 키-allowlist. spec-impl-evidence R-5 "빈 약속 영구 누락" 패턴과 동형 | `spec-sync-external-interaction-api-gaps.md` 에 **체크리스트 등재** |

## Info (주요)

- **I1** (rationale-continuity): §9 예외는 §8.1/§8.2 결정의 **번복이 아니라 적용 범위 분리** — 위젯 2-way 축약은 PR #874 이전부터 시행 중이었고 `1-widget-app.md` 는 애초 §9.4·§9.5 만 인용했다. 단 §8.1/§8.2 에 역참조가 없어 향후 drift 재발 가능 → **§8.2 말미 1줄 cross-ref 권고**(채택).
- **I2** (convention-compliance): §9 예외의 `1-widget-app.md` 링크에 앵커 프래그먼트 누락 → `#2-화면-구조` 부착(채택).
- **I3** (naming-collision): R 번호는 **문서-로컬** 연속. `1-widget-app.md` 가 R4 부터 시작하는 건 영역 신설 시 전역 시퀀스 잔재(`a652f8733`), `#761`(`aba46cc90`) 에서 architecture 만 로컬 재넘버링. **R7 이 안전한 다음 번호**.
- **I4** (naming-collision): `interaction.service.ts` 실재 확인, `conversation-thread.md` 기존 `code:` glob 과 중복 없음. 다중-spec 소유는 기존 관례(`spec-code-paths.test.ts` 가 배타성 미강제).
- **I5** (cross-spec): 변경 (3) 은 §8.4·EIA §5.3/§R17·websocket-protocol §4.4.5 와 **문구 수준까지 정합** — 그대로 반영 가능.

## 별건 발견 (본 PR 범위 밖 — developer 트랙)

cross-spec checker 가 W1 검증 중 **잠재 backend 결함**을 발견: `end_conversation` 은 EIA §5.1 상 "AI Agent / IE (multi turn)" 전용 명령이나, `interaction.service.ts` 의 검증은 `assertNodeId`(존재 여부만) + `assertWaiting`(execution status 만) 으로 **노드 타입을 강제하지 않는다**. `endAiConversation` 은 nodeId 를 받지도 않고, 재개 라우팅(`dispatchResumeTurn`)은 continuation 메시지 타입이 아니라 **현재 대기 노드 타입**으로 핸들러를 고른다. 따라서 Form 대기 중 `end_conversation` 을 보내면 409 거부가 아니라 **빈 `formData` 로 Form 이 조용히 재개**될 수 있다(침묵 오처리).

→ spec-only 인 본 PR 에서는 다루지 않고 **별도 developer 후속**으로 분리한다. R7 은 이 미검증 동작을 인용하지 않는다(W1 삭제로 자연 해소).

## 위험도

MEDIUM → 정정 후 LOW
