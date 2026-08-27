# 문서화(Documentation) 코드 리뷰

## 검토 범위

이 diff 는 `masking-expression-egress-split` (config echo 마스킹을 어댑터 → egress 로 이동) 의
최종 라운드다. 이전 3개 리뷰 라운드(`10_53_52`→`11_25_15`→`12_00_05`)가 이미 "미러 스윕이
몇 곳을 놓친다" 클래스의 결함을 세 번 재발시키고 각각 정정했다는 이력(RESOLUTION.md)이 있어,
이번 라운드에서는 (1) 그 정정들이 실제로 전부 정합적으로 착지했는지 소스를 직접 `Read`/`grep`
으로 재검증하고, (2) 이번에 새로 추가된 코드 주석·JSDoc 이 실제 구현과 정확히 일치하는지를
중심으로 봤다.

**재검증 방법**: `maskSensitiveFields` 문자열을 `codebase/`·`spec/`·`plan/` 전역에서 재검색해
"boundary" 를 현재형으로 인용하는 자리가 남아 있는지 확인했다. `explore-tools.service.ts`(유일한
생존 소비처)와 `plan/complete/**`(과거 완료 문서, 아래 INFO 참고) 를 제외하면 전부 취소선 +
정정 문구로 일치했다 — `ai-turn-executor.ts:3281,3356`, `node-output.md:256`,
`1-ai-agent.md:480,755,979,1114`, `4-execution-engine.md:193,203,1510`,
`egress-masking.md:54`, `14-execution-history.md:471` 전부 직접 열어 대조 완료.

## 발견사항

- **[WARNING]** `setStructuredOutput` JSDoc 이 "참조 저장" 을 과장 서술 — 실제로는 top-level
  래퍼는 새로 만들어지고(`{ ...adapted }`), 공유되는 것은 한 단계 안쪽의 `config` 뿐. 그리고
  그 사실을 "고정" 한다고 인용한 캐너리는 **이 함수를 테스트하지 않는다**.
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:141-148`
    (JSDoc), 대조 `:160` (`context.structuredOutputCache[nodeId] = { ...adapted };`) 및
    `:190` (자매 `setEngineResolvedConfig` 의 `{ ...resolvedConfig }`)
  - 상세: 새 JSDoc 은 "**Stores `adapted` by reference — no defensive copy** (asymmetric with
    {@link setEngineResolvedConfig}, which shallow-copies)" 라고 적는다. 그런데 실제 대입문은
    `context.structuredOutputCache[nodeId] = { ...adapted };` — 이것도 스프레드이므로 **top-level
    은 새 객체**다(`structuredOutputCache[nodeId] !== adapted`). 진짜로 참조가 공유되는 것은 한
    단계 안쪽인 `adapted.config` (스프레드는 얕은 복사라 중첩 값은 그대로 같은 참조) 뿐이다.
    `setEngineResolvedConfig` 쪽은 `{ ...resolvedConfig }` 인데 여기서 `resolvedConfig` 자체가
    바로 config 객체이므로 스프레드가 **config 레벨**에서 새 객체를 만든다 — 그래서 "asymmetric"
    이라는 결론 자체는 맞지만, "Stores `adapted` by reference — no defensive copy" 라는 도입 문장은
    *어느 레벨* 이야기인지 섞여 있어 읽는 사람이 "`structuredOutputCache[nodeId] === adapted`" 로
    오해할 수 있다(실제로는 `false`, `.config` 만 `true`).
    또한 이 JSDoc 은 "`handler-output.adapter.spec.ts` pins the reference-passing with a `toBe`
    canary" 라고 근거를 대는데, 그 캐너리(`handler-output.adapter.spec.ts:164-171`,
    `expect(out.config).toBe(rawConfig)`)는 **`adaptHandlerReturn` 의 반환값**만 검사한다.
    `setStructuredOutput` 자신의 `{ ...adapted }` 단계에서 `config` 참조가 보존되는지는
    `execution-context.service.spec.ts:198` 이 유일한 관련 테스트인데 이건 `toEqual`(깊은 값
    비교)이지 `toBe`(참조 비교) 가 아니다 — 즉 누군가 `setStructuredOutput` 을
    `{ ...adapted, config: structuredClone(adapted.config) }` 처럼 바꿔 이 JSDoc 이 서술하는
    load-bearing 불변식(핸들러가 반환 후 config 를 변형하면 캐시도 같이 바뀐다)을 깨뜨려도,
    이 JSDoc 이 "고정됐다" 고 인용하는 캐너리는 계속 GREEN 이다.
  - 제안: JSDoc 문장을 "top-level 래퍼는 새로 만들지만, 그 안의 `config` 는 `adapted.config` 와
    동일 참조" 로 정정하고, `execution-context.service.spec.ts` 에
    `expect(ctx.structuredOutputCache[nodeId].config).toBe(adapted.config)` 형태의 직접 `toBe`
    캐너리를 하나 추가해 이 파일 자신의 불변식을 이 파일 자신의 테스트로 고정할 것을 권장.

- **[INFO]** `plan/complete/**` 4개 문서가 이제 제거된 `handler-output.adapter.ts` 의
  `maskSensitiveFields` boundary 를 현재형으로 서술한 채 남아 있음 (수정 불필요 — 관례상 정상)
  - 위치: `plan/complete/assistant-mask-leak.md:34,101`, `plan/complete/spec-update-assistant-masking.md:87,92,94`,
    `plan/complete/eia-internal-rest-error-masking.md:51,319`, `plan/complete/spec-draft-cross-audit-doc-batch.md:61`
  - 상세: 이 저장소의 plan lifecycle 규약상 `plan/complete/` 는 완료 시점의 스냅샷이며 이후 변경에
    맞춰 소급 수정하지 않는 것이 정상이다(`.claude/docs/plan-lifecycle.md`). 실제로 이번 PR 의
    `spec_impact` 6개 spec 파일과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는
    전부 정확히 정정되어 있어 "살아있는" SoT 쪽은 문제 없다. 다만 향후 `git grep maskSensitiveFields`
    로 이 4개 완료 문서를 우연히 열람하는 사람이 날짜를 확인하지 않으면 "config echo 는 여전히
    어댑터에서 마스킹된다" 로 오해할 표면적 위험은 남는다.
  - 제안: 조치 불필요. 다만 6개 spec 파일의 R-5 정정 블록처럼, 이 4개 완료 plan 은 **손대지 않는
    것**이 이 저장소의 명시적 관례이므로 그대로 둔다.

## 긍정적으로 확인된 점

- `CHANGELOG.md` 의 신규 "Unreleased" 항목이 **문제(표현식이 마스킹값을 읽음)·조치(boundary
  제거)·운영 영향(DB 저장값이 원문으로 바뀜, REST/WS 응답은 불변)·안전 전제(키 집합 포함관계)·
  대가(크로스-노드 릴레이, safe-by-convention 이동)** 를 전부 한 항목에 담아 이 저장소가 이미
  갖고 있던 masking-경계 변경 CHANGELOG 관례를 그대로 따른다.
- `mask-sensitive-fields.util.ts` 신규 export JSDoc(`:1-9`)이 export 하는 **이유**(테스트가 이
  상수에서 직접 파생해야 함)와 "런타임 소비처는 이 export 를 쓰지 않는다" 는 **비대칭 경고**까지
  명시해, 향후 누군가 이 export 를 런타임 로직에 끌어다 쓰는 오용을 예방한다.
- `handler-output.adapter.ts:30-52` 의 인라인 주석이 *왜 제거했는지* → *왜 걷어내도 안전한지*
  → *초판 캐너리가 어떻게 거짓 안전을 주장했었는지* 를 순서대로 서술해, 코드만 보고는 알 수 없는
  '왜' 를 전부 담았다 — CLAUDE.md 의 "결정의 배경·근거" 관례와 정확히 일치하는 형태.
  `mask-sensitive-fields.util.spec.ts` 의 포함관계 캐너리 JSDoc(`:116-137`) 도 같은 사고 흐름을
  독립적으로 재서술해 어느 파일을 먼저 읽어도 같은 결론에 도달하게 한다(다만 이 근접-중복 자체는
  이미 `10_53_52` maintainability 리뷰가 INFO 로 지적했고 이번 PR 범위를 넓히지 않기로 명시
  처분됐다 — 재지적 아님).
- 6개 spec 문서(`14-execution-history.md`, `4-ai-assistant.md`, `1-ai-agent.md`(3곳),
  `4-execution-engine.md`(3곳), `egress-masking.md`, `node-output.md`) 전부를 `Read`/`git diff`
  로 직접 열어 대조한 결과, 취소선 + 정정 문구 패턴이 일관되고 "부재를 egress 마스킹에 귀속시키는"
  논리적 자기모순(`11_25_15` W3, `12_00_05` W3/W4 가 지적했던 것) 도 재발하지 않았다 — 3라운드에
  걸친 "주장 기반 전수 스윕" 방법론 전환이 실제로 수렴했음을 재확인.
- `handler-output.adapter.spec.ts` 의 재작성된 테스트들은 `[캐너리]`/`[대조군]` 접두어와 JSDoc 으로
  "무엇을 왜 고정하는지" 를 각 `it` 앞에 명시하고, egress 대조군(`deepRedactSecrets` 를 직접 걸어
  안전 주장을 같은 파일에서 검증)까지 포함해 "무엇을 없앴다" 뿐 아니라 "그런데도 왜 안전한가" 를
  코드로도 보여준다.

## 요약

핵심 코드 변경(`handler-output.adapter.ts` 의 마스킹 제거)과 그에 따른 6개 spec 문서·CHANGELOG·
관련 코드 주석 4곳(`ai-turn-executor.ts` 2곳, `node-output.md`, `1-ai-agent.md` 등)의 미러 스윕은
— 3라운드의 자기교정 끝에 — 이번 시점 기준으로 전수 대조 결과 정합적이다. 새로 남는 것은 하나뿐:
`execution-context.service.ts` 의 신규 JSDoc 이 "참조 저장" 을 설명하며 어느 레벨(래퍼 vs 중첩
`config`)의 참조인지를 섞어 서술하고, 그 불변식을 "고정한다" 고 인용한 캐너리가 실제로는 다른
함수(`adaptHandlerReturn`)를 테스트해 이 파일 자신의 회귀는 못 잡는다는 점이다. 이 PR 이 다른
곳에서 보여준 정밀도(주석이 정확히 무엇을 테스트가 고정하는지 명시하는 관행) 에 비추면 이 한
곳만 눈에 띄는 예외다. `plan/complete/` 의 과거 서술은 관례상 정상이라 조치 불필요.

## 위험도

LOW
