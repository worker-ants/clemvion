# Cross-Spec 일관성 검토 — error-code-emission-axis (--impl-prep, scope=spec/conventions/)

## 검토 범위에 대한 전제

이 호출은 `--impl-prep` 모드이고 `plan/in-progress/error-code-emission-axis.md` 는
`spec_impact: none` 이다 — 이번 작업은 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
에 "방출(emission)" 축을 추가하고 `GUIDE_NON_EMITTED_VOCABULARY` 신규 면제 목록을 두며,
가이드 문장 3종(KO/EN)을 정정하는 **순수 코드/문서 작업**이다. 새로 쓰는 `spec/` draft 는 없다.
따라서 본 검토는 "target draft vs 다른 spec 영역" 이 아니라 **이 작업이 의존할 기존
`spec/conventions/*` 가 서로 그리고 다른 영역(`spec/4-nodes`, `spec/5-system`)과 정합적인가** 로
치환해 수행했다.

**프롬프트 번들 자체의 결함**: `_prompts/cross_spec.md` 에서 `spec/conventions/error-codes.md`
(17,742자) 와 `spec/conventions/user-guide-evidence.md` 를 포함해 268개 파일이 "컨텍스트 예산
초과" 로 **본문이 통째로 생략**됐다. 하필 이번 작업의 SoT 로 명시된 두 문서(`error-codes.md`,
`user-guide-evidence.md`) 가 정확히 그 생략 목록에 있다 — 번들만 보고 판정했다면 이번 작업에
가장 중요한 문서 없이 "충돌 없음" 을 냈을 것이다. 아래 발견사항은 해당 파일들을 `Read` 로 직접
열어 확인한 결과다. (기존에 기록된 동일 클래스 결함: `feedback_consistency_spec_mode_budget.md`
— `--spec` 모드 한정으로 알려져 있었으나 `--impl-prep` 에서도 동일 증상이 재현됨을 이번에 확인.)

---

## 발견사항

- **[WARNING]** `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 "메시지" 인지 "코드" 인지
  spec 영역마다 다르게 표기돼 있다 — 이번 작업이 고치려는 것과 **같은 결함 클래스**가 conventions
  밖 spec 에 남아 있다.
  - target 위치: (간접) `spec/conventions/error-codes.md` — "본 규율은 … **프로젝트 전체의
    에러 코드 문자열**에 적용된다" (Overview), 그리고 `guide-identifier-scan.ts` 상단 주석이
    이 문서를 SoT 로 명시.
  - 충돌 대상:
    - `spec/4-nodes/1-logic/3-loop.md` §6 표 — 열 제목 **"메시지"** (정확)
    - `spec/4-nodes/1-logic/7-map.md` §6 표 — 열 제목 **"메시지"** (정확)
    - `spec/4-nodes/1-logic/9-foreach.md` §6 표 — 열 제목이 **"메시지 / 코드"** (모호 — 이 토큰이
      구조화된 `error.code` 일 수도 있다는 인상을 준다)
    - `spec/4-nodes/1-logic/0-common.md`, `spec/3-workflow-editor/0-canvas.md`,
      `spec/3-workflow-editor/2-edge.md`, `spec/5-system/4-execution-engine.md` §3.0 — 모두
      backtick 으로 감싸 "`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT` **에러**" 식으로
      서술하며, 코드/메시지 구분을 명시하지 않는다 (`3-loop.md` 처럼 표로 분리돼 있지 않음).
    - `spec/5-system/3-error-handling.md §1` (에러 코드 **카탈로그** SoT, `error-codes.md` 가
      직접 위임하는 문서) — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`/
      `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE` 넷 다 **카탈로그에 아예 없다**. 같은 문서
      §1.3 `RESERVED_VARIABLE_NAME` 행은 정확히 이 상황(런타임 L2 message-prefix, 구조화
      `error.code` 없음)을 `EXECUTION_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT` 선례를 인용해 **명시
      기술**하는데, CONTAINER_* 4종에는 그 대응 각주가 없다.
  - 상세: 실제 구현(`execution-engine.service.ts:7053,7084,7121,7125,7130`)은 넷 다
    `throw new Error('TOKEN: 사람이 읽는 문장')` 형태의 **일반 `Error`** 이며 구조화된
    `error.code` 필드를 싣지 않는다 — 즉 `MAKESHOP_UNRESOLVED_PATH_PARAM` 과 정확히 같은 "메시지
    접두" 패턴이다. 이번 plan(§D)이 가이드 mdx 3문장에서 정정하려는 바로 그 오해("가이드가
    «코드» 라고 적은 것이 코드가 아니다")가, `9-foreach.md` 의 "메시지 / 코드" 열 제목과
    나머지 4개 spec 문서의 무구분 서술 때문에 **spec 자체에서** 재생산될 소지가 있다. 이 plan은
    `codebase/frontend/src/content/docs/**` 가이드 mdx 만 정정하고 이 spec 문서들은 손대지
    않으므로(범위 밖, `spec_impact: none`), 다음에 누군가 이 spec 을 근거로 가이드나 코드 주석을
    작성하면 같은 오분류가 재발할 수 있다.
  - 제안: 이번 PR 의 스코프를 넓히라는 뜻은 아니다(범위를 좁게 유지한 판단은 타당). 다만 완료
    후 별도 항목으로 (a) `9-foreach.md §6` 열 제목을 `3-loop.md`/`7-map.md` 와 동일하게
    "메시지" 로 통일, (b) `3-error-handling.md §1` 또는 `execution-engine.md §3.0` 에
    `RESERVED_VARIABLE_NAME` 행과 같은 형식의 각주("CONTAINER_* 4종은 message-prefix 이며
    구조화 `error.code` 없음")를 추가하는 것을 `plan/` 에 등재해 두는 편이, 이 작업이 방금
    잡은 결함 클래스의 재발을 spec 층에서도 막는다.

- **[WARNING]** consistency-check 프롬프트 번들이 이 작업의 두 SoT 문서
  (`error-codes.md`, `user-guide-evidence.md`) 를 예산 초과로 누락시킨다 (`--impl-prep` 에서도
  재현, 기존엔 `--spec` 한정 결함으로 기록돼 있었음).
  - target 위치: `_prompts/cross_spec.md` L1106-1108, L1101-1103(인접), 및
    `### ⚠️ 컨텍스트 예산 초과로 생략된 파일 268개` 목록.
  - 충돌 대상: `spec/conventions/error-codes.md`(17,742자), `spec/conventions/user-guide-evidence.md`
    — 둘 다 목록에 있음.
  - 상세: 이번 작업처럼 "target 문서" 가 명확한 단일 draft 가 아니라 `spec/conventions/`
    디렉토리 전체를 번들하는 `--impl-prep` 스코프에서는, 알파벳 순 적재가 예산을 다 쓴 뒤에
    나오는 파일(`error-codes.md` 는 `audit-actions.md`·`cafe24-api-catalog/**` 다음 순번이라
    일찍 잘림)일수록 정작 이 작업과 **가장 관련이 큰 문서일 확률이 낮지 않다**. 이번엔 직접
    `Read` 로 두 파일을 열어 실제로는 충돌이 없음을 확인했지만, 번들만 신뢰했다면 거짓
    "충돌 없음" 판정이 나갈 뻔했다.
  - 제안: `--impl-prep` 번들러가 `plan.md` 본문에서 언급되는 `spec/` 경로(이번 경우
    `guide-identifier-scan.ts` 헤더의 "SoT: …" 3개)를 **우선 적재**하도록 정렬 순서를 바꾸는
    것을 harness 백로그에 등재 검토. (기존 기록:
    `feedback_consistency_spec_mode_budget.md` — 이번 관측을 그 항목에 추가하거나 `--impl-prep`
    전용 후속 항목으로 분리)

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY`(신규, "방출" 축 면제) 는 기존
  `GUIDE_EXTERNAL_VOCABULARY`(존재 축 면제) 와 제약이 정반대이며 plan §C 가 이미 이를 정확히
  분석해 병합 불가를 스스로 결론냈다(기준집합에 "없을 것" vs "있을 것"). 구조적으로는
  `error-codes.md §3`(historical-artifact 예외 레지스트리, "사유를 적어야 한다") 와 같은 패턴
  ("예외는 명시적으로 등록하고 근거를 남긴다")을 재사용하는 셈이다. 이름·목적 충돌은 없음 —
  참고로만 남긴다. 별도 조치 불필요.

- **[INFO]** `guide-identifier-scan.ts` 헤더 주석이 SoT 로 `spec/conventions/user-guide-evidence.md`
  를 명시하지만, 그 문서(§1~§5)는 `<ImplAnchor>` 컴포넌트 기반의 **별개 가드 계열**(GUI 흐름
  절 → 코드 symbol 존재)을 다루며 `guide-identifier-scan.ts` 의 식별자-인용 스캔(따옴표/백틱
  토큰 → 소스 문자열 존재)과는 검증 메커니즘이 다르다. 두 가드 모두 "가이드 → 코드" 방향이라는
  점에서 `user-guide-evidence.md §2.1 다른 가드와의 관계` 절의 취지와 일치하지만, 그 절 목록에
  `guide-identifier-scan`/`guide-identifier-existence.test.ts` 계열은 아직 등재돼 있지 않다.
  충돌은 아니고(별개 메커니즘이라 배타적이지 않음), 문서 완결성 관점의 참고 사항.

---

## 요약

이번 plan(`error-code-emission-axis`)이 직접 건드리는 대상(`guide-identifier-scan.ts` 신규
"방출" 축, `GUIDE_NON_EMITTED_VOCABULARY`, 가이드 mdx 3문장 정정)에는 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 기존 `spec/**` 과의 직접 모순이 없다 —
`spec_impact: none` 판단은 타당하다. 다만 조사 과정에서 이 plan 이 고치는 것과 **같은 결함
클래스**(메시지 접두 vs 구조화 error.code 혼동)가 `spec/4-nodes/1-logic/9-foreach.md` 의
"메시지 / 코드" 열 제목과 `0-common.md`/`0-canvas.md`/`2-edge.md`/`4-execution-engine.md` 의
무구분 서술로 spec 층에 그대로 남아 있음을 발견했다(WARNING, 이번 PR 범위 밖 후속 권고). 또한
이 검토 자체의 입력 번들이 컨텍스트 예산 초과로 이번 작업의 SoT 두 문서를 누락시켜, 번들만으로는
신뢰할 수 있는 판정이 나올 수 없었다(WARNING, harness 결함 — 직접 `Read` 로 우회해 확인 완료).

## 위험도

MEDIUM
