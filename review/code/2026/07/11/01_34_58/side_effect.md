# 부작용(Side Effect) Review — execution-engine.service.ts (49ea06f7)

## 대상 변경

`resumeFromCheckpoint` 의 `persistedInteractionType` 계산을 손코딩 fallback 체인에서
`readPersistedInteractionType(cachedOutput)` (waiting-surface-guard.ts) 호출로 치환.
부수적으로 미사용 `toRecord` import 제거.

## 발견사항

- **[INFO]** 유효 데이터 동등성 확인 — 순수 함수 치환, 의도한 대로 회귀 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1713-1720`
  - 상세: 신구 두 구현을 `cachedOutput`/`meta` 의 모든 실질 shape(undefined·null·object·array·primitive, `interactionType` 문자열/비문자열)에 대해 대조했다.
    - `cachedOutput` 이 `undefined`/`null` → 두 구현 모두 `undefined`.
    - `meta` 가 `null`/`undefined`/배열/원시값(비-object) → 구 `toRecord(x)` 도 `{}` 로 수렴, 신 `readPersistedInteractionType` 도 `typeof meta === 'object'` 가드로 동일하게 flat fallback 경로로 떨어진다 (`toRecord` 의 `isRecord` 배열-제외 규칙과 신 함수의 `typeof === 'object'` null-제외 체크가 이 서브케이스에서 동형).
    - `meta.interactionType` 이 유효 문자열 → 양쪽 동일 값 반환.
    - `interactionType` 미존재(구조화 envelope 없음, legacy flat root) → 양쪽 동일하게 flat 값 fallback.
    - 결론: **유효 데이터에서 완전히 동일한 반환값**. 커밋 메시지의 "의미 동일(유효 데이터)" 주장이 코드로 검증됨.
  - 제안: 없음 (정상)

- **[INFO]** 손상 데이터 경로에서 의도된 행동 변화 — fail-closed 강화 + 부수적 fallback 복구
  - 위치: `waiting-surface-guard.ts:111-136` (`coalesceInteractionType`/`readPersistedInteractionType`) vs 제거된 구 코드
  - 상세: 구 코드 `(cachedMeta.interactionType as string | undefined) ?? (cachedOutput?.interactionType as string | undefined)` 는 `as` 타입 단언일 뿐 런타임 문자열 검증이 없다. `meta.interactionType` 이 비-문자열(예: 숫자 `7`)이면 `??`(nullish coalescing) 는 `null`/`undefined` 만 체크하므로 그 값을 그대로 통과시켰다 — **flat 값으로 fallback 하지 않는다**. 신 코드는 `coalesceInteractionType` 의 `typeof === 'string'` 가드로 비-문자열 meta 값을 무시하고 flat 값으로 정상 fallback 한다 (`coalesceInteractionType(7, 'buttons') === 'buttons'`, `waiting-surface-guard.spec.ts:182`).
    - 실질 영향: 손상된 `meta.interactionType`(비-문자열) + 유효한 flat `interactionType` 이 공존하는 malformed row 에서, 구 코드는 corrupt 값을 들고 있다가 `dispatchResumeTurn` 의 `===` 문자열 비교에서 전부 미스매치 → `RESUME_INCOMPATIBLE_STATE`/`RESUME_CHECKPOINT_MISSING` 로 재개 실패. 신 코드는 flat 값으로 정상 복구해 올바른 handler 로 라우팅될 수 있다. 이는 **회귀가 아니라 개선**(구 latent bug 해소)이며 하류 `dispatchResumeTurn` 의 `===` 문자열 비교 특성상 corrupt 값이 우연히 다른 유효 케이스와 충돌할 가능성은 없다(비-문자열이 `'ai_conversation'`/`'ai_form_render'`/`'buttons'` 와 strict-equal 될 수 없음).
    - 이 서브케이스(meta 존재+비문자열, flat 유효)는 `waiting-surface-guard.spec.ts:187-213` 에서 순수 함수 단위로 커버되나(`{ meta: { interactionType: 7 } }` → `undefined`, flat 없음 케이스), `execution-engine.service.spec.ts` 쪽 `resumeFromCheckpoint` 통합 테스트들은 전부 유효 문자열 `meta.interactionType` 만 주입해 이 fallback-복구 서브케이스를 직접 관통하지 않는다(관찰, 차단 아님).
  - 제안: 없음 — 커밋 메시지가 이 차이를 명시적으로 인지·문서화했고("손상 데이터에는 더 엄격(fail-closed)"), 실 malformed row 는 배포 이전 레거시/손상 케이스로 희귀하며 방향성(fail-closed + 정상 fallback 복구)이 안전 쪽.

- **[INFO]** 하류(`dispatchResumeTurn` 라우팅) 영향 없음 — 단일 계산 지점 유지
  - 위치: `execution-engine.service.ts:1720, 1784, 1840, 1877, 1925, 1934` 및 `driveCallStackResume`/`driveResumeAwaited`/`driveResumeFrame` 호출부(2038-2069, 2249, 2364-2407)
  - 상세: `persistedInteractionType` 은 `resumeFromCheckpoint` 에서 **단 한 번** 계산돼 `isAiConversation` 판정과 `driveCallStackResume`/`driveResumeAwaited` 로 그대로 전달되고, 이후 `dispatchResumeTurn` selector(`buttons`/`ai_conversation`)·에러 메시지 보간에서 소비된다. 이 흐름 자체(호출 그래프·필드 전달 순서)는 diff 로 변경되지 않았고, 계산식 하나만 교체됐으므로 라우팅 로직·selector 비교 대상에 구조적 변화가 없다. 다른 위치(`driveResumeFrame` 등)에서 별도로 `persistedInteractionType` 을 재계산하는 중복 코드는 없음을 확인(grep) — SoT 단일화가 실제로 성립.
  - 제안: 없음

- **[INFO]** `toRecord` import 제거 — 다른 소비처 영향 없음 (grep 0 확인)
  - 위치: `execution-engine.service.ts:107` (제거된 import)
  - 상세:
    - 파일 내 `toRecord(` 잔존 호출 0건, `cachedMeta` 잔존 참조 0건 (dangling reference 없음, 컴파일 안전).
    - `./utils/to-record` 모듈의 `toRecord` export 를 import 하는 다른 파일 0건 (`grep -rn "utils/to-record"` → `handler-output.adapter.ts` 가 `isRecord` 만 import, `toRecord` 는 아님).
    - `telegram-client.ts` 에 동명 `toRecord` 함수가 있으나 완전히 별개의 로컬 함수(파일 내부 정의, `execution-engine/utils/to-record.ts` 와 무관) — 혼동 없음.
    - `to-record.ts` 자체는 삭제되지 않았고 `toRecord`/`isRecord` 둘 다 계속 export 됨 — 향후 재사용 가능, 파괴적 변경 아님.
  - 제안: 없음 (안전한 dead-import 정리)

- **[INFO]** 전역 상태·파일시스템·환경 변수·네트워크·이벤트/콜백 — 해당 없음
  - 상세: `readPersistedInteractionType`/`coalesceInteractionType` 은 인자만 읽는 순수 함수(전역 변수·모듈 레벨 mutable state·`process.env`·I/O 없음). `resumeFromCheckpoint` 의 시그니처(파라미터 개수·타입·반환 타입)도 이번 diff 로 변경되지 않았고 private 메서드라 외부 호출자 영향 없음. `readPersistedInteractionType` 자체는 이미 `waiting-surface-guard.ts` 에 존재하던 공개 함수이며 이번 diff 로 그 정의나 export 표면이 바뀌지 않았다(새 소비처 추가일 뿐).

## 요약

이번 diff 는 순수 함수(`readPersistedInteractionType`)로 손코딩 fallback 체인을 대체하는 리팩터로, 유효 데이터에서는 신구 구현이 완전히 동일한 값을 반환함을 모든 shape 조합에 대해 확인했다. 유일한 실질 행동 차이는 malformed(비-문자열 `meta.interactionType`) 데이터에서 구 코드가 corrupt 값을 그대로 흘려보내던 latent 결함을 신 코드가 fail-closed + flat-fallback 복구로 고친 것이며, 이는 커밋 메시지가 명시적으로 인지·의도한 개선이고 `dispatchResumeTurn` 의 strict-equal 라우팅 특성상 부작용 위험이 없다. `dispatchResumeTurn` 하류 라우팅 흐름·시그니처·공개 인터페이스는 변경되지 않았고, `toRecord` import 제거는 grep 으로 다른 소비처가 전혀 없음을 확인해 부작용이 없다. 전역 상태·파일시스템·환경 변수·네트워크·이벤트 콜백 관점에서도 해당 사항 없음.

## 위험도

NONE
