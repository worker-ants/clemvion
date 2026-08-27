# 문서화(Documentation) 코드 리뷰 — masking-residuals-0b195b (5라운드, `12_52_43`)

## 검토 범위와 방법

이 diff(`origin/main` 대비)는 `masking-expression-egress-split` 작업의 4개 리뷰 라운드
(`10_53_52` → `11_25_15` → `12_00_05` → `12_28_26`)가 누적된 최종 상태 + 그 산출물(`review/**`)
커밋을 포함한다. 각 라운드가 "미러 스윕이 몇 곳을 놓친다" 클래스의 문서 결함을 반복 지적·수정한
이력이 있으므로, 이번 라운드는 새 diff 를 읽는 대신 **그 정정들이 실제로 현재 소스에 정합적으로
착지했는지**를 직접 `Read`/`grep`으로 재검증하는 데 집중했다.

재검증한 대상:
- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` — export JSDoc, 취소선 정정
  문단(과거 3라운드 연속 "문법이 깨진 문장"으로 지적됐던 자리)
- `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts` — 포함관계 캐너리,
  빈 문자열 대조군 단언
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.{ts,spec.ts}`
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.{ts,spec.ts}`
  — `12_28_26` W1(래퍼 vs `.config` 참조 레벨 혼동)이 지적한 자리
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`:3277-3286`, `:3348-3361`)
- `spec/conventions/node-output.md:256`, `spec/5-system/4-execution-engine.md:193,203,1510`,
  `spec/4-nodes/3-ai/1-ai-agent.md:480,755,979,1114`, `spec/conventions/egress-masking.md:54`,
  `spec/2-navigation/14-execution-history.md:471-484`, `spec/3-workflow-editor/4-ai-assistant.md:261`
- `CHANGELOG.md` 신규 "Unreleased" 항목, `plan/in-progress/masking-expression-egress-split.md`
  체크리스트·뮤테이션 표

`review/code/**`·`review/consistency/**` 산출물 파일들은 과거 라운드의 읽기 전용 기록물이라
재검토 대상에서 제외했다(이미 산출된 시점의 진술이며 이 리뷰가 그 내용의 정오를 다시 판정하지
않는다).

## 발견사항

- **[INFO]** 4라운드에 걸쳐 반복 지적됐던 문서 결함이 이번 시점 기준 **전부 해소됨을 직접 확인**
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:30-40`,
    `spec/conventions/node-output.md:256`,
    `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:137-169`,
    `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:160-165`
  - 상세:
    1. `mask-sensitive-fields.util.ts` 의 문법이 깨진 취소선 문장(`10_53_52`→`11_25_15`→`12_00_05`
       세 차례 미수정으로 남았던 자리)이 지금은 **원 문장 전체가 취소선 처리**되고 새 문장
       ("소비처는 이제 `explore-tools.service.ts` 하나다")이 온전한 주어-서술어로 앞에 붙어
       문법적으로 이어진다.
    2. `node-output.md:256` 은 `11_25_15`/`12_00_05` 가 지적한 "boundary strip" stale 인용이
       `~~maskSensitiveFields boundary~~ **allow-list 로 애초에 배제**" 로 정정돼 있고, 같은
       파일 336~351행의 신규 서술과 더 이상 자기모순을 일으키지 않는다.
    3. `execution-context.service.ts` 의 `setStructuredOutput` JSDoc(`12_28_26` W1 — "참조 저장"
       설명이 래퍼 레벨과 `.config` 레벨을 섞어 서술하고, 인용한 캐너리가 실제로는 다른 함수만
       검사하던 문제)은 이제 두 홉으로 명시적으로 갈라 서술하고, 실제 구현
       (`context.structuredOutputCache[nodeId] = adapted;` — 스프레드 없이 진짜 참조 대입)과
       일치하며, `execution-context.service.spec.ts` 에 `expect(cached).toBe(adapted)` /
       `expect(cached?.config).toBe(rawConfig)` 직접 `toBe` 캐너리가 이 파일 자신의 spec 으로
       고정돼 있다.
    4. `mask-sensitive-fields.util.spec.ts` 의 빈 문자열 대조군(`12_00_05` W2 — `typeof` 단언이
       마스킹 여부를 못 가르는 vacuous 문제)은 `expect(out.apiKey).toBe('')` 값 단언으로
       교체돼 있다.
  - 이 항목은 조치 불요(양호) — 과거 3~4라운드 연속 재발했던 클래스가 이번엔 재발하지 않았음을
    기록하기 위해 INFO 로 남긴다.

- **[INFO]** (기지, 비차단) 근접-중복 안전 서사와 과도한 인라인 주석 비율 — `12_00_05`
  maintainability 가 이미 지적하고 "이 PR 범위를 넓히지 않는다"로 명시 처분된 항목이 그대로
  남아 있음
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-53`
    (한 줄 `config: r.config ?? {},` 에 앞선 주석 약 23줄),
    `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:92-108`,
    `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:116-137`
  - 상세: "어댑터가 config 를 더 이상 마스킹하지 않아도 안전한 이유(egress 두 곳이 이미
    `deepRedactSecrets*` 를 걸고 그 키 축이 `DEFAULT_SENSITIVE_KEYS` 를 포함한다)"라는 동일
    논지가 여전히 세 파일에 표현만 바꿔 반복된다. 새로 발견한 것이 아니라 기존 처분(비차단)이
    유지되는지 확인 차 기록한다.
  - 제안: 없음(이미 처분 완료, 재지적 아님).

- **[INFO]** (기지, 비차단) `ai-turn-executor.ts` 인접 절의 같은 주어 반복 — `12_00_05`
  maintainability 가 이미 지적한 사소한 문체 이슈, 미수정이나 강제 아님
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3279-3280`
    ("credential (llmConfigId 가 가리키는 provider secret) 은 포함하지 않으며 credential 은
    **allow-list 로 애초에 배제**한다")
  - 상세: 두 절이 "credential"을 주어로 같은 내용을 반복해 약간 장황하다. 기능 영향 없음.
  - 제안: 없음(스타일, 강제 아님 — 이전 라운드 처분 유지).

## 잘된 점 (참고)

- `CHANGELOG.md` 의 "Unreleased" 항목이 문제(표현식이 마스킹값을 읽음)·조치(boundary 제거)·
  운영 영향(DB 저장값 원문화, REST/WS 응답 불변)·안전 전제(키 집합 포함관계)·대가(크로스-노드
  릴레이, safe-by-convention 이동)를 한 항목에 담아 이 저장소의 masking-경계 변경 CHANGELOG
  관례를 정확히 따른다. 링크 `spec/2-navigation/14-execution-history.md` 도 유효하다.
- `plan/in-progress/masking-expression-egress-split.md` 체크리스트는 `/ai-review` 항목 서술만
  다음 라운드를 반영하지 못한 상태(4라운드까지만 기록 — 이 리뷰 자체가 5번째)이고 나머지는
  현재 diff 상태와 일치한다. 테스트 카운트(9,023)에는 "PR 이 닫히는 시점의 값" 이라는 단서가
  이미 붙어 있어, 라운드마다 값이 바뀌어도 문서 신뢰성 문제가 되지 않는다.
- spec 8개 지점(node-output.md·4-execution-engine.md 3곳·1-ai-agent.md 4곳·egress-masking.md·
  14-execution-history.md·4-ai-assistant.md) 전부가 취소선 + 정정 문구 패턴으로 일관되며,
  "부재를 egress 마스킹에 귀속시키는" 논리적 자기모순(이전 라운드들이 반복 지적했던 형태)도
  재발하지 않았다.
- `mask-sensitive-fields.util.ts` 신규 export JSDoc 이 export 이유·초판 결함·반증 경위를 코드
  자신에 남겨, 향후 이 상수를 런타임 로직에 끌어다 쓰는 오용을 예방한다.

## 요약

이 PR 이 4라운드에 걸쳐 반복 재발시켰던 "미러 스윕이 몇 곳을 놓친다" 클래스의 문서 결함
(문법 깨진 주석, `node-output.md` stale 인용, `setStructuredOutput` JSDoc 의 참조 레벨 혼동,
vacuous 빈 문자열 캐너리)은 이번 시점 기준 소스를 직접 열어 대조한 결과 **전부 해소**돼 있다.
남아 있는 것은 이전 라운드가 이미 "이 PR 범위를 넓히지 않는다"로 명시 처분한 비차단 INFO
(근접-중복 안전 서사 3곳, 과도한 인라인 주석 비율, 사소한 문장 반복)뿐이며 신규 결함은
아니다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE
