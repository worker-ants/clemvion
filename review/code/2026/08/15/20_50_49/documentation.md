# 문서화(Documentation) 리뷰 — `20_50_49`

## 검토 방법

이 diff(`origin/main`...`HEAD`, `e8585b574`)는 `ws-event-types-extract` 작업 전체 —
`websocket.service.ts` 의 값(enum)·타입 선언을 의존성-프리 모듈
`websocket-events.types.ts` 로 분리한 리팩터, 그 위에 쌓인 3라운드의 `/ai-review`
(`19_27_37` → `20_05_17` → `20_27_08`)와 그 RESOLUTION 커밋들, 그리고 마지막 fix 커밋
(`e8585b574`, 이번 라운드가 처음 보는 신규 델타)을 전부 포함한다.

이전 세 라운드의 documentation 관점 발견 — 클래스 JSDoc orphan(`19_27_37` W2),
`NotificationEventType` JSDoc 이중 블록(W3), WARN #10 credential JSDoc 고아화(W4),
`import type` 누락 3곳(`20_05_17` W1) → 재발 4곳(`20_27_08` W1), `websocket.service.ts`
stale "KB union" 주석(3라운드 반복 지적) — 이 전부 최종 커밋에서 실제로 반영됐는지, 그리고
마지막 fix 커밋(`e8585b574`) 자체가 새 문서화 결함을 들여오지 않았는지를 프롬프트 diff 게이트가
아니라 현재 소스(`Read`)와 `git show e8585b574`로 직접 대조했다.

## 발견사항

없음 — Critical/Warning/INFO 급 신규 문서화 결함 없음.

## 확인 — 누적 지적 사항의 최종 반영 상태 (전부 해소 확인)

- **클래스 JSDoc orphan (`19_27_37` W2)**: `execution-event-emitter.service.ts` 현재 소스 —
  `TERMINAL_SHAPE` 상수+JSDoc 이 클래스 JSDoc **위**에 위치해 `@Injectable()` 클래스 선언에
  클래스 설명이 정상 인접함을 확인.
- **`NotificationEventType` JSDoc 이중 블록 (`19_27_37` W3)**: `websocket-events.types.ts:209-218`
  — 채널·권위 출처 설명과 disambiguation 경고("⚠️ 인앱 알림 벨 전용...")가 한 블록으로
  병합돼 `export enum NotificationEventType`에 정상 부착. 그 안에 적힌 "개명은 별도 항목"이란
  약속도 `plan/in-progress/ws-event-types-extract.md:227`에 실제로 등재돼 있음을 확인(약속과
  실제 등재가 어긋나지 않음).
- **WARN #10 credential JSDoc 고아화 (`19_27_37` W4)**: `websocket-events.types.ts`엔 남아있지
  않고 `websocket.service.ts:51-58`, 실제 구현(`CREDENTIAL_KEY_PATTERN`, 60행) 바로 위에
  정상 부착.
- **`import type` 누락 (`20_05_17` W1 3곳 → `20_27_08` W1 4곳 재발)**: 재발 원인이 "지목된
  인스턴스만 고쳤기 때문"이라는 자체 분석이 정확하며, 최종 수정은 인스턴스 나열이 아니라
  `websocket-events.types.spec.ts`에 다섯 번째 테스트(타입 모듈을 파싱해 타입 전용 심볼
  목록을 동적으로 얻고, `type` 표시 없이 import 하는 곳을 전수 검사)로 **부류를 고정**했다.
  현재 코드에서 `chat-channel.dispatcher.ts`, `notification-fanout.service.ts`,
  `sse-adapter.service.ts`, 그리고 마지막 커밋이 추가로 잡은 spec 2곳
  (`execution-event-emitter.service.spec.ts`, `websocket.service.spec.ts`) 및
  `execution-engine.service.ts`/`ai-turn-executor.ts` 모두 `import type`으로 통일됨을
  `git show e8585b574`로 확인.
- **`websocket.service.ts` stale "KB union" 주석 (3라운드 연속 지적)**: `websocket.service.ts:134-136`
  — "그 선언이던 KB union 은 이후 `websocket-events.types.ts` 로 옮겨졌으니 '바로 아래' 로
  읽지 말 것"로 파일-불변적 표현으로 정정돼 있음을 확인.
- **가드 자신의 판별 기준 결함 (`20_27_08` W2, 별칭 vs 원 식별자)**: `websocket-events.types.spec.ts:112-173`
  의 `valueEdgeToWebsocketService` — 원인·재현 프로브(FP/FN 양방향)·교정 근거가 함수 상단
  JSDoc과 인라인 주석에 구체적으로 남아 있고, `export … from` 분기에 `WebsocketService` 예외를
  **의도적으로 비대칭**으로 둔 이유(DI 주입의 불가피함 vs re-export 우회 경로)까지 코드에
  명문화됨. 마지막 커밋(`e8585b574`) 자체가 도입한 신규 텍스트이지만 결함이 아니라 오히려
  이 저장소 컨벤션(왜/근거를 코드에 남긴다)에 부합.
- **README/CHANGELOG/API 문서**: 신규 공개 API·엔드포인트·환경변수·설정 옵션 없음(순수 내부
  모듈 리팩터 + 회귀 가드 테스트). 이 저장소는 CHANGELOG.md 를 쓰지 않고 spec Rationale + plan
  으로 변경 이력을 관리하는 기존 컨벤션과 일치하며 갱신 대상 아님.
- **`spec/5-system/6-websocket-protocol.md` frontmatter**: `code:` 목록에
  `websocket-events.types.ts` 1줄만 추가, 본문 변경 없음. `spec_impact: none`과 무모순.
- **`plan/in-progress/ws-event-types-extract.md`**: "왜"·"실측"·"역재현"·"구현 중 잡은 것"
  섹션이 구체적 수치(25→13, 66 suites 실패→425/425, 뮤테이션 표 M1~M14/N1~N3)로 근거를 남긴
  모범적 plan 문서. 체크리스트가 실제 반영 상태와 일치(마지막 두 항목이 이번 라운드에서 `[x]`로
  갱신됨을 `git show e8585b574` diff로 확인).

## 요약

이 diff는 3라운드에 걸친 `/ai-review`가 누적 지적한 documentation 관점 결함(JSDoc 고아화 2건,
JSDoc 이중 블록 1건, stale 컨텍스트 주석 1건, `import type` 누락의 재발 패턴 1건) 전부가 최종
커밋까지 실제로 반영됐음을 소스 직접 대조로 확인했다. 특히 `import type` 누락은 "지적된 인스턴스만
고친다 → 다음 라운드에 또 나온다"는 패턴을 스스로 인지하고, 하드코딩된 목록 대신 타입 모듈을
파싱해 부류 자체를 고정하는 테스트로 전환한 점이 문서화 위생 측면에서도 우수하다(재발 방지 근거가
테스트 파일의 JSDoc에 남아 향후 동일 지적을 예방한다). 새로 추가된 마지막 커밋(`e8585b574`)의
변경분(6개 소스 파일 `import type` 정정 + 신규 회귀 테스트 1개 + plan 갱신)에서도 새로운 문서화
결함은 발견되지 않았다. README/CHANGELOG/API 문서 갱신 필요성 없음(순수 내부 리팩터), spec
frontmatter `code:` 목록 갱신은 최소·정확하다. 병합을 막을 문서화 사유 없음.

## 위험도

NONE
