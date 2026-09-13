# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 · 방법

`--impl-prep` scope=`spec/conventions/` 로 조립된 프롬프트 번들은 총 292개 파일 중 **268개가
컨텍스트 예산 초과로 본문 생략**됐다 (`spec/conventions/error-codes.md` 포함 — 이번 plan
`error-code-emission-axis` 가 다루는 축과 가장 직접 관련된 컨벤션 문서). 번들 자체가 "여기 없다는
사실을 근거로 삼지 말라" 고 명시하므로, 생략된 파일 중 이번 검토 관점(명명·출력포맷·문서구조·API
문서·금지항목)에 가장 직결되는 4개를 저장소에서 **직접 `Read`** 했다: `error-codes.md`,
`spec-impl-evidence.md`(frontmatter 규약 SoT), `user-guide-evidence.md`, `swagger.md`(일부).
번들에 실제 본문이 실린 파일(`audit-actions.md`, `cafe24-api-catalog/_overview.md`·`category.md`·
`store.md`·`translation.md`, `cafe24-api-metadata.md` 일부)도 함께 대조했다.

## 발견사항

- **[WARNING] impl-prep 번들이 이번 작업과 가장 관련 깊은 컨벤션을 예산으로 누락**
  - target 위치: 프롬프트 번들 전체(`_prompts/convention_compliance.md`) — "⚠️ 컨텍스트 예산
    초과로 생략된 파일 268개" 목록
  - 위반 규약: 특정 조항 위반은 아니고, 기존에 이미 기록된 harness 한계
    (`--spec` 모드 예산이 conventions 를 통째로 떨구는 문제)의 `--impl-prep` 판본
  - 상세: `error-codes.md`(에러 코드 명명·안정성 규약, 17,742자)가 생략 목록 1번째로 올라 있다.
    이번 plan(`error-code-emission-axis`)이 정확히 "가이드에 인용된 에러 코드가 실제로 방출되는가"
    를 다루므로, 이 문서가 번들에서 빠지면 checker 가 무근거로 "관련 컨벤션 없음"이라 오판할
    위험이 있다. 이번 세션은 프롬프트의 지시대로 `Read` 로 직접 열어 대조했고(§본문), 그 결과
    CRITICAL 은 없었다 — 다만 이 우회는 **이번 세션이 수행했다는 사실 자체가 번들 설계의
    결함을 재확인**한다(생략 대상에 "이번 작업과 직결" 이라는 우선순위 가중치가 없다).
  - 제안: 번들러가 최소한 "plan 본문/제목에 등장하는 키워드와 basename 이 겹치는 conventions
    파일"을 예산 배정 우선순위 최상위로 끌어올리는 것을 고려. (harness 변경이므로 이 결정은
    `project-planner`/`developer` 소관이며 본 리뷰는 관측만 보고한다.)

- **[INFO] `cafe24-api-catalog/_overview.md §2` 의 `id` 컬럼 정의가 "resource" 의미를 두 갈래로 씀**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §2 표의 `id` 행;
    대조 대상은 `category.md`(`mains_list`/`mains_add`/`autodisplay_*` 4개 id)와
    `store.md`(약 50개 id, `store_get` 외 전부 `shops_*`/`activitylogs_*`/`kakaopay_*` 등
    파일 resource 명과 무관한 접두)
  - 위반 규약: 자체 위반은 아님 — `_overview.md §2`: "id: … `<resource>_<verb>` 또는
    `<resource>_<sub>_<verb>` … resource 내 unique"
  - 상세: 이 정의문의 `<resource>` 토큰이 "그 카탈로그 파일이 대표하는 Cafe24Resource"(예:
    category.md → `category`)인지, "그 endpoint 가 속한 Cafe24 API 경로 그룹명"(예: `mains`,
    `autodisplay`, `shops`, `activitylogs`)인지 정의문만으로는 갈리지 않는다. 실제 표는 후자로
    일관 채워져 있다(485개 row 전체가 이 패턴). `_overview.md §5` 말미의 "`store.md` 의 `privacy_*`
    id 명명 우려(별 `privacy` resource 와 prefix 충돌)" 각주가 이 애매성의 **한 사례만** 이미
    추적하고 있고, 같은 애매성 자체는 문서화돼 있지 않다.
  - 제안: `_overview.md §2` id 정의에 "`<resource>` 는 그 endpoint 가 속한 Cafe24 API 경로
    그룹명이며 카탈로그 파일이 대표하는 최상위 resource 와 다를 수 있다"는 한 문장을 추가하면
    향후 카탈로그 유지보수자(및 §5 각주 같은 follow-up 항목)의 판단 기준이 명확해진다. 기능
    변경이 아니므로 CRITICAL/WARNING 아님.

- **[INFO] 카탈로그 최상위 index 파일(`category.md`/`store.md`/`translation.md`)이
  Overview/Rationale 섹션 없이 표만 담음**
  - target 위치: 위 3개 파일 전체 구조(frontmatter → 제목 → 링크 한 줄 → base URL → `## 표`)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장(각
    SKILL.md 참고) — 단 이는 "권장"이며 `spec-impl-evidence.md`(frontmatter 규약 SoT)는 이
    3섹션 구조를 강제하지 않는다(§1~§4 어디에도 Overview/Rationale 섹션 요구 없음, frontmatter
    필드만 강제).
  - 상세: 18개 최상위 카탈로그 파일(확인된 3개 기준)이 예외 없이 동일한 lean 구조를 쓰고,
    정책·동기 정책·Rationale 은 전부 `_overview.md`(Overview 문단 + §1~8 본문 + `## Rationale`
    보유)로 위임한다. 개별성 없는 일관된 패턴이라 **누락이 아니라 의도된 설계**로 보인다 — 485개
    데이터 row 카탈로그 각각에 Rationale 을 반복하는 것이 오히려 SoT 를 흩뜨린다.
  - 제안: 조치 불필요. 다만 이 판단(카탈로그 index 파일은 3섹션 구조 예외)을 어딘가(`_overview.md`
    자신이나 CLAUDE.md)에 한 줄로 명문화해두면, 다음에 신규 카탈로그를 추가하는 사람이 "왜
    Overview/Rationale 이 없지"라고 재질문하는 것을 막을 수 있다.

- 확인만 하고 문제 없음(참고): 본문이 노출된 6개 파일(`audit-actions.md`, `cafe24-api-catalog/
  _overview.md`·`category.md`·`store.md`·`translation.md`, `cafe24-api-metadata.md`) 모두
  `spec-impl-evidence.md §1~2` 의 frontmatter 의무(`id`/`status`/`code`)를 정확히 준수한다.
  `_overview.md` 가 frontmatter 없이 시작하는 것도 §1 세 번째 제외 항목("밑줄 prefix
  `_overview.md`")에 정확히 해당해 위반이 아니다. `code:` 글로브가 가리키는 대표 경로
  (`error-codes.ts`·`audit-action.const.ts`·`category.ts`·`store.ts`·`translation.ts`)는
  실측으로 전부 실존을 확인했다. `error-codes.md`(직접 Read)는 Overview/본문(§1~5)/Rationale
  3섹션을 모두 갖췄고, 명명 규약(`UPPER_SNAKE_CASE`는 §3.2/node-output.md 로 위임해 재선언
  안 함)·historical-artifact 예외 레지스트리·rename 안정성 정책이 자기 SoT 경계를 명확히
  긋고 있어 이번 검토 관점 5가지(명명/출력포맷/문서구조/API문서/금지항목) 전부에서 CRITICAL
  또는 WARNING 급 위반을 찾지 못했다.

## 요약

번들에 실제로 실린 spec/conventions/ 문서(`audit-actions.md`, cafe24-api-catalog 계열
일부)와, 이번 작업 성격상 직접 `Read` 로 대조한 핵심 문서(`error-codes.md`·
`spec-impl-evidence.md`·`user-guide-evidence.md`·`swagger.md`) 전부 frontmatter·명명·문서구조
규약을 정확히 지키고 있으며, CRITICAL 급 정식 규약 위반은 발견되지 않았다. 가장 비중 있는
발견은 문서 내용 자체가 아니라 **검토 인프라의 갭**이다 — impl-prep 번들이 이번 plan 과 가장
직결된 컨벤션(`error-codes.md`)을 예산 초과로 누락했고, 그 부재를 "관련 규약 없음"으로 오판하지
않으려면 checker 가 직접 파일을 열어야 한다(이번엔 열어서 문제가 없음을 확인했다). 나머지 2건은
문서 명확성 수준의 INFO 로, 이미 부분적으로 추적되고 있거나(카탈로그 id 접두 애매성) 의도된
설계로 보이는(카탈로그 index 파일의 lean 구조) 사안이라 즉시 조치가 필요하지 않다.

## 위험도
LOW
