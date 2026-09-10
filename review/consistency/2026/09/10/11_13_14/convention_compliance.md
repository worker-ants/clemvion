# 정식 규약 준수 검토 — `spec-draft-schedule-trigger-ref-nav.md`

검토 대상: `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md` (변경안 D-1/D-2/D-3, 대상
`spec/2-navigation/3-schedule.md` §4 · `spec/2-navigation/2-trigger-list.md` §3/§2.1)

검토 방법: 실제 저장소 파일(`spec/5-system/2-api-convention.md`, `spec/1-data-model.md`,
`spec/2-navigation/{2-trigger-list,3-schedule}.md`)을 직접 열어 대조하고, 문서 가드
(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts` + `spec-link-integrity.test.ts`)가
실제로 쓰는 알고리즘(remark `mdast-util-from-markdown` 파싱 → `github-slugger`)을 그대로
Node 스크립트로 재현해 6개 신규 앵커 전부를 실측했다.

## 발견사항

### [INFO] 기준 (b) 서술이 §5.4 문구보다 강한 근거를 댄다 — 연결 문장 권장

- target 위치: D-1 표의 `trigger.workflow` 행, D-2 註 1문단 (`2-trigger-list.md §3`)
- 위반 규약: `spec/5-system/2-api-convention.md` §5.4 — "키 생략은 (a)/(b) 중 하나에 해당할 때만
  쓰고, **그 필드를 문서화하는 절에 사유를 명시**한다." (b) = "선택적 부가 컨텍스트라 소비자가
  부재를 정상 경로로 다룰 때"
- 상세: 두 DTO(`ScheduleTriggerRefDto.workflow`, `TriggerWorkflowRefDto`/`TriggerDto.workflow`)의
  기존 JSDoc은 이미 "§5.4 기준 (b)"로 분류해 두었고 사유를 `?? ""` 폴백 읽기로 적는다 — 이는
  (b)의 "소비자가 부재를 정상 경로로 다룬다"는 문구와 글자 그대로 일치한다. 이 초안은 그보다
  **더 강한 사실**(생성 응답 자체를 프런트엔드가 아예 읽지 않는다)을 스펙에 적기로 택했는데,
  이 사실 자체는 (a)도 (b)도 아닌 제3의 근거("소비 경로에 도달하지 않는다")로 읽힐 여지가 있다.
  실측(`schedules.ts:66`/`triggers.ts:174`의 `create` 가 `Promise<void>` — 바디를 버림)은 correct하고
  결론("(b) 위반 아님")도 방어 가능하다 — 응답을 아무도 읽지 않으면 자명하게 "부재를 정상
  경로로 다룬다"(다뤄야 할 코드 경로 자체가 없다)의 극단적 인스턴스이기 때문이다. 다만 이
  연결을 스펙 텍스트가 명시하지 않아, 다음 사람이 "이게 왜 (b)인가"를 되짚어야 한다.
- 제안: D-1/D-2 문구에 "(응답이 읽히지 않으므로 (b)의 '정상 경로로 다룬다'를 자명하게
  충족)" 같은 한 구절만 추가하면 충분하다. CRITICAL/WARNING 아님 — 근거 자체는 실측과
  일치하고 코드 JSDoc의 기존 (b) 분류와도 모순되지 않는다.

### [정보 확인 — 문제 없음] D-1/D-2 "필드를 문서화하는 절" 배치는 §5.4 요건을 충족한다

- target 위치: D-1 (`3-schedule.md §4`), D-2 (`2-trigger-list.md §3`)
- 근거: `1-data-model.md §2.9`/§2.9.1은 DB 컬럼·동기화 규칙만 기술하고(§5.4 자신이 "적용
  범위 — 응답 바디... 서버가 내보내는 표현"이라고 스코프를 명시) 응답 wire 형태를 다루지
  않는다 — 실측(`spec/1-data-model.md:260-291`)으로 확인. `3-schedule.md §4`/`2-trigger-list.md
  §3`은 각 화면의 API 엔드포인트를 기술하는 유일한 절이며, D-2가 삽입되는 자리는 이미
  `PATCH` 본문 형태를 설명하는 동종 blockquote 註 4개가 있는 바로 그 자리다(§3 기존 내용,
  `2-trigger-list.md:169-175`) — 구조적으로 이질적이지 않다. "DTO 전 필드 인벤토리를 옮기지
  않는다"는 초안의 자체 배제 규율도 선례(`#1303`/`8a2ad2f20`, §9.1 경계 결정)와 일치한다.
  → 위반 없음.

### [정보 확인 — 문제 없음] 신규 앵커 6개 전부 실재 (github-slugger 알고리즘으로 재현 검증)

- target 위치: D-1/D-2/D-3 이 도입하는 6개 링크
- 위반 규약: 없음 — 문서 가드(`spec-links.ts` `headingSlugs`/`slugify`, remark
  `mdast-util-from-markdown` + `github-slugger` 파이프라인, `spec-link-integrity.test.ts` 가
  `spec/**.md` 전수에 대해 이 알고리즘으로 DEAD/ANCHOR 0건을 강제)로 실측했다.
- 상세 (계산된 slug vs 초안이 쓴 앵커):

  | 링크 | 대상 heading 원문 | 계산된 slug | 초안 앵커 | 일치 |
  |---|---|---|---|---|
  | `../1-data-model.md#291-...` | `### 2.9.1 Trigger ↔ Schedule 동기화 규칙` | `291-trigger--schedule-동기화-규칙` | `291-trigger--schedule-동기화-규칙` | ✅ |
  | `../5-system/2-api-convention.md#54-...` | ``### 5.4 부재 표현 — `null` vs 키 생략`` | `54-부재-표현--null-vs-키-생략` | `54-부재-표현--null-vs-키-생략` | ✅ |
  | `../5-system/2-api-convention.md#검증-층-...` | `#### 검증 층 — 이 규칙을 무엇이 강제하는가` | `검증-층--이-규칙을-무엇이-강제하는가` | `검증-층--이-규칙을-무엇이-강제하는가` | ✅ |
  | `./2-trigger-list.md#3-api` | `## 3. API` (트리거 목록) | `3-api` | `3-api` | ✅ |
  | `./3-schedule.md#4-api` | `## 4. API` (스케줄) | `4-api` | `4-api` | ✅ |
  | `#3-api` (D-3, 같은 파일) | 위와 동일 | `3-api` | `3-api` | ✅ |

  각 대상 문서 전체에 대해 실제 `headingSlugs()` 로직(단일 `GithubSlugger` 인스턴스, 문서
  순서대로 slug 부여 — 중복 시 `-1`/`-2` 부여)을 그대로 재현해 **문서 전체 heading 목록**에서
  대조했고, 6개 슬러그 모두 **단일 발생**(중복 접미사 없음)으로 확인됐다. 프롬프트가 "틀린
  슬러그면 Critical" 이라 경고했지만, 실측 결과 **6개 전부 정확**하다 — 이 초안을 그대로
  적용해도 `spec-link-integrity.test.ts` 가드는 통과한다.

### [정보 확인 — 문제 없음] blockquote 안 GFM 표(D-1)는 이 저장소의 기존 관례이며 렌더 파이프라인이 지원한다

- target 위치: D-1의 2행 표 (`> | 필드 | 부재 표현 | 근거 |` 형태)
- 위반 규약: 없음 — 문서 마크다운 스타일을 규정하는 명시적 convention 파일은 `spec/conventions/**`
  에 없고(grep 결과 없음), 오히려 이 정확한 패턴("`> |...`" — blockquote 안에 GFM 표)이
  저장소 전역에 이미 최소 10곳 이상 존재한다: `spec/1-data-model.md:980-1002` (2곳),
  `spec/2-navigation/_layout.md:92-96`, `spec/3-workflow-editor/1-node-common.md:213-220`,
  `spec/4-nodes/5-data/2-code.md:353-357`, `spec/4-nodes/3-ai/1-ai-agent.md` (5곳),
  `spec/5-system/4-execution-engine.md:1114-1119`, `spec/5-system/6-websocket-protocol.md:551-`.
- 상세: 렌더 파이프라인은 `codebase/frontend/next.config.ts` 에서 `@next/mdx` +
  `remarkGfm` + `rehypeSlug` 로 구성돼 있다. `remark`/CommonMark 사양상 blockquote 는 컨테이너
  블록이라 내부 콘텐츠가 최상위와 동일한 블록 문법(표 포함, `remark-gfm` 활성 시)으로
  파싱된다 — 별도 예외 처리가 필요 없다. 이미 저장소에서 반복 사용 중인 검증된 패턴이므로
  이 초안이 새로운 위험을 들이는 것이 아니다.

### [정보 확인 — 문제 없음] 상대 링크 방향

- target 위치: D-1(`3-schedule.md`)·D-2(`2-trigger-list.md`) 전체
- 상세: 두 대상 파일 모두 `spec/2-navigation/` 안에 있다. `../5-system/2-api-convention.md`,
  `../1-data-model.md` 는 `spec/2-navigation/` → `spec/` → 목적지로 정확히 한 단계 상위
  이동이며 (`5-system/`·`1-data-model.md` 둘 다 `spec/` 직속), `./2-trigger-list.md`
  (D-1 안, `3-schedule.md`에서)와 `./3-schedule.md`(D-2 안, `2-trigger-list.md`에서)는
  같은 디렉터리 형제 파일 참조로 정확하다. D-3의 `#3-api`는 같은 파일(`2-trigger-list.md`)
  안이므로 상대 경로 자체가 필요 없는 것도 맞다. 방향 오류 없음.

### [정보 확인 — 문제 없음] D-3 데이터-출처 열 추가는 §2.1 자매 행 선례와 일치

- target 위치: `2-trigger-list.md §2.1` "연결된 워크플로우" 행
- 상세: 같은 표의 "인증" 행(`2-trigger-list.md:62`)이 이미 "데이터 출처: 목록 응답의
  `authConfigId`([§3 GET /api/triggers](#3-api))..." 형태를 쓰고 있어, D-3 이 제안하는
  "데이터 출처: 목록 응답의 `workflow.name`([§3](#3-api) — 키 생략형이고...)" 는 동일 패턴의
  반복이며 비대칭을 만들지 않는다. 체크리스트가 이미 "그 행은 단일 물리 라인이다(GFM
  표), 개행 없이 이어붙일 것"을 명시해 실제 적용 시 표 파손 위험도 인지하고 있다.

## 요약

이 초안이 `spec/`에 실제로 쓰는 6개 신규 앵커·2개 blockquote 註(하나는 註 안에 GFM 표
포함)·1개 표 셀 확장을 실제 문서 가드 알고리즘(remark 파싱 + github-slugger)으로 재현해
전수 대조한 결과, **앵커 6/6 전부 정확**하고(문서 가드 통과), 상대 링크 방향도 파일별로
전부 올바르며, blockquote 안 GFM 표는 이 저장소에 이미 10곳 이상 있는 검증된 패턴이라
신규 위험이 아니다. §5.4가 요구하는 "필드를 문서화하는 절에 사유 명시"도 D-1/D-2가
겨냥한 절(`3-schedule.md §4`, `2-trigger-list.md §3`)이 실제로 그 절의 유일한 후보이고
기존 blockquote 註 관례와도 구조적으로 맞는다. 유일한 지적은 INFO 등급 — (b) 기준의
서술이 DTO JSDoc의 원 근거보다 한 단계 강한 사실을 대되, "왜 그게 (b)를 만족하는가"를
잇는 한 문장이 스펙 텍스트 자체에는 빠져 있다는 점뿐이다. 정식 규약 위반은 발견되지
않았다.

## 위험도

NONE
