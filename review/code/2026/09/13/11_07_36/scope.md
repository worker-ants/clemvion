# 변경 범위(Scope) 검토 — guide-error-code-truth

## 검토 방법

`git diff origin/main...HEAD --stat` 으로 전체 82개 변경 파일을 확인하고, 프롬프트가 절단한
파일(`llm-model-config.controller.spec.ts`, `guide-error-code-existence.test.ts`,
`guide-error-code-scan.ts`, `plan/in-progress/guide-error-code-truth.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)은 저장소 원본을 `git diff`/`Read`
로 직접 열어 대조했다. 저장소 파일은 수정하지 않았다(`git status --short` 로 clean 확인 —
현재 커밋 상태만 조회, 뮤테이션 없음).

`review/**` 58개 파일(files 25~82)은 이 배치가 이미 거친 두 라운드의 `/ai-review` +
`--impl-prep`/`--impl-done` `consistency-check` 산출물이 그대로 커밋된 것이다. `review/` 는
gitignore 대상이 아니고, CLAUDE.md 가 요구하는 "구현 완료 후 `/ai-review` 는 상시 승인된
강제 의무" 절차의 표준 부산물이므로 이 자체는 스코프 위반이 아니다(§체크리스트에도
명시). 스코프 판단의 실질 대상은 **코드/문서/plan 24개 파일**이다.

## 배경 — 원 트래커 대비 스코프가 늘어난 경위

`plan/in-progress/guide-error-code-truth.md` 는 트래커 항목 *"유저 가이드가 존재하지 않는
에러 코드 5종을 이름으로 적는다"* 를 닫는 작업으로 시작했다. 착수 중 실측이 다섯 중 셋은
"없는 이름"이 아니라 **엉뚱한 층에 붙인 귀속**이며, 그중 하나(§A, `LlmService.testConnection`)
는 문서 결함이 아니라 **런타임 결함**(서비스 `error` vs DTO/FE `message` 3중 불일치로 실패
사유가 화면에 전혀 도달하지 않음)임을 드러냈다. 이 발견이 스코프를 "문서 5종 정정"에서
"런타임 필드 정합화 + 계약 테스트 배선 + 신규 가드"로 넓혔다.

## 발견사항

- **[INFO]** 형제 도메인(Integrations) DTO 까지 손댄 것은 원 트래커 제목보다 넓지만,
  근거·고지가 각 층(코드 주석·CHANGELOG·plan)에 일관되게 실려 있다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto`, `latencyMs`/`meta` 제거 + `code?: string` 추가)
  - 상세: 이 파일은 LLM/model-config 도메인이 아니라 `/api/integrations/:id/test` 를 감싸는
    Integrations 도메인 DTO 다. `git log`(`de99def86`)로 확인한 커밋 메시지 자체가
    "리뷰 라운드 2 — 형제 엔드포인트에도 계약 검사를 걸고" 라고 스스로 스코프 확장을
    고지하고 있고, CHANGELOG(`## Unreleased — Behavior change`)도 이 엔드포인트를 별도
    "형제" 절로 갈라 적으며 "같은 값 vs 선언 점검을 형제에도 돌린 결과"라고 명시한다.
    `code` 추가는 `IntegrationsService` 가 26곳에서 실제로 발행 중이고
    `spec/2-navigation/4-integration.md §9.1` 이 이미 문서화한 shape 을 뒤늦게 선언에 반영한
    것이라 "없던 기능 추가"가 아니라 "선언 vs 값" 불일치 해소다. `integrations.service.spec.ts`
    에 대응 `assertMatchesContract` 배선도 같은 커밋에 함께 있어 코드만 바뀌고 테스트가
    안 따라간 형태는 아니다.
  - 제안: 없음 — 스코프 확장이 은닉되지 않고 각 층에서 일관되게 고지돼 있어 차단 사유로
    보지 않는다. 다만 원 트래커 제목("가이드 에러 코드")만 보고 diff 를 훑는 사람에게는
    이 파일이 왜 여기 있는지 CHANGELOG 를 봐야 알 수 있다는 점은 다음 사람을 위해 기록해 둔다.

- **[INFO]** 신규 가드 파일이 plan §D 가 명시한 것보다 1건 더 많다(2건 → 3건) — 이 역시
  disclosure 됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (신규)
  - 상세: plan 최초 체크리스트(§D)는 가드 2건(`guide-error-code-{scan,existence}`)만 계획했다.
    3번째 가드는 리뷰 라운드 1(§G, architecture WARNING#1: "8갈래 문장표가 SoT 와 손으로만
    맞춰져 있어 재발 방지가 없다")에 대한 응답으로 추가됐다. `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 의 관계표 등재 항목도 "가드 하나만 적고
    있었다"를 스스로 지적하고 3→5건으로 정정한 이력이 diff 에 남아 있어, 스코프가 늘어난
    사실 자체를 숨기지 않았다. 리뷰가 낸 지적에 대한 처분이지 임의로 추가한 기능 확장이
    아니다(over-engineering 아님).
  - 제안: 없음.

- **[INFO]** `run-results{,.en}.mdx` 표 수정 중 `nodeName`→`nodeLabel` 필드명 정정은 "에러
  코드 진위"라는 원 축과 다른 축(필드명)이지만 같은 표 행을 건드리는 김에 처리됨
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`,
    `run-results.en.mdx` (`"nodeName"` → `"nodeLabel"`)
  - 상세: plan §H(리뷰 라운드 2)가 "rationale W#2 — nodeName 잔존, 바로 옆 code 를 고치면서
    지나쳤다"로 명시 처분한 항목이다. `spec/2-navigation` §2.2 가 2026-08-17 에 이미
    `nodeLabel` 로 정정했고 backend emit 실측(`nodeName` 0 · `nodeLabel` 57)도 근거로 남아
    있어 정당한 수정이지만, 엄밀히는 "에러 코드 표"가 아니라 "같은 JSON 예시 안의 인접
    필드명" 축이다. 같은 코드펜스 안에서 발견돼 즉시 고친 것으로, 별도 파일·별도 PR 을
    요구할 정도의 무관한 수정은 아니라고 판단한다.
  - 제안: 없음 — 인접 발견의 즉시 처분으로 적절한 범위.

## 검토한 항목 중 문제 없음으로 판단한 것

- 코드/문서/plan 24개 파일(`review/**` 제외) 전부가 plan §A/§B/§C/§D 중 하나에 1:1 대응한다.
  체크리스트에 없는 여분의 리팩토링·포맷팅-only 변경·무관한 주석 삭제/추가는 발견되지 않았다.
- `llm-model-config.controller.spec.ts`·`llm.service.spec.ts`·`integrations.service.spec.ts`
  의 신규 import(`supertest`, `assertMatchesContract`/`contractForDto`, DTO 클래스)는 전부
  새로 추가된 테스트 블록에서 실제로 소비되며 미사용 import 는 없다.
- `model-configs.ts`/`model-configs.test.ts` 변경은 `latencyMs` 제거 한 줄과 대응 픽스처
  교체(`dimension` 으로 대체)뿐이고, 다른 API 클라이언트 함수는 건드리지 않았다.
- `impl-anchor-existence.test.ts` 의 주석 수정은 이 PR 이 `models{,.en}.mdx` 에 처음으로
  `api-endpoint` 앵커를 실으면서 그 주석이 서술하던 전제("아직 실사례 없음")를 스스로
  반증했기 때문에 필요한 정정이며, 무관한 주석 손질이 아니다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff 는 원 트래커 체크박스
  갱신 + 관련 backlog 3건 등재에 국한되며, 3200줄대 그 문서의 다른 절은 건드리지 않았다
  (diff 범위를 `git diff` 로 확인).
- `.claude/**`·`package.json`·lockfile·CI 설정 등 harness/설정 파일 변경은 0건이다
  (`git diff origin/main...HEAD --name-only` 전수 확인).
- CHANGELOG 항목이 두 개의 `## Unreleased` 절로 성격(런타임 결함 vs 문서 오류)을 스스로
  분리해 적고 있어, 작성자가 스코프의 이질성을 인지하고 고지하고 있다.

## 요약

원 트래커는 "유저 가이드의 존재하지 않는 에러 코드 5종 정정"이었지만, 착수 중 실측이 그중
하나(§A)를 문서 결함이 아니라 3층 필드명 불일치로 인한 런타임 결함으로 재분류하면서 실제
diff 는 형제 Integrations DTO 계약 정합화·신규 build-time 가드 3건·컨트롤러 HTTP 왕복
테스트까지 번졌다. 이 확장은 은닉되지 않았다 — 코드 주석·CHANGELOG(별도 절)·plan(§A~§H
전 과정과 두 차례 리뷰 라운드 처분 기록)이 각 확장 지점마다 실측 근거와 함께 고지하고
있고, 코드/문서 24개 파일 전부가 그 고지된 항목에 1:1 대응한다. 임의의 리팩토링, 요청하지
않은 기능 추가, 포맷팅-only 변경, 무관한 주석/임포트/설정 변경은 발견되지 않았다. 유일한
관찰점은 스코프가 원 제목보다 넓어졌다는 사실 자체인데, 그 확장이 "같은 결함 클래스를
발견 즉시 닫는다"는 일관된 원칙 아래 매번 disclosure 되고 있어 심각한 스코프 위반으로
보지 않는다.

## 위험도

LOW
