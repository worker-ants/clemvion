# Maintainability Review — execution-engine.service.ts (rehydration SoT delegation)

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `resumeFromCheckpoint` 의 `persistedInteractionType` 계산을 `readPersistedInteractionType(cachedOutput)` 호출로 치환, 미사용 `toRecord` import 제거.
- (파일 2~6: `review/code/2026/07/11/01_17_12/*` 는 직전 리뷰 세션의 산출물이 같은 커밋에 포함된 것으로, 손코딩 소스가 아닌 리뷰 아티팩트다. 코드 품질 관점 평가 대상이 아니므로 별도 발견사항 없음.)

## 배경 검증 (delegation 이 기존 동작을 보존하는지)

`waiting-surface-guard.ts` 의 `coalesceInteractionType`/`readPersistedInteractionType` 정의를 직접 읽고 이전 손코딩 로직과 대조했다.

- 이전: `toRecord(cachedOutput?.meta)` 로 비-객체 `meta` 를 `{}` 로 수렴시킨 뒤 `cachedMeta.interactionType as string | undefined` → `?? cachedOutput?.interactionType as string | undefined`. `as` 단언은 런타임 검증이 없어, `interactionType` 값이 문자열이 아니어도(e.g. 숫자·객체) 그대로 통과해 정적으로는 `string`으로 오인됐다.
- 이후: `coalesceInteractionType` 이 `typeof === 'string'` 가드를 두 값 모두에 적용 — 문자열이 아니면 명시적으로 무시(`undefined`).
- 유효 데이터(정상적으로 문자열인 경우): 두 규칙 모두 "meta 우선 → flat fallback" 이므로 결과 동일. 다운스트림은 전부 `=== 'ai_conversation'`/`'buttons'`/`'ai_form_render'` strict-equality 비교이거나 `string | undefined` 로 그대로 전달(예: 로그 문자열 삽입)이므로, 비교 결과나 표시값 관점에서 회귀 없음을 확인했다(`persistedInteractionType` 소비처 전수 grep, L1720/1729-1730/1784/1840/1877/1925/1934/2023/2038/2069/2203/2249/2364/2407).
- 손상 데이터(비-문자열 `interactionType`): 이전엔 값이 그대로 새어나가 예컨대 로그 삽입 시 non-string 값이 노출될 수 있었으나, 이후엔 `undefined` 로 수렴(fail-closed) — 커밋 메시지 서술과 일치.
- `toRecord` import 제거 후 파일 내 `toRecord` 참조 0건 확인(grep) — dead import 정리가 정확하다.
- SoT 루프: `readPersistedInteractionType`/`coalesceInteractionType` 를 `waiting-surface-guard.spec.ts` 가 이미 단위 테스트로 커버(정상/손상 케이스 포함, L166-211) — 재개 경로 위임 후 두 호출부(publisher 표면 가드·rehydration)가 동일 검증된 규칙을 공유하게 되어 "dead code" 상태가 실질적으로 해소됐다.

## 발견사항

- **[INFO]** 호출부 주석이 함수 JSDoc 과 부분 중복
  - 위치: `execution-engine.service.ts:1713-1716` (`resumeFromCheckpoint` 상단 주석)
  - 상세: `readPersistedInteractionType` 자체에 이미 "meta 우선·string-guard·§7.5 rehydration 과 동일 규칙" 이라는 상세 JSDoc(`waiting-surface-guard.ts:101-109`)이 있다. 호출부 주석이 그 내용을 다시 요약해 서술하며, 두 곳이 향후 독립적으로 stale 해질 여지가 아주 작게 있다.
  - 제안: 사소한 스타일 관찰이며 현재 서술은 오히려 로컬 컨텍스트를 바로 파악하게 해주는 실익이 있어(정의로 점프하지 않아도 됨) 수정을 권하지 않는다. 참고용으로만 기록.

기타 CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 요약

이번 변경은 직전 리뷰가 지적한 "`readPersistedInteractionType` 프로덕션 dead code" 문제를 정확히 해소하는 최소 범위 리팩터다. 손코딩된 precedence 로직(3줄)을 이미 테스트로 검증된 단일 SoT 함수 호출 1줄로 대체해 중복을 제거했고, 사용하지 않게 된 `toRecord` import 도 함께 정리해 군더더기가 남지 않았다. 네이밍(`persistedInteractionType`/`readPersistedInteractionType`/`coalesceInteractionType`)은 기존 컨벤션과 일관되고, 변경 지점의 주석이 "왜"(publisher 표면 가드와 재개 경로가 동일 규칙을 공유해야 하는 이유)를 명확히 남겨 향후 유지보수자가 이 위임의 의도를 재추적할 필요가 없다. 함수 길이·중첩·복잡도에 실질적 영향이 없고, 유효 데이터에 대한 동작 동형성과 손상 데이터에 대한 더 엄격한(fail-closed) 처리는 코드 대조로 직접 확인했다. 유지보수성 관점에서 흠잡을 데 없는 변경이다.

## 위험도

NONE
