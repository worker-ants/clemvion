# Architecture Review — guide-error-code-truth (3차 라운드, `de99def86` 반영 후)

## 검토 방법

`origin/main...HEAD` 전체 diff(3개 커밋: `911d9d7dd` 원 구현 · `a68457936` 라운드 1 처분 ·
`de99def86` 라운드 2 처분)를 대상으로, 프롬프트가 절단한 파일(`llm-model-config.controller.spec.ts`,
`guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`)은 저장소에서 `Read`/`git show`로
직접 열어 전문을 확인했다. 이전 두 라운드(`review/code/2026/09/13/10_12_19`,
`review/code/2026/09/13/10_40_34`)의 architecture 리포트가 이미 대부분의 표면을 다뤘으므로, 이번
검토는 (1) 그 리포트들이 낸 WARNING이 이번 라운드에서 실제로 해소됐는지 재확인, (2) 라운드 2
(`de99def86`)가 새로 손댄 자리(`TestConnectionResultDto.code` 선언·JSDoc 배치 정정·형제 엔드포인트
계약 배선)를 신규 검토하는 데 집중했다. 저장소 파일은 뮤테이션하지 않았다(`Read`/`git show`/`grep`만
사용).

## 발견사항

- **[INFO]** (확인) 직전 라운드 WARNING("새 가드가 코드 *이름*의 실재만 보고 8갈래 문장 *내용*의
  정확성은 무방비")이 이번 라운드에서 실제로 닫혔다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (신규,
    전체 73줄)
  - 상세: `sanitize-error.util.ts`의 8개 반환 리터럴을 텍스트로 추출해 `models{,.en}.mdx` 표와
    양방향(표→SoT 누락 없음, SoT→표 누락 없음) 대조하는 별도 가드를 추가했다. `guide-error-code-scan.ts`
    (코드 **토큰** 실재성)와 표면이 분리돼 있고, vacuity floor(`toHaveLength(8)`)로 추출 자체가
    깨지는 방향도 방어한다. 레이어(코드 이름 실재성 vs 문구 내용 일치)를 별개 가드로 분리한 것은
    단일 책임 원칙에 부합한다.
  - 제안: 없음 — 확인 완료.

- **[WARNING]** `assertMatchesContract` 계약 검사기는 구조상 "선언에 없는 키가 나간다" 방향만 잡고,
  "선언은 있는데 결코 나가지 않는 키"(유령 필드) 방향은 원리적으로 못 본다 — 이 비대칭이 **같은 PR
  안에서 두 번** 같은 결함(`latencyMs`)을 낳은 뒤에도 그 방향을 닫는 자동 가드는 여전히 없다
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:52-56`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:459-462` —
    두 파일 모두 스스로 "이 방향은 `assertMatchesContract`가 원리적으로 못 본다 — grep이 유일한
    검사"라고 주석에 명시
  - 상세: 이번 배치는 서로 다른 두 DTO(`ModelTestConnectionResultDto`, `TestConnectionResultDto`)에서
    독립적으로 발생한 동일한 유령-필드 결함(`latencyMs`, 생산자 0건)을 발견해 제거했다. 저자 스스로
    "한쪽만 고치면 같은 거짓 광고가 남는다"고 인지할 정도로 이 결함 클래스가 반복성이 있음을 알고
    있는데도, 이번에 새로 배선한 `assertMatchesContract`(양쪽 엔드포인트 실패 경로)는 "응답에 있는데
    선언이 없다" 방향만 커버한다. "선언에 있는데 응답에 없다" 방향은 여전히 수동 grep에 의존한다 —
    즉 검증 인프라 자체가 한쪽으로만 열린 계약 검사이고, 이 PR의 실제 이력(같은 방향의 결함이 두
    DTO에서 각각 발견됨)이 그 결함이 세 번째로 재발할 개연성이 낮지 않음을 실증한다.
  - 제안: 이번 PR 스코프를 막을 사유는 아니다(이미 두 곳 다 grep으로 실측·제거했고, plan에도
    "정반대 방향" 결함으로 명시돼 있다). 다만 이 비대칭을 구조적으로 닫는 방법(예: DTO의
    `@ApiPropertyOptional` 필드를 서비스 return 리터럴과 대조하는 정적 스캐너 — `guide-error-code-scan.ts`가
    쓴 것과 같은 "선언 vs grep 기준집합" 패턴을 이 축에도 적용)을 플랜 백로그에 등재할 것을 권고한다.
    지금은 두 사례뿐이라 급하지 않지만, 반복되면 세 번째부터는 수동 grep이 아니라 가드가 필요하다.

- **[INFO]** 두 "연결 테스트 결과" DTO(`ModelTestConnectionResultDto` / `TestConnectionResultDto`)가
  서로 다른 모듈에 독립 존재하며 공용 베이스 타입이 없다 — 이번 배치에서 그 대가(동일 유령 필드의
  중복 발생)가 가설이 아니라 **실측 사실**로 확인됐다
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:49-63`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456-491`
  - 상세: 두 DTO는 `success: boolean` + `message?: string|null` 공통 shape 위에 각자 도메인 필드
    (`dimension?` vs `code?`)를 얹은 형태다. `latencyMs` 유령 필드가 양쪽에 독립적으로 존재했다는
    사실은 이 shape 계열이 실제로 shotgun-surgery 패턴(한 결함을 여러 자리에서 반복 수정)을 겪고
    있음을 보여준다. 다만 두 도메인(모델 연결 vs 통합 연결)이 서로 다른 실패 분류 축(`dimension`은
    probe 결과, `code`는 실패 분류)을 갖고 있어 강제 통합이 항상 옳은 것은 아니다 — 모듈 경계
    (model-config vs integrations)가 각자의 계약을 소유하는 구조 자체는 타당하다.
  - 제안: 공통 베이스 DTO(`{success, message?}`) 추출을 강제하지는 않되, 같은 클래스의 결함이
    세 번째로 발생하면(다른 kind의 connection-test 엔드포인트가 추가될 때 등) 공용 베이스 타입
    도입을 재검토할 근거로 이번 실측을 플랜에 남길 것을 권고(이전 라운드가 이미 남긴 관찰을
    "가설"에서 "실측"으로 승격).

- **[INFO]** (확인) `de99def86`가 같은 파일 안에서 스스로 위반한 문서화 규약을 스스로 정정 —
  경위 서사(JSDoc) vs 소비자 문서(JSDoc)의 경계가 이제 규약과 일치
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456-477`
    (`TestConnectionResultDto.code`)
  - 상세: `swagger.md §3`은 "OpenAPI로 나가는 JSDoc에는 소비자용 서술만, 정정 경위·리뷰 참조 같은
    내부 서사는 leading `//`에" 라고 규정한다. `git show de99def86`로 확인한 결과, 라운드 1이 `code`
    필드의 JSDoc 안에 넣었던 "이 선언은 latencyMs의 정반대 방향 결함을 닫는다..." 서사가 이번
    라운드에서 leading `//` 주석으로 옮겨지고, JSDoc에는 소비자용 한 문단(`실패 분류 코드.
    MCP_* · ... · 성공 응답에는 실리지 않습니다.`)만 남았다. 같은 파일의 `meta` 제거 설명은
    처음부터 `//`로 맞게 배치돼 있었으므로, 이번 정정으로 한 파일 안의 두 선언이 같은 규약을
    일관되게 따르게 됐다.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 형제 엔드포인트(`/api/integrations/:id/test`) 계약 검사 배선이 실패 경로로만 의도적으로
  scoping됐고, 성공 경로 확장이 차단되는 이유(미선언 MCP 필드)가 플랜에 명시적으로 위임됨 — 스코프
  판단이 임의가 아니라 근거 기반
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:688-699`
    (`pending_install` 케이스에만 `assertMatchesContract` 배선)
  - 상세: `TestConnectionResultDto`가 아직 `capabilities`/`serverInfo`/`preview`(MCP 성공 응답
    필드)를 선언하지 않으므로, 성공 경로에 지금 계약 검사를 걸면 그 자리에서 RED가 난다. 저자는
    이를 회피하지 않고 실패 경로에만 배선한 뒤 그 경계와 후속 계획(`plan/in-progress/
    spec-draft-nullable-notation-followups.md`)을 테스트 주석에 명시했다 — "일단 되는 데까지만
    닫고 나머지는 등재"라는 점진적 확장 패턴이 임시방편이 아니라 근거를 남긴 설계 결정으로
    보인다.
  - 제안: 없음 — 긍정적 관찰.

- **[INFO]** (재확인, 신규 리스크 아님) frontend 테스트 스위트가 build-time에 `codebase/backend/src`
  + `codebase/packages`를 파일시스템 레벨로 직접 순회 — 기존 자매 가드(`impl-anchor-existence.test.ts`,
  `spec-link-integrity.test.ts`)와 같은 계열의 의도적 경계 확장이며, 이번 라운드에서 새로 도입된
  방향은 아니다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts:46-49`
  - 상세: `walkTree(root, ["codebase/backend/src", "codebase/packages"], ...)`로 1,354개 `.ts`
    파일을 읽어 토큰 집합을 만드는 구조는 모듈 경계상 이례적이지만, 목적(가이드-코드 실재성
    검증)상 불가피하고 이미 확립된 선례를 재사용한다. vacuity floor(`sourceTexts.length > 500`,
    `backendTokens.size > 800`, 두 root 각각의 대표 토큰 존재 확인)로 "경로가 조용히 빈다"는
    실패 모드도 방어돼 있다. 같은 트리를 이미 다른 가드(`spec-links.ts::collectCodebaseSources`)가
    독립적으로 재순회한다는 점은 이전 라운드(`10_40_34/performance.md`)가 실측으로 확인한 성능
    관찰이며, 아키텍처 관점에서는 "가드마다 파일 목록/내용을 캐싱 없이 재수집"하는 결합 방향이
    누적되고 있다는 정도로만 기록한다 — 지금 규모에서 차단 사유는 아니다.
  - 제안: 없음(이전 라운드 관찰과 동일, 신규 조치 불요).

## 요약

이번 라운드(`de99def86`)는 새 아키텍처 결함을 도입하지 않고, 직전 라운드가 지적한 "가드가 코드
이름만 보고 문구 내용은 무방비"라는 WARNING을 별도 가드(`guide-sanitized-message-parity.test.ts`)로
정확히 닫았으며, 자신이 직전 라운드에서 스스로 어긴 JSDoc/내부-서사 배치 규약도 같은 파일 안에서
정정했다. 형제 엔드포인트(`/api/integrations/:id/test`)에 `assertMatchesContract`를 실패 경로로만
의도적으로 배선하고 성공 경로 확장을 근거와 함께 백로그로 미룬 판단도 스코프 관리 관점에서 적절하다.
다만 이번 배치가 실측으로 드러낸 사실 하나는 아키텍처 관점에서 계속 관찰할 가치가 있다 — 새로
배선한 런타임 계약 검사기(`assertMatchesContract`)는 "선언에 없는 키가 나간다" 방향만 잡고
"선언은 있는데 나가지 않는 키"(유령 필드) 방향은 원리적으로 못 보는데, 바로 그 방향의 결함이
**같은 PR 안에서 서로 다른 두 DTO에 독립적으로** 존재했다. 지금은 grep으로 수동 방어했지만, 이
비대칭을 구조적으로 닫는 가드가 없다는 점과, 두 개의 유사 shape DTO가 공용 베이스 없이 각자
같은 결함을 반복한다는 점(shotgun surgery)을 함께 백로그에 남길 것을 권고한다. CRITICAL 급 결함,
순환 의존성, 레이어 위반은 발견되지 않았다.

## 위험도

LOW
