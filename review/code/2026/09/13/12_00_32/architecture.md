# Architecture Review — guide-error-code-truth (5차 라운드)

## 검토 방법

`origin/main...HEAD` 누적 diff(5개 커밋: `911d9d7dd` 원 구현 · `a68457936` 라운드 1 처분 ·
`de99def86` 라운드 2 처분 · `137784219` 라운드 3 처분 · `42680d5f9` 라운드 4 처분)를 대상으로
했다. 이전 네 라운드(`review/code/2026/09/13/{10_12_19,10_40_34,11_07_36,11_33_23}/architecture.md`)가
모듈 의존 방향, DTO 중복, `assertMatchesContract` 비대칭, 컨트롤러 HTTP 왕복 테스트 계층 구조를
이미 상세히 다뤘으므로, 이번 라운드는 (1) 라운드 4 커밋(`42680d5f9`, CRITICAL 해소)이 새로
손댄 자리에 아키텍처 관점 신규 리스크가 있는지, (2) 직전 라운드들이 낸 WARNING이 최신 상태에서
실제로 유지되고 있는지에 집중했다. 프롬프트가 diff 를 생략한 파일(`llm-model-config.controller.spec.ts`,
`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`)은 `Read`/`git show`로 원본
전문을 직접 열어 확인했다. `git show 42680d5f9 --stat`로 이번 라운드가 실제로 건드린 파일을
특정했다 — `codebase/**` 안에서는 `guide-error-code-scan.ts`(주석만 19줄 추가, 로직 변경 0)와
MDX 문서(Callout 추가) 뿐이고, 나머지는 `PROJECT.md`·`plan/**`·`review/**` 메타 문서다. 저장소
파일은 뮤테이션하지 않았다(`Read`/`git show`/`grep`만 사용).

## 발견사항

- **[INFO]** (확인) 라운드 4 커밋이 프로덕션 런타임 코드를 전혀 건드리지 않았다 — 이번 라운드의
  실질 표면은 가드 주석·문서·plan 뿐
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (게이트 42~59행,
    신규 주석 블록 "## 이 가드가 **못** 보는 것")
  - 상세: `scanErrorCodeCitations`/`collectBackendTokens` 두 함수의 로직·시그니처·정규식은
    라운드 3(`137784219`) 이후 그대로다. 이번에 추가된 것은 가드의 판정 술어("존재"이지
    "방출"이 아니다)를 명시하는 주석뿐이고, 이는 같은 파일 상단에 이미 있던 "## 이 가드가
    **못** 보는 것" 계열 서술(축 3 채택 근거, 로드맵 이름 배제 근거)과 동일한 형식·위치
    관례를 따른다 — 새 관례를 만들지 않았다.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 이번 라운드가 실측으로 드러낸 사실 — "존재 검사 ≠ 완전성/방출 검사" 결함 클래스가
  **같은 PR 생애주기 안에서 세 번째로** 나타났고, 이번엔 그 가드 자신이 검사 대상이 됐다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:42-59`(가드의 한계
    주석), 비교 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md:3305`(DTO
    유령 필드, `assertMatchesContract`), `:3318`(이번 건, `guide-error-code-existence`)
  - 상세: 라운드 1~2 가 지적한 `assertMatchesContract` 비대칭("선언에 없는 키는 잡지만
    선언은 있고 안 나가는 키는 못 본다")과 라운드 3 이 지적한 가이드 표 완전성 갭("가이드가
    적은 코드가 실재하는가는 보지만 실재하는 코드가 가이드에 다 있는가는 안 본다")에 이어,
    라운드 4 는 이 **가드 자신의 술어**("backend 소스에 UPPER_SNAKE 문자열로 존재하는가")가
    "그 문자열이 실제로 `output.error.code` 로 나가는가"와 다르다는 것을 실측으로 드러냈다
    (`MAKESHOP_UNRESOLVED_PATH_PARAM` 이 `throw new Error(...)` 의 메시지 접두일 뿐인데 가드는
    통과시켰고, `--impl-done`(`11_33_51`) naming_collision 이 CRITICAL 로 잡았다 — code
    reviewer 14명 전원 미검출). 세 사례 모두 **"검증 가능한 집합을 문자열/키 존재로 판정하고,
    그 판정이 실제 동작 경로(응답 필드가 나가는가·코드가 방출되는가)와 별개"**라는 같은
    구조적 원인을 공유한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 세
    항목이 각각(3305·3318·3336행) 독립 backlog 로 등재돼 있고 서로 인접해 있어 연결이 아주
    안 보이는 것은 아니지만, "같은 근본 원인의 세 표현"이라는 문장으로 명시적으로 묶여 있지는
    않다.
  - 제안: 이번 PR 스코프를 막을 사유는 아니다 — CRITICAL 은 이미 라운드 4 에서 가이드 문장
    정정으로 고쳤고, 가드 자체의 술어 확장(방출 위치 AST 특정)은 실측 후 기각(허용목록 필요)
    하고 등재했다. 다만 세 backlog 항목이 이미 서로 인접해 있으므로, 다음에 이 클래스가
    네 번째로 재발할 때(예: `EngineErrorCode` 쪽) "완전성/방출 검사기 하나로 세 항목을 동시에
    닫을 수 있는가"를 먼저 검토하도록 세 항목 위에 짧은 상호 참조 한 줄을 추가하는 정도의
    가벼운 정리를 권고(저우선순위, 비차단).

- **[INFO]** (확인) 모듈 의존 방향 재확인 — 신규 import 없음, 순환 없음
  - 위치: `git show 42680d5f9 --stat` 결과 `codebase/**` 의 `.ts` 파일 중 diff 가 있는 것은
    `guide-error-code-scan.ts` 하나뿐이고 이는 주석 추가만이다
  - 상세: 이번 라운드는 새 import·새 의존 관계를 추가하지 않았다. `llm ↔ model-config` 단방향
    의존, `frontend __tests__` → `backend/packages` 소스 텍스트 읽기(빌드타임 전용) 구조는
    라운드 2~4 가 이미 확인한 그대로 변화가 없다.
  - 제안: 없음.

- **[INFO]** (확인) 이전 라운드들이 남긴 아키텍처 관찰(DTO 중복·타입-런타임 계약 분리)은
  이번 라운드에서도 그대로 유지되며 새 재발은 없다
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`,
    `codebase/backend/src/modules/llm/llm.service.ts`(`testConnection` 반환 타입)
  - 상세: 두 "연결 테스트 결과" DTO 가 공용 베이스 없이 독립 유지되는 구조, `LlmService.testConnection`
    반환 타입이 `ModelTestConnectionResultDto` 와 타입 수준으로 연결되지 않고 `assertMatchesContract`
    런타임 검사로만 묶이는 구조는 이 저장소가 실측(엔티티↔DTO 통합 시도, 불일치 59건 중 46건이
    `Date`→`string` 정상 동작) 끝에 선택한 의도된 트레이드오프이고, 이번 라운드에서 새로 손댄
    자리도 아니다. 재확인 외 신규 지적 없음.
  - 제안: 없음.

## 요약

라운드 5(`42680d5f9`)는 프로덕션 런타임 코드를 전혀 건드리지 않는 처분 커밋이다 — `codebase/**`
안에서 실제로 바뀐 것은 기존 정적 가드(`guide-error-code-scan.ts`)에 자신의 판정 한계("존재
검사이지 방출 검사가 아니다")를 명시하는 주석뿐이고, 나머지는 가이드 MDX 의 오류 문구를
Callout 으로 정정한 문서 변경, `PROJECT.md` 가드 카탈로그 갱신, plan 백로그 등재다. 모듈 의존
방향(순환 없음), 레이어 경계(컨트롤러 HTTP 왕복 테스트의 프레젠테이션/비즈니스/외부의존 분리),
DTO 중복과 타입-런타임 계약 분리라는 기존의 의도된 트레이드오프 모두 이전 라운드가 확인한
상태 그대로 유지된다. 아키텍처적으로 유일하게 주목할 관찰은, "존재 검사가 완전성/방출 검사를
대체할 수 없다"는 같은 구조적 결함 클래스가 이 PR 생애주기 안에서 이제 **세 번째**(DTO 유령
필드 → 가이드 표 누락 → 가드 자신의 방출 오판)로 나타났다는 것인데, 세 사례 모두 이미 근접한
자리에 backlog 로 등재돼 있어 이번 PR 을 막을 사유는 아니다. CRITICAL 급 결함, 순환 의존성,
레이어 위반은 발견되지 않았다.

## 위험도

LOW
