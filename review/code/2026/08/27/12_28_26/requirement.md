# 요구사항(Requirement) 충족 리뷰 — masking-residuals-0b195b (`12_28_26`, 4라운드 누적)

## 검토 방법

이 worktree 에서 네 번째로 수행되는 requirement 리뷰다. 앞선 세 라운드(`10_53_52` CRITICAL 1건,
`11_25_15` WARNING 3건, `12_00_05` WARNING 1건 + INFO)가 지적한 항목이 이번 diff 시점 기준
실제로 해소됐는지 `Read`/`grep`/독립 재현으로 재확인했고, 그 위에서 신규 결함을 점검했다.

- 핵심 코드 4파일(`mask-sensitive-fields.util.{ts,spec.ts}`, `handler-output.adapter.{ts,spec.ts}`),
  `execution-context.service.ts`, `ai-turn-executor.ts` 를 `Read`로 현재 소스 그대로 전문 대조.
- **CRITICAL 재발 여부를 직접 재현**: `DEFAULT_SENSITIVE_KEYS`에 egress 정규식이 못 잡는 가상
  키(`oauthCredXYZreview`)를 추가 → `mask-sensitive-fields.util.spec.ts` 43 total/**1 failed**,
  실패 케이스가 정확히 그 신규 키. `10_53_52` CRITICAL(캐너리 미파생, 42/42 GREEN 이었던 것)이
  실제로 고쳐졌음을 독립 재현으로 확인. `cp` 백업 없이 sed 삽입/삭제로 원복(추가한 한 줄만 정확히
  제거), `git diff`로 clean 확인, 테스트 재실행(42 passed)으로 원복 검증.
- `npx jest mask-sensitive-fields.util.spec.ts handler-output.adapter.spec.ts` 직접 실행 —
  84 passed / 2 suites, GREEN.
- `expression-resolver.service.ts:60` (`config: adapted.config ?? {}`)을 직접 열어, CHANGELOG/코드
  주석이 주장하는 "표현식이 `adapted.config`를 원문 그대로 읽는다"는 인과관계를 실제 소비 지점에서
  확인.
- spec 6개 문서(`14-execution-history.md`, `4-ai-assistant.md`, `1-ai-agent.md`,
  `4-execution-engine.md`, `egress-masking.md`, `node-output.md`)의 이전 라운드 지적 자리
  (`node-output.md:256`, `4-execution-engine.md:193/203/1510`, `1-ai-agent.md:480/755/979`)를
  line-level로 재대조.
- 저장소 전역에서 `maskSensitiveFields` 잔여 인용을 재-grep(`spec/`, `codebase/backend/src`,
  `.spec.ts` 제외)해 stale/모순 서술이 남아 있는지 재확인.

## 발견사항

- **[INFO]** 이전 세 라운드가 지적한 CRITICAL 1건 + WARNING 4건이 이번 diff 시점 기준 전부 해소되어
  있음을 직접 재현/재대조로 확인
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10`(`export const
    DEFAULT_SENSITIVE_KEYS`), `.spec.ts:139`(`const KEYS = [...DEFAULT_SENSITIVE_KEYS]`),
    `.spec.ts:160-165`(`expect(out.apiKey).toBe('')`), `spec/conventions/node-output.md:256`,
    `spec/5-system/4-execution-engine.md:193`, `:203`, `:1510`,
    `spec/4-nodes/3-ai/1-ai-agent.md:480`, `:755`, `:979`
  - 상세:
    1. **`10_53_52` CRITICAL** (포함관계 캐너리가 `DEFAULT_SENSITIVE_KEYS`에서 실제로 파생되지
       않음) — `DEFAULT_SENSITIVE_KEYS`를 export하고 `[...DEFAULT_SENSITIVE_KEYS]`로 직접
       spread하도록 재작성됨을 소스로 확인했고, 신규 sensitive 키를 추가하면 그 키만 RED가 되는
       것을 **직접 재현**해 검증했다(43 total/1 failed, 실패 케이스가 그 키).
    2. **`12_00_05` W2** (빈 문자열 캐너리가 `typeof === 'string'`로 vacuous) — 현재
       `expect(out.apiKey).toBe('')`로 값 단언하도록 고쳐져 있고, 인접 주석이 왜 `typeof` 단언이
       분기를 못 가르는지(마스킹돼도 문자열이므로) 직접 설명한다.
    3. **`11_25_15` W1** (`node-output.md:256`가 폐기된 boundary를 여전히 근거로 인용) — 현재
       `~~maskSensitiveFields boundary~~ **allow-list 로 애초에 배제**`로 취소선 정정됨을 확인.
    4. **`11_25_15` W2** (`4-execution-engine.md:193`의 `_resumeCheckpoint`가 자매 `:203`과 달리
       미정정) — 현재 `:193`도 동일한 취소선+정정 패턴으로 맞춰져 있음을 확인.
    5. **`11_25_15` W3 / `12_00_05` W3·W4** (`1-ai-agent.md:755,979`의 "미동봉이며 →
       egress 마스킹"이라는 자기모순, `1-ai-agent.md:480`의 "없는 값에 마스킹을 귀속"시키는 오류,
       `4-execution-engine.md:1510`의 "allow-list"라는 오칭) — 모두 현재 "allow-list로 애초에
       배제 — 그 boundary는 2026-08-24에 제거됐고 이 배제는 그것과 무관"으로 재정정되어 논리
       모순이 사라졌다.
  - 제안: 없음(양호, 재현/재대조로 확인 완료).

- **[INFO]** 세 라운드에 걸쳐 반복 지적됐던 문법 깨진 주석 문장이 이번 diff에서 실제로 해소됨
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:38-40`
  - 상세: `10_53_52`(requirement INFO)·`11_25_15`(documentation INFO)·`12_00_05`(maintainability
    WARNING, requirement INFO 3회째 미수정)가 반복 지적한 "취소선 정정이 원 문장의 뒷부분(`내보낸다
    — 비-자격증명 config 필드가 …`)을 주어 없이 남겨 문법이 깨진 문제"가, 이번 diff에서 원 문장
    **전체**를 취소선으로 넘기는 방식으로 완전히 재작성됐다: `~~이 상수는 handler-output.adapter.ts
    도 쓰고, 그쪽은 노드 config echo 를 DB·WS·표현식으로 내보낸다.~~ **그 소비처는 2026-08-24 에
    사라졌다** — config echo 는 이제 egress 에서만 가려지고 표현식은 원문을 읽는다.` 로 이어 읽어도
    문법이 깨지지 않는다. 세 번째 시도 만에 근본 원인(부분 취소선이 주어-서술어를 분리)을 제거하는
    방식으로 고쳐졌다.
  - 제안: 없음(양호).

- **[INFO]** 핵심 기능 변경의 인과관계(표현식이 masked config를 읽던 기능 오염)를 소비 코드에서
  직접 확인 — spec/CHANGELOG의 사실 주장과 실제 구현이 일치
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:60`
    (`config: adapted.config ?? {}`)
  - 상세: CHANGELOG·spec 6곳이 반복 주장하는 "표현식 컨텍스트가 `adapted.config`를 그대로 읽는다"는
    인과관계를 실제 소비 지점 코드로 확인했다. 어댑터가 masking을 걷어낸 것(`handler-output.adapter.ts:53`,
    `config: r.config ?? {}`)이 정확히 이 소비 지점에 원문을 전달하게 만드는 변경이며, 함수명·주석·
    구현이 서로 어긋나지 않는다.
  - 제안: 없음.

- **[INFO]** `setStructuredOutput`의 참조-전달(aliasing) JSDoc 추가가 실제 동작·캐너리와 일치
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:140-149`,
    대조 캐너리 `handler-output.adapter.spec.ts:164-172`(`expect(out.config).toBe(rawConfig)`)
  - 상세: 종전엔 `maskSensitiveFields`가 매 레벨 새 객체를 만들어 암묵적 deep-clone 역할을 겸했는데,
    그 함수가 제거되면서 `adaptHandlerReturn`이 핸들러 원본 객체를 참조로 그대로 반환하게 된 것을
    JSDoc이 정확히 설명하고, `toBe` 캐너리로 실측 고정했다(추측이 아니라 참조 동일성 자체를 단언).
    자매 함수 `setEngineResolvedConfig`가 shallow-copy하는 것과의 비대칭도 명시적으로 대조했다.
  - 제안: 없음.

- **[INFO]** 저장소 전역 재-grep 결과 `maskSensitiveFields` 관련 stale/모순 서술 잔여 0건
  - 위치: 해당 없음 (`spec/**/*.md`, `codebase/backend/src/**/*.ts` 전역, `.spec.ts` 제외)
  - 상세: `explore-tools.service.ts`(잔존 소비처, 정확), `7-llm-client.md:325`(미래형 "도입될
    경우", `maskSensitiveFields`가 아직 존재하므로 유효), `mask-sensitive-fields.util.ts` 자신의
    정의/주석, `ai-turn-executor.ts:3356`("Formerly cited... that boundary was removed",
    과거형으로 정확), `execution-context.service.ts:144`(과거형 "was masked", 정확),
    `14-external-interaction-api.md`의 `explore-tools` 관련 서술(별개 소비처, 정확) 외에
    미정정 stale 인용은 발견되지 않았다. `12_00_05` RESOLUTION의 "35건 전수 판정" 주장과 이번
    재-grep 결과가 일치한다.
  - 제안: 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 마커 없음, 반환값·엣지케이스 커버리지 양호
  - 위치: 핵심 코드 5파일 전체
  - 상세: 미완성 작업을 시사하는 마커는 발견되지 않았다. `adaptHandlerReturn`의 `config: r.config ??
    {}`는 `null`/`undefined` 양쪽을 `{}`로 정규화하는 기존 계약을 그대로 유지한다(테스트
    `handler-output.adapter.spec.ts:51-56` "defaults config to {} when null/undefined"로 회귀
    커버됨). 빈 문자열 자격증명이라는 이 PR이 실제로 동작을 바꾼 엣지케이스도 대조군으로 명시적으로
    고정됐다.
  - 제안: 없음.

## 요약

이번 diff(4라운드 누적, `origin/main` 대비)의 핵심 기능 변경 — `handler-output.adapter.ts`에서
노드 `config` echo의 storage-time 마스킹(`maskSensitiveFields`)을 제거해 표현식/DB는 원문을 보고
REST/WS egress만 마스킹하도록 재배선한 것 — 은 실제 버그(표현식이 `$node["X"].config.<field>`
참조에서 마스킹된 리터럴을 읽던 기능 오염)를 정확히 겨냥하고, 그 인과관계를 소비 코드
(`expression-resolver.service.ts:60`)로 직접 확인했다. 앞선 세 라운드가 지적한 CRITICAL 1건
(포함관계 캐너리 미파생 — 이번에 신규 키 추가로 직접 재현해 재검증 완료)과 WARNING 4건(spec mirror
sweep 불완전 3곳 + vacuous 캐너리 1곳)은 모두 line-level 재대조와 독립 재현으로 실제 해소를
확인했다. 세 라운드 연속 미수정이던 문법 깨진 주석 문장도 이번엔 근본 원인(부분 취소선)을 제거하는
방식으로 완전히 고쳐졌다. spec 6개 문서와 코드 사이의 line-level 불일치, 신규 CRITICAL/WARNING
급 요구사항 결함은 발견되지 않았다. `aliasing`(참조 전달) 변경도 JSDoc·`toBe` 캐너리로 정확히
문서화·고정되어 있다.

## 위험도

LOW
