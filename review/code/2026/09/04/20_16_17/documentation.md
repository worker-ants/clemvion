# 문서화(Documentation) 코드 리뷰

## 검토 방법 메모

이번 changeset(26개 파일)은 크게 두 종류로 나뉜다.

1. **실질 변경 5개** — `CHANGELOG.md`, `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`,
   신규 가드 `swagger-dto-contract-guard.ts`/`swagger-dto-contract.spec.ts`,
   `plan/in-progress/spec-draft-nullable-notation-followups.md`. `git log`/`git diff --stat origin/main...HEAD` 로
   확인한 결과 이 5개 파일의 diff 는 세 커밋(`a65a4f85e` fix → `5a7de8ab1` test →
   `dc83c0312` docs)이 **누적된 최종 상태**다.
2. **과거 리뷰 산출물 21개** — `review/code/2026/09/04/19_43_18/*`(코드 리뷰 8명분)와
   `review/consistency/2026/09/04/20_05_42/*`(consistency 5개 checker 분)가 이번 브랜치에
   신규 파일로 커밋되어 diff 에 포함되어 있다. 즉 이번 changeset 은 **"결함 발견 → 수정 →
   그 수정에 대한 재검토 → 재수정"** 두 라운드가 이미 끝난 뒤의 기록이다.

따라서 이번 리뷰의 실질 작업은 (a) 과거 두 라운드가 지적한 문서화 관련 WARNING/INFO 가
파일 1~5 의 **현재 상태에 정말 반영됐는지 소스 대조로 재확인**하는 것과, (b) 두 라운드가
놓쳤을 수 있는 새 문서화 결함을 찾는 것이다. 저장소 뮤테이션 없이 `Read`/`grep`/`git`
읽기 명령만 사용했다.

## 재확인 결과 (과거 지적 → 현재 상태)

직접 소스를 열어 대조했다 —

| 과거 라운드 지적 | 현재 상태 확인 |
|---|---|
| (`19_43_18` W2) CHANGELOG/JSDoc 이 `list()` 만 언급, `create`/`update` 누락 | `CHANGELOG.md` "왜 아무도 몰랐나" 절이 "`list`·`create`·`update` 세 응답 모두"로 정정됨 — 확인 |
| (`19_43_18` W3) CHANGELOG 에 codegen 영향(`**영향**:`) 문단 누락 | `CHANGELOG.md` 에 "**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서…" 문단 추가됨 — 확인 |
| (`19_43_18` W4) plan 문서 "불일치 59건" 서술과 분류 표 합계(57) 불일치 | `plan/.../spec-draft-nullable-notation-followups.md` 표가 `46+6+4+3=59` 로 정정되고, 원래 마지막 행이 "판정 결과"였지 "버킷 크기"가 아니었다는 원인 설명까지 추가됨 — 확인 |
| (`19_43_18` W1) 이 결함을 되잡을 회귀 테스트 부재 | `findNumericAsNumber` 신규 축 + 3방향 대조군(`swagger-dto-contract.spec.ts`)이 추가됨 — 확인 |
| (`20_05_42` W1) DTO JSDoc 의 내부 서사가 `@nestjs/swagger` 플러그인을 통해 공개 OpenAPI `description` 으로 노출 | JSDoc 이 "임계값. 문자열로 내려간다…" 2문장으로 축약되고, 경위는 비-JSDoc(`//`) 주석 + CHANGELOG 로 이동됨 — 확인. `//` 라인 주석은 JSDoc(`/** */`) 이 아니므로 CLI 플러그인 introspection 대상에서 제외되는 것으로 판단(이전 라운드가 `nest-cli.json` plugin 활성 확인 후 내린 구조적 결정과 일치) |
| (`20_05_42` INFO#2 / `19_43_18` api_contract·documentation·testing.md 의 `/api/alerts/rules` 표기) CHANGELOG 라우트 오기 | `alerts.controller.ts` 를 직접 확인(`@Controller('alerts')` + `@Get()`, global prefix `api`) — 실제 라우트는 `GET /api/alerts` 이며, 현재 `CHANGELOG.md`·`plan/...followups.md` 양쪽 모두 `/api/alerts` 로 정확히 표기됨. **주의**: `review/code/2026/09/04/19_43_18/{api_contract,documentation,testing}.md`·`SUMMARY.md`·`RESOLUTION.md` 등 **과거 라운드의 산출물 스냅샷**에는 여전히 잘못된 `/api/alerts/rules` 가 남아 있다 — 그러나 이는 그 시점의 기록을 보존하는 것이 이 저장소의 관례(리뷰 산출물은 사후 수정 대상이 아님)이고, 실제 오류는 `20_05_42` W1 라운드가 이미 "내 오기다" 로 인지·정정했으므로 **새 결함으로 보고하지 않는다** |
| (`20_05_42` W2) numeric 불변식이 가드로만 강제되고 `spec/conventions/swagger.md` 에 미규약화 | `plan/...followups.md` 에 "planner, `20_05_42` W2" 로 정확히 등재됨(developer 권한 밖, `spec/` 쓰기는 planner 트랙) — 확인, 조치 불요 |
| (`19_43_18` INFO#6 / `20_05_42` INFO#1·#3) `spec/1-data-model.md:873` `threshold` 를 `Float` 로 라벨링 | `spec/1-data-model.md:873` 실측(`| threshold | Float | 임계치 (DB 는 NUMERIC(12,4) 고정소수) |`) — `plan/...followups.md` 에 "planner, `19_43_18` INFO#6" 로 정확히 등재됨 — 확인, 조치 불요 |

이번 diff 의 5개 실질 변경 파일 자체에서는 **새로운 문서화 결함을 발견하지 못했다.**
CHANGELOG 서술, DTO JSDoc, 신규 가드/테스트의 JSDoc, plan 문서 갱신 모두 실제 코드(엔티티·
컨트롤러·서비스·프런트엔드)와 대조해 정확했고, 두 차례의 리뷰가 지적한 항목은 전부 소스
레벨에서 반영이 확인됐다.

## 발견사항

- **[INFO]** 소스 코드 주석에 내부 리뷰 라운드 ID(`--impl-done 20_05_42`, `19_43_18 INFO#5` 등)를
  직접 인용하는 것이 이 저장소의 관례로 보인다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` 20~23행
    (`// ... (`--impl-done 20_05_42` W1).`), `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (`19_43_18 INFO#5`, `20_05_42 W2` 등 다수)
  - 상세: `review/` 산출물이 gitignore 되지 않고 커밋되어 보존되므로(이 저장소의 명시적 관례),
    이 인용은 git 이력을 통해 항상 역추적 가능하다는 점에서 결함은 아니다. 다만 리뷰 세션
    디렉터리명(`HH_MM_SS` 타임스탬프)은 그 자체로는 의미가 없는 식별자라, 코드만 읽는(리뷰
    이력에 접근하지 않는) 독자에게는 "왜 이 형태인가"의 설명력이 떨어질 수 있다. 이미 같은
    주석이 "경위는 CHANGELOG 에 있다"고 명시하므로 실질적 추적 경로는 이중으로 확보되어 있어
    영향은 작다.
  - 제안: 조치 불요(관례 준수). 향후 이런 참조가 대량으로 누적되면 CHANGELOG/plan 쪽 링크만
    남기고 소스 주석에서는 라운드 ID 인용을 생략하는 것도 고려할 만하다.

- **[INFO]** 리뷰 중 워킹트리에서 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  가 순간적으로 `git status`상 `M`(수정됨)으로 나타났다가 재확인 시 사라짐(clean)을 관측했다
  - 위치: 저장소 워킹트리 전역(`git status --short`)
  - 상세: 이 reviewer 는 해당 파일에 어떤 Write/Edit 도 수행하지 않았다(Read/grep/git 만 사용).
    프롬프트가 경고한 대로 "지금 이 순간 다른 reviewer 들이 같은 워킹트리를 동시에 읽고
    있다"는 병렬 fan-out 상황에서 다른 reviewer 의 일시적 뮤테이션-후-원복으로 추정된다.
    재확인 시점(`git status --short`)에는 `review/code/2026/09/04/20_16_17/`(이 세션 산출물
    디렉터리) 외에 아무 변경도 없었다.
  - 제안: 조치 불요 — 자기 원인이 아니며 관측 시점에 이미 clean. 참고용으로 보고한다(프롬프트의
    "관측한 이상 상태는 그대로 보고" 지침에 따름).

## 요약

이번 changeset 은 `AlertRuleDto.threshold` 의 OpenAPI 문서(`number`)가 실제 wire(`string`)와
어긋났던 결함을 정정한 fix(`a65a4f85e`) + 회귀 방지 가드/테스트(`5a7de8ab1`) + JSDoc 공개
노출 범위 축소(`dc83c0312`) 세 커밋의 누적 diff이며, 이미 코드 리뷰 1라운드(8명)와 consistency
check 1라운드(5개 checker)를 거쳐 발견된 문서화 WARNING 4건·INFO 다수가 전부 소스 레벨에서
정정된 것을 이번 라운드에서 직접 대조 확인했다: CHANGELOG 의 영향 범위 서술(list만→list/
create/update 3곳)·codegen 영향(`**영향**:`) 문단·plan 문서의 산술 불일치(59 vs 57)·CHANGELOG
라우트 오기(`/api/alerts/rules` → `/api/alerts`)·DTO JSDoc 의 공개 OpenAPI description 노출
범위(16줄 서사 → 2문장 요약 + 별도 `//` 경고 주석)가 모두 실제 파일에 반영돼 있었다. 남은
문서화 부채(swagger.md 의 numeric 불변식 미성문화, `1-data-model.md:873` 의 `Float` 오표기)는
developer 권한 밖(`spec/` 쓰기는 planner 트랙)이라는 이유로 정확히 plan 에 등재된 채 유예되어
있어 이 자체는 결함이 아니다. 이번 diff 5개 실질 파일에서 새로운 문서화 결함은 발견하지
못했다.

## 위험도

NONE
