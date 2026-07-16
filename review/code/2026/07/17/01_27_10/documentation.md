# 문서화(Documentation) 리뷰

리뷰 대상: 직전 리뷰(`01_07_43`) W#6(CHANGELOG 누락) 조치 재검증 — `CHANGELOG.md` 신규 절 + `WORKSPACE_ROUTE_SEGMENT` docstring.

## 발견사항

- **[INFO]** CHANGELOG 신규 절이 확립된 구조·상세도 관행과 대체로 정합함
  - 위치: `CHANGELOG.md:3-12` (`## Unreleased — 사용자 가이드(/docs) 진입 시 워크스페이스 slug 무한 중첩 fix`)
  - 상세: 저장소 전체 `## Unreleased` 절(50여 건)과 대조한 결과, 이 절은 (1) 굵게 강조한 한 줄 요약으로 시작하는 번호 목록, (2) 근본원인·수정 내용·**채택하지 않은 대안과 그 이유**(`/w/` 접두를 떼고 재-forward 하는 대안의 ping-pong 무한루프 반증)를 명시하는 서술 방식, (3) `**부수 fix**:` 레이블(기존 `edge.md §1.3` 항목의 `**부수 강화**:`, `§4.1` 항목의 `**부수 수정**:`과 동일 관용구) 사용에서 기존 관행과 정확히 일치한다. spec 인용(`spec/2-navigation/_layout.md §2.2`, `spec/2-navigation/11-error-empty-states.md §1.3`)도 실제 spec 본문과 대조해 정확함을 확인했다.
  - 제안: 없음(구조·상세도 자체는 양호).

- **[WARNING]** 다른 다항목 절과 달리 말미에 통합 `SoT:` 인용 문장이 없음
  - 위치: `CHANGELOG.md:3-12`
  - 상세: spec 을 인용하는 대다수 `## Unreleased` 절(예: `:31`·`:35` 채팅채널 escape, `:37`·`:42` payload 예산, `:71`·`:75` EIA nodeId, `:83`·`:85` edge 분할 등)은 본문 중간에 spec 조항을 서술적으로 언급하더라도, 마지막에 `SoT: `spec/....md §X`.` 형태의 통합 인용 문장으로 절을 닫는 패턴이 사실상 표준이다(스캔 시 "이 변경의 SoT 가 무엇인지"를 한 곳에서 바로 찾을 수 있게 함). 본 절은 item 1·2 안에 `spec/2-navigation/_layout.md §2.2`, `spec/2-navigation/11-error-empty-states.md §1.3` 두 spec 을 산발적으로 인용하지만, 절 전체를 마무리하는 `SoT:` 트레일러 없이 `> 검증: ...` 블록쿼트로 끝난다. 두 spec 문서(`_layout.md`, `11-error-empty-states.md`)를 훑어야 SoT 를 재구성할 수 있어 스캔성이 다소 떨어진다.
  - 제안: 마지막 줄에 `SoT: \`spec/2-navigation/_layout.md §2.2\`, \`spec/2-navigation/11-error-empty-states.md §1.3\`.` 한 문장을 추가(선택, 낮은 우선순위 — 정보 자체는 이미 본문에 다 있음).

- **[INFO]** 검증 정보를 별도 블록쿼트로 분리한 것은 이 파일 안에서 드문 패턴
  - 위치: `CHANGELOG.md:12` (`> 검증: playwright e2e 신규 5건...`)
  - 상세: 저장소 전체에서 `^> ` 블록쿼트 사용례는 이 항목을 포함해 단 2건뿐이며(다른 1건은 `:405` "자사 클라이언트 무영향" 경고성 콜아웃으로 성격이 다름), 대다수 절은 "테스트: ..."/"검증" 정보를 항목 본문 문장 안에 인라인으로 녹인다(예: `:85` "테스트: `firstOutputHandleId`(2)·...", `:93` "테스트: `resolveEdgeExecutionState` 9 + ..."). 본 절이 블록쿼트로 분리한 것 자체가 틀린 것은 아니고 오히려 "unit 은 이 클래스의 버그를 원리적으로 증명 못 한다"는 중요한 한계를 눈에 띄게 만드는 효과가 있어, 단순 스타일 편차로 본다.
  - 제안: 조치 불요(선택 시 인라인 문장으로 통일 가능하나 현재도 가독성 문제 없음).

- **[INFO]** `WORKSPACE_ROUTE_SEGMENT` docstring 은 정확하고 배치도 적절함
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:3-10`
  - 상세: docstring 이 주장하는 두 가지를 코드로 직접 대조 확인했다 — (1) "생성부"(`buildWorkspaceHref`, 같은 파일 `:37`)와 "판별부"(`(main)/[...rest]/page.tsx:55` `rest[0] === WORKSPACE_ROUTE_SEGMENT`)가 실제로 이 상수 하나만 공유하며, 다른 소비처는 없음(grep 결과 이 두 곳뿐). (2) "`(main)/w/[slug]` · `(editor)/w/[slug]` 의 `w`" 라는 서술도 실제 `src/app/(main)/w`, `src/app/(editor)/w` 두 라우트 그룹 존재와 일치한다. "두 값이 어긋나면 무한 중첩이 재발한다"는 인과 설명도 이번 버그의 실제 근본원인(재부착 가드 부재)과 정확히 대응해, 향후 유지보수자가 실수를 반복하지 않도록 근거를 잘 남겼다. 상수 선언을 파일 최상단(첫 사용부 이전)에 두어 가독성도 좋다.
  - 제안: 없음.

- **[INFO]** 인접 주석(`page.tsx`)도 상수 도입에 맞춰 정확히 갱신됨 — 오래된 주석 없음
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:53-59`
  - 상세: "세그먼트 단위 비교 — `/web-chat` 처럼 'w' 로 시작하는 일반 경로와 섞이지 않는다" 주석은 리터럴 `"w"` 비교에서 `WORKSPACE_ROUTE_SEGMENT` 비교로 코드가 바뀐 뒤에도 여전히 의미상 정확하고(설명 대상이 "값"이 아니라 "정확 일치 비교라는 전략"이라 상수화와 무관하게 유효), 바로 아래 신규 주석("상수는 `buildWorkspaceHref` 의 생성부와 공유한다...")이 자연스럽게 이어 붙어 왜 상수가 필요한지를 그 자리에서 설명한다. `rest.length === 2` 관련 주석도 "세그먼트 2개"라는 구조적 의미를 그대로 유지해 실제 조건과 어긋나지 않는다.
  - 제안: 없음.

- **[INFO]** README·API 문서·신규 설정(env) 문서화: 여전히 해당 없음 확인
  - 위치: 전체 diff(`CHANGELOG.md`, `href.ts`, `page.tsx`, e2e spec, plan 문서 2건)
  - 상세: 이번 재리뷰 대상 변경은 신규 API 엔드포인트·신규 env·신규 UI 문자열을 도입하지 않는 순수 리팩터/문서 보강이라, README 및 API 문서 갱신 필요성은 없다. 직전 리뷰의 동일 판정과 일치.
  - 제안: 없음.

## 요약

W#6 조치로 추가된 `CHANGELOG.md` 절은 이 저장소의 확립된 관행(굵은 요약 문장으로 시작하는 번호 목록, 근본원인·채택하지 않은 대안 서술, `부수 fix/강화/수정` 관용구, spec 근거 인용)을 대체로 충실히 따르고 있어 실질적인 결함은 없다. 다만 대다수 spec-인용 절이 갖는 말미의 통합 `SoT:` 트레일러 문장이 없고 검증 정보를 인라인이 아닌 블록쿼트로 분리한 점은 이 파일 안에서 소수 패턴이라 스캔성 관점에서 사소한 개선 여지가 있다(WARNING 1건, 조치 필수 아님). `WORKSPACE_ROUTE_SEGMENT` 상수의 docstring 은 실제 코드(생성부·판별부 두 소비처, 두 라우트 그룹 존재)와 전부 대조 확인한 결과 정확하며 배치도 적절하고, 인접 주석 역시 상수 도입 이후에도 오래된(stale) 서술 없이 정합하다.

## 위험도

LOW
