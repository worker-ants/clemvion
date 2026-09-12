# 유지보수성(Maintainability) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 4)

## 검토 방법

이 세션은 이미 3라운드(`16_17_57` → `16_39_18` → `17_02_19`)를 거쳤고, 매 라운드 maintainability
reviewer 가 `chat-channel-input-rules.{ts,spec.ts}` 등 8개 애플리케이션 파일을 독립적으로 훑어
LOW 수준 INFO 만 남긴 상태다(`throwInvalidField` 의 넓은 `string` 타이핑, `it.each` 반복 2건,
컨트롤러 주석 위치). 이번 라운드의 **새로운 델타**는 직전 라운드(`17_02_19`)가 WARNING 으로 낸
"DTO 클래스명 충돌 재발 방지 부재"에 대한 조치로 신설된 가드 5개 파일뿐이다
(`git log --oneline -- codebase/` 최신 커밋 `3c9f4dd12`):

- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts` (신규)

이 5개 파일은 이전 세 라운드 어느 maintainability 리뷰도 검토하지 않았다(조치가 라운드 3 리뷰
**이후**에 커밋됨 — `review/code/2026/09/12/17_02_19/maintainability.md` 자체가 "8개 애플리케이션
파일"만 대상으로 했다고 명시). 그래서 이번 라운드는 이 5개 파일을 신규로, 나머지 8개 파일은
회귀 여부만 재확인했다.

`Read`/`grep`으로만 조회했고 저장소에 쓰기는 하지 않았다(`git status --short` 결과 이 리뷰 산출물
디렉터리 외 변경 없음, 원복 불필요).

## 발견사항

- **[INFO]** 신규 `exportedClassNames`가 최상위 statement 만 훑어, 형제 가드(`dto-jsdoc-citation-guard.ts`)의 재귀 순회와 스캔 깊이가 다르다 — 현재는 무해하지만 설계 근거가 적혀 있지 않다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts:25-41`(`exportedClassNames` — `for (const stmt of source.statements)`, 최상위 문만 순회)
  - 상세: 같은 디렉터리의 형제 가드 `dto-jsdoc-citation-guard.ts`의 `findDtoJsDocCitations`는 `ts.forEachChild`로 **재귀** 방문해 어디에 중첩돼 있든 클래스 선언을 찾는다. 반면 이번 신규 가드는 `source.statements`(파일 최상위 문 목록)만 순회해 `export class`가 네임스페이스·조건부 블록·다른 선언 내부에 중첩돼 있으면 조용히 건너뛴다. 실측으로는 현재 위험이 없다 — `grep -rn "^\s\+export class" --include="*.dto.ts" codebase/backend/src`가 0건이라 저장소의 모든 DTO 클래스가 최상위에 있다. 다만 이 가드의 존재 이유 자체가 "정규식이 아니라 정본 파서로 **놓치지 않고** 세겠다"는 완전성 주장이고, 그 주장을 뒷받침하는 문서(가드/spec JSDoc 양쪽)가 "AST vs 정규식"만 근거로 들 뿐 "왜 재귀가 아니라 최상위만 보는가"는 언급하지 않는다. 이 파일이 만들어진 계기(swagger 스키마 이름 충돌)가 애초에 "사람이 놓친 것을 정적 도구로 잡자"는 취지였던 만큼, 스캔 범위의 암묵적 가정도 같은 수준으로 문서화하거나 형제 가드처럼 재귀 순회로 맞추는 편이 자기 일관적이다.
  - 제안: 급하지 않음(현재 실측 위험 0). "최상위 `export class`만 센다"를 의도적 설계로 굳힐 것이면 파일 헤더나 함수 JSDoc에 그 범위를 명시하고, 아니라면 형제 가드처럼 `ts.forEachChild` 재귀 순회로 통일.

- **[INFO]** `SRC_ROOT` 계산이 스펙 파일에서 지역적으로 중복된다 — 형제 가드가 정한 "한 곳이 소유" 패턴과 어긋난다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts:42`(`const SRC_ROOT = path.resolve(__dirname, '..', '..');`)
  - 상세: 같은 디렉터리의 `dto-jsdoc-citation-guard.ts`는 `export const SRC_ROOT = path.resolve(__dirname, '..', '..');`를 가드 모듈에 두고, `dto-jsdoc-citation.spec.ts`가 그 상수를 import 해서 쓴다(주석: "응답 DTO 판정은 **한 곳이 소유한다**. 같은 이름·같은 로직을 여기 다시 쓰면 한쪽만 바뀌었을 때 두 가드의 판정이 조용히 갈린다"). 이번 신규 가드(`dto-class-name-collision-guard.ts`)는 `SRC_ROOT`를 export 하지 않고, spec 파일이 동일한 계산식을 손으로 다시 적었다. 두 파일이 같은 디렉터리(`__dirname` 값이 항상 같음)라 지금 당장 값이 갈릴 위험은 없지만, 이 가드가 스스로 인용하는 "한 곳이 소유" 원칙을 자신은 따르지 않는 형태다.
  - 제안: 급하지 않음. `SRC_ROOT`(또는 `SCAN_ROOTS`)를 가드 모듈에서 export 해 spec 이 import 하도록 정리하면 형제 가드와 패턴이 맞는다.

- **[INFO]** `findDtoClassCollisions`가 파일당 불변인 상대경로를 클래스마다 재계산한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts:54-57`(`for (const name of exportedClassNames(file)) { const rel = toPosixRelative(srcRoot, file); ... }`)
  - 상세: `toPosixRelative(srcRoot, file)`는 `file`에만 의존하므로 한 파일에 `export class`가 여러 개면(예: `chat-channel-config.dto.ts`처럼 보조 DTO를 여러 개 선언하는 파일) 같은 값을 클래스 수만큼 다시 계산한다. 결과에 영향은 없고 파일 수·클래스 수가 작아(114개) 성능상 의미도 없지만, 바깥 for 문으로 한 번만 계산하면 "이 값이 클래스마다 달라지나?"라는 순간의 오독을 없앨 수 있다.
  - 제안: 급하지 않음(순수 스타일). 다음에 이 함수를 만질 때 `rel` 계산을 바깥 루프로 옮기는 정도로 충분.

## 확인했으나 문제 없음

- **DTO 클래스명 충돌 가드 자체의 설계** — 단일 책임 함수 2개(`exportedClassNames`/`findDtoClassCollisions`), 명확한 네이밍, 낮은 중첩(최대 2단), 매직 넘버 없음. 형제 가드(`dto-jsdoc-citation-guard.ts`)와 파일명 패턴(`*-guard.ts`/`*.spec.ts`)·구조·JSDoc 서사 스타일이 일관된다.
- **스캔 루트를 `modules/`·`common/`로 좁힌 이유가 실측과 함께 문서화됨** — spec 파일 43~46행이 "`src` 전체를 훑었더니 자기 fixture 를 잡고 죽었다"는 실제 겪은 실패와 `*.dto.ts` 114개가 그 두 디렉터리에만 있다는 실측을 함께 남겼다. 새 fixture 3개(`alpha.dto.ts`/`beta.dto.ts`/`decoy.dto.ts`)는 `src/repo-guards/__tests__/fixtures/` 아래 있어 이 가드의 `SCAN_ROOTS`(`modules`/`common`) 밖이다 — 자기 자신을 다시 잡는 문제가 재발하지 않음을 실제 경로로 확인했다.
- **다른 가드로의 오염 가능성 없음을 직접 확인** — 새 fixture 3개는 파일명이 `*.dto.ts`로 끝나 저장소 전체를 스캔하는 다른 가드(`swagger-dto-contract.spec.ts`가 `collectTsFiles(SRC_ROOT)`로 `src` 전체를 읽음)의 입력에도 포함된다. 하지만 그 가드의 판정 함수(`findSwaggerContractMismatches`)는 `@ApiProperty`류 데코레이터가 붙은 프로퍼티만 보고, 세 fixture 클래스 모두 데코레이터가 없는 순수 필드라 어떤 판정에도 걸리지 않음을 코드(`swagger-dto-contract-guard.ts:174-186`)를 직접 읽어 확인했다 — 오탐 없음.
- **대조군(control-group) 설계** — "같은 이름 두 파일" 양성 fixture와 "주석/문자열/JSDoc 예제 속 `export class`" 음성 fixture(`decoy.dto.ts`)를 함께 둬, "0건이라서 통과"와 "아무것도 안 세서 통과"를 가른다. `> 100` 하한 단언까지 있어 스캔 경로가 어긋나도 vacuous 통과 대신 실패한다 — 이 저장소가 반복적으로 겪은 vacuous-test 사고 패턴을 이 신규 파일 자신은 피했다.
- **8개 애플리케이션 파일(`chat-channel-input-rules.{ts,spec.ts}` 등) 회귀 없음** — 라운드 3 이후 코드 변경 없음(`git show 3c9f4dd12 --stat`에 이 파일들 없음). 직접 `Read`로 전문 재확인한 결과 함수 길이·중첩·네이밍 모두 라운드 3 리뷰 시점과 동일하다.

## 요약

이번 라운드의 실질 델타는 라운드 3 WARNING(스키마 이름 충돌 재발 방지 부재)을 해소하려고 신설한
`dto-class-name-collision` 가드 5개 파일이다. 단일 책임 함수·명확한 네이밍·낮은 복잡도·형제
가드와 일관된 파일 구조를 갖췄고, 자기 자신의 fixture 를 스캔 대상에서 실측으로 배제했으며 다른
가드로의 오염 가능성도 코드를 직접 읽어 없음을 확인했다. 다만 형제 가드(`dto-jsdoc-citation-guard.ts`)가
이미 정착시킨 두 관례 — **재귀 AST 순회**와 **`SRC_ROOT` 단일 소유(export)** — 를 이번 신규 가드는
따르지 않아, 같은 디렉터리 안에서 스타일이 갈린다. 둘 다 현재 시점에는 실측으로 무해함을
확인했지만(중첩 클래스 0건, `__dirname` 동일), 이 가드의 존재 이유가 "완전성"이라는 점을 감안하면
암묵적 가정을 문서화하거나 형제 패턴에 맞추는 편이 자기 일관적이다. 8개 애플리케이션 파일은 라운드
1~3 조치 이후 재변경이 없어 이전 라운드들이 남긴 LOW 수준 INFO(넓은 `string` 타이핑, `it.each`
반복, 컨트롤러 주석 위치) 그대로다 — 새로 발견된 CRITICAL/WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
