# 정식 규약 준수 검토 — interaction-type-exhaustiveness.test.ts (regex → AST 가드 교체)

## 검토 범위 요약
- 검토 모드: `--impl-prep`, scope=`spec/conventions/`
- 실제 판정 대상: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 를
  정규식(`RegExp('[\'"`]'+value+'[\'"`]')`) 매칭에서 TypeScript 컴파일러 API(`ts.createSourceFile`
  + `ts.forEachChild`) 기반 실제 AST string-literal 파싱으로 교체하는 계획.
  이 파일은 `spec/conventions/interaction-type-registry.md` frontmatter `code:` 에 등재된
  spec-linked 파일.
- 프롬프트에 함께 번들된 `spec/conventions/audit-actions.md` 및
  `spec/conventions/cafe24-api-catalog/**` 전체 덤프는 이번 계획된 변경과 무관한 배경 컨텍스트로
  판단(변경 대상도 아니고 판정에 참조되지도 않음) — 별도 결함 없음, 리뷰 대상에서 제외.

## 발견사항

- **[INFO]** 스펙 문서의 "grep" 잔존 표현이 구현 전환 후 기술적으로 부정확해짐
  - target 위치: 계획된 변경(대상 파일 상단 JSDoc 및 로직) ↔ `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1 (`system_error`/`rag` 행), §5 rule 2
  - 위반 규약: 없음(직접 위반 아님) — 참고용 관찰
  - 상세: 스펙 문서는 이 가드의 **1차·공식 명칭으로 "AST 가드"를 5회 일관되게 사용**한다
    (§1.2 rule 3 "AST 가드(...)가 매트릭스의 모든 enum 값이 **등록된 grep 대상 파일**에 string
    literal 로 등장하는지 검증한다", §2.1 `system_error`/`rag` 행의 "**AST 가드 대상 코드 파일**",
    §5 "매트릭스 + **AST 가드** + exhaustive switch", "**AST 가드**가 매트릭스 vs 코드 grep 결과를
    build 단계에서 비교 fail"). "grep" 은 이 인용들에서 **AST 가드와 대등한 별도 명칭이 아니라
    그 가드가 수행하는 "찾기" 동작을 가리키는 비공식 서술어**로 함께 쓰인다 — 예컨대
    §1.2 는 "grep 가드가 아니라 TS exhaustive... 커버된다", "두 가드(grep·TS exhaustive) 어느
    쪽도 아니며" 처럼 **"grep" 을 "AST 가드"의 동의어**로 대입해 쓴다. 즉 스펙 상 공식 명칭은
    이미 "AST 가드"이고, 현재 구현(정규식 텍스트 매칭)이 오히려 그 명칭에 못 미쳐 있던 상태다.
    계획된 변경(`ts.createSourceFile` 실제 AST 파싱)은 스펙의 1차 명칭에 **수렴**하는 방향이며,
    "grep" 이라는 잔존 서술어만 이제는 문자 그대로의 텍스트 검색이 아니게 되어 다소 부정확해진다.
  - 제안: **(a) 의미 충돌 아님 · (b) 로 판정** — project-planner 위임 불필요, 코드 변경만으로
    충분하다. `interaction-type-registry.md` 를 지금 당장 고칠 필요는 없으나, 후속으로(별도
    저비용 편집 PR 또는 이번 PR에 곁들여) §1.2 rule 3 · §2.1 두 행 · §5 rule 2 의 "grep" 표현을
    "AST" 또는 "literal-scan" 으로 치환하면 차후 독자가 "grep"을 문자 그대로의 정규식 검색으로
    오독하는 것을 예방할 수 있다. 이는 규약 갱신이 필요해서가 아니라 **서술 정확도 개선** 차원의
    권고이며 블로킹 사유는 아니다.

- **[INFO]** 대상 파일 JSDoc 헤더의 자기서술("AST/grep guard")도 동일 갱신 대상
  - target 위치: `interaction-type-exhaustiveness.test.ts` 상단 JSDoc `"AST/grep guard for
    \`WaitingInteractionType\` exhaustiveness."` 및 "This test grep-finds string literals..."
    문구, `ENUM_VALUES` 위 "Known limitation: the grep matches backtick-quoted mentions too..."
    주석
  - 위반 규약: 없음 — 참고용 관찰
  - 상세: 계획된 변경이 실제로 반영되면 "grep-finds" 서술과 "Known limitation" 주석(현재 결함을
    정확히 서술하는 부분)은 사실과 어긋나게 된다. 이는 conventions 위반이 아니라 구현 변경에
    자연히 수반되는 사내 주석 갱신 항목이다.
  - 제안: 코드 변경 시 이 JSDoc/주석도 AST 파싱 방식으로 함께 갱신(이미 "채택 방안" 서술에
    구현 세부가 명시돼 있으므로 실제 착수 시 반영될 것으로 예상 — 사전에 명시적으로 짚어둠).

- **[INFO]** 정규식 기반 가드는 이 저장소에서 금지 패턴이 아니라 오히려 확립된 선례
  - target 위치: `spec/conventions/migrations.md` (SQL_NAME_RE/SQL_RE 가드), `spec/conventions/i18n-userguide.md` §113 (`ui-label-parity.test.ts` 의 정적 regex 파싱, "spec/conventions/interaction-type-registry.md 와 동일한 'N 개 갱신 위치 동시 변경' 원칙" 명시적으로 인용)
  - 위반 규약: 해당 없음(오탐 방지용 기록)
  - 상세: `spec/conventions/**` 전체를 검색한 결과 정규식/grep 기반 가드를 금지하거나 AST 파싱만
    허용하는 규정은 없다. i18n-userguide.md 는 오히려 정적 regex 파싱을 채택하면서
    interaction-type-registry.md 의 "N 개 갱신 위치 동시 변경" **원칙**(구현 기법이 아니라
    매트릭스 기반 다중 사이트 추적이라는 원칙)을 명시적으로 원용한다. 두 문서가 공유하는 것은
    "매트릭스 SoT + 다중 사이트 동시 갱신" 이라는 원칙이지 "grep 이어야 한다"는 기법 강제가
    아니므로, interaction-type-registry.md 쪽만 AST 로 전환해도 i18n-userguide.md 와 상충하지
    않는다.
  - 제안: 없음(문제 없음을 확인하기 위한 기록).

- **[INFO]** 계획 텍스트의 `typescript` 버전 서술 정밀도
  - target 위치: "채택 방안" 문단 — "`typescript` 는 frontend 의 기존 devDependency(5.9.3)"
  - 위반 규약: 없음 — 정식 규약 대상 아님(사실관계 정밀도 이슈)
  - 상세: `codebase/frontend/package.json` 의 실제 선언은 `"typescript": "^5"` (caret range) 이며
    `5.9.3` 은 현재 lockfile 상 resolve 된 구체 버전으로 추정된다. devDependency 존재 자체는
    사실이라 conventions 위반은 아니다.
  - 제안: 해당 없음(참고 사실 기록 — convention_compliance 범위 밖이라 등급 부여하지 않음).

## 문서 구조 규약 / API 문서 규약 관련 확인

이번 "착수 예정 변경"은 `spec/conventions/**` 문서 자체를 편집하지 않는다(코드 파일 1개만
변경). 따라서 Overview/본문/Rationale 3섹션 구성, `_product-overview.md`/`0-` prefix 명명,
OpenAPI/Swagger 데코레이터·DTO 명명 규약은 이번 변경에 **적용 대상이 아니다** — 위반도, 갱신
필요도 없다. `spec/conventions/interaction-type-registry.md` 의 `code:` frontmatter 는 이미 이
파일을 등재하고 있어 spec-impl-evidence 링크도 그대로 유효하다(새 파일 추가나 파일 경로 변경이
없으므로 frontmatter 갱신 불요).

## 요약

계획된 변경(정규식 텍스트 매칭 → `ts.createSourceFile` 기반 실제 AST 파싱)은 정식 규약
관점에서 **명확한 위반이 없다**. `spec/conventions/interaction-type-registry.md` 는 이 가드를
1차적으로 "AST 가드"라는 이름으로 5회 일관되게 부르며, "grep" 은 그 가드의 하위 서술어로
혼용돼 있을 뿐 별도의 공식 명칭이 아니다 — 따라서 이번 구현 교체는 스펙이 이미 선언한 이름에
**수렴**하는 방향이고((b) 판정), project-planner 위임이 필요한 의미 충돌((a))이 아니다. 저장소
내 다른 conventions(migrations.md, i18n-userguide.md)도 정규식 기반 가드를 금지하지 않으며
오히려 이 문서의 "N 개 갱신 위치 동시 갱신" 원칙을 원용하고 있어, 구현 기법 전환이 다른 규약과
상충하지도 않는다. 유일한 잔여 사항은 스펙 문서 내 "grep" 표현이 구현 전환 후 문자 그대로는
다소 부정확해진다는 서술 정밀도 문제이며, 이는 INFO 등급의 비차단 권고(후속 소규모 wording
정정)로 충분하다. 대상 문서 자체를 편집하지 않는 변경이므로 문서 구조·API 문서 규약은 애초에
적용 범위 밖이다.

## 위험도

NONE
