# 문서화(Documentation) 리뷰 — 워크플로우 duplicate 가 nodes/edges 를 복사하도록 구현

대상: `WorkflowsService.duplicate()` 재구현(캔버스 전체 복제) + Swagger 설명 갱신 + unit/e2e 테스트 보강 +
spec 2곳(`spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`) 정정 + 신규 plan 문서.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 미갱신 — 완전히 깨져 있던 사용자 대면 기능(복제 시 빈 워크플로우 생성)을
  캔버스 전체 복제로 고치는 변경인데 `CHANGELOG.md` 에 항목이 없다.
  - 위치: `CHANGELOG.md` (수정 대상 파일 목록 23개 중에 없음 — 부재 자체가 지적 사항)
  - 상세: 이 저장소는 `CHANGELOG.md` 를 상시 최신으로 유지하며, 특히 "이미 배포된 사용자 대면 동작의
    회귀/결함 수정" 류는 거의 예외 없이 `## Unreleased — <제목>` 항목을 받는다 — 같은 파일 최상단의
    최근 3개 항목만 봐도 취소(Stop) 버튼이 하류 노드 dispatch 를 못 멈추던 결함, retry-turn 종결 경로의
    무가드 쓰기, 웹챗 세션-apiBase 바인딩 결함이 전부 상세 항목으로 기록돼 있다. 실제로 `git log --
    CHANGELOG.md` 로 확인한 결과 최근 30개 커밋 중 `fix(engine)`/`fix(web-chat)`/`fix(navigation)` 류의
    사용자 대면 회귀 수정은 전부 CHANGELOG 항목을 동반했다(`771801e3e`/`d3fafbafc`/`24d8ab623`/
    `6bf6620cf`/`ab19fef67` 등). 이번 fix(`13b818ec5 fix(backend): 워크플로우 복제가 빈 워크플로우를
    만들던 결함`)는 성격상(핵심 기능이 완전히 깨진 상태였고, 이번에 수정) 이 패턴과 정확히 같은
    카테고리인데 `CHANGELOG.md` 는 손대지 않았다. 다만 이 규칙은 `CLAUDE.md`/`PROJECT.md`/
    `developer` SKILL 어디에도 명문화된 **강제** 절차는 아니며(검색 결과 0건), 저장소 관행(precedent)에
    근거한 지적이다.
  - 제안: `## Unreleased — 워크플로우 복제가 nodes/edges 를 복사하지 않던 결함 수정` 같은 항목을
    추가해 "복제가 캔버스 전체(노드·엣지)를 복사하도록 수정, 버전 이력/트리거/테스트 데이터셋은
    비승계" 를 1~2문단으로 기록할 것을 권장.

- **[INFO]** 신규 인라인 주석이 가드 테스트의 위치를 실제와 다르게(다른 파일을) 가리킴
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:264`
  - 상세: `// 에는 둘 다 없음(같은 전제를 고정하는 가드 테스트가 본 파일 하단에 있다).` 라는 신규
    주석은 "본 파일"(=`workflows.service.ts`) 하단에 해당 가드 테스트가 있다고 말하지만, 실제 그
    가드 테스트(`describe('importWorkflow 전제 — Node/Edge 엔티티 @BeforeInsert 부재·cascade
    메타데이터 가드 (W3c)', ...)`)는 `workflows.service.ts` 가 아니라 별도 파일인
    `workflows.service.spec.ts:2222` 에 있다. 같은 파일에서 "본 파일에" 라는 표현이 문자 그대로
    "이 .ts 소스 파일"을 가리키는 용례가 이미 존재해(`execution-engine.service.ts:229` "본 파일에
    그대로 잔류 — 이동하지 않는다") 이 표현이 이 저장소에서 느슨한 비유가 아니라 문자 그대로
    쓰이는 관용구임을 뒷받침한다. `importWorkflow()` 의 동일 취지 기존 주석(`:401` 부근)은 이런
    가드 테스트 위치 언급 없이 "(2026-06-10 확인)" 으로만 적어 이 문제를 안 만들었는데, 이번에
    `duplicate()` 에 신규로 추가하며 위치 서술이 부정확해졌다.
  - 제안: "본 파일 하단" → "테스트 파일(`workflows.service.spec.ts` W3c)" 등으로 정정.

- **[INFO]** JSDoc 의 복제 범위-제외 문구가 spec 표에 반영된 명확화를 미러링하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:225-226` (JSDoc "복제 범위 밖" 문단)
  - 상세: 같은 PR 이 `spec/data-flow/11-workflow.md` 의 duplicate 엔드포인트 표 행을 "`trigger`
    **(webhook/schedule)**" 로 명확화했다 — "Manual Trigger 노드"(캔버스상의 `node.category='trigger'`)
    와 "Trigger 엔티티"(webhook/schedule 자동화 설정)가 이름이 겹쳐 구현자가 오독할 수 있다는
    consistency-check INFO 를 반영한 결과다(`review/consistency/2026/07/30/16_45_59/cross_spec.md`
    INFO #1). 그런데 같은 문구를 요약하는 `duplicate()` 의 JSDoc 은 그냥 `` `trigger` `` 라고만 적어
    이 명확화가 미러링되지 않았다 — 코드를 읽는 구현자/리뷰어 입장에서는 spec 을 따로 열어보지
    않는 한 여전히 같은 오독 여지가 남는다.
  - 제안: JSDoc 문구도 `` `trigger`(webhook/schedule) `` 로 맞추면 spec 과 코드 주석이 같은 명확화를
    공유한다.

- **[INFO]** `@ApiOperation.description` 길이가 프로젝트 컨벤션의 권장 상한을 초과
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:215`
  - 상세: `spec/conventions/swagger.md §3` 은 "`description`은 50~150자 내외" 를 권장하는데, 갱신된
    duplicate 설명은 237자다(측정 완료). 다만 같은 컨트롤러 파일 안에 이미 281자짜리 설명
    (`triggerGraphWarnings` 계열, `NodeComponentMetadata 의 graphWarningRules...`)이 선례로 존재해,
    "복잡한 부수효과를 정확히 설명하기 위해 권장 길이를 넘기는" 것이 이 파일에서 이미 용인되는
    패턴이다. 내용 자체(부수효과 정확히 명시)는 §3 "가능하면 '무엇을 하는지 + 제약/부수효과'를
    담습니다" 요구에 잘 부합하므로 규약 위반이라기보다 참고 수준의 완결성 메모.
  - 제안: 필수 아님. 필요하면 Swagger UI 표시상 가독성을 위해 문장을 좀 더 짧게 쪼개는 것을 고려.

## 검증했으나 문제없음 (긍정 확인 — 문서화 관점에서 특히 꼼꼼히 대조한 항목)

- **Swagger `@ApiOperation.description` 갱신**: `codebase/backend/src/modules/workflows/
  workflows.controller.ts:214-215` 가 실제 구현(캔버스 전체 복제, UUID 재매핑, 버전/트리거/데이터셋/
  실행이력 비승계)을 정확히 반영한다. 직전 라운드 consistency-check(`convention_compliance.md`
  INFO)가 지적했던 "부수효과 미기재" 갭이 정확히 해소됐다.
- **`duplicate()` 신규 JSDoc**(`workflows.service.ts:216-227`): import 경로와 UUID 재매핑 알고리즘만
  공유하고 게이트(label 중복 검사·`applyConfigDefaults`·기본 LLM 주입)는 공유하지 않는 이유, 복제
  범위 밖 목록을 모두 정확히 서술 — 실제 구현 바디와 1:1 대조 결과 불일치 없음. `(data-flow §1.5)`/
  `(§Rationale)` 같은 파일 경로 생략형 인용은 `agent-memory.service.ts`/`auth.service.ts`/
  `execution-engine.service.ts` 등 저장소 전반에 이미 확립된 관용구와 일치해 스타일 이슈 아님.
  guard-test 파일 언급 부정확 1건은 위 INFO 로 별도 기재.
  - `manager.insert` 가 `@BeforeInsert`/cascade 를 건너뛴다는 인라인 주장은 실제로
    `workflows.service.spec.ts:2222-2249` 의 `W3c` describe 블록이 reflect-metadata 로 고정하고 있음을
    확인(존재 자체는 정확, 다만 "본 파일" 위치 서술만 부정확 — 위 INFO).
- **spec 2곳 반영**(`spec/data-flow/11-workflow.md` §1.5/§2.1/Rationale, `spec/2-navigation/
  1-workflow-list.md` §2.6/§3): 두 차례 consistency-check(16:45/17:03)가 지적한 INFO/WARNING 6건
  전부가 최종 diff 에 실제로 반영돼 있음을 직접 대조로 확인 — `pending_plans:` 등재, Rationale
  인용 앵커 정정(`#r-22-...`), "기각한 대안" 2건 모두 명시적 라벨 부여, `workflow`/`node`/`edge`
  세 테이블 전부에 대칭적으로 "복제 (§1.5)" 행 추가. 스텁/거짓 반영 없음.
  `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 의 slugify 로직 기준으로
  신규 앵커(`#15-복제--내보내기--가져오기`)도 실제 헤딩과 일치.
  - spec 상의 "옛 메타-only 서술" 잔존 여부를 저장소 전체(`spec/**`, frontend)에서 재검색한 결과
    옛 문구는 plan(의도된 AS-IS 인용)과 `review/**`(과거 리포트, 정상) 안에만 남아 있고 살아있는
    spec/코드에는 잔존하지 않음.
- **e2e/unit 테스트의 신규 인라인 주석**: `workflow-crud.e2e-spec.ts` 의 "`SaveCanvasNodeDto` 의
  `containerId`/`toolOwnerId` 가 `@IsUUID()`" 주장을 `save-canvas.dto.ts:97,108` 로 직접 대조해 정확함을
  확인. "프론트엔드도 새 노드에 UUID 를 발급한다" 주장도 `workflow-canvas.tsx`/`editor-store.ts` 의
  `crypto.randomUUID()` 사용처로 뒷받침됨. `workflows.service.spec.ts` 상단 fixture 주석("container 축과
  toolOwner 축을 다른 노드로 갈라 뒤바뀌어도 관측되게 한다")도 실제 fixture·단언 쌍과 일치.
- **plan 문서의 역사적 사실 주장**: `git log -L 216,233:...workflows.service.ts` 로 재현한 결과 plan 이
  주장한 "`8ff4e8564` 이후 한 번도 수정된 적이 없다"가 정확히 재현됨(fix 커밋 `13b818ec5` 직전
  마지막 수정이 정확히 `8ff4e8564`).
- **README/설정 문서/예제 코드**: 신규 환경변수·설정 키 없음(naming_collision.md 교차 확인).
  `codebase/backend/README.md` 는 엔드포인트별 문서를 다루지 않는 일반 셋업 문서라 갱신 대상 아님.
  내부 API 라 별도 사용 예제 코드는 불필요 — Swagger 설명 + e2e 케이스가 사실상 그 역할을 겸함.

## 요약

이번 변경은 문서화 관점에서 전반적으로 매우 높은 완성도를 보인다. 코드 레벨 JSDoc(`duplicate()`)이
"무엇을 하는지" 뿐 아니라 "왜 export/import 게이트를 공유하지 않는지"·"왜 버전 이력/트리거/데이터셋을
승계하지 않는지"까지 근거를 담고 있고, Swagger `@ApiOperation.description`·두 spec 문서(§1.5 API 표,
§2.1 데이터 흐름 표, Rationale)·plan 문서·e2e/unit 테스트 주석이 모두 같은 사실(캔버스 전체 복제·UUID
재매핑·버전 이력 비승계)을 정확하고 상호 일치되게 서술한다. 두 차례 consistency-check 가 지적한
INFO/WARNING 6건도 최종 diff 에서 전부 실제로 반영된 것을 직접 대조로 확인했다. 남은 지적은 전부
경미한 수준이다 — (1) 이 정도 규모의 사용자 대면 결함 수정에 대해 저장소 관행상 통상 따라붙는
`CHANGELOG.md` 항목이 빠짐(WARNING, 단 강제 규칙은 아님), (2) 신규 주석 하나가 가드 테스트의 소재
파일을 "본 파일"로 잘못 지칭, (3) JSDoc 이 spec 표에 반영된 "trigger(webhook/schedule)" 명확화를
미러링하지 않음, (4) Swagger 설명 길이가 컨벤션 권장 상한을 넘음(단 같은 파일에 더 긴 선례 존재).
전부 INFO 수준(CHANGELOG 만 WARNING)이며 어느 것도 구현 정확성이나 향후 유지보수를 위협하지 않는다.

## 위험도

LOW
