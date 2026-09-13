# 변경 범위(Scope) 검토 — guide-error-code-truth

## 검토 방법

`git diff origin/main --stat` 으로 전체 107개 변경 파일을 확인했다. 프롬프트가 크기 제한으로
절단한 파일(`llm-model-config.controller.spec.ts`, `guide-error-code-existence.test.ts`,
`guide-error-code-scan.ts`, `plan/in-progress/guide-error-code-truth.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)은 저장소에서 `git diff origin/main`
/`Read` 로 직접 열어 대조했다. 4개 커밋(`911d9d7dd`→`137784219`)과 `plan/in-progress/
guide-error-code-truth.md` 전문을 읽어 각 확장 지점의 disclosure 여부를 확인했다. 저장소
파일은 조회만 했고 아무것도 쓰거나 고치지 않았다(`git status --short` 로 clean 확인 — 이번
리뷰 세션이 만든 `review/code/2026/09/13/11_33_23/`·`review/consistency/2026/09/13/11_33_51/`
두 미커밋 디렉터리만 존재).

`review/**` 83개 파일(files 25~107)은 이 배치가 이미 거친 3라운드의 `/ai-review` +
`--impl-prep`/`--impl-done` `consistency-check` 산출물이 그대로 커밋된 것이다. `review/` 는
gitignore 대상이 아니고 CLAUDE.md 가 "구현 완료 후 `/ai-review` 는 상시 승인된 강제 의무"의
표준 부산물로 커밋을 요구하므로 그 자체는 스코프 위반이 아니다. 스코프 판단의 실질 대상은
**코드/문서/plan 24개 파일**이다.

## 배경 — 원 트래커 대비 스코프가 늘어난 경위 (전 라운드에서도 확인된 사실)

`plan/in-progress/guide-error-code-truth.md` 는 트래커 항목 *"유저 가이드가 존재하지 않는
에러 코드 5종을 이름으로 적는다"* 를 닫는 작업으로 시작했다. 착수 중 실측이 다섯 중 셋은
"없는 이름"이 아니라 **엉뚱한 층에 붙인 귀속**이며, 그중 하나(§A, `LlmService.testConnection`)
는 문서 결함이 아니라 **런타임 결함**(서비스 `error` vs DTO/FE `message` 3중 불일치로 실패
사유가 화면에 전혀 도달하지 않음)임을 드러냈다. 이 발견이 스코프를 "문서 5종 정정"에서
"런타임 필드 정합화 + 계약 테스트 배선 + 신규 가드 3건 + 형제 DTO 정합화"로 넓혔다. 이 확장은
CHANGELOG(두 개의 별도 `## Unreleased` 절), plan(§A~§I 전 과정), 커밋 메시지(4개 전부가 스스로
"리뷰 라운드 N — ..." 형태로 확장을 고지)에 일관되게 실려 있다.

## 발견사항

- **[INFO]** 형제 도메인(Integrations) DTO 까지 손댄 것은 원 트래커 제목("가이드 에러 코드")
  보다 넓지만, 근거·고지가 각 층(코드 주석·CHANGELOG·plan·커밋 메시지)에 일관되게 실려 있다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto`, 게이트 460~488행 — `latencyMs`/`meta` 제거 + `code?: string` 추가)
  - 상세: 이 파일은 LLM/model-config 도메인이 아니라 `/api/integrations/:id/test` 를 감싸는
    별도 도메인 DTO 다. `git log` 로 확인한 커밋(`de99def86`)이 스스로 "리뷰 라운드 2 —
    형제 엔드포인트에도 계약 검사를 걸고"라고 확장을 고지하며, CHANGELOG(`## Unreleased —
    Behavior change`, 게이트 27~39행)도 "형제 ... 같은 값 vs 선언 점검을 형제에도 돌린 결과"라고
    별도 절로 갈라 명시한다. `code` 추가는 `IntegrationsService` 가 실제로 발행 중이고(라운드 3
    커밋이 최초 "26곳" 수치를 실측 오류로 자체 정정해 "4곳 + MCP 테스터 6곳"으로 좁힌 이력까지
    diff 에 남아 있다) `spec/2-navigation/4-integration.md §9.1` 이 이미 문서화한 shape 을
    뒤늦게 선언에 반영한 것이라 "없던 기능 추가"가 아니다. `integrations.service.spec.ts` 에
    대응 `assertMatchesContract` 배선도 같은 커밋에 함께 있어 코드만 바뀌고 테스트가 안
    따라간 형태는 아니다.
  - 제안: 없음 — 스코프 확장이 은닉되지 않고 각 층에서 일관되게 고지돼 있어 차단 사유로 보지
    않는다. 원 트래커 제목만 보고 diff 를 훑는 사람에게는 이 파일이 왜 여기 있는지 CHANGELOG
    를 봐야 알 수 있다는 점만 기록해 둔다.

- **[INFO]** 신규 가드 파일이 최초 plan 체크리스트(§D)가 계획한 2건보다 1건 더 많다(3건) —
  이 역시 disclosure 됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts`
    (신규 파일 전체)
  - 상세: plan 최초 §D 는 가드 2건(`guide-error-code-{scan,existence}`)만 계획했다. 3번째
    가드는 리뷰 라운드 1(§G, architecture WARNING#1: "8갈래 문장표가 SoT 와 손으로만 맞춰져
    있어 재발 방지가 없다")에 대한 응답으로 추가됐고, `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 관계표 등재 항목이 "가드 하나만 적고 있었다"를
    스스로 지적하며 3→5건으로 정정한 이력이 diff 에 남아 있다. 리뷰가 낸 지적에 대한 처분이지
    임의로 추가한 기능 확장(over-engineering)이 아니다.
  - 제안: 없음.

- **[INFO]** `run-results{,.en}.mdx` 표 수정 중 `nodeName`→`nodeLabel` 필드명 정정은 "에러 코드
  진위"라는 원 축과 다른 축(인접 필드명)이지만 같은 JSON 예시 코드펜스를 건드리는 김에 처리됨
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`,
    `run-results.en.mdx` (`"nodeName"` → `"nodeLabel"`, 게이트 163행 부근)
  - 상세: plan §H(리뷰 라운드 2)가 "rationale W#2 — nodeName 잔존, 바로 옆 code 를 고치면서
    지나쳤다"로 명시 처분한 항목이다. `spec/2-navigation` §2.2 가 2026-08-17 에 이미
    `nodeLabel` 로 정정했고 실측(backend emit `nodeName` 0 · `nodeLabel` 57)이 근거로 남아
    있어 정당한 수정이지만, 엄밀히는 "에러 코드 표"가 아니라 인접 필드명 축이다. 같은
    코드펜스 안에서 즉시 발견·처분된 것으로, 별도 파일·별도 커밋을 요구할 정도의 무관한
    수정은 아니라고 판단한다.
  - 제안: 없음 — 인접 발견의 즉시 처분으로 적절한 범위.

- **[INFO]** 라운드 3 커밋(`137784219`)이 이 PR 자신이 만든 노드-종류별 표에서 실재 코드 5종
  (`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·`MAX_COLLECTION_RETRIES_EXCEEDED`·
  `SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE`)을 추가로 등재 — 새 축이 아니라
  이 PR 이 §B 에서 이미 시작한 "spec §1.4 카탈로그 미러링" 작업의 결손 보정이라 스코프 내
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`,
    `run-results.en.mdx`, `integrations{,.en}.mdx` (MakeShop 4종 사전-호출 실패 코드 문단 추가)
  - 상세: 라운드 3은 정지 규칙("주석·문서 성격 발견이면 등재만 하고 멈춘다")의 문자를 어기고
    직접 고쳤다고 스스로 커밋 메시지에 명시하지만, 근거(이 PR 산출물 자체의 오류·유계·기계적
    수정)를 밝히고 있고 실제 diff 도 표에 행을 추가하는 것으로 국한돼 새 파일·새 기능·새
    가드를 만들지 않았다(역방향 가드·유령 필드 스캐너는 등재만 하고 착수하지 않음). 스코프
    판단상 문제 삼을 수준은 아니다.
  - 제안: 없음 — 자기 규칙 위반 사실 자체는 이미 plan(§I "정지 규칙에 대한 판단")에 정직하게
    기록돼 있으므로 별도 지적 불요.

## 검토한 항목 중 문제 없음으로 판단한 것

- 코드/문서/plan 24개 파일(`review/**` 제외) 전부가 plan §A/§B/§C/§D 중 하나에 1:1 대응한다.
  체크리스트에 없는 여분의 리팩토링·포맷팅-only 변경·무관한 주석 삭제/추가는 발견되지 않았다.
- `llm-model-config.controller.spec.ts`·`llm.service.spec.ts`·`integrations.service.spec.ts`
  의 신규 import(`supertest`, `assertMatchesContract`/`contractForDto`, DTO 클래스,
  `LlmService`/`LlmPreviewService` 를 `import type` 에서 값 import 로 전환)는 전부 새로
  추가된 DI 기반 테스트 블록에서 실제로 소비되며 미사용 import 는 없다.
- `model-configs.ts`/`model-configs.test.ts` 변경은 `latencyMs` 제거 한 줄과 대응 픽스처
  교체(실재 필드 `dimension` 으로 대체)뿐이고, 다른 API 클라이언트 함수는 건드리지 않았다.
- `impl-anchor-existence.test.ts` 의 주석 수정(게이트 108~113행)은 이 PR 이 `models{,.en}.mdx`
  에 처음으로 `api-endpoint` 앵커를 실으면서 그 주석이 서술하던 전제("아직 실사례 없음")를
  스스로 반증했기 때문에 필요한 정정이며, 무관한 주석 손질이 아니다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff 는 원 트래커 체크박스
  갱신 + 관련 backlog 5건 등재(§D 가드 위치 결정에 따른 planner 위임분)에 국한되며, 3200줄대
  그 문서의 다른 절은 건드리지 않았다.
- `.claude/**`·`package.json`·lockfile·CI 설정 등 harness/설정 파일 변경은 0건이다
  (`git diff origin/main --name-only` 전수 확인).
- CHANGELOG 항목이 두 개의 `## Unreleased` 절로 성격(런타임 결함 vs 문서 오류)을 스스로
  분리해 적고 있어, 작성자가 스코프의 이질성을 인지하고 고지하고 있다.
- `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`/
  `guide-sanitized-message-parity.test.ts` 는 전부 plan §D·라운드1 처분에 1:1 대응하고,
  기존 자매 유틸(`tree-walk`·`impl-anchor-parse`)을 재사용해 새 인프라를 중복 생성하지 않았다.
- 라운드 1~3 리뷰 자신이 앞선 라운드의 scope reviewer 발견(예: `review/code/2026/09/13/
  10_40_34/scope.md` "scope W#1 — CHANGELOG 가 meta 제거·code 추가 누락")을 확인·처분한
  이력이 CHANGELOG·plan diff 에 그대로 남아 있어, 스코프 관련 지적이 방치되지 않고 각
  라운드에서 소비됐다.

## 요약

원 트래커는 "유저 가이드의 존재하지 않는 에러 코드 5종 정정"이었지만, 착수 중 실측이 그중
하나(§A)를 문서 결함이 아니라 3층 필드명 불일치로 인한 런타임 결함으로 재분류하면서 실제
diff 는 형제 Integrations DTO 계약 정합화·신규 build-time 가드 3건·컨트롤러 HTTP 왕복
테스트·spec §1.4 카탈로그 미러링 보정까지 3라운드에 걸쳐 번졌다. 이 확장은 매 지점 은닉되지
않았다 — 코드 주석·CHANGELOG(별도 절)·plan(§A~§I 전 과정과 세 차례 리뷰 라운드 처분 기록)·
커밋 메시지가 각 확장 지점마다 실측 근거와 함께 고지하고 있고, 코드/문서 24개 파일 전부가 그
고지된 항목에 1:1 대응한다. 임의의 리팩토링, 요청하지 않은 기능 추가, 포맷팅-only 변경, 무관한
주석/임포트/설정 변경은 발견되지 않았다. 유일한 관찰점은 스코프가 원 제목보다 상당히
넓어졌다는 사실 자체인데, 그 확장이 "같은 결함 클래스를 발견 즉시 닫는다"는 일관된 원칙 아래
매번 disclosure 되고 있어 심각한 스코프 위반으로 보지 않는다.

## 위험도

LOW
