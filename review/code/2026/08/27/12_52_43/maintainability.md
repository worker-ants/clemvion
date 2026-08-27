# 유지보수성(Maintainability) 코드 리뷰 — masking-residuals-0b195b (5라운드, `12_52_43`)

## 검토 범위와 방법

핵심 코드 변경 파일을 `Read`로 현재 소스 전문 대조했다:

- `codebase/backend/src/common/utils/mask-sensitive-fields.util.{ts,spec.ts}`
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.{ts,spec.ts}`
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.{ts,spec.ts}`
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (해당 diff 구간)

이 변경은 이미 4차례(`10_53_52` CRITICAL 1건, `11_25_15`/`12_00_05` WARNING 다수, `12_28_26`
WARNING 1건 신규 — 전부 수렴 판정) 리뷰를 거쳤다. 이번 라운드는 그 이후 남은/새로 추가된
지점만 재확인한다. `plan/**`·`review/**`·`spec/**` 는 프로세스·문서 산출물이라 "코드"로서의
함수 길이/복잡도 평가 대상이 아니므로 최소 확인만 했다.

## 발견사항

- **[INFO]** `execution-context.service.spec.ts` 신규 캐너리 2건이 동일한 이중 캐스트를 반복
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.spec.ts` — `describe('setStructuredOutput — 참조 저장 (방어적 복사 없음)')` 내 두 `it` (`adapted 래퍼와 그 config 를 참조 그대로 캐시에 눕힌다`, `반환 후 핸들러가 자기 config 를 변형하면 캐시에도 보인다`)
  - 상세: 두 테스트 모두 `{ output: {}, config: rawConfig } as unknown as Parameters<typeof service.setStructuredOutput>[2]` 형태의 동일한 이중 타입 단언을 그대로 복제한다. 기능상 문제는 없고 판독도 가능하지만, `NodeHandlerOutput` 부분 픽스처를 만드는 이 캐스트가 이 describe 블록에만 2회 등장해 향후 3번째 캐너리가 추가되면 3중 복제가 된다.
  - 제안: 로컬 헬퍼(예: `const asHandlerOutput = (config: Record<string, unknown>) => ({ output: {}, config }) as unknown as Parameters<typeof service.setStructuredOutput>[2];`)로 추출해 두 `it` 에서 재사용. 강제 아님 — 현재 2회 반복은 이 저장소 관행상 추출 임계선(3회) 이하다.

- **[INFO]** `handler-output.adapter.ts` 의 1줄 코드에 23줄 인라인 주석 — 이전 라운드(`12_00_05` INFO)가 이미 지적, 이번 라운드까지 그대로 유지
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-52` (`config: r.config ?? {},` 직전 주석 블록)
  - 상세: `12_00_05` 라운드에서 INFO로 지적되고 강제 아님으로 넘겨진 항목이 이번 라운드까지 형태 변경 없이 유지되고 있음을 재확인했다. 이제 유사한 패턴이 `execution-context.service.ts` 의 `setStructuredOutput` JSDoc(약 16줄, 메서드 본문은 12줄)에도 반복돼, "안전 서사를 코드 옆에 길게 남기는" 스타일이 이 PR 전체에서 확산되는 모양새다. 개별 결함은 아니다.
  - 제안: 기존 권고(핵심 1~2문단만 남기고 반증 이력은 CHANGELOG/spec 포인터로 대체) 유지. 강제 아님.

- **[INFO]** 동일 보안 불변식 설명의 3파일 근접-중복 서술 — 미해소 상태 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-52`(인라인 주석), `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:92-107`(JSDoc), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:102-137`(JSDoc)
  - 상세: `10_53_52`/`12_00_05` 라운드가 이미 지적한 이 항목이 이번 라운드에도 구조적으로 변경되지 않은 채 남아 있다. "포함관계 캐너리가 두 마스커의 안전성을 보장한다"는 동일 논지가 세 파일에 표현만 바꿔 반복된다.
  - 제안: 기존 권고(하나를 canonical, 나머지는 참조 포인터로 축약) 유지. 이 PR 범위에서 강제할 사안은 아니다.

## 긍정적으로 확인된 점

- **`12_28_26` W1 이 실제로 근본 수정됐다** — `setStructuredOutput` JSDoc 이 hop 1(`adaptHandlerReturn` 이 핸들러 `config` 를 그대로 반환)과 hop 2(이 메서드가 `adapted` 래퍼 전체를 참조 저장)를 명시적으로 분리하고, 각 주장에 정확히 대응하는 캐너리를 지목한다(`Read` 로 `:141-156` 원문 확인, `= adapted`(참조 저장) 구현과 JSDoc 주장이 일치).
- 새로 추가된 두 캐너리(`adapted 래퍼와 그 config 를 참조 그대로 캐시에 눕힌다`, `반환 후 핸들러가 자기 config 를 변형하면 캐시에도 보인다`)와 자매 대조군(`setEngineResolvedConfig` 의 shallow-copy `[대조군]`)이 "왜 한쪽만 복사하는가"를 테스트 배치만으로 계약처럼 읽히게 한다 — 좋은 대조군 설계.
- `mask-sensitive-fields.util.ts` 의 이전 라운드(`12_00_05`)가 지적한 문법 깨진 주석(주어 없는 "내보낸다")이 이번 소스 대조에서 완전히 해소됨을 재확인했다 — 원래 문장 전체가 취소선 처리되고 새 문장이 명시적 주어("소비처")로 재작성됐다.
- `handler-output.adapter.ts` 의 `config` 필드 조립이 `(maskSensitiveFields(...) ?? {}) as Record<string, unknown>` → `r.config ?? {}` 로 단순화된 상태가 유지된다 — 순환 복잡도가 원본보다 낮다.
- 함수 길이·중첩 깊이는 전 파일에서 양호하다. `adaptHandlerReturn`, `setStructuredOutput`, `maskSensitiveFields` 모두 단일 책임을 유지하며, 이번 라운드 신규 코드(테스트 2건, JSDoc 분리)도 기존 조건문 중첩 구조를 늘리지 않았다.
- 테스트 네이밍(`[캐너리]`/`[대조군]` 접두, 라운드 번호 상호 참조 `12_00_05 INFO 6 → 12_28_26 W1`)이 일관되고, 어느 라운드의 어느 지적에 대응하는 테스트인지 추적 가능해 향후 회귀 원인 규명 비용을 낮춘다.

## 요약

5라운드째 재검토 결과, 이전 라운드들이 지적한 코드 동작 결함·문법 오류는 모두 실제로 해소됐고, `12_28_26` 라운드가 새로 만든 "JSDoc이 실제보다 넓은 캐너리 커버리지를 주장" 문제도 hop 분리 + 전용 캐너리 2건으로 근본 수정됐음을 직접 소스 대조로 확인했다. 남은 것은 전부 이전 라운드부터 INFO로 넘겨져 온 비차단 항목(3파일 근접-중복 서술, 코드 대비 과도한 인라인 주석 길이)이며, 이번 라운드에서 새로 발견한 것은 신규 테스트 2건의 이중 캐스트 반복(2회, 추출 임계선 미달) 정도로 사소하다. 핵심 로직(`adaptHandlerReturn`, `setStructuredOutput`)은 이번 diff로 오히려 단순해졌고, 함수 길이·중첩·매직 넘버·네이밍 컨벤션 전반이 이 저장소의 기존 관행과 일관된다.

## 위험도

LOW
