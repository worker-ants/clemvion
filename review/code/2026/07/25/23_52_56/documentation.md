# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** JSDoc 요약 문단과 상세 "소비자" 목록이 불일치 (Cafe24/MakeShop 추가가 절반만 반영됨)
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:216` (요약 문단, 이번 diff 에서 `chat-channel` → `Cafe24 / MakeShop` 로 수정됨) 및 `:225`-`:231` (상세 "소비자" 열거 — 이번 diff 에서 미변경)
  - 상세: `abortSignal` JSDoc 은 두 단으로 구성된다 — ①요약 문단("장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / Cafe24 / MakeShop)")과 ②"**소비자**" 상세 열거(HTTP/DB/AI/Email 각각에 실제 구현 메커니즘 한 줄씩: `fetch(url, { signal })`, `pg_cancel_backend`/`KILL QUERY`, SDK `signal` 옵션, 사전 abort 체크만). 이번 PR 은 ①에 `Cafe24 / MakeShop` 을 추가했지만(정확한 수정 — 실제로 2026-07-25 구현 완료됨, `plan/in-progress/node-cancellation-residual-signal-propagation.md` 참조) ②의 열거에는 대응 항목을 추가하지 않았다. 그 결과 읽는 사람은 Cafe24/MakeShop 이 "전파한다"는 사실은 알아도 HTTP/DB/AI/Email 과 달리 **어떤 메커니즘으로** 전파하는지(실제로는 client 자체 per-call `AbortController` 에 cascade — 이미 aborted 면 즉시 abort, 아니면 listener 등록 후 완료 시 해제, `http-request.handler.ts` 와 동일 패턴) 이 JSDoc 만으로는 알 수 없다.
  - 제안: `:231` 앞(또는 Email 다음)에 한 줄 추가 — 예: `` *  - Cafe24 / MakeShop — client 의 per-call `AbortController` 에 cascade (이미 aborted 면 즉시 abort, 완료 시 listener 해제 — `http-request.handler.ts` 와 동일 패턴) ``. 사소하지만 "요약은 갱신, 상세는 누락"은 이 저장소가 반복 경계하는 라벨/본문 drift 패턴과 같은 종류라 이번 기회에 함께 닫는 편이 안전하다.

- **[INFO]** 이번 diff 의 문서 정확성·상호 참조는 검증 결과 모두 실측과 일치함
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:235`-`240` (신규 JSDoc), `plan/in-progress/node-cancellation-residual-signal-propagation.md` §잔여 항목, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §추가 위임 #5
  - 상세: 다음 세 가지 인용을 직접 열어 대조했다 — (1) `spec/1-data-model.md:230` 은 실제로 "chat-channel 은 별도 type 이 아니라 webhook 트리거의 config.chatChannel 변형" 문장을 담고 있어 인용이 정확하다. (2) `spec/5-system/15-chat-channel.md` 의 `CCH-AD-05` 결정 ID 는 실제 존재하며 "어댑터가 executionEvents$ 를 구독해 outbound 발송"이라는 서술과 일치한다. (3) `codebase/backend/src/nodes/core/node-types.constants.ts` 에 `chat` 관련 등록이 0건이라는 주장도 grep 으로 확인됨(실제 0건). 세 파일(JSDoc, 잔여-plan 체크리스트, shutdown-classification 위임 plan)의 서술이 서로 완전히 일치하며, 코드(JSDoc)를 spec 과 어긋난 채로 방치하지 않고 근거와 함께 정정한 점, 그리고 developer 권한 밖인 spec 본문(§1/§6 표) 수정은 project-planner 로 명시적으로 위임한 점이 CLAUDE.md 의 역할 분리 규약과 정확히 부합한다.

- **[INFO]** README/API 문서/CHANGELOG/설정 문서 갱신 불필요
  - 위치: 해당 없음 (변경 범위 전체)
  - 상세: 이번 변경은 (a) 기존 JSDoc 의 사실관계 오류 정정(코드 동작 변경 없음), (b) `plan/` 추적 문서 갱신(체크리스트·위임 섹션 추가) 뿐이다. 새 API 엔드포인트·환경변수·설정 옵션·공개 기능이 추가되지 않았으므로 README, API 문서, 설정 문서, 예제 코드 갱신 필요성은 없다. CHANGELOG 도 마찬가지로 불필요 — 실제 사용자 가시 기능(Cafe24/MakeShop signal cascade 자체)은 이 diff 이전에 이미 별도로 구현·커밋된 상태이고, 이 diff 는 그에 대한 문서 정정 후속일 뿐이다.

## 요약

세 파일 모두 문서화 품질이 높다. 코드 파일(`node-handler.interface.ts`)의 JSDoc 정정은 실제 코드베이스 실측(노드 카테고리 전수 확인, `node-types.constants.ts` grep, spec 상호 참조 line 번호)에 근거해 정확하며, 두 plan 파일은 체크리스트·위임 섹션이 서로 완전히 동기화되어 있고 `spec/` 쓰기 권한 밖의 후속 조치(§1/§6 표 정정)를 project-planner 에게 명시적으로 위임해 역할 분리 규약을 준수한다. 유일한 흠은 JSDoc 요약 문단에 `Cafe24 / MakeShop` 을 추가하면서 그 아래 "소비자" 상세 열거에는 대응 항목을 넣지 않아 두 목록의 상세도가 어긋난 것으로, 이는 사소한 완결성 갭이며 diff 를 막을 사안은 아니다.

## 위험도

LOW
