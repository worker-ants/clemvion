# 정식 규약 준수 검토 — dto-class-jsdoc-citation

## 검토 대상

- **spec 델타**: `spec/conventions/review-citations.md`, `spec/conventions/swagger.md` (§3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다, 2026-09-27)
- **구현 델타**: `schedule-response.dto.ts` · `trigger-response.dto.ts`(리뷰 인용을 클래스 JSDoc → `//` 주석으로 이동) · `dto-jsdoc-citation-guard.ts` · `dto-jsdoc-citation.spec.ts`(가드 베이스라인 2건 → 0건)

## 발견사항

없음. CRITICAL·WARNING 대상 위반을 찾지 못했다. 검증 절차는 아래 "검증 상세" 참고.

## 검증 상세 (반증 시도 포함)

1. **§2 인용 형식 규약 자기 준수** — 이번 diff(review-citations.md·swagger.md)에 `hh_mm_ss` bare 패턴이 새로 들어갔는지 정규식으로 diff 를 훑었다(`grep -oE '[0-9]{2}_[0-9]{2}_[0-9]{2}'`) → 매치 0. 이동된 인용(`review/consistency/2026/09/06/00_48_52` W2)도 전체 경로+라운드 번호로 §2 "권장" 형식을 그대로 따른다.

2. **새 Rationale 절의 앵커 링크** — `[Rationale](#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27)` 이 가리키는 헤딩은 `### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)`. GitHub 슬러그 규칙(구두점 제거·소문자·공백→`-`)으로 수동 재계산한 결과 정확히 일치(em dash 제거로 생기는 이중 공백이 이중 하이픈 `3--응답`으로 나타나는 것까지 일치). 깨진 앵커 없음.

3. **"규약 두 문서에는 이 절이 처음이다" 주장 실측** — `git log -S'클래스 JSDoc' -- spec/conventions/review-citations.md spec/conventions/swagger.md` 실행 결과 커밋 1개(`c8bf27c8e`, 이번 PR)만 나옴. 주장이 사실과 일치.

4. **"클래스 JSDoc 문구는 빌드 산출물 어디에도 없다(`codebase/backend/dist`, 2026-09-27)" 주장 실측** — `codebase/backend/dist/modules/triggers/dto/responses/trigger-response.dto.js` 를 직접 읽어 확인: `_OPENAPI_METADATA_FACTORY()` 에는 **프로퍼티** JSDoc("워크플로우 UUID"·"워크플로우 이름")만 유니코드 이스케이프로 박혀 있고, 클래스 JSDoc 텍스트("한쪽을 다른 쪽으로 갈아 끼우지 말 것" 등)는 grep 0건. 문서가 의존하는 기술적 근거(플러그인이 프로퍼티만 스키마화한다)가 검증됨.

5. **`spec-impl-evidence.md` 상호 등재 확인** — review-citations.md Rationale 이 "이 예외는 `spec-impl-evidence.md` §2.1 의 `code:` 필드 정의 설명 안에 함께 등재했다" 고 주장. 실제로 `spec/conventions/spec-impl-evidence.md` §2.1 `code` 필드 행을 grep 하여 review-citations.md 를 선례로 지목하고 "§3 의 **응답 DTO** 축은 `dto-jsdoc-citation-guard.ts` 가 2026-09-06 부터 강제하고, 같은 절의 **컨트롤러** 축은 여전히 미강제" 문구가 실제로 존재함을 확인 — 한쪽만 재해석해 SoT 가 모르게 되는 상황이 아니다.

6. **가드 구현이 문서 주장과 일치하는지** — `dto-jsdoc-citation-guard.ts` 의 `findDtoJsDocCitations` 를 직접 읽어 `ts.isClassDeclaration` 과 `ts.isPropertyDeclaration` 양쪽을 순회함을 확인 — review-citations.md Rationale 표("§3 — 응답 DTO JSDoc: 예(강제)")·가드 자체 JSDoc·`spec-impl-evidence.md` 서술이 삼자 일치.

7. **코드 수정이 새 규칙(§3 신설 행 "회피처도 같다 — 바로 위 `//` 주석")을 실제로 따르는가** — `schedule-response.dto.ts`/`trigger-response.dto.ts` diff 확인: 클래스 `/** */` 안의 인용을 지우고 바로 위 기존 `// 내부 서사를 ...` 블록에 같은 인용(전체 경로+라운드 번호)을 추가 — 처방한 회피처 위치·형식 그대로.

8. **명명·API 문서 데코레이터 축** — 이번 diff 는 데코레이터·DTO 클래스명·파일 위치를 바꾸지 않았다(순수 주석 이동 + 테스트 상수 비우기). `swagger.md` §1-7(Update 접두)·§5(응답 DTO 클래스명 유일성) 등 명명 규약에 저촉되는 변경 없음.

## 참고 (비차단, 스코프 밖)

- `swagger.md` 는 최상단에 명시적 `## Overview` 헤딩이 없다(도입부 산문 후 바로 `## 0)`으로 진입). CLAUDE.md 의 "Overview/본문/Rationale 3섹션 권장" 과 결이 다르지만, 이는 이번 PR 이전부터 있던 문서 구조이고 이번 diff 는 그 구조를 건드리지 않았다 — 이번 변경의 위반으로 보지 않는다.

## 요약

이번 PR 이 건드린 두 conventions 문서(`review-citations.md`, `swagger.md`)의 변경분은 §2 인용 형식·앵커 링크·상호 참조(`spec-impl-evidence.md` §2.1)를 전부 실측으로 재확인했고 전부 일치했다. 문서가 새로 내세운 두 가지 사실 주장(git 이력상 최초 등재, 빌드 산출물에 클래스 JSDoc 부재)도 `git log -S`·`dist/*.js` 직접 확인으로 반증 시도했으나 모두 참으로 확인됐다. 대응 코드 diff(가드 2파일 + DTO 2파일)도 문서가 처방한 형태(클래스+프로퍼티 함께 강제, 인용은 바로 위 `//` 로 이동)를 정확히 구현한다. 정식 규약 위반을 찾지 못했다.

## 위험도

NONE
