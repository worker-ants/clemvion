# 아키텍처(Architecture) 리뷰 — error-code-emission-axis (라운드 8, `22_06_10`)

## 검토 범위

이 라운드의 실질 아키텍처 표면은 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
(스캐너 모듈)와 `guide-identifier-existence.test.ts`(그 축의 단언·검증 인프라)로 좁다. 나머지
(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`/`logic.en.mdx`·`plan/**`·`review/**`)는 문서/프로세스
산출물이라 SOLID·결합도·레이어·순환의존 관점의 표면이 없다. `origin/main` 대비 전체 diff 를
`git diff origin/main --stat` 로 확인했고, 이전 라운드(`19_23_22`~`21_41_23`)의 architecture/
maintainability/testing 리뷰가 이미 다룬 지적(수집기 중복 제거, `isMessagePrefixOnly` 소유권
이전, `resolveSourceLines` 유일성 가드 등)은 처분(고침/유지 결정)이 확인된 한 재론하지 않고,
그 처분 이후에도 남아 있거나 이번 라운드에 새로 들어온 구조적 결을 우선 확인했다.

## 발견사항

- **[WARNING]** `resolveSourceLines` 의 검색 루트가 이 축이 스스로 정의한 "소스 기준집합"
  보다 좁다 — 같은 파일 안에서 두 개의 서로 다른 "백엔드 소스" 정의가 공존한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:92`
    (`resolveSourceLines` 내부 `walkTree(repoRoot(), ["codebase/backend/src"], …)`) vs
    `:110` (`const sourceTexts = walkTree(root, ["codebase/backend/src", "codebase/packages"], …)`)
  - 상세: `sourceTexts`(라인 110)는 이 파일이 "기준집합 = 소스 토큰 ∪ env 선언처" 라고 명시한
    바로 그 기준이고, 발행 축의 `quotedLiterals`/`messagePrefixes`(라인 141-142)도 이
    `sourceTexts` 를 그대로 재사용해 `codebase/backend/src` + `codebase/packages` 양쪽을
    커버한다. 그런데 같은 발행 축의 `where` 프리텍스트 검증이 쓰는 `resolveSourceLines`
    (라인 88-102)는 **자기 자신의 `walkTree` 호출을 새로 선언**하면서 루트를
    `["codebase/backend/src"]` 로만 좁혔다 — `codebase/packages` 가 빠졌다. `codebase/packages`
    에는 실제로 `.ts` 파일 50개가 있어(`find codebase/packages -name "*.ts" | wc -l` = 50,
    node_modules/dist 제외) 이론상의 빈 집합이 아니다. 오늘 등록된 3항목(`GUIDE_NON_EMITTED_
    VOCABULARY`, `guide-identifier-scan.ts:339-357`)은 전부 `codebase/backend/src` 하위
    파일(`execution-engine.service.ts`, `makeshop.handler.ts`)을 가리켜 이 불일치가 지금은
    발화하지 않는다. 하지만 다음 항목이 `packages/` 쪽 발행 코드(예: 공유 통합 코드)를
    `where` 로 인용하면, 그 토큰은 `messagePrefixes`/`quotedLiterals` 판정에서는 정상적으로
    `packages` 소스를 반영해 놓고, **바로 옆의 검증 테스트("`where` 의 `파일:줄` 이 실제로
    그 토큰을 담는다")만 "파일을 유일하게 특정할 수 없다" 로 거짓 실패**한다 — 같은 기능
    안에서 "기준" 을 두 번 따로 정의하면서 한쪽만 좁힌, 이 저장소가 반복해서 이름 붙여 온
    형태("정의를 한 칸 좁게 잡는다") 그대로다.
  - 제안: `resolveSourceLines` 가 새 `walkTree` 루트 배열을 독립적으로 선언하지 말고, 이미
    109번 줄에 있는 루트 목록(`["codebase/backend/src", "codebase/packages"]`)을 상수로
    뽑아 두 호출부가 공유하게 한다. 그러면 "기준집합" 이 파일 전체에서 단일 진실원(SoT)을
    갖고, 다음 축이 세 번째 "소스 루트 목록" 을 또 선언하는 것도 막는다.

- **[INFO]** `where` 필드가 여전히 "파일:줄 + 산문 설명" 을 한 문자열에 섞은 자유 텍스트라,
  구조적 정보(등록마다 최소 1개, 최대 다수의 `{file, line}`)를 정규식으로 역추출해야 한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:339-357`
    (`GUIDE_NON_EMITTED_VOCABULARY` 의 `where: string` 필드 선언과 3개 항목의 값),
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:56-63`
    (`parseWhereRefs` — `where` 를 정규식 `/([\w./-]+\.ts):(\d+(?:·\d+)*)/g` 로 재파싱)
  - 상세: 이 배치 자체의 RESOLUTION.md(`review/code/2026/09/13/19_51_33/RESOLUTION.md`
    WARNING#2)가 기록하듯, `where` 를 자유 텍스트로 둔 대가로 "첫 판 `.exec()` 단일 매치가
    둘째 위치부터 검증을 안 한다" 는 결함이 실제로 발생했고 뮤테이션으로 실증됐다. 지금은
    `parseWhereRefs` 로 다중 참조를 걷도록 고쳐 그 결함 자체는 닫혔지만, 근본 설계(구조화된
    데이터를 문자열로 인코딩한 뒤 정규식으로 되파싱)는 그대로다 — `where` 가 `파일:줄` 표기
    관례(가운뎃점 구분자 `·`)를 벗어나면(예: 다른 파일의 여러 줄을 섞어 적거나, 줄 번호
    없이 함수명만 적는 경우) 파서가 조용히 그 참조를 건너뛴다. 자매 가드
    (`impl-anchor-existence.test.ts`)는 같은 종류의 근거를 `{file: string; symbol: string}`
    구조화 필드로 받아 이런 파싱 표면 자체가 없다.
  - 제안: 즉시 강제하지는 않되, 다음에 `GUIDE_NON_EMITTED_VOCABULARY` 류의 항목 형태를 다시
    설계할 기회가 오면(예: 세 번째 거울상 목록 추가 시) `where: string` 대신
    `refs: { file: string; line: number }[]` 구조화 필드 + 별도 `note: string` 로 분리하는
    것을 고려한다. 그러면 "전부 걷었는가" 가 파서의 정확성이 아니라 타입 자체가 보장한다.

- **[INFO]** (전 라운드 architecture INFO#2, 재확인 — 미해결 상태 유지, 의도된 낮은 우선순위)
  `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 두 "거울상" 목록이 여전히 공유
  베이스 타입이 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:306-309`
    (`GUIDE_EXTERNAL_VOCABULARY: readonly { token: string; system: string; why: string }[]`),
    `:339-344` (`GUIDE_NON_EMITTED_VOCABULARY: readonly { token: string; where: string; why: string }[]`)
  - 상세: `review/code/2026/09/13/19_51_33/architecture.md` INFO#2 가 이미 지적했고 "즉시
    조치 불요, 세 번째 목록이 생기는 시점에 고려" 로 명시적으로 낮은 우선순위 처분됐다. 이번
    라운드에도 두 타입은 여전히 독립 인라인 리터럴이라 상태 변화가 없다 — 새로운 결함이
    아니라 그 처분이 유효하게 유지되고 있음을 재확인한 것.
  - 제안: 조치 불요(기존 처분 유지). 세 번째 거울상 목록이 생기면 공유 베이스 인터페이스
    (`{ token: string; why: string }`)를 도입할 것.

## 긍정적으로 확인한 설계 (이전 라운드 지적의 처분 확인)

- 전 라운드 architecture INFO#1(*"발행 축 판정 로직이 스캐너가 아니라 테스트 파일에 있다"*)이
  **고쳐졌다** — `isMessagePrefixOnly`(`guide-identifier-scan.ts` 신규 export)와
  `computeNonEmittedOffenders`(같은 파일, 판정 4항을 단일 함수로 수렴)가 스캐너 모듈로
  이동했고, 테스트는 `sets` 번들을 조립해 그 함수를 호출만 한다
  (`guide-identifier-existence.test.ts:143-151`). 존재 축과 동일한 "스캐너가 판정 소유,
  테스트는 소비" 경계가 발행 축에도 이제 일관되게 적용된다.
- 전 라운드 architecture INFO#3(*"세 예외 채널의 필터 체인이 분기 표면을 누적시킨다"*)에서
  제안한 "단일 판정 함수로 수렴" 방향이 `computeNonEmittedOffenders` 로 실제 채택됐다 —
  `isMessagePrefixOnly` → `!catalogCodes.has` → `!registered.has` 세 단계가 이제 한 함수
  안에 있어 "왜 이 토큰이 통과했는가" 를 함수 하나로 답할 수 있다. 완전한
  `classifyToken(): "existent" | ... ` 형태의 열거형 수렴은 아니지만, 필터 체인이 테스트
  파일에 흩어져 있던 이전 상태보다 추적 가능성이 개선됐다.
  - 다만 이 aggregator 는 `catalogCodes`/`registered` 두 예외 채널만 감싸고, **존재 축의
    `allowed`(`GUIDE_EXTERNAL_VOCABULARY`) 는 그 안에 포함되지 않는다** — 발행 축 판정에
    들어가기 전 단계(citations 자체)에서 존재 축이 이미 걸러지므로 지금은 문제가 없지만,
    "판정 정본" 이라는 이름과 달리 두 축의 예외 채널을 완전히 통합하지는 않는다는 점은
    다음 축 추가 시 참고할 만하다(WARNING 은 아님).
- naming-collision 회피 규율(*"새 식별자는 후보 토큰이 grep 0건임을 먼저 보여라"*)이 이번
  라운드 신규 식별자 6개(`staleGuideEntries`, `resolveSourceLines`, `parseWhereRefs`,
  `computeNonEmittedOffenders`, `isMessagePrefixOnly`, `GUIDE_NON_EMITTED_VOCABULARY`) 전부에
  대해 실제로 지켜졌다 — `grep -rln` 으로 `codebase/frontend/src` 전체에서 이 파일 쌍 밖의
  충돌을 확인했고 0건이었다(`staleEntries`→`staleGuideEntries` 개명 이력 자체가 이 규율이
  한 번 깨졌다가 고쳐진 사례).
- 순환 의존성 없음 — `guide-identifier-existence.test.ts` → `guide-identifier-scan.ts`/
  `tree-walk`/`impl-anchor-parse` 단방향, export 표면은 전부 순수 추가라 하위 호환성 파괴
  없음.

## 요약

이번 라운드는 harness(테스트 타임 정적 스캐너) 표면에 국한되며, 이전 두 라운드의 architecture
지적 중 우선순위가 높았던 두 건(판정 로직 소유권 불일치, 필터 체인 분산)이 실제로 스캐너
모듈로 수렴돼 고쳐졌다는 것을 확인했다. 새로 발견한 것은 하나 — `resolveSourceLines` 가
자신의 `walkTree` 검색 루트를 이 파일이 이미 정의한 "소스 기준집합"(`backend/src` +
`packages`)과 별도로 좁게(`backend/src` 만) 재선언해, 같은 기능 안에 서로 다른 두 "백엔드
소스" 정의가 공존한다. 오늘의 등록 3항목으로는 발화하지 않는 잠재 결함이지만, 이 저장소가
반복해서 이름 붙여 온 "정의를 한 칸 좁게 잡는" 형태와 정확히 같은 모양이라 WARNING 으로
남긴다. `where` 필드의 자유 텍스트+정규식 파싱 설계는 이미 한 번 결함을 낳았고 지금은 다중
참조까지 걷도록 고쳐졌지만 근본적으로 구조화 타입보다 취약한 표현이라는 점을 INFO 로 기록한다.
"두 거울상 목록의 공유 타입 부재"는 이전 라운드에서 이미 낮은 우선순위로 명시적으로 유예된
사항이라 상태 변화 없음으로 재확인했다. 셋 다 이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
