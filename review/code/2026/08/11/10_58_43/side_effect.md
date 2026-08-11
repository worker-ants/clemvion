# 부작용(Side Effect) 리뷰 — round `10_58_43`

## 스코프 확정

프롬프트에 번들된 diff 는 브랜치 누적분(다수 이전 라운드에서 이미 리뷰된 `eia-client.ts`·
`session-store.ts`·`use-token-refresh.ts` 등 포함)이라, orchestrator 지시대로 **이번 delta**만
스코프로 잡았다. `git show 37b38cf31 --stat` 로 실제 커밋 범위를 확인:

```
codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts      |  5 +-
codebase/channel-web-chat/src/widget/use-widget.test.ts                 | 36 ++-
codebase/channel-web-chat/src/widget/use-widget.ts                      | 19 ++--
plan/in-progress/webchat-auth-session-status-reconcile.md               |  2 +-
```

정확히 태스크 설명(`shouldAbortAfterSeed`·`SeedOutcome` export, 단위 테스트 3건, 주석 정정)과
일치한다.

## 변경 내용 분석

### 1. `export` 키워드 추가 — `codebase/channel-web-chat/src/widget/use-widget.ts:84`, `:142`

- `type SeedOutcome` → `export type SeedOutcome` (`use-widget.ts:84`)
- `function shouldAbortAfterSeed` → `export function shouldAbortAfterSeed` (`use-widget.ts:142`)

함수 본문(`return outcome !== "continue" && outcome !== "refresh_deferred";`)과 시그니처
(`(outcome: SeedOutcome): boolean`)는 **불변**. `type` 은 컴파일 타임에 완전히 소거되므로 런타임
동작에 관여할 수 없다. `export` 는 모듈의 export table 에 바인딩을 등록할 뿐 — 함수 선언은
`export` 여부와 무관하게 호이스팅되고, 기존 모듈 내부 호출부(`start()`·`applyConfig`)의 호출
방식·시점·인자는 그대로다. 따라서 **동작 변경 0** — 지난 라운드에 검증한 `sseErrorDetail` export
(동일 패턴)와 같은 결론이다.

**인터페이스 확장 영향 확인**:
- `grep` 으로 `use-widget.ts` 를 import 하는 유일한 소비자는 `widget-app.tsx` 이며, 거기서 쓰는
  것은 `useWidget` 훅 하나뿐 — 신규 export 를 끌어다 쓰는 곳이 없다.
- barrel re-export(`export * from "./use-widget"`) 는 저장소 전체에 없음(`grep` 0건) — 신규
  export 가 의도치 않게 더 넓은 공개 표면(예: 패키지 진입점)으로 새어나갈 경로가 없다.
- 두 export 모두 함수/타입 JSDoc 에 `@internal — unit-test seam only` 주석이 붙어 있고, 이는
  같은 파일의 `sseErrorDetail`, 그리고 `eia-client.ts:30`·`safe-html.ts:56` 에서 이미 쓰인
  저장소 기존 컨벤션과 동일하다 — 신규 패턴이 아니라 기존 관례를 따른 것.
- production 번들 관점에서도 신규 export 를 실제로 import 하는 곳이 테스트 파일뿐이라 tree-shaking
  결과에 실질적 영향은 없다(named export 미사용 시 제거).

**결론**: 시그니처 변경 없음, 공개 API 확장은 이미 확립된 `@internal` 테스트-seam 관례를 따름,
소비자 영향 없음 — 부작용 소지 없음.

### 2. 단위 테스트 3건 — `use-widget.test.ts`

- `sseErrorDetail` 의 `readyState: undefined` 케이스(존재하지만 값이 `undefined`)
- `shouldAbortAfterSeed` 4-way 진리표
- `shouldAbortAfterSeed` fail-closed(미지 갈래 → 중단) 케이스

순수 함수에 대한 read-only 단언만 수행한다. `vi.fn`/mock/timer 조작이나 모듈 상태를 건드리는
설정이 없고, 테스트 파일 스코프 밖으로 새는 부작용(전역 오염, fixture 파일 I/O 등)도 없다.

### 3. 주석/JSDoc 정정 — `use-widget.ts`, `use-widget-eager-start.test.ts`, `webchat-auth-session-status-reconcile.md`

전부 `//` 또는 `/** */` 주석 블록 내부 문구 교정("(실측)" → "(정적 추적 — …)" 라벨 정정,
`4-security §5` → `§1` 인용 정정, provenance 문구 복원)이다. 실행 가능한 코드·문자열 리터럴에
닿지 않으므로 런타임 동작에 영향 없음.

## 발견사항

없음 — 이번 delta 는 (a) 타입 export(런타임 소거), (b) 이미 사용 중인 `@internal` 테스트-seam
관례를 따른 순수 함수 export, (c) 신규 단위 테스트, (d) 주석 정정으로만 구성되며 어느 것도
전역 상태·파일시스템·환경 변수·네트워크·이벤트/콜백·기존 시그니처를 건드리지 않는다.

## 요약

이번 delta 는 `SeedOutcome` 타입과 `shouldAbortAfterSeed` 함수에 `export` 를 추가해 기존
`sseErrorDetail` 과 동일한 `@internal` unit-test seam 패턴으로 노출하고, 그 노출로 가능해진
3건의 단위 테스트(진리표 + fail-closed + `sseErrorDetail` undefined 축)를 추가했으며, 나머지는
주석/JSDoc 문구 정정이다. 함수 본문·시그니처는 불변이고, 신규 export 를 실사용하는 소비자는
테스트 파일뿐이며 barrel re-export 경로도 없어 공개 표면 확장이 실질적 영향으로 이어지지
않는다. 직전 라운드와 동일하게 **동작 변경 0** 을 확인했다.

## 위험도

NONE
