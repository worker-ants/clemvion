# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

실질 코드 변경은 3개 파일이다(`git diff --stat origin/main...HEAD -- codebase/` 로 확인).

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설, `toTerminalErrorPayload()` 모든 반환 경로에 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 8건 추가
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만(로직 무변경)

나머지(`CHANGELOG.md`, `plan/**`, `review/**`)는 코드가 아니며, 이번 PR 은 이미 두 차례 `/ai-review` 라운드(`09_51_00`, `10_19_30`)를 거쳐 대부분의 유지보수성 지적이 반영·기각(근거와 함께)됐다. 이번 라운드는 그 누적 diff 를 대상으로 신규 관점을 추가한다.

## 발견사항

- **[WARNING]** 이전 라운드가 "완전 동일한 중복 단언 2건"으로 함께 지적한 것 중 한쪽만 의도 설명 주석이 달리고 다른 쪽은 여전히 무설명 중복으로 남았다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:219-222` (신규 `it('details 가 없으면 키를 만들지 않는다 (§6.4 optional)', ...)`), 원 중복 대상: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:32-39` (기존 `it('details 는 있을 때만 싣는다 (§6.4 가 optional 로 선언)', ...)`) — 특히 기존 테스트의 후반부 `expect(toTerminalErrorPayload({ message: 'x' })).not.toHaveProperty('details');` 와 신규 테스트의 `expect(out && 'details' in out).toBe(false);` 는 표현만 다를 뿐 같은 명제를 검증한다.
  - 상세: `09_51_00` 라운드 maintainability 리뷰는 이 파일의 신규 `describe` 블록에서 **두 개**의 완전 중복 단언을 지적했다 — (a) `null/undefined` 테스트, (b) `details` 키 생략 테스트. 그 RESOLUTION(W5)은 "의도가 다르다(마스킹 도입 후에도 계약이 유지되는지 확인)"는 근거로 무조치 처리했다가, 다음 라운드(`10_19_30`)가 "의도가 코드에 없으면 다음 사람에겐 그냥 중복"이라 재지적했고 RESOLUTION(W6)은 "주석으로 적었다"고 반영을 주장한다. 그런데 실제로 파일을 열어 대조하면 그 주석은 (a) `null/undefined` 테스트(:193-194, "상단 스위트에도 같은 단언이 있다. 중복이 아니라 **마스킹 도입 후에도** 이 경로가 그대로인지를 묻는 것이다 — 한쪽만 갱신되면 그때 갈린다")에만 달렸고, (b) `details` 생략 테스트(:219)에는 어떤 설명도 없다. 두 항목은 애초에 같은 WARNING 으로 함께 지적됐고 같은 근거(마스킹 계약 유지 확인)로 무조치→반영 처리됐는데, 정작 코드 상으로는 한쪽만 "의도가 다름"이 기록되고 다른 쪽은 여전히 무설명 순수 중복으로 남아 비대칭이다. 다음 리더가 (b)를 보면 "왜 상단 스위트와 똑같은 걸 또 검증하지?"를 다시 조사해야 한다.
  - 제안: `:219` 테스트에도 `:193-194` 와 같은 취지의 짧은 주석("상단 스위트의 details-생략 단언과 동일 — 마스킹 도입 후에도 이 경로가 그대로인지 확인")을 추가해 두 중복 항목의 처리를 대칭으로 맞춘다.

- **[INFO]** `deepRedactSecrets` 반환값(`unknown`)을 `string` 으로 무검증 타입 단언 — 이전 두 라운드에서 이미 지적·기록되었고 여전히 존재
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:110` — `message: deepRedactSecrets(p.message) as string,`
  - 상세: 현재 구현상 문자열 입력에는 문자열을 반환하므로 런타임 안전하지만, 타입 시스템이 이를 보증하지 않는다. `deepRedactSecrets` 의 문자열 분기가 향후 확장되면 이 캐스트가 컴파일 경고 없이 조용히 깨질 수 있다. 조치 불요로 이미 두 차례 결론났으므로 이번엔 참고용으로만 재확인한다.
  - 제안: (기존 제안 유지, 강제 아님) 캐스트 옆에 "문자열 입력→문자열 출력은 `deepRedactSecrets` 의 런타임 불변식" 한 줄 주석.

- **[INFO]** 동일 함수·파일 내 "optional 키 생략" 관용구 혼재(명령형 `if` vs 조건부 spread) — 이미 두 라운드에서 검토 후 명시적으로 무조치 확정된 사안, 이번 diff 로 악화되지 않음
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:159`(`if (src.details !== undefined) out.details = src.details;`) vs `:111-113`(`...(p.details === undefined ? {} : { details: deepRedactSecrets(p.details) })`)
  - 상세: `09_51_00` RESOLUTION W6 이 "강한 요구 아님·기존 `if` 를 건드리면 diff 가 넓어진다"는 근거로 무조치 확정했고 `10_19_30` maintainability 리뷰도 같은 결론을 재확인했다. 새로 추가할 근거가 없어 참고용으로만 기재한다.
  - 제안: 조치 불요(기결정 유지).

## 확인한 항목 (문제 없음)

- `redactTerminalError` 는 함수 길이 8줄, 분기 없음(단일 조건부 spread)으로 순환 복잡도가 매우 낮다. `toTerminalErrorPayload` 는 4개의 얕은 `if` 분기(중첩 깊이 1)로 구성돼 있고, 모든 반환 경로가 동일한 `redactTerminalError(...)` 호출을 통과하는 균일한 구조라 읽기 쉽다.
- 네이밍은 `deepRedactSecrets`/`redactSecrets`(기존 shared SoT)와 `redactTerminalError`(신규)가 `redact*` 접두어로 일관되고, `TerminalErrorPayload`/`toTerminalErrorPayload` 등 기존 관례와도 맞는다.
- 매직 넘버 없음. 새로 도입된 리터럴(`code: null`, `nodeId: null`)은 기존 코드의 반복이며 이번 diff 가 새로 만든 것이 아니다.
- `sanitize-error-message.ts`(execution-engine) 변경은 docstring 정정뿐이며 런타임 로직·정규식·상수는 무변경 — 유지보수성 관점에서 별도 우려 없음.
- 파일 두 개가 같은 basename(`sanitize-error-message.ts`)을 갖는 기존 구조는 이번 diff 가 만든 문제가 아니고, docstring 이 "자매 leaf util" 관계를 상세히 설명해 혼동을 완화한다(이전 라운드 INFO 로 이미 기록, 즉시 조치 대상 아님).
- JSDoc 대 코드 비율이 매우 높은 문서-지배적 스타일(`redactTerminalError` 주석 59줄 vs 본문 8줄)은 이 저장소가 결정 배경을 코드 인접 주석에 남기는 확립된 컨벤션과 부합하며, 4~5라운드 미뤄졌다가 실측으로 뒤집힌 결정을 다루므로 근거를 남기는 편이 재지적 방지에 유리하다 — 조치 불요로 이전 라운드에서 이미 결론남.

## 요약

핵심 로직 변경(`redactTerminalError` 도입, `toTerminalErrorPayload` 4개 반환 경로 일괄 배선)은 함수 길이·중첩 깊이·순환 복잡도·네이밍 모두 양호하고, 두 차례 앞선 리뷰 라운드에서 제기된 유지보수성 지적(JSDoc 궤도 이탈, 판별력 없는 테스트, "5곳" 혼동 등)은 실제로 코드에 반영돼 해소된 것을 직접 파일 대조로 확인했다. 다만 새로 발견한 것은, 두 라운드 전 같은 WARNING 으로 **함께** 지적됐던 중복 단언 2건(`null/undefined` 테스트·`details` 생략 테스트) 중 "주석으로 의도를 명시했다"는 RESOLUTION 의 반영 주장이 실제로는 전자에만 적용되고 후자(`terminal-error-payload.spec.ts:219-222`)에는 적용되지 않아, 같은 처리를 받았어야 할 두 항목이 비대칭 상태로 남았다는 점이다. 그 외 잔여 항목(타입 단언, optional-키 관용구 혼재)은 이미 명시적으로 검토·기각되어 이번 라운드에서 새로 추가할 근거가 없다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
