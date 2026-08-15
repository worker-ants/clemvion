# 문서화(Documentation) 리뷰 — `21_49_51`

## 검토 방법

이 diff(`origin/main`...`HEAD`, `b5ef57c3a`)는 `ws-event-types-extract` 작업 전체 — `websocket.service.ts`
의 값(enum)·타입 선언을 의존성-프리 모듈 `websocket-events.types.ts` 로 분리한 리팩터, 그 위에 쌓인
6라운드의 `/ai-review`(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`→`21_14_51`)와 각 RESOLUTION 커밋,
그리고 마지막 fix 커밋(`b5ef57c3a`, 이번 라운드가 처음 보는 신규 델타 — 가드 스펙의 오탐(FP) 수정 +
plan 갱신)까지 전부 포함한다.

프롬프트 번들은 컨텍스트 예산 한계로 다수 파일(특히 `websocket-events.types.ts`,
`websocket-events.types.spec.ts`, `websocket.service.ts`)의 diff 를 생략했으므로, 이전 5라운드가
누적 지적한 documentation 항목 — 클래스 JSDoc orphan · `NotificationEventType` JSDoc 이중 블록 ·
WARN #10 credential JSDoc 고아화 · `import type` 누락(3곳→4곳 재발) · `websocket.service.ts` stale
"KB union" 주석(3라운드 반복) · plan 의 "타입 9" 오기 — 가 최종 커밋까지 실제로 반영됐는지를 프롬프트
게이트가 아니라 현재 소스(`Read`)와 `git show b5ef57c3a`로 직접 대조했다.

## 발견사항

없음 — Critical/Warning/INFO 급 신규 문서화 결함 없음.

## 확인 — 누적 지적 사항의 최종 반영 상태 (전부 해소 확인, 소스 직접 대조)

- **클래스 JSDoc orphan (`19_27_37` W2)**: `execution-event-emitter.service.ts` 현재 소스(1-110행) —
  `TERMINAL_SHAPE` 상수+JSDoc(51-84행)이 클래스 JSDoc(86-101행) **위**에 위치해 `@Injectable()`
  클래스 선언(103-104행)에 클래스 설명이 정상 인접함을 확인.
- **`NotificationEventType` JSDoc 및 "개명은 별도 항목" 약속 이행**: `websocket-events.types.ts:217-219`
  의 disambiguation 경고에 "개명은 별도 항목"이라 적혀 있고, `plan/in-progress/ws-event-types-extract.md:293`
  에 `NotificationEventType` 개명 항목이 실제로 등재돼 있음을 확인 — 약속과 실제 등재가 어긋나지 않는다.
- **WARN #10 credential JSDoc 고아화 (`19_27_37` W4)**: `websocket-events.types.ts` 에는 남아있지
  않고, `websocket.service.ts:52-59` — 실제 구현(`CREDENTIAL_KEY_PATTERN`, 59행) 바로 위에 정상
  부착되어 있음을 확인.
- **`import type` 누락 (`20_05_17` W1 3곳 → `20_27_08` W1 4곳 재발 → `21_14_51` 구조적 가드로 고정)**:
  `chat-channel.dispatcher.ts:11`, `notification-fanout.service.ts:11`, `sse-adapter.service.ts:8`,
  `execution-event-emitter.service.spec.ts:8`(`ExecutionRoutingContext`), `websocket.service.spec.ts`
  전부 `import type`/인라인 `type` 태그로 통일돼 있음을 `grep`+직접 열람으로 재확인.
- **`websocket.service.ts` stale "KB union" 주석 (3라운드 연속 지적)**: 현재 소스 129-136행 —
  "그 선언이던 KB union 은 이후 `websocket-events.types.ts` 로 옮겨졌으니 '바로 아래' 로 읽지 말 것"로
  파일-불변적 표현으로 정정되어 있음을 확인.
- **plan 의 re-export 개수 오기 (`20_50_49` requirement INFO7, "타입 9")**: `plan/in-progress/ws-event-types-extract.md:69`
  — "값 4 + 타입 8"로 정정되어 있고 "`20_50_49` INFO7 이 '타입 9' 오기를"이라는 정정 이력까지 남아
  있음을 확인. 실제 `websocket.service.ts` 의 `export type {...}` 블록(8개)과 일치.
- **마지막 커밋(`b5ef57c3a`)이 새로 도입한 텍스트**: `websocket-events.types.spec.ts` 에 `leavesValueEdge`
  헬퍼(오탐 재현·원인·교정 근거를 JSDoc 에 구체적으로 서술) + `SERVICE_MODULE`/`EVENT_MODULES` 정규식에
  근거 주석(후자가 `websocket.service` 도 매치하는 이유 — "facade 경유도 같은 심볼") 신설. 이 커밋은
  production 코드를 건드리지 않고 가드 스펙(+57줄)과 plan 문서(+34줄)만 변경했으며, 신규 텍스트는 발견
  경위·재현 프로브·교정 근거를 코드에 남기는 이 저장소 컨벤션에 부합한다.
- **README/CHANGELOG/API 문서**: 신규 공개 API·엔드포인트·환경변수·설정 옵션 없음(순수 내부 모듈
  리팩터 + 회귀 가드 테스트). 이 저장소는 CHANGELOG.md 를 쓰지 않고 spec Rationale + plan 으로 변경
  이력을 관리하는 기존 컨벤션과 일치하며 갱신 대상 아님.
- **`spec/5-system/6-websocket-protocol.md` frontmatter**(파일 112): `code:` 목록에
  `websocket-events.types.ts` 1줄만 추가, 본문 변경 없음. `spec_impact: none`과 무모순이며 신규
  `.spec.ts` 는 이 저장소 convention 상 `code:` 글로브 대상이 아님(다른 `*.spec.ts` 도 미등재).

## 요약

6라운드에 걸친 `/ai-review` 사이클이 누적 지적한 documentation 관점 결함(JSDoc 고아화 2건, JSDoc
이중 블록 1건, 3라운드 반복된 stale 컨텍스트 주석 1건, `import type` 누락의 재발 패턴, plan 수치
오기 1건) 전부가 최종 커밋(`b5ef57c3a`)까지 실제로 반영돼 있음을 소스 직접 대조로 확인했다. 특히
`import type` 누락은 "지적된 인스턴스만 고친다 → 다음 라운드에 또 나온다"는 패턴을 인지하고
하드코딩 목록 대신 타입 모듈을 파싱해 부류를 고정하는 다섯 번째 테스트로 전환했고, 이번 마지막
델타는 그 가드 자신의 오탐(FP)까지 대조군을 넓혀 닫으면서 발견 경위를 JSDoc 에 남겨 문서 위생이
이례적으로 높다. 새로 추가된 텍스트(가드 헬퍼 JSDoc, plan 수정 이력)에서도 신규 문서화 결함은
발견되지 않았다. README/CHANGELOG/API 문서 갱신 필요성 없음(순수 내부 리팩터), spec frontmatter
`code:` 목록 갱신은 최소·정확하다. 병합을 막을 문서화 사유 없음.

## 위험도

NONE
