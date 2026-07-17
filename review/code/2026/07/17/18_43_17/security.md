# 보안(Security) 리뷰

대상: `git diff origin/main..HEAD`

- `codebase/frontend/eslint.config.mjs`
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
- `review/code/2026/07/17/18_06_36/*` (13개, 이전 리뷰 라운드의 산출물 문서 신규 추가: SUMMARY/RESOLUTION/각 reviewer 보고서·상태 JSON)

## 분석 범위 확인

`git diff origin/main..HEAD --stat` 로 확인한 변경 파일은 총 15개이며, 실제 애플리케이션/빌드 도구 코드 변경은 위 2개 파일뿐이다. 나머지 13개는 이전 코드 리뷰 세션(`18_06_36`)의 산출물(markdown 보고서, JSON 상태 파일)이 신규로 커밋된 것으로, 런타임 동작에 영향이 없는 리뷰 아티팩트다. 이 13개 파일 전체를 훑어 시크릿·자격증명·토큰 노출 여부를 확인했으나 해당 사항 없음(파일 경로·커밋 해시·테스트 카운트 등 리뷰 메타데이터만 포함).

## 코드 변경 상세 분석

### `eslint.config.mjs`

기존에 두 곳(`ImportExpression` selector, `CallExpression` selector)에 리터럴로 중복돼 있던 정규식 문자열을

```js
const COMPONENTS_PATH_RE = String.raw`^(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)$`;
```

로 상수화하고, 두 selector 에서 템플릿 리터럴로 보간(`` `ImportExpression[source.value=/${COMPONENTS_PATH_RE}/]` ``)하는 순수 리팩터다.

- **동등성**: 원본 정규식 리터럴(`^(@\\/components(\\/.*)?|(\\.\\.\\/)+components(\\/.*)?)$`, JS 문자열 이스케이프 반영)과 `String.raw` 로 정의한 신규 상수를 파싱 결과 기준으로 비교하면 바이트 단위로 동일한 정규식이다. 동작 회귀나 매칭 범위 변화 없음.
- **공격 표면**: 이 정규식은 ESLint(`no-restricted-syntax`) 설정 안에서 소스 코드의 import specifier 문자열(개발자가 작성한 정적 리터럴)을 정적 분석 시점(lint-time)에 매칭하는 용도다. 런타임에 사용자 입력을 받지 않고, 네트워크/DB/파일시스템 I/O 도 없으며, CI/개발자 로컬에서만 실행된다. 따라서:
  - **정규식 인젝션**: 해당 없음 — `COMPONENTS_PATH_RE` 는 고정 상수이며 사용자 입력이나 외부 데이터로부터 조립되지 않는다.
  - **ReDoS**: 정규식 구조(`(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)`)에 중첩 quantifier 나 겹치는 문자 클래스 반복이 없어 catastrophic backtracking 유발 패턴이 아니다. 설령 이론적으로 느려지더라도 공격자가 도달할 수 없는 dev/CI-only 실행 경로라 실질적 위협이 아니다.
  - **경로 탐색/파일시스템 접근**: 이 정규식은 파일시스템 경로를 실제로 열거나 접근하지 않고 import specifier 문자열 매칭에만 쓰인다. 경로 탐색(path traversal) 취약점과 무관.
- **시크릿**: 하드코딩된 API 키/비밀번호/토큰 없음.
- **인증/인가, 입력 검증, 암호화, 에러 처리, 의존성**: 해당 변경에 관련 접점 없음(빌드 도구 설정 파일이며 런타임 요청 경로·인증 플로우·암호화 로직과 무관).

### `eslint-layering-guard.test.ts`

`layeringBlock`(단수, `.find`) → `layeringBlocks`(복수, `.filter`) + flat config "나중 블록 우선" 병합 재현(`Object.assign`), severity(`"error"`) 검증 assertion 추가, bare-path 위반 케이스 및 근접 오탐(negative) 케이스 추가. 순수 테스트 코드로 애플리케이션 런타임 동작에 영향 없음. 테스트에 사용된 픽스처 문자열(`'import "@/components";'` 등)은 테스트 내부 상수이며 외부 입력이 아니다. 시크릿·자격증명 노출 없음.

## 리뷰 산출물 문서 13건

`review/code/2026/07/17/18_06_36/` 하위 신규 파일들은 이전 리뷰 라운드의 결과 보고서·상태 파일이다. 내용은 파일 경로, 커밋 해시(`a1e2ec8af...`), 테스트 통과 카운트, 라우팅 결정 등 메타데이터로 구성되어 있으며 시크릿·인증정보·민감 데이터 노출은 확인되지 않았다.

## 발견사항

없음.

## 요약

이번 diff 는 ESLint flat config 의 레이어 역전 가드 정규식을 중복 제거 목적으로 상수화한 순수 리팩터와, 그 가드를 검증하는 테스트 파일의 견고성 보강(flat config 병합 순서 재현, severity 강등 감지, bare-path/근접 오탐 케이스 추가)이다. 두 파일 모두 빌드/린트 도구 설정과 그 테스트에 국한되며, 사용자 입력·네트워크·DB·인증·시크릿 등 런타임 공격 표면과 접점이 없다. 정규식 리팩터는 원본과 완전히 동등하고 ReDoS 유발 구조도 아니다. 나머지 13개 변경 파일은 이전 리뷰 라운드의 문서성 산출물로 시크릿 노출이나 보안 관련 이슈가 없다. 보안 관점에서 조치가 필요한 발견사항은 없다.

## 위험도

NONE
