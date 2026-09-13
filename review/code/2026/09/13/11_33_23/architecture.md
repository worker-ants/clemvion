# Architecture Review — guide-error-code-truth (4차 라운드)

## 검토 방법

`origin/main...HEAD` 전체 diff(4개 커밋: `911d9d7dd` 원 구현 · `a68457936` 라운드 1 처분 ·
`de99def86` 라운드 2 처분 · `137784219` 라운드 3 처분)를 대상으로 했다. 이전 세 라운드
(`review/code/2026/09/13/{10_12_19,10_40_34,11_07_36}/architecture.md`)가 이미 코드 표면
(모듈 의존 방향, DTO 중복, `assertMatchesContract` 비대칭, 컨트롤러 HTTP 왕복 테스트 계층 구조)을
상세히 다뤘으므로, 이번 라운드는 (1) 그 리포트들의 WARNING 이 최신 상태에서 실제로 어떻게
처분됐는지, (2) 라운드 3(`137784219`, docs-only 커밋)이 새로 손댄 지점에 아키텍처 관점 신규
리스크가 있는지에 집중했다. `git show 137784219 --stat` 로 확인한 결과 이 커밋은 `CHANGELOG.md`·
MDX 문서 4파일·`plan/**` 만 건드리고 **`codebase/**` 의 TypeScript 소스는 전혀 수정하지 않았다** —
즉 이번 라운드의 실질 검토 대상은 이전 라운드가 이미 본 코드 표면과 동일하고, 신규 표면은
"가이드 표 큐레이션" 문서 레이어뿐이다. 저장소 파일은 뮤테이션하지 않았다(`Read`/`git show`/
`grep`/`sed -n` 만 사용, `git status --short` 로 확인).

## 발견사항

- **[INFO]** (확인) 라운드 3 리뷰(`review/code/2026/09/13/11_07_36/architecture.md`)의
  WARNING("`assertMatchesContract` 는 유령 필드 방향을 원리적으로 못 보고, 같은 PR 안에서 이미
  두 번 재발했다")이 이번 최종 커밋에서 **가드 신설이 아니라 등재로 처분**됐고, 그 판단 근거가
  plan 문서에 남아 있다
  - 위치: `plan/in-progress/guide-error-code-truth.md` (`## D. 가드` 절 하단, "유령 필드 방향은
    이미 세 번째다" 관련 서술 — 커밋 `137784219` 본문에도 동일 내용)
  - 상세: 커밋 메시지가 스스로 "이미 세 번째다"(`ModelTestConnectionResultDto.latencyMs` ·
    `TestConnectionResultDto.latencyMs` · `TestConnectionResultDto.meta`)라고 인정하면서도, 이번
    라운드에서 정적 스캐너를 새로 만들지 않고 **착수 전 선실측 항목**(그 DTO 를 반환하는 서비스를
    기계적으로 특정 가능한가)과 함께 backlog 에만 남겼다. 직전 라운드가 "정지 규칙 위반 여부"를
    스스로 검토한 뒤 "가드 신설은 규칙이 막으려는 무한 루프에 해당한다"고 판단한 근거
    (`137784219` 커밋 본문 "정지 규칙을 문자 그대로 따르지 않았다" 절)가 궁색하지 않다 — 실제로
    이번 라운드가 고친 것은 유계·기계적인 spec-표 미러링(§B 아래) 뿐이고 새 검증 인프라를 만들지
    않아 스코프가 실제로 유계로 유지됐다.
  - 제안: 없음 — 처분 방식(가드 신설 유보 + 근거를 갖춘 backlog 등재)이 적절하다. 다음
    (네 번째) 재발 시에는 "선언 vs 서비스 return 리터럴" 정적 대조 스캐너 도입을 재검토할
    근거가 이미 plan 에 쌓여 있다.

- **[INFO]** 이번 최종 커밋이 드러낸 새로운 사실 — "existence-only, 방향 비대칭" 결함 클래스가
  **레이어를 바꿔 같은 PR 안에서 두 번째로** 재현됐다
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results{,.en}.mdx` (노드-종류별
    에러 코드 표, `137784219` diff) / 비교 대상: `codebase/backend/src/modules/model-config/dto/
    responses/model-config-response.dto.ts`, `codebase/backend/src/modules/integrations/dto/
    responses/integration-response.dto.ts` (라운드 2 의 `latencyMs`/`meta`/`code`)
  - 상세: 라운드 1~2 에서 지적된 `assertMatchesContract` 비대칭은 "선언에 없는 키가 나간다" 방향만
    잡고 "선언은 있는데 안 나가는 키" 방향은 못 봤다. 이번 라운드 3 은 그와 **구조적으로 동일한
    비대칭**을 문서 레이어에서 스스로 재현했다 — 신설한 `guide-error-code-existence.test.ts` 가드는
    "가이드가 적은 코드가 실재하는가"(가이드→코드) 한 방향만 검증하고, 그 역방향("실재하는 코드가
    가이드에 다 실렸는가", 코드→가이드=완전성)은 검증 대상이 아니었다. 그 결과 `spec/5-system/
    3-error-handling.md §1.4` 의 실재 코드 5종(`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·
    `MAX_COLLECTION_RETRIES_EXCEEDED`·`SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE`)이
    가이드 표에서 조용히 누락된 채로 라운드 2 리뷰까지 통과했다. 두 사례(DTO 필드·가이드 표) 모두
    근본 원인이 같다 — **"검증 가능한 필드/코드 집합을 손으로 큐레이션"** 하고, 그 큐레이션의
    완전성을 검증하는 장치가 없었다는 것. 이번 커밋 자체는 5행을 채워 넣는 유계·기계적 수정으로
    처분했고 역방향 가드는 backlog 등재(가드 신설 금지 — 위 항목과 동일 판단)로 남겼다.
  - 제안: 없음(이번 PR 스코프를 막을 사유 아님). 다만 이 관찰을 "DTO 필드 유령화"와 "가이드 표
    누락"을 **별개 사례가 아니라 같은 아키텍처 결함 클래스(단방향 존재성 검사, 완전성 검사 부재)의
    두 표현**으로 plan/backlog 문서에 명시적으로 연결해 두면, 다음에 이 클래스가 세 번째(코드) 자리
    에서 재발했을 때 "완전성 검사기"라는 하나의 해법으로 두 백로그 항목을 동시에 닫을 수 있다.
    현재 plan 문서에는 두 관찰이 각자 별도 절(`## D`, 커밋 본문 "유령 필드" 절)에 흩어져 있어
    같은 근본 원인이라는 연결이 명시적이지 않다.

- **[INFO]** (확인) 컨트롤러 HTTP 왕복 계약 테스트의 레이어 경계가 여전히 견고하다 — 실제
  `LlmService` 를 DI 하고 그 하위 의존(`ModelConfigService`/`LLMClientFactory`/`LlmUsageLogService`/
  `LlmPreviewService`)만 mock 하는 구조를 직접 열어 재확인
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:153-247`
    (`POST /model-configs/:id/test — 와이어 계약 (HTTP)`)
  - 상세: 프레젠테이션(컨트롤러+전역 `TransformInterceptor`)–비즈니스(`LlmService`, 실제 인스턴스)–
    외부 의존(mock) 세 층이 테스트에서 정확히 그 경계대로 분리돼 있다. `LlmService` 를 mock 하지
    않은 이유("mock 하면 내가 적은 리터럴을 내가 단언하게 된다 — 필드 이름 축에서 vacuous")가 주석에
    명시돼 있고, 실제로 응답 wire 키를 `Object.keys(...).sort()` 로 전수 고정해 "선언 초과"·
    "필드 누락" 양방향을 이 특정 필드 집합에 한해서는 실제로 방어한다(위 항목의 "존재성 검사만"
    지적은 신규 가이드 스캐너에 대한 것이고, 이 wire 테스트 자체는 이미 완전성까지 본다).
  - 제안: 없음 — 확인 완료, 긍정적 관찰.

- **[INFO]** (확인) 모듈 의존 방향 재확인 — 순환 없음, 신규 import 없음
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:1-16`
  - 상세: 이번 라운드까지 포함해 diff 전체에서 `model-config → llm` 역방향 import 는 여전히
    0건이다(`grep -rn "from '.*modules/llm" codebase/backend/src/modules/model-config` 재확인).
    `LlmModelConfigController` 가 `model-config` 모듈의 서비스/DTO 를 단방향으로 참조하는 기존
    구조(`C-2 cluster 4` forwardRef 제거 이력, 파일 상단 주석에 명시)가 그대로 유지된다.
  - 제안: 없음.

## 요약

이번 라운드의 유일한 실질 변경(`137784219`)은 `codebase/**` TypeScript 소스를 건드리지 않는
docs/plan 정정 커밋이라 새로운 코드 아키텍처 리스크를 만들지 않는다. 다만 그 커밋이 고친 내용
자체(가이드의 노드-종류별 에러 코드 표가 spec 대비 5종을 누락)는 이전 라운드가 이미 지적한
`assertMatchesContract` 의 "존재성만 검사, 완전성은 검사하지 않는" 단방향 비대칭과 **구조적으로
동일한 결함 클래스**가 문서 레이어에서 재현된 사례다 — DTO 필드(코드 레이어)에서 한 번, 가이드
표(문서 레이어)에서 또 한 번, 같은 PR 생애주기 안에서 두 번 나타났다. 저자는 두 경우 모두 즉시
가드를 신설하지 않고 유계·기계적 수정 + backlog 등재로 스코프를 관리했는데, 이는 "정지 규칙"의
취지(무한 루프 방지)에 부합하는 합리적 처분이다. 컨트롤러 HTTP 왕복 테스트의 레이어 경계, 모듈
의존 방향(순환 없음)은 이전 라운드 확인 그대로 견고하다. CRITICAL 급 결함, 순환 의존성, 레이어
위반은 발견되지 않았고, 남은 것은 두 개의 별도 backlog 항목(유령 필드 정적 스캐너, 가이드 역방향
완전성 가드)이 사실은 하나의 근본 원인이라는 것을 명시적으로 연결해 두면 좋겠다는 저우선순위
제안뿐이다.

## 위험도

LOW
