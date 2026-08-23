# 아키텍처(Architecture) 리뷰 — SSE/fanout `nodeOutput` allowlist (3라운드)

## 리뷰 범위와 판단 근거

이번 diff(23_56_18)는 `22_51_46`·`23_16_40` 두 차례 코드 리뷰와 `22_26_33`·`23_29_27` 두 차례
consistency-check 를 이미 거친 뒤의 상태다. 핵심 로직 파일(`node-output-allowlist.ts`,
`websocket.service.ts`)을 직접 열어 대조한 결과, **`23_16_40` 라운드가 리뷰한 코드와 지금
`HEAD` 의 코드가 동일**하다 — `allowlistFanoutNodeOutput`(24줄), `NODE_OUTPUT_ALLOWED_KEYS`(13키),
`toFanoutEnvelope` 배선 모두 변경 없음. 이번 라운드의 실질 diff(파일 1~9)는:

- `CHANGELOG.md`: 자기반증형 소정정(취소선 + 정정 블록) — 문서
- `interaction.service.spec.ts` / `node-output-allowlist.spec.ts` / `websocket.service.spec.ts`: 캐너리·리터럴 테스트 추가 — 테스트
- `node-output-allowlist.ts`: JSDoc/헤더 주석 정정("소비처는 둘이다") — 문서
- plan 문서 2건(`spec-draft-eia-62-waiting-payload.md`, `plan/complete/sse-nodeoutput-allowlist.md`): 자기반증형 소정정 — 문서

나머지(파일 10~54)는 이전 두 리뷰·컨시스턴시 라운드의 산출물이 이번 diff 에 신규 파일로
포함된 것으로, 코드 아키텍처가 아니라 워크플로 산출물이다.

즉 이번 라운드는 **동작 변경이 없는 순수 문서/테스트 라운드**다 — 프로젝트 메모의 수렴 기준
("발견의 성격이 동작→구조→문서로 이동하면 수렴")에 정확히 부합한다.

## 발견사항

새로 도입된 CRITICAL/WARNING 급 아키텍처 결함은 없다. `23_16_40` 라운드가 남긴 INFO 세 건
(shared/utils 의 도메인 타입 결속, chokepoint 의 컨벤션-only 강제, 공유 allowlist 가 REST·WS
두 표면을 동시 결정하는 결합)은 코드 변경이 없으므로 재론하지 않는다 — 전부 정본 트래커
(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:174-191`, `:196-`)에 등재돼
재개 조건과 함께 남아 있음을 직접 열어 확인했다.

- **[INFO]** `plan/complete/sse-nodeoutput-allowlist.md` 의 SSE 정정 서술이 `execution.node.completed`/`.failed` 의 `envelope.output` 을 **의도적 잔여**로 명시한 것이, 코드 쪽 캐너리(`websocket.service.spec.ts` `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다`, `codebase/backend/src/shared/utils/node-output-allowlist.ts` 헤더의 "shape 이 다르다" 서술)와 `spec/5-system/6-websocket-protocol.md` §4.4 정정 blockquote(`execution.node.* 의 envelope.output 은 이 좁히기 대상이 아니다`) 세 층에서 문자 그대로 일치한다.
  - 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:188-193`(정정 blockquote), `spec/5-system/6-websocket-protocol.md`(`toFanoutEnvelope` §4.4 정정 blockquote — diff 파일 56), `codebase/backend/src/modules/websocket/websocket.service.ts:171-181`(`allowlistFanoutNodeOutput` JSDoc)
  - 상세: "범위는 총칭이 아니라 열거"라는 원칙(같은 문서)이 `waiting_for_input` 표면 안에서도 두 이질적 payload(`nodeOutput` vs `execution.node.*` 의 `output`)를 같은 목록으로 묶지 않도록 지켰다 — 서로 다른 shape 에 같은 allowlist 를 걸어 정상 데이터를 자르는 (직전 사고 이력의 재발 패턴) 실수를 피했다.
  - 제안: 조치 불요(양호, 확인용 기재).

- **[INFO]** 이번 라운드가 커밋한 review/consistency 산출물(파일 10~54)이 코드베이스가 아닌 `review/**` 아래 위치해, `spec/**`·`codebase/**`·`plan/**` 3영역 쓰기 경계와 충돌하지 않는다.
  - 위치: `review/code/2026/08/23/22_51_46/**`, `review/code/2026/08/23/23_16_40/**`, `review/consistency/2026/08/23/22_26_33/**`, `review/consistency/2026/08/23/23_29_27/**`
  - 상세: 아키텍처 관점의 "모듈 경계"를 코드가 아니라 저장소 워크플로 산출물 배치로 확장 해석하면, 리뷰 산출물이 소스 레이어와 분리된 별도 디렉토리 트리에 있어 빌드/런타임 경계와 섞이지 않는다.
  - 제안: 조치 불요.

## 잘된 점 (참고)

- **문서/코드/spec 3층 정합**: `_retryState`/`_resumeState`(엔진 내부) vs `nodeOutput`/`buttonConfig.nodeOutput`(외부 egress clone) 의 경계가 `websocket.service.ts` JSDoc, `node-output-allowlist.ts` JSDoc, `spec/5-system/6-websocket-protocol.md` §4.4, `plan/complete/sse-nodeoutput-allowlist.md` 네 곳에서 같은 문장으로 반복돼 drift 위험이 낮다.
- **"내부 WS 는 건드리지 않는다"는 명시적 레이어 분리**: `toFanoutEnvelope` 은 `broadcastToChannel` 로 이미 나간 `wireEnvelope` 을 건드리지 않고 **새 clone** 만 좁힌다(`websocket.service.ts:463-466` JSDoc, `:319`/`:391` vs `:327`/`:394` 소스 대조로 확인). 내부 디버깅 표면(에디터 콘솔)과 외부 egress 계약을 물리적으로 분리해, allowlist 도입이 내부 관측성을 훼손하지 않는다 — 레이어 책임 분리가 정확하다.
- **자기반증형 소정정의 3중 동기화**: `CHANGELOG.md`·`plan/in-progress/spec-draft-eia-62-waiting-payload.md`·`plan/complete/sse-nodeoutput-allowlist.md` 세 문서가 같은 반증(SSE 도 닫혔다, 단 `execution.node.*` 는 잔여)을 취소선+정정 블록으로 일관되게 반영해, "예고가 틀렸는데 한 곳만 고쳐 나머지가 낡는" 이 저장소의 반복 결함 클래스를 이번엔 피했다.

## 요약

이번 3라운드 diff 는 핵심 로직(`allowlistFanoutNodeOutput`, `NODE_OUTPUT_ALLOWED_KEYS`, `toFanoutEnvelope` 배선)에 대한 변경이 전혀 없고, 이미 두 차례 리뷰로 수렴된 코드에 캐너리 테스트·JSDoc 정정·CHANGELOG/plan 자기반증형 소정정만 얹은 순수 문서/테스트 라운드다. 직접 소스를 열어 `23_16_40` 라운드가 검토한 코드와 현재 코드가 바이트 단위로 동일함을 확인했고, 그 라운드가 남긴 세 가지 구조적 긴장(shared/utils 도메인 타입 결속, 컨벤션-only chokepoint, 공유 allowlist 의 표면 간 결합)은 전부 정본 트래커에 재개 조건과 함께 등재돼 있어 재론할 근거가 없다. `execution.node.*` 의 `envelope.output` 을 의도적으로 이번 좁히기 대상에서 제외한 경계와, 내부 WS store 와 외부 egress clone 을 물리적으로 분리한 설계는 문서·코드·spec 세 층이 일관되게 뒷받침한다. 신규 CRITICAL/WARNING 은 없다.

## 위험도
NONE
