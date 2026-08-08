# 유지보수성(Maintainability) 리뷰

## 스코프 메모

`git diff origin/main...HEAD --stat` 기준 실제 변경 파일은 75개이나, 본 프롬프트에는 40개만
포함되어 있다(orchestrator 측 예산 절단으로 추정, `plan/in-progress/*.md` 2건과
`nodes/**`·`workflow-assistant/**`·`websocket.service.ts` 등 35개가 프롬프트에서 누락).
아래 리뷰는 프롬프트에 포함된 40개 파일 + 실제 `git diff`로 대조 확인한 내용을 기준으로 한다.
누락된 35개 파일은 다른 reviewer 인스턴스가 커버했거나 커버되지 않았을 수 있으니 SUMMARY
단계에서 별도 확인이 필요하다.

## 변경 성격

전체 diff(75개 파일, +272/-375줄)는 `plan/in-progress/backend-lint-gate-broken-on-main.md`가
가리키는 backend lint gate 작업의 일부로, 사실상 전량이 기계적 lint/format 정리다:

- `@typescript-eslint/no-unnecessary-type-assertion` 위반 제거 (불필요한 `as X` 캐스트 삭제)
- Prettier 3.9 규칙 적용 — multi-line leading-pipe union(`| 'a'\n| 'b'`)을 한 줄 union으로 병합,
  `registerAs(name, factory)` 호출부 병합
- 진짜로 필요한 캐스트(빌드 에러 유발)는 삭제하지 않고 `eslint-disable-next-line` + 근거 주석을
  추가해 보존

이 성격상 발견사항은 대체로 INFO 수준이며, CRITICAL/WARNING급 유지보수성 결함은 발견되지 않았다.

## 발견사항

- **[INFO]** 캐스트 제거로 지역 타입 문서화가 옅어진 지점
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:525`, `:575`
  - 상세: `result: ((event.payload as {...}).result ?? {}) as { outputs?: unknown; finalNodeId?: string; finalPort?: string }` 형태의 로컬 shape 캐스트가 `result: (event.payload as { result?: unknown }).result ?? {}`로 단순화됐다. 함수 `toChatChannelEvent`의 선언된 반환 타입(`EiaEvent | ChatChannelInternalEvent | null`)이 여전히 이 필드의 구조를 강제하므로 타입 안전성 손실은 없다(`no-unnecessary-type-assertion`이 정확히 잡은 케이스). 다만 해당 호출부만 읽는 리뷰어 입장에서는 `result`에 어떤 필드가 기대되는지 로컬 주석/캐스트로 즉시 확인하던 것이 사라져, 상위 타입 정의까지 거슬러 올라가야 한다.
  - 제안: 필요하다면 인접 라인에 `result` shape 를 가리키는 1줄 주석(예: `// shape: EiaEvent['result']`)만 남겨도 충분 — 캐스트 복원은 불필요.

- **[INFO]** load-bearing assertion 근거 주석이 2개 파일에 유사 문구로 중복
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:171-174` (근방, `setEngineResolvedConfig` 내부 `as MutableExecutionContext` 앞), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:711-714` (근방, `errorObj` 캐스트 앞)
  - 상세: 두 곳 모두 "`no-unnecessary-type-assertion`이 불필요하다고 지목하지만 `nest build`로 반증됐다"는 취지의 3~4줄 주석을 독립적으로 작성했다. 내용은 정확하고 각자 문맥(TS2542 vs TS2339)에 맞게 잘 설명돼 있어 즉시 문제는 아니지만, 향후 같은 패턴의 caveat가 더 늘어나면 파편화된다.
  - 제안: 반복될 경우 `spec/conventions/` 또는 코드 내 공용 주석 템플릿으로 "known no-unnecessary-type-assertion false-positive" 패턴을 한 곳에 정리하고 각 사이트는 링크만 남기는 것을 고려. 현재 2건뿐이라 시급하지 않음.

- **[INFO]** union 타입 한 줄 병합(prettier 3.9)이 일부 라인에서 폭이 넓어짐
  - 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts:247-248`(예: `{ rows?: Array<Record<string, unknown>>; columns?: string[] } | undefined;`), 동일 패턴이 discord-message.renderer.ts·telegram 계열에도 반복
  - 상세: 기존 leading-pipe multi-line union이 단일 라인으로 병합되며 일부 anonymous object 타입 union은 가로로 길어졌다. Prettier 자동 포맷이며 전체 코드베이스에 일괄 적용되는 규칙이라 이 PR만의 문제는 아니고, 별도 조치 불필요(정보 제공 목적).

## 요약

리뷰 대상 diff는 실질적으로 신규 로직이 아니라 `no-unnecessary-type-assertion` lint 위반 제거 +
Prettier 3.9 재포맷의 기계적 정리 작업이며, 가독성/네이밍/함수 길이/중첩/매직넘버/중복/복잡도 관점에서
새로운 구조적 결함을 도입하지 않는다. 특히 실제로 필요한(`nest build`로 반증된) 캐스트는 삭제 대신
`eslint-disable-next-line` + 근거 주석으로 보존해 안전망을 남긴 점이 바람직하다. 유일하게 눈에 띄는
트레이드오프는 `chat-channel.dispatcher.ts`의 로컬 shape 캐스트 제거로 인한 미세한 지역 문서화 손실인데,
상위 함수 반환 타입이 여전히 그 구조를 강제하므로 타입 안전성 문제는 아니다. 다만 본 프롬프트가 실제
diff의 40/75 파일만 담고 있어 나머지 35개 파일(`nodes/**`, `workflow-assistant/**`,
`websocket.service.ts` 등)은 이 리뷰에서 커버되지 않았다는 점을 SUMMARY 단계에서 인지해야 한다.

## 위험도

LOW
