# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-error-cause-criterion.md`

## 검토 개요

target 은 `#1219`/`#1226` 후속으로 `catch` 에러 wrapping 시 `{ cause: err }` 부착 여부의
판별 기준을 `spec/5-system/3-error-handling.md` §6.3 아래 §6.3.1 로 신설하자는 project-planner
spec draft 다. `spec/conventions/**` 번들 중 전문이 로드된 3개 문서(`error-codes.md`,
`secret-store.md`, `audit-actions.md`)와 target 이 실제로 건드리는 대상 파일
(`spec/5-system/3-error-handling.md`, `spec/conventions/node-output.md`)을 직접 열어 교차
검증했다. 나머지 269개 conventions 파일(swagger.md·node-output.md 포함, 본문은 절단됨)은
컨텍스트 예산 초과로 생략돼 있었으나, `node-output.md` §3.2 는 target 판단에 직결돼 별도로
전문을 확인했다.

## 발견사항

- **[WARNING]** 신설 §6.3.1 의 배치가 대상 섹션(§6 "로깅 정책")이 스스로 선언한 범위와 어긋난다
  - target 위치: "## 제안 — `spec/5-system/3-error-handling.md` §6.3 에 소절 신설" 섹션 전체
  - 위반 규약: 직접적인 `spec/conventions/*` 항목 위반은 아니다. CLAUDE.md 의 "결정의 배경·근거는
    해당 spec 문서 Rationale, 기술 명세는 본문" 원칙과, `error-codes.md` Overview 가 보여주는
    "각 문서/섹션이 자신의 소유 범위를 명시하고 그 밖은 재선언하지 않는다" 는 정식 관행(§0)과의
    정합성 문제
  - 상세: `spec/5-system/3-error-handling.md` 의 Overview 는 "§6 = 로깅 레벨·민감정보 마스킹"
    으로 범위를 명시하고, 실측한 §6.3 본문도 "로그에 다음 정보가 포함되지 않도록 자동 마스킹" +
    API Key/Bearer Token/OAuth 토큰/PII 나열로 스코프를 **로그 출력**에 고정한다. 반면 target 의
    draft 가 "왜 이 기준이 필요한가" 에서 제시하는 위험 근거는 "노드 에러는 **Activity API** 를
    통해 사용자에게 노출되므로" — 이는 §2(에러 응답 형식)/`node-output.md` §3.2(`output.error`
    wire shape) 레이어의 노출 경로이지 로그 마스킹 레이어가 아니다. target 의 "왜
    `spec/conventions/` 가 아니라 여기인가" 절은 `secret-store.md`·`error-codes.md` 두 대안만
    검토했고, **같은 파일 안의 더 근접한 대안인 §2(에러 응답 형식)** 는 검토 대상에 없었다.
    §6.3 문언을 그대로 읽으면 "로그 마스킹 규칙" 으로 좁게 해석되어, 정작 draft 가 막으려는
    API-표면 노출 케이스에는 이 절이 적용되지 않는다고 오독될 여지가 있다.
    (참고로 `node-output.md` §3.2 를 직접 확인한 결과 `output.error` 표준 형태는
    `code`/`message`/`details` 세 필드로 고정돼 있어 `cause` 가 낄 자리가 구조적으로 없다 — 이
    사실은 draft 의 "0곳 직렬화" 실측을 구조적으로 뒷받침하는 강한 근거인데, draft 는 이를
    인용하지 않고 `http-exception.filter.ts` 확인만 근거로 든다.)
  - 제안: (a) 신설 §6.3.1 서두에 "본 절은 로그 마스킹이 아니라 `Error` 생성 시점의 wrapping
    정책이며, 향후 어떤 직렬화 경로(로그·응답 envelope·node output)에도 적용되는 원칙"이라는
    scope 명시 문장을 추가하거나, (b) §2(에러 응답 형식)에도 짧은 상호 참조를 걸어 두 섹션
    어느 쪽에서 찾아도 착지하게 한다. 아울러 "0곳 직렬화" 실측 근거에 `node-output.md §3.2` 의
    구조적 배제(스키마에 `cause` 필드 부재)를 함께 인용하면 근거가 `http-exception.filter.ts`
    단일 지점 확인보다 견고해진다. — 이는 규약 위반이라기보다 draft 완성도 제고 제안이며, 이후
    실제 spec 반영 시 반영 여부는 project-planner 판단.

- **[INFO]** 중첩 backtick 마크다운 렌더링 결함
  - target 위치: "## 제안" 섹션 첫 문장 — `` §6.3(민감 정보 마스킹) 아래에 `#### 6.3.1 에러 wrapping 시 `cause` 부착 기준` 을 넣는다. ``
  - 위반 규약: 없음 (문서 포맷 일관성 사소 지적)
  - 상세: 백틱 4개가 소스 순서대로 짝지어져 `` `#### 6.3.1 에러 wrapping 시 ` `` / `` `cause` `` / `` ` 부착 기준` `` 세 span 으로 쪼개지면서, 가운데 "cause" 만 코드서식에서 빠지고 "####" 마크가 그대로 코드 텍스트로 노출되는 렌더링 결함이 생긴다.
  - 제안: 인용 전체를 단일 backtick 쌍으로 감싸거나, 실제 삽입될 heading 텍스트를 별도 코드펜스(```)로 옮겨 중첩을 피한다.

- **[INFO]** 이번 검토의 커버리지 한계 고지 (기지 harness 이슈, 신규 아님)
  - target 위치: 전체 (conventions 번들)
  - 상세: 이번 번들은 conventions 파일 272개 중 269개(`swagger.md`, `node-output.md` 포함)가
    "컨텍스트 예산 초과" 로 본문이 생략된 상태로 조립됐다 — 이는 이미 알려진 harness 특성
    (`--spec` 모드 기본 예산이 conventions 를 대거 드롭)이며 이번 target 이 새로 일으킨 문제는
    아니다. `node-output.md` §3.2 는 target 판단에 직결돼 파일시스템에서 직접 열어 별도
    확인했으나, 그 밖의 API 문서(swagger) 관련 관점은 이번 번들만으로는 검증되지 않았다. target
    자체가 DTO/swagger 데코레이터를 건드리지 않으므로 실질 영향은 낮다.
  - 제안: 없음 (기존 harness 개선 트래킹 대상 — 이번 target 리뷰의 결론에는 영향 없음).

## 명명/frontmatter 규약 — 이상 없음 (참고)

- `spec_impact` 가 YAML 리스트 형식(`- spec/5-system/3-error-handling.md`)으로 선언돼 있어
  Gate C 스키마(리스트 또는 `none`, bare string/빈 배열 금지) 를 충족한다.
- `worktree`/`started`/`owner` 3필수 필드 모두 존재, `owner: project-planner` 는 skill 표(“`spec/`
  변경 → project-planner”) 와 일치.
- `priority: P3` 는 저장소 내 기존 in-progress plan 들의 실사용 값(P1/P2/P3)과 동일 체계.
- 신설 heading 깊이(`#### 6.3.1`, `### 6.3` 하위)는 같은 파일에 이미 존재하는
  `#### 1.2.1`(`### 1.2` 하위) 패턴과 동일해 heading depth 컨벤션에 부합.
- draft 의 "왜 `spec/conventions/`가 아니라 여기인가" 판단(=`secret-store.md`·`error-codes.md`
  제외)은 두 문서의 Overview 가 스스로 선언한 소유 범위(각각 "secret 저장 추상화", "에러 코드
  명명·안정성")와 대조했을 때 정확하다 — 두 문서 모두 `cause` wrapping 정책을 다루지 않는다.

## 요약

target 이 새로 발행하는 identifier(에러 코드·API endpoint·DTO 등)는 없고, 검토 결과
`spec/conventions/error-codes.md`·`secret-store.md`·`audit-actions.md` 어느 것도 이 draft 와
직접 충돌하지 않는다. frontmatter·heading depth·Gate C 스키마 등 CLAUDE.md 의 명명·구조
컨벤션도 준수한다. 다만 신설 §6.3.1 을 §6("로깅 정책"이라고 스스로 선언한 섹션) 아래 두면서
정작 그 필요성 근거는 API 노출(§2 레이어)에서 끌어오는 스코프 불일치가 있어, 이후 이 절을 읽는
사람이 "로그에만 적용되는 규칙" 으로 오인할 여지가 있다 — WARNING 으로 기록하되 project-planner
가 실제 spec 반영 단계에서 scope 명시 문장 한두 줄로 쉽게 해소 가능한 수준이다. CRITICAL 은
없다.

## 위험도

LOW
