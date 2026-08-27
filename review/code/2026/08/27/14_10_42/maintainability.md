# 유지보수성(Maintainability) 코드 리뷰 — masking-residuals-0b195b (6라운드, `14_10_42`)

## 검토 범위와 방법

이 브랜치의 실질 코드 변경(핵심 5개 파일)은 이전 5라운드(`10_53_52` CRITICAL 1건 →
`11_25_15`/`12_00_05` WARNING 다수 → `12_28_26` WARNING 1건 신규 → `12_52_43` LOW 수렴)에서
이미 반복 검토됐다. `git log --oneline origin/main..HEAD -- <핵심 5개 파일>` 로 대조한 결과
마지막 코드 변경 커밋은 `b0b52ad2c`(`12_28_26` W1 수정)이고, 그 이후 커밋(`ad166120d`,
`006b8aa2e`, `6af73b2c8`, `69802a686`)은 전부 `plan/**`·`spec/**` 문서만 건드린다. 즉
**`12_52_43` 라운드가 본 소스와 이번 라운드가 보는 소스가 동일**하다 — 아래는 `Read` 로 현재
소스를 재대조해 그 결론을 재확인한 것이다.

- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` / `.spec.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (해당 diff 구간 — 주석만 변경)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (JSDoc 한 단어 치환 — 코드 변경 없음)

`plan/**`·`review/**`·`spec/**` 는 프로세스·문서 산출물이라 함수 길이/복잡도 평가 대상이
아니므로 최소 확인만 했다.

## 발견사항

- **[INFO]** `handler-output.adapter.ts` 의 1줄 코드에 23줄 인라인 주석 — 3라운드 연속 미해소, 강제 아님
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-53` (`config: r.config ?? {},` 및 그 직전 주석 블록)
  - 상세: `12_00_05`·`12_52_43` 라운드가 이미 INFO 로 지적했고, 이번 라운드까지 형태 변경 없이 그대로다. 마스킹 제거 배경·재발 방지 근거·과거 리뷰 인용을 코드 옆에 남기는 것 자체는 이 저장소가 반복해 온 "왜"를 잃지 않으려는 관행과 일치하지만, 실행 코드는 `config: r.config ?? {},` 한 줄뿐이라 주석 대 코드 비율이 극단적이다.
  - 제안: 기존 권고 유지 — 핵심 1~2문단만 남기고 반증 이력(라운드 인용 등)은 CHANGELOG/spec 포인터로 대체. 강제 아님.

- **[INFO]** 동일 보안 불변식("포함관계 캐너리가 두 마스커의 안전성을 보장한다") 서술이 3개 파일에 근접-중복
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:39-48`(인라인 주석), `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:92-108`(JSDoc), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:116-137`(JSDoc)
  - 상세: `10_53_52`부터 이번 라운드까지 구조적으로 변경되지 않은 채 남아 있다. 세 파일이 같은 논지(egress 두 곳이 `DEFAULT_SENSITIVE_KEYS`⊆`CREDENTIAL_KEY_PATTERN` 포함관계로 안전을 보장한다)를 표현만 바꿔 반복한다. 한 곳을 고치면 나머지 두 곳이 stale 해질 위험이 실제로 이번 PR 자체에서 여러 번 발생했다(mirror-sweep 라운드들).
  - 제안: 기존 권고 유지 — `mask-sensitive-fields.util.spec.ts` JSDoc 을 canonical 로 삼고 나머지 둘은 `@see`/짧은 참조 포인터로 축약. 이 PR 범위에서 강제할 사안은 아니다.

- **[INFO]** `execution-context.service.spec.ts` 신규 캐너리 2건이 동일한 이중 타입 캐스트를 반복 — 추출 임계선(3회) 미달
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.spec.ts:245`, `:263` (`describe('setStructuredOutput — 참조 저장 (방어적 복사 없음)')` 내부)
  - 상세: `{ output: {}, config: rawConfig } as unknown as Parameters<typeof service.setStructuredOutput>[2]` 형태가 두 `it` 에 그대로 복제돼 있다. 기능 문제는 없고 가독에도 지장 없으나, 세 번째 캐너리가 추가되면 로컬 헬퍼 추출이 필요해진다.
  - 제안: 로컬 헬퍼(`const asHandlerOutput = (config) => ({ output: {}, config }) as unknown as Parameters<typeof service.setStructuredOutput>[2];`)로 추출. 이 저장소 관행상 2회 반복은 강제 추출 대상이 아니므로 비차단.

## 긍정적으로 확인된 점

- `adaptHandlerReturn`(`handler-output.adapter.ts`)의 `config` 조립이 `(maskSensitiveFields(r.config ?? {}) ?? {}) as Record<string, unknown>` → `r.config ?? {}` 로 단순화된 상태가 그대로 유지된다 — 순환 복잡도가 origin/main 대비 낮아졌다.
- `setStructuredOutput` JSDoc(`execution-context.service.ts:141-157`)이 hop 1(`adaptHandlerReturn`)과 hop 2(이 메서드)의 참조-저장 보장을 명시적으로 분리하고, 각 주장에 정확히 대응하는 캐너리를 지목한다(`12_28_26` W1 "문서한 보장이 구현보다 넓었다" 결함이 hop 분리 + 전용 캐너리 2건으로 근본 수정됨을 소스 대조로 재확인).
- `setStructuredOutput`(참조 저장, no defensive copy)과 `setEngineResolvedConfig`(shallow-copy)의 비대칭이 양쪽 JSDoc·양쪽 캐너리(`[캐너리]`/`[대조군]`)로 대칭 문서화돼 있어 "왜 한쪽만 복사하나"가 우연이 아니라 계약으로 읽힌다.
- `mask-sensitive-fields.util.ts` 의 `DEFAULT_SENSITIVE_KEYS` export 전환으로, 캐너리(`mask-sensitive-fields.util.spec.ts`)가 상수를 `[...DEFAULT_SENSITIVE_KEYS]` 로 직접 순회한다 — 손으로 다시 나열하던 이전 버전(파생 단절 CRITICAL)이 재발할 수 없는 구조로 바뀌었다.
- 테스트 네이밍(`[캐너리]`/`[대조군]`/`[메타]` 접두, 라운드 상호 참조 `10_53_52`→`12_28_26`)이 파일 전반에서 일관돼 어느 지적에 대응하는 테스트인지 추적 가능하다.
- 함수 길이·중첩 깊이·네이밍 컨벤션은 변경된 모든 파일에서 양호하다. `adaptHandlerReturn`, `setStructuredOutput`, `maskSensitiveFields` 모두 단일 책임을 유지하고, `ai-turn-executor.ts`/`websocket.service.ts` 의 변경은 주석·JSDoc 문구 정정뿐이라 코드 복잡도에 영향이 없다.
- 매직 넘버 없음, 새 중복 로직 없음 — 신규 캐너리들도 기존 테스트 패턴(값 단언 위주, `toBe`/`not.toContain`)을 그대로 따른다.

## 요약

6라운드째 재검토 결과, 마지막 코드 변경 커밋(`b0b52ad2c`) 이후 `plan/`·`spec/` 문서만 갱신됐을 뿐 핵심 코드 5개 파일은 `12_52_43`(5라운드, LOW 수렴) 시점과 동일함을 `git log` + `Read` 로 확인했다. 남은 발견사항은 전부 이전 라운드부터 반복 지적된 INFO 3건(인라인 주석 대비 코드 1줄, 3파일 근접-중복 서술, 테스트 이중 캐스트 2회 반복)이며 모두 강제 대상이 아니고 형태 변화 없이 유지되고 있다. 핵심 로직(`adaptHandlerReturn`, `setStructuredOutput`)은 이번 변경으로 오히려 단순해졌고(마스킹 함수 호출 제거), 함수 길이·중첩·매직 넘버·네이밍 컨벤션·기존 스타일 일관성 전반에서 신규 결함은 발견되지 않았다.

## 위험도

LOW
