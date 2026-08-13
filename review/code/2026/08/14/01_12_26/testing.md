# 테스트(Testing) 리뷰

## 스코프 메모

리뷰 대상 136개 파일 중 실제 테스트 대상 코드는 파일 1~19(`UPDATE/DELETE RETURNING` 튜플
shape 결함 수정 — `updateReturningRows` 헬퍼·소비 지점 8곳·구조적 회귀 가드·e2e 신설)이고,
파일 20~136 은 이미 완결된 이전 라운드(`20_36_35`~`00_00_45`)의 review/consistency 산출물
(RESOLUTION.md·meta.json·개별 리뷰어 리포트)이다 — 이번 diff 에서는 그 시점에 이미 생성·커밋된
정적 기록이라 "테스트 관점" 분석 대상이 아니므로 별도 발견사항을 만들지 않았다. 아래는 실제
테스트/구현 파일에 대한 분석이다. `assert-row-array.spec.ts` / `update-returning-rows.spec.ts` /
`source-scan.spec.ts` / `auth-oauth.service.spec.ts` / `execution-engine.service.spec.ts` /
`knowledge-base.service.spec.ts` 를 로컬에서 개별 실행해 전부 GREEN 을 확인했다
(source-scan+assert-row-array+update-returning-rows+auth-oauth: 4 suites/39 tests, knowledge-base:
57 tests, execution-engine: 448 tests, 전부 pass).

## 발견사항

- **[WARNING]** `stripComments` 가 이 PR 전체가 막으려는 바로 그 실패 유형(주석 속 심벌 언급이
  카운트를 부풀려 구조적 가드를 무력화)에 대해 **줄 끝(트레일링) 주석 케이스만 테스트가 없다**.
  - 위치: `codebase/backend/src/common/utils/source-scan.ts:27` (`stripComments` 본문) /
    `codebase/backend/src/common/utils/__testing__/source-scan.spec.ts` (전체 4개 `it` 블록 — 이
    시나리오를 다루는 테스트가 없음)
  - 상세: `stripComments` 는 블록 주석과 **줄 전체가 주석인 줄**만 지우고, `실제 코드 뒤에 붙는
    줄 끝 // 주석은 의도적으로 남긴다`(`https://` URL 을 잘라먹지 않기 위해). 이는 합리적인
    트레이드오프지만, 그 대가로 `코드; // updateReturningRows 를 썼었다` 같은 트레일링 주석은
    `countCalls` 에 그대로 잡혀 카운트를 부풀린다. `source-scan.spec.ts` 의 4개 테스트는
    (1) 독립 줄 블록/라인 주석, (2) 제네릭+일반 호출, (3) 접두 심벌 구분, (4) 줄 끝 주석이
    "잘리지 않는다"(문자열 보존)만 검증하고, **줄 끝 주석에 심벌명이 들어 있을 때 그것이
    `countCalls` 에 섞이는지**는 아무도 잠그지 않는다. 이 파일의 docstring(17~24번째 줄)이
    "잘라도 결과는 개수가 줄어 RED 라 조용히 통과하는 방향은 아니다" 라고 리스크를 정당화하는데,
    이 근거는 **URL 절단(과소 카운트) 방향에만 적용**되고 지금 지적하는 **트레일링 주석의 심벌
    언급으로 인한 과다 카운트** 방향에는 적용되지 않는다 — `countCalls` 가 실측보다 커지면
    "자매 지점 전수" 가드(`assert-row-array.spec.ts`/`update-returning-rows.spec.ts`)가 **가드
    누락을 놓치고 조용히 GREEN** 을 유지할 수 있다(이 세션이 반복해서 겪은 바로 그 결함 클래스).
    현재 4개 소비 대상 파일에는 이런 트레일링 언급이 없어(`grep` 확인) 지금 당장 오탐은 없지만,
    이 정확한 실패 유형을 막으려고 만든 헬퍼치고는 그 실패 유형의 정확히 절반(과소/과다 중
    한쪽)만 테스트로 잠겨 있다.
  - 제안: `it('코드 뒤 줄 끝 주석의 심벌 언급은 세지 않는다(또는: 센다는 것을 명시 고정한다)', …)`
    형태로 `const x = foo(); // bar(y) 참고` 류 fixture 를 추가해 현재 동작(포함되는지
    여부)을 명시적으로 고정한다. 그래야 다음 사람이 실수로 정규식을 바꿔도 즉시 RED 로 드러난다.

- **[INFO]** `auth-oauth.service.spec.ts` 의 `handleCallback` describe 블록에서 신규 3개
  테스트만 실제 드라이버 shape(`[[row], count]` 튜플)을 mock 하고, 기존 7개 테스트는 여전히
  이 PR 이 "4개월간 결함을 숨긴 원흉" 으로 지목한 바로 그 shape(`[validState]`, 행 배열 직접)를
  그대로 쓴다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts:206, 213, 224, 276, 296,
    313, 327` (`dataSource.query.mockResolvedValueOnce([...])` 형태, 튜플로 감싸지 않음) — 대조:
    실측 shape 를 쓰는 신규 테스트는 `244, 263, 355~358`.
  - 상세: `updateReturningRows` 가 튜플/행-배열 두 shape 를 의도적으로 모두 받아들이므로
    (`update-returning-rows.ts` JSDoc "비-튜플(행 배열 직접) 형태도 받아들인다") 이 7개 테스트는
    기능적으로 여전히 유효하고, 언랩 로직 자체는 헬퍼 전용 스펙(`update-returning-rows.spec.ts`)과
    e2e(`auth-oauth-callback.e2e-spec.ts`, 실 드라이버)가 이미 충분히 잠그고 있어 커버리지
    공백이 크지는 않다. 다만 이 파일의 새 주석들이 반복해서 "mock 이 틀린 현실을 인코딩해
    결함을 숨겼다" 를 교훈으로 강조하는데, 정작 같은 파일의 다수 테스트(신규 user 생성·기존
    유저 연결·동시 unique-violation 복구 등 handleCallback 의 핵심 분기 대부분)는 여전히 그
    "틀린 현실"(행 배열 직접) 위에서만 검증된다. 향후 이 서비스에 새 필드/분기가 추가되면서
    튜플 unwrap 과 상호작용하는 회귀가 생겨도, 다수결 쪽 테스트는 애초에 그 축을 건드리지
    않으므로 조용히 통과할 여지가 남는다.
  - 제안: 필수는 아니나, 나머지 7개 fixture 도 `[[validState], 1]` 형태로 통일하면 이 파일
    전체가 "실제 드라이버가 돌려주는 shape" 라는 이 PR 의 원칙을 완전히 반영하게 되고, 다음
    사람이 이 파일을 예제로 복사할 때 잘못된 shape 를 다시 퍼뜨릴 위험도 줄어든다.

## 요약

핵심 결함 수정(`updateReturningRows` 헬퍼 + 8개 소비 지점 + 2개 구조적 회귀 가드 + auth-oauth
unit/e2e)은 실측 기반 판별 테스트(0행 vs 1행 튜플, `documentId` 실값 단언, 대조군 포함
`remember_me` true/false)로 꼼꼼히 뒷받침되어 있고, 로컬 실행으로 전부 GREEN 을 확인했다.
`countCalls`/`stripComments` 공유 헬퍼 자체도 자기 존재 이유(주석 오염 방지)를 직접 단언하는
전용 스펙을 갖췄다. 남은 갭은 두 가지로 좁다 — (1) `stripComments` 가 의도적으로 남기는 줄 끝
주석 케이스가 이 PR 이 막으려는 정확히 같은 실패 유형(주석발 과다 카운트)의 절반을 테스트
없이 남겨 두었고, (2) `auth-oauth.service.spec.ts` 의 다수 기존 테스트가 이 PR 의 교훈에도
불구하고 여전히 비현실적 mock shape 를 쓴다(기능적으로는 무해하지만 일관성 관점의 잔여
리스크). 둘 다 현재 프로덕션 결함으로 이어지지는 않으며, CRITICAL 급 갭은 없다.

## 위험도

LOW
