# 유지보수성(Maintainability) 리뷰 결과

## 사전 확인

이 diff(`origin/main...HEAD`)는 `20_36_35→22_45_24→23_07_11→23_27_48→23_46_00→00_00_44` 6개
라운드가 이미 검토한 누적 결과이며, 직전 코드 라운드(`00_00_44`)는 CRITICAL/WARNING 0·INFO 3건
(전부 "조치 불요"로 명시 유예)으로 LOW 판정했다. 그 이후 추가된 커밋
(`304679959` e2e 신설·`a53af772b` plan 위임·`e34a85b44` auth remember_me fix·`f5ab3040c`
source-scan.ts 카운터 공유)을 `Read`/`Grep`으로 직접 대조해 신규분과 기존 유예 항목의 현재
상태를 갈라 확인했다.

- `it.each` placeholder 명·`detail` 필수화·`unknown` 전환 — 이전 라운드에서 해소 확인된 상태
  그대로 유지. execution-engine/knowledge-base 는 이번 4개 커밋에서 변경되지 않았다.
- `knowledge-base.service.ts`의 `rowsOut`(2회)/`resetRows`(1회) 변수명 불일치(`22_45_24`부터
  4라운드째 INFO, "급하지 않음"으로 유예) — **상태 변화 없음**, 코드 unchanged.
- 두 구조적 회귀 가드(`assert-row-array.spec.ts`/`update-returning-rows.spec.ts`)의 `SRC`/
  정규식-카운팅 보일러플레이트 중복(3라운드째 INFO, "세 번째 유사 가드가 생기면 추출 고려"로
  유예) — `f5ab3040c`가 `countCalls`/`stripComments`만 `__testing__/source-scan.ts`로 공유했고,
  `SRC = join(__dirname, '..', '..')` 계산과 `CONSUMING_QUERY`/`CONSUMING` 정규식 자체는 여전히
  각 파일에 독립 정의돼 있다(`assert-row-array.spec.ts:55,62` / `update-returning-rows.spec.ts:51,54`).
  기존 유예 범위와 정확히 일치하므로 재유예.
- `auth-oauth.service.ts`의 `updateReturningRows` 호출 스타일(인라인 `await` 전달, 나머지 7곳은
  변수로 받아 전달) — 기존에 지적·수용된 비대칭 그대로, 변경 없음.

## 발견사항

- **[INFO]** `AuthOAuthStateRow`(신규 raw-row 타입)와 기존 엔티티 클래스 `AuthOAuthState`가
  이름이 한 단어(`Row`) 차이라 임포트 지점만 보고는 어떤 shape(camelCase entity vs snake_case
  raw row)인지 구분되지 않는다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`interface AuthOAuthStateRow`
    선언부, `import { AuthOAuthState, AuthOAuthMode } from './entities/auth-oauth-state.entity'`
    바로 아래에 정의됨)
  - 상세: 이 파일의 결함(“타입이 거짓말을 했다” — `record.rememberMe`가 컴파일은 통과하지만
    런타임엔 `undefined`)이 애초에 두 shape을 혼동해 생겼고, 그 교훈을 담은 JSDoc이 15줄에 걸쳐
    정확히 이 위험을 설명하고 있다. 문서는 훌륭하지만, 이름 자체가 그 차이를 드러내지 않아
    다음에 이 파일을 스치듯 읽는 사람은 여전히 `AuthOAuthState`/`AuthOAuthStateRow`를 같은
    shape으로 오인할 수 있는 함정이 남아 있다 — 이번 결함이 재발한 축(제네릭 단언은 검증이
    아니다)과는 다른, 이름 축의 잔여 위험이다.
  - 제안: 급하지 않음. 다음에 이 파일을 손댈 때 `RawAuthOAuthStateRow` 류로 접두어를 붙이면
    타입명만으로 "raw SQL 행"임이 드러난다.

- **[INFO]** 소비지점 3곳(admission)·업데이트-지점 안내 주석이 실제로는 존재하지 않는 번호
  체계를 참조한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:727`
    (`// ① 과 같은 CAS 락 — 튜플이라 거절 분기가 사문화돼 있었다.`)
  - 상세: 이 주석은 `reEmbedAll`의 CAS 락이 `reExtractAll`의 CAS 락과 같은 패턴임을 알리려는
    의도로 "①"을 가리키지만, 정작 그 대상인 `reExtractAll`의 주석(`:335`)은
    `// 1) atomic CAS lock`로 아라비아 숫자+괄호 표기다. 저장소 전체에 원문자(①②③) 넘버링
    관례가 따로 없어(다른 파일은 전부 `1)`/`#1` 류), "①"이 가리키는 실제 앵커가 코드에 없다.
    `8332d9a20`(이 PR의 첫 커밋)부터 5라운드 넘게 지적되지 않고 남아 있었다 — 기능에는
    영향이 없지만, `Cmd+F`로 "①"을 찾아 대조하려는 다음 리뷰어는 못 찾는다.
  - 제안: `// 1) 과 같은 CAS 락` 으로 표기를 맞추거나, 원문자를 쓰려면 `:335`도 함께 바꾼다.

## 요약

이번 라운드에서 새로 들어온 4개 커밋(e2e 신규 파일·plan 위임 문서·auth remember_me 컬럼명
수정·`source-scan.ts` 카운터 공유)은 모두 짧고 단일 책임이며 기존 컨벤션(실측 근거를 주석에
남기는 서술형 스타일, `detail` 진단 인자 관철, `it.each` placeholder 명 일치)을 그대로 따른다.
`auth-oauth-callback.e2e-spec.ts`는 헬퍼 함수(`seedState`/`callbackRaw`/`callback`/
`refreshCookieMaxAge`)로 잘 분리되어 있고 매직 넘버(`MAX_AGE_REMEMBER_ME`/`MAX_AGE_DEFAULT`)도
계산식+주석으로 근거가 명시돼 함수 길이·중첩·복잡도 축에서 문제가 없다. CRITICAL/WARNING 급
신규 발견은 없으며, 발견된 2건은 모두 사소한 네이밍/주석-참조 정합성 INFO다. 5라운드 넘게
반복 지적·유예돼 온 기존 항목(`rowsOut`/`resetRows` 비일관, 두 구조적 가드의 `SRC`/정규식
보일러플레이트 중복, `auth-oauth` 호출 스타일 비대칭)은 이번 4개 커밋의 변경 범위 밖이라
상태 변화 없이 그대로 유효한 유예다.

## 위험도

LOW
