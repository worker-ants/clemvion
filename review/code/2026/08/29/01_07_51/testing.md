# 테스트(Testing) 리뷰

## 스코프 요약

6개 파일 중 5개(`expression-resolver.service.spec.ts`, `expression-resolver.service.ts`,
`secret-resolver.service.ts`, `code.handler.spec.ts`, `code.handler.ts`)의 diff 는 **전부
주석(comment-only) 변경**이다. 각 hunk 를 확인한 결과 실행 코드(`throw new Error(..., { cause:
err })` 등)는 diff 전후 동일하고, 바뀐 것은 "`cause` 부착/비부착 판단 기준"을 인라인으로
재서술하던 것을 `spec/5-system/3-error-handling.md` §6.3.1 을 가리키는 참조로 축약한 것뿐이다.
`plan/in-progress/deps-peer-gating-and-eslint10.md`(파일 6)는 이 정리 작업의 배경(이전에 "등재됐다"고
잘못 기록했던 것을 정정)을 담은 plan 문서로, 코드 변경이 아니다.

이 특성 때문에 본 diff 자체는 테스트 로직·커버리지·assertion 을 하나도 바꾸지 않는다. 아래는
그 전제 위에서의 관측이다.

## 발견사항

- **[INFO]** 코멘트가 참조하는 C2 기준("표현식 평가 예외라 message·name 밖 속성이 없다")이 자동
  단언으로 강제되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:141-142` (신규 코멘트), 검증 대상 테스트는 `:144-159` `원본 예외를 cause로 보존한다` 케이스. 동형 케이스는 `codebase/backend/src/nodes/data/code/code.handler.spec.ts:200-203`(코멘트), `:204-226`(테스트).
  - 상세: 두 스펙 파일의 테스트는 `cause instanceof Error`(또는 `toBeDefined`)와 `thrown.message.toContain(cause.message)` 만 단언한다. 코멘트가 주장하는 C2("이 경로에서 잡히는 예외 객체가 message/name 이외의 민감한 속성을 갖지 않는다")는 어떤 assertion 으로도 관측되지 않는다 — 이는 `evaluate()`(`@workflow/expression-engine`)나 `isolated-vm` 의 컴파일 예외가 장차 부가 속성(예: 참조 실패 시 관련 변수 값, 소스 스니펫 등)을 붙이도록 바뀌어도 이 테스트 스위트가 그 변화를 잡지 못한다는 뜻이다. 다만 이 특성은 이번 diff 가 새로 만든 것이 아니라 코멘트 정리 이전부터 있던 상태이며(이전 코멘트도 C1만 서술하고 C2는 애초에 언급조차 없었다), diff 자체가 악화시킨 갭은 아니다.
  - 제안: 필수는 아니나, `Object.keys(cause).filter(k => k !== 'message' && k !== 'stack')` 형태로 "message/name/stack 이외의 own enumerable 속성이 없다"를 캐너리로 고정하면 C2 가 실측 가능한 불변식이 된다. 지금 코멘트가 정본(spec §6.3.1)을 명시적으로 가리키게 됐으니, 다음에 이 자리를 여는 사람이 캐너리를 붙이기 좋은 지점이다.

- **[INFO]** 회귀 안전성 — 참조 대상 spec 문서 확인.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:89-98`(신규/확장 코멘트).
  - 상세: 이 파일에 대한 회귀 테스트(`err.cause` 가 `undefined` 임을 단언, `secret-resolver.service.spec.ts:207-229`)는 이번 diff 의 변경 대상이 아니며 그대로 유지된다 — 코멘트만 확장됐을 뿐 `eslint-disable-next-line preserve-caught-error` 줄과 `throw new Error('Secret decryption failed')` 는 diff 전후 동일하다. 코멘트가 "이 자리가 §6.3.1 이 지목하는 비부착 사례"라고 주장하는 것과 기존 테스트(`cause` 미존재를 단언)가 실제로 정합함을 직접 열어 확인했다 — 코멘트와 테스트 간 괴리 없음.

## 항목별 점검 결과

1. **테스트 존재 여부**: diff 대상 3개 실행 코드 파일 모두 `cause` 부착/비부착 분기에 대한 기존 회귀 테스트가 이미 존재(2개는 이번 diff 의 spec 파일에, 1개는 diff 밖의 `secret-resolver.service.spec.ts`). 신규 테스트 추가/삭제 없음 — 코멘트만 변경됐으므로 추가 요구사항 없음.
2. **커버리지 갭**: 코드 로직 변경이 없어 신규 갭 없음. 위 INFO 에서 지적한 C2 미검증은 기존 갭의 연속.
3. **엣지 케이스**: 변경 없음(코멘트만).
4. **Mock 적절성**: 해당 없음 — mock 구성이 diff 대상이 아님. (참고로 `expression-resolver.service.spec.ts` 의 `ConfigService` 인라인 mock 은 `beforeEach`에서 매 테스트 재생성되어 격리가 유지된다.)
5. **테스트 격리**: 변경 없음. 기존 `$env` 테스트들의 `process.env` 조작은 `try/finally` 로 정리되어 있어(예: `:388-405`, `:429-446`) 격리가 유지된다 — 이 diff 로 영향받지 않음.
6. **테스트 가독성**: 코멘트 리팩터링의 목적 자체가 가독성/유지보수성 개선(중복 서술 제거 → 정본 참조)이며 효과가 있다. 다만 코멘트가 "이 자리가 정본 기준을 어떻게 만족하는가"만 남기고 기준 자체를 지운 설계라, 리뷰어가 판단의 타당성을 확인하려면 반드시 `spec/5-system/3-error-handling.md` §6.3.1 을 열어야 한다 — 의도된 트레이드오프(SoT 분리)로 보이며 문제로 보지 않는다.
7. **회귀 테스트**: 기존 테스트는 diff 이후에도 그대로 유효하다 — 대상 실행 코드 라인이 diff 전후 바이트 단위로 동일하므로 회귀 가능성 없음.
8. **테스트 용이성**: 변경 없음.

## 요약

리뷰 대상 diff 는 5개 코드/스펙 파일에서 실행 로직을 전혀 건드리지 않는 순수 주석 정리이며(중복 서술된 `cause` 부착 판단 기준을 `spec/5-system/3-error-handling.md` §6.3.1 참조로 대체), plan 파일(파일 6)은 그 배경을 기록한 문서 변경이다. 실행 코드 라인이 diff 전후 동일함을 직접 대조해 확인했고, 관련 회귀 테스트(스펙 3개 파일)도 모두 그대로 유지되어 테스트 관점에서 새로 발생한 리스크는 없다. 유일하게 짚을 만한 점은 코멘트가 주장하는 C2 기준("message·name 밖 민감 속성 없음")이 여전히 자동 단언으로 강제되지 않는다는 것인데, 이는 이번 diff 이전부터 있던 상태로 신규 결함이 아니라 개선 여지(캐너리 테스트 후보)로 기록한다.

## 위험도

NONE
