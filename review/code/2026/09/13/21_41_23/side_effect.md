# 부작용(Side Effect) 리뷰 — error-code-emission-axis (round 7 / 21_41_23)

## 검토 범위

이번 라운드까지 누적된 실질 코드 변경은 두 파일뿐이다 — `guide-identifier-scan.ts`(발행 축
정규식 3종 + 공용 수집기 `collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY` + 판정 함수 3종)와
`guide-identifier-existence.test.ts`(그 축을 소비하는 단언·대조군 + 라운드 6 에서 새로 추가된
`resolveSourceLines` 캐시). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·
`review/**`)는 문서·plan·리뷰 산출물이라 부작용 관점 대상이 아니다. 직전 6라운드의
`side_effect.md`가 이미 여러 차례 이 코드베이스를 NONE 으로 판정했으므로, 이번 라운드는
**라운드 6 커밋(`eb53aba1c`)에서 새로 들어온 델타**(`resolveSourceLines`/`sourceLinesCache`
캐시 리팩터)를 중심으로 재검토했다.

## 발견사항

- **[INFO]** 라운드 6 이 도입한 캐시가 **단일 호출부만 있는데도 모듈 스코프**에 선언돼 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:86-99`
    (선언), 호출부는 `:285` 한 곳(그 안을 감싸는 `it()` 블록은 `:262-296`) 뿐이다.
  - 상세: `sourceLinesCache`(`Map<string, string[] | null>`)는 `describe`/`it` 밖의 파일
    최상위에 선언되어 이 테스트 파일의 모듈 인스턴스가 살아있는 동안(같은 파일 안의 모든
    `it()` 블록 실행 전체) 유지되는 공유 가변 상태다. 그런데 실제로 이 캐시를 채우고 읽는
    `resolveSourceLines`는 `"where` 의 `파일:줄` 이 실제로 그 토큰을 담는다"` 라는 **단 하나의
    `it()`** 안에서만 호출된다 — 이 파일의 다른 자매 캐시(`spec-links.ts:293`의 `slugCache`)는
    함수(호출) 스코프로 좁게 선언돼 좁힌 전례가 있는데, 이번 캐시는 그보다 넓게 잡혔다.
    다만 캐시의 값이 순수 파일시스템 읽기 결과(불변 텍스트)이고, 키가 `path.basename(file)`
    로 결정적이며, `found.length === 1` 아닐 때는 `null`을 캐시해 라운드-이전 로직
    (`walkTree` 를 참조마다 새로 돌려 `hits.length` 로 판정하던 방식)과 정확히 같은 판정을
    낸다 — basename 만으로 매칭하는 것은 캐시 도입 이전부터 있던 기존 설계이므로 캐시가
    새로운 오탐/누락 경로를 만들지는 않는다. RESOLUTION.md(`review/code/2026/09/13/21_41_23`
    바로 이전 커밋 메시지, `eb53aba1c`)에 캐시 도입 후 두 뮤턴트(둘째 줄 번호 변조,
    존재하지 않는 파일명 변조)를 재실행해 둘 다 RED 로 남는 것을 확인했다는 실측이 있어,
    캐시가 검증을 가리는 방향의 부작용은 이미 스스로 검증됐다.
  - 제안: 조치 불필요(현재 유일한 호출부라 실질 위험 없음). 다음에 두 번째 호출부가 생기면
    그때 "캐시가 두 호출부 사이에서 서로 다른 기대를 감추지 않는가"를 다시 확인할 것 — 지금
    스코프를 좁히려면 `it()` 콜백 안으로 캐시 선언을 옮기면 된다(선택 사항).

- **[INFO]** 신규 카탈로그 읽기가 여전히 존재 가드 없이 이뤄진다 (라운드 1부터 이어진 관측,
  변경 없음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:142-147`
  - 상세: `catalogCodes`는 `fs.readFileSync(path.join(root, "spec/5-system/3-error-handling.md"), "utf8")`
    를 최상위 `describe` 블록(테스트 수집 시점, 모든 `it` 실행 전)에서 직접 호출한다. 같은
    파일의 `envExampleTexts`는 `readIfPresent`(내부에서 `fs.existsSync`로 먼저 확인)를 거치는데
    이 read는 그 가드를 거치지 않는다 — 대상 파일이 이동·삭제되면 이 describe 블록 전체
    (발행 축뿐 아니라 기존 베이스라인·과거 결함 재현 테스트까지)가 컬렉션 단계에서 예외로
    죽는다. 다만 같은 패턴이 이미 `guide-sanitized-message-parity.test.ts`에도 있어 이
    저장소의 기존 관행과 일치하고(1라운드 side_effect.md·RESOLUTION.md INFO#7에서 "기존 관행
    — 처분 유지"로 여러 라운드 연속 확인됨), 이번 델타가 새로 만든 위험이 아니다.
  - 제안: 조치 불필요(누적 처분 유지). 강화하려면 `readIfPresent`로 통일.

- **[INFO]** 신규 export 전부가 순수 추가이고 기존 시그니처는 그대로다 — 확인 완료
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:260-478`
    (`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`/`collectMatches`/
    `GUIDE_NON_EMITTED_VOCABULARY`/`collectQuotedLiterals`/`collectMessagePrefixes`/
    `collectCatalogCodes`/`isMessagePrefixOnly`/`computeNonEmittedOffenders`)
  - 상세: 기존 export(`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`·
    `GUIDE_EXTERNAL_VOCABULARY`)의 시그니처·동작은 diff 안에서 전혀 바뀌지 않았다(`git diff
    origin/main..HEAD`로 확인). 새 함수들은 인자로 받은 문자열 배열/집합만 읽어 새 `Set`·
    `string[]`·`boolean`을 반환하는 순수 함수이고, 전역 상태·파일시스템·네트워크에 접근하지
    않는다. `GUIDE_NON_EMITTED_VOCABULARY`는 `readonly` 배열 상수 신규 추가로 기존 호출자에
    영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** `matchAll` 채택으로 공유 `lastIndex` 오염 회피 — 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:260-291`(정규식
    선언 + `collectMatches` 정의)
  - 상세: `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 셋 다 `"g"` 플래그를 갖고 있어
    `String.prototype.matchAll`이 정상 동작한다(전제 확인 완료). `matchAll`은 내부적으로
    정규식을 복제해 순회하므로 원본 모듈-스코프 `RegExp` 객체의 `lastIndex`를 건드리지
    않는다 — 이 파일에 이미 있던 4곳의 수동 `rx.lastIndex = 0` 관용구(재호출 시 리셋
    누락이면 두 번째 호출부터 조용히 결과가 준다는, 트래커에 등재된 결함 클래스)를 새로
    반복하지 않는다.
  - 제안: 조치 불필요.

## 검토했으나 부작용 없음으로 판단한 항목

- `plan/in-progress/error-code-emission-axis.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`(추가분),
  `CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`: 전부 정적 문서 변경(가이드 문장
  정정 · plan 트래킹 · CHANGELOG/PROJECT.md 갱신)뿐이며 코드 실행 경로·런타임 동작에 영향
  없음. `logic.mdx`/`logic.en.mdx`의 문장 변경은 엔진 동작(`execution-engine.service.ts`)을
  서술만 정정할 뿐 그 코드 자체는 이번 diff에 포함되지 않았다.
- env 변수·네트워크 호출·이벤트/콜백: 이번 diff 범위(테스트/스캐너/문서/plan) 안에 신규
  `process.env` 읽기, 외부 서비스 호출, 이벤트 발행/구독 변경이 전혀 없다.
- 파일시스템 쓰기: 이번 diff의 실질 코드(스캐너·테스트) 어디에도 `fs.writeFileSync` 등 쓰기
  호출이 없다 — 전부 읽기 전용.
- `review/code/**`, `review/consistency/**` 산출물 커밋: CLAUDE.md가 의무화한 `/ai-review`·
  `--impl-prep`/`--impl-done` 호출의 정적 산출물이고, 다른 프로세스가 실행 중 참조하는 상태가
  아니다.

## 요약

라운드 7 시점의 누적 diff는 여전히 문서 정정(가이드 mdx·CHANGELOG·PROJECT.md), 테스트 전용
스캐너(`guide-identifier-scan.ts`)의 순수 함수·상수 추가, 그리고 그 위에 새로 얹힌
`resolveSourceLines` 캐시(라운드 6, 성능 회귀 수정)로 구성되며 프로덕션 런타임 코드는 건드리지
않는다. 새 캐시는 모듈 스코프에 선언돼 있지만 현재 호출부가 하나뿐이고 순수 읽기 결과를
memoize할 뿐이며, 검증을 가릴 수 있는 방향(캐시가 실패를 숨김)에 대해 개발자가 직접 두
뮤턴트로 RED를 재확인한 기록이 있다 — 새로운 위험으로 격상할 근거는 없다. 카탈로그 파일의
가드 없는 read는 라운드 1부터 여러 차례 확인된 기존 관행의 반복이라 새 위험이 아니다. 전역
상태의 예기치 않은 변경, 시그니처/공개 API 파괴적 변경, 예기치 않은 파일 생성·삭제·쓰기,
환경변수·네트워크·이벤트 부작용은 이번 라운드에도 발견되지 않았다.

## 위험도

NONE
