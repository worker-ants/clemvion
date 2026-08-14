# 아키텍처 리뷰 — EIA 종결(terminal) `error` payload 정규화 (최종 게이트, `23_34_12`)

## 리뷰 범위 및 이전 라운드 대비

이 diff 의 핵심 코드(파일 1~12)는 `22_55_51`(CRITICAL 1·WARNING 10) → `23_17_57`(WARNING 6)
두 차례 ai-review 를 이미 거친 상태다. 두 라운드 모두 아키텍처 관점 WARNING/INFO 를 냈고
`RESOLUTION.md` 가 조치를 주장한다. 이번 라운드에서는 그 주장을 코드 실측으로 재검증하고,
새로 남은 diff(주로 `review/**`·`plan/**` 산출물)에 새 아키텍처 결함이 있는지 확인했다.

**재검증 결과 — 두 라운드의 핵심 아키텍처 개선이 실제로 반영돼 있다:**

- **순환 의존 회피가 실제로 구현됐다.** `23_17_57` RESOLUTION 이 주장한 "헬퍼를
  `shared/utils/` 로 승격" 을 직접 확인했다 — `codebase/backend/src/shared/utils/terminal-error-payload.ts`
  (파일 10)는 `chat-channel`·`execution-engine` 어느 쪽도 import 하지 않고, 소비 측
  (`chat-channel.dispatcher.ts` 파일 3 게이트 14, `execution-engine.service.ts` 파일 6 게이트
  204, `retry-turn.service.ts` 파일 8 게이트 4)은 전부 `shared/utils/` 를 단방향으로 참조한다.
  `execution-engine.service.ts` 가 기존에 이미 `../chat-channel/shared/form-mode` 를 import 하고
  있어(`grep` 로 직접 확인) `chat-channel → execution-engine` 역방향 import 는 실제로 순환을
  만들었을 것 — shared 계층으로의 승격은 이 저장소의 기존 유틸리티 계층 관례
  (`strip-external-only-fields.ts`·`sanitize-error-message.ts` 등, `shared/utils/` 디렉터리 실측
  확인)와도 일치하는 정공법이다.
- **DB 저장과 wire emit 의 단일 출처화가 실제로 지켜진다.** `failFirstSegmentSetup`
  (`execution-engine.service.ts`, 파일 6 관련부)·`failRetryExecution`(`retry-turn.service.ts`,
  파일 8 게이트 964-967)를 직접 읽어 확인 — 둘 다 DB 에 쓴 바로 그 `row.error`/`execution.error`
  객체를 그대로 `toTerminalErrorPayload` 에 넘긴다. 과거 `finalizeStalledExhausted` 에서 실제로
  발생했던 drift(emit 문구를 손으로 재작성하며 `attempts` 유실) 클래스가 구조적으로 재발 방지됐다.
- **프런트엔드 경계에서 anti-corruption layer 역할을 하는 정규화가 스토어보다 앞단에 있다.**
  `use-execution-events.ts`(파일 12, 게이트 264-270)가 wire 의 `string | object` 유니온을
  `errorMessage` 문자열로 정규화한 뒤에만 `failExecution`/`flushPendingToolItemsAsError` 를
  호출한다 — 스토어 쪽 시그니처(`failExecution: (error?: string) => void`, 직접 확인)는 바뀌지
  않았다. wire 형태가 또 바뀌어도 블라스트 반경이 이 하나의 훅으로 국한되는 설계다.

## 발견사항

- **[INFO]** 종결 `error` wire 형태가 여전히 두 곳에 독립 선언돼 있다 — `23_17_57` 라운드가
  "3중 선언 → 부분 해소(2중)" 로 이미 인지·수용한 상태의 연속이며, 이번 라운드에서도 재확인
  결과 그대로다.
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:36-41`(파일 10, 게이트
    36-41, `export interface TerminalErrorPayload`) vs
    `codebase/backend/src/modules/chat-channel/types.ts:399-409`(파일 4, 게이트 399-409,
    `EiaFailedEvent.error` 인라인 타입).
  - 상세: `chat-channel/types.ts` 는 `TerminalErrorPayload` 를 import 하지 않고 같은 모양을
    손으로 다시 선언한다(직접 grep 확인 — `types.ts` 안에 `toTerminalErrorPayload` 문자열은
    주석 인용 1건뿐, import 는 0건). 두 타입은 지금은 구조적으로 호환되지만(`nodeId` optionality
    차이는 이미 W6 로 검토돼 의도적으로 유지) 그 정합은 사람이 매번 다시 판단해야 하고
    컴파일러가 보장하지 않는다. `chat-channel.dispatcher.ts`(파일 3, 게이트 552)가 로컬 변수
    타입을 `EiaFailedEvent['error']` 로 통일해 선언 수를 3→2로 줄인 것은 실제 개선이지만, 그
    2번째 선언 자체를 `shared/utils` 쪽 타입에 연결하는 조치는 이번에도 없었다.
  - 제안: 신규 필드가 §6.4 wire 형태에 추가될 때 producer(`TerminalErrorPayload`)만 갱신하고
    consumer(`EiaFailedEvent.error`)를 빠뜨리는 회귀가 언젠가 재발할 수 있다는 점을 인지하고
    있으면 충분 — 실제로 발생하면 그때는 `Pick<TerminalErrorPayload, ...>` 재사용 또는 상호 링크
    주석으로 좁히는 것을 권장. 지금 당장 강제할 필요는 없다(현재 필드 집합이 안정적이고, 두
    선언 모두 이 diff 안에서 §6.4 인용을 명시하고 있어 다음 사람이 놓치기 어렵다).

- **[INFO]** `execution.cancelled` 계열은 이번 정규화 대상에서 계속 제외돼 같은 "종결 error"
  카테고리 안에 두 스키마(신규 nullable-object vs 기존 non-nullable `{code, message}`)가
  공존한다 — `23_17_57` INFO 의 연속. 새 diff 로 재확인한 결과 code(`execution-engine.service.ts`
  의 `emitCancellationEvent`, 이번 diff 밖)·spec(파일 62, 게이트 572·795-797)·plan(파일 19,
  `spec-sync-external-interaction-api-gaps.md`) 세 곳 모두 "의도적으로 분리된 비용 그룹"
  이라는 같은 서술로 일관돼 있다. 은폐가 아니라 명시적으로 추적되는 스코프 경계다.
  - 위치: `spec/5-system/14-external-interaction-api.md:572`(파일 62, 게이트 572).
  - 제안: 조치 불요. 후속 PR 에서 `emitCancellationEvent` 5개 호출부까지 `toTerminalErrorPayload`
    로 통일하면 이 카테고리의 "정규화는 한 곳에서" 원칙이 완결된다.

## 요약

이번 diff 의 코드 핵심부(9개 소스 파일)는 이미 두 차례 아키텍처 리뷰(WARNING 3건 → INFO 로
수렴)를 거친 상태이고, 이번 라운드의 독립 재검증에서 그 조치 주장(헬퍼의 `shared/utils` 승격에
의한 순환 의존 회피, DB/wire 단일 출처화, 프런트 경계 정규화)이 실제 코드와 일치함을 직접
확인했다 — `RESOLUTION.md` 의 서술이 부풀려지지 않았다. SRP(정규화 책임이 순수 함수 하나에
집중)·DRY(emit 4곳·consumer 1곳이 같은 헬퍼를 공유)·모듈 경계(execution-engine ↔ chat-channel
간 순환 없음, shared 계층을 통한 단방향 의존)가 모두 견고하다. 남은 두 관찰(`TerminalErrorPayload`
/`EiaFailedEvent.error` 2중 독립 선언, `execution.cancelled` 미통일)은 이 PR 이전부터 이미
검토·문서화된 트레이드오프의 잔여분이며 code·spec·plan 세 층위에서 일관되게 추적되고 있어 새로운
차단 사유가 아니다. 이번 라운드에서 새로 발견한 아키텍처 결함은 없다.

## 위험도

LOW
