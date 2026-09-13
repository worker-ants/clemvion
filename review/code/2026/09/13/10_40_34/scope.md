# 변경 범위(Scope) 검토 — guide-error-code-truth (라운드 2)

## 검토 방법

프롬프트 번들 56개 파일(트래커 항목 원 구현 + 라운드1 리뷰 산출물 + 라운드1 리뷰 대응 수정분이 모두
`origin/main...HEAD` 누적 diff 에 실려 있음) 전부를 확인했다. 절단된 diff 는
`git diff origin/main...HEAD -- <path>` 로 원본을 직접 대조했고, `TestConnectionResultDto` 등
핵심 심볼은 `grep -rn`으로 저장소 전수 재확인했다. 저장소 파일은 건드리지 않았다(읽기 전용
`git diff`/`grep`/`Read`만 사용, mutation 없음).

`plan/in-progress/guide-error-code-truth.md`(신규, 264줄)가 이 배치의 전체 이력을 §A~§G 로
자기 서술하고 있어, 이번 검토는 diff 가 그 서술과 실제로 일치하는지를 축으로 삼았다.

## 배경 — 이번 라운드가 새로 얹은 것

이전 scope 리뷰(`review/code/2026/09/13/10_12_19/scope.md`, LOW)는 원 구현(§A/§B/§C/§D)까지만
검토했다. 이번 라운드는 그 리뷰 이후 `/ai-review` 라운드 1(10건 지적)에 대한 대응 커밋이
추가된 상태다 — plan §G 표에 10건 처분이 전부 기록돼 있고, 코드 diff 를 대조하면 그 표와
정확히 일치한다(`llm.service.ts` JSDoc 재배치, `guide-error-code-scan.ts` 의
`collectBackendTokens(files→fileTexts)` 리네임, `run-results{,.en}.mdx` 의 `LLM_RATE_LIMIT`
중복 제거, `nodeName→nodeLabel`, `model-config-manager.test.tsx` 신규 실패-경로 테스트,
`guide-sanitized-message-parity.test.ts` 신규, `integration-response.dto.ts` 의 `code` 필드
추가 등). 체크리스트 항목 밖의 "덤" 수정은 발견되지 않았다.

## 발견사항

- **[WARNING]** 라운드 1 응답으로 `TestConnectionResultDto`(Integrations 도메인,
  `/api/integrations/:id/test`)에 `meta` 필드 제거 + `code` 필드 신설이 새로 추가됐는데,
  CHANGELOG 의 "배포 시 확인" 고지 섹션이 이 변경을 누락한다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (게이트 460~490행, `TestConnectionResultDto`) / `CHANGELOG.md` (게이트 19~26행,
    "⚠️ 배포 시 확인 — 응답에서 사라지는 필드" 절)
  - 상세: 원 구현(라운드 1 이전)은 이 파일에서 `latencyMs` 제거만 했고, CHANGELOG 도 그것만
    "필드 2종 제거"(`latencyMs` + `error`→`message` 리네임)로 정확히 고지했다(이전 scope
    리뷰가 이 시점 상태를 INFO 로 남긴 바 있다). 이번 라운드에서 api_contract WARNING#3
    대응으로 같은 DTO 에 **`code?: string` 를 새로 추가**하고 **`meta?` 를 제거**했다 — 둘 다
    코드 주석(`integration-response.dto.ts:483-489`)과 `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 의 새 백로그 항목("`/api/integrations/:id/test`
    의 MCP 전용 응답 필드 3종이 미선언 + 계약 검증자 미배선")에는 상세히 기록돼 있지만,
    **CHANGELOG 의 "응답에서 사라지는 필드" 목록에는 `meta` 가 없다.** 이 절은 정확히
    "배포 시 확인" 을 위해 만들어진 절이고 제목이 "필드 **2종** 제거"라고 숫자까지 못박고
    있어, `meta` 제거(Integrations 도메인, 원 스토리와 다른 엔드포인트)가 조용히 세 번째
    필드 변경이 되어 있다. `meta` 는 저장소 내 소비처가 없다는 근거(주석)는 있으나, 이
    DTO 는 OpenAPI 로 광고되는 공개 응답이라 latencyMs 와 같은 배포-영향 등급이다.
  - 제안: CHANGELOG 의 해당 절 제목·목록에 `meta` 제거(및 `code` 신설)를 추가하거나, 최소한
    "이번 라운드에서 형제 엔드포인트로 범위가 확장됐다"는 한 줄을 얹는다.

- **[INFO]** 같은 라운드-2 확장(Integrations DTO `code`/`meta`)은 원 스토리(LLM/model-config
  도메인)가 받은 것과 같은 급의 테스트 보강 없이 이뤄졌다 — 비대칭이지만 이미 백로그로
  고지됨.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    — 이 diff 는 해당 파일 1개 26줄 추가/3줄 삭제뿐이며, `git diff --stat -- 'codebase/backend/
    src/modules/integrations/**'` 로 재확인한 결과 이 모듈 아래 테스트 파일 변경은 0건이다.
  - 상세: 원 스토리(LLM `testConnection`)는 서비스 단위 프로브 + 컨트롤러 HTTP 왕복(실제
    `TransformInterceptor` 포함) 두 층에 `assertMatchesContract` 를 배선해 "선언 vs 값"
    불일치를 런타임으로 고정했다. 반면 이번에 같은 결함 클래스(과소 선언)를 발견하고 고친
    Integrations DTO 쪽은 선언만 추가했을 뿐, `/api/integrations/:id/test` 에는 계약 테스트가
    여전히 배선돼 있지 않다 — 즉 이 필드가 다시 어긋나도 정적 `swagger-dto-contract-guard`
    조차 못 잡는 상태가 그대로 남는다. 다만 이 gap 자체는 은닉되지 않았다: developer 가 새
    백로그 항목("MCP 전용 응답 필드 3종이 미선언 + 계약 검증자 미배선")에 "함께 할 일:
    assertMatchesContract 배선"이라고 명시해 뒀다.
  - 제안: 조치 불요(정상적으로 등재됨) — 다만 다음 사람이 "왜 Integrations 쪽엔 계약 테스트가
    없나"를 찾을 때 이 INFO 를 참고하도록 남긴다.

- **[INFO]** 원 트래커 제목("가이드가 존재하지 않는 에러 코드 5종을 이름으로 적는다")보다
  구현 범위가 넓어진 것은 라운드 1 이전부터의 특징이며, 이번 라운드도 그 성격을 유지한다 —
  신규 위반은 아님.
  - 위치: `plan/in-progress/guide-error-code-truth.md` §A(런타임 필드 3중 불일치),
    `spec-draft-nullable-notation-followups.md` 신규 항목 4건
  - 상세: 이전 scope 리뷰(10_12_19)가 이미 이 확장(문서 오류 → 런타임 결함)을 INFO 로
    기록했고, plan·CHANGELOG 가 처음부터 두 갈래로 나눠 고지하고 있다. 이번 라운드는 그
    구조를 유지한 채 리뷰 지적 처분만 얹었을 뿐, 새로운 임의 확장은 아니다.
  - 제안: 없음(이미 확인·기록됨, 위 WARNING 과 별개로 재확인 차원의 기록).

## 검토한 항목 중 문제 없음으로 판단한 것

- 코드 파일 6개(`llm.service.ts`, 두 DTO, `llm.service.spec.ts`,
  `llm-model-config.controller.spec.ts`, `model-configs.ts`)의 변경은 전부 plan §A 체크리스트
  항목 또는 §G 라운드1 처분 표의 특정 행에 1:1 대응한다. 무관한 리팩토링·포맷팅-only 변경은
  없음.
- 신규 파일 3개(`guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`,
  `guide-sanitized-message-parity.test.ts`)는 각각 plan §D, §G("architecture W#1") 항목의
  직접 산출물이며, 기능이 요구 이상으로 확장된 흔적(over-engineering)이 없다 — 세 축·양방향
  대조 모두 "왜 필요한가"가 실측(뮤테이션 RED/GREEN 표)으로 뒷받침돼 있다.
- MDX 문서 8개(ko/en 4쌍)는 plan §A/§B/§C 3갈래와 §G("cross_spec W#1"·"rationale W#2")에
  정확히 대응하며, 체크리스트에 없는 여분 문단 수정은 발견되지 않았다.
- `impl-anchor-existence.test.ts` 의 유일한 변경은 주석 갱신(§G INFO#7 처분, "아직 실사례
  없다"는 낡은 전제 정정) — 로직 변경 없음, 무관한 주석 정리 아님(이 PR 자신의 앵커가 그
  전제를 깼다는 사실 정정).
- consistency-check 산출물(files 41~56)은 `--impl-prep`/`--impl-done` 의무 절차의 표준
  부산물이며 `spec/` 본문은 이 diff 어디서도 수정되지 않았다(review 전용 파일만 추가) —
  역할 경계(`developer`는 `spec/` read-only) 준수.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 새로 등재된 4개 항목은
  전부 `owner: planner`(1건은 `owner: developer` 로 명시된 잔여 작업)로 표기돼 있고, 권한
  밖 spec 수정을 코드로 대신 저지르지 않고 정확히 위임했다.

## 요약

이번 라운드는 `/ai-review` 라운드 1 의 10건 지적을 처분한 후속 커밋이며, plan 문서(§G)가
지적별 처분을 표로 정확히 기록하고 있고 diff 도 그 표와 1:1 대응한다 — 체크리스트 밖의
임의 리팩토링·기능 확장·포맷팅 혼입은 발견되지 않았다. 다만 라운드 1 지적(api_contract
W#3) 대응 과정에서 원 스토리 도메인(LLM/model-config) 밖의 형제 DTO
(`TestConnectionResultDto`, Integrations 도메인)에 `code` 필드 신설 + `meta` 필드 제거가
추가로 얹혔는데, CHANGELOG 의 "배포 시 확인 — 응답에서 사라지는 필드" 절이 정확히 이런
변경을 위해 만들어진 절이면서도 `meta` 제거를 누락하고 있다(제목이 "2종"이라고 수까지
못박아 셋째 변경이 조용히 빠진 모양새다). 코드 주석과 별도 plan 백로그 항목에는 이 변경이
상세히 기록돼 있어 은닉은 아니지만, 배포자가 실제로 참고할 문서(CHANGELOG)에는 반영되지
않았다는 점에서 WARNING 으로 남긴다. 그 외 새로 발견한 스코프 이탈은 없다.

## 위험도

LOW
