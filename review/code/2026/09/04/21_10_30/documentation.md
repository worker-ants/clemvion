# 문서화(Documentation) 코드 리뷰

## 검토 방법

이번 changeset(`origin/main...HEAD`, 브랜치 `claude/passthrough-dto-verifier`, HEAD `9ba0991c8`)은
실질 변경 6개 파일(`CHANGELOG.md`, `alert-rule-response.dto.ts`, `swagger-dto-contract-guard.ts`,
`swagger-dto-contract.spec.ts`, `alerts-threshold-wire-type.e2e-spec.ts`,
`spec-draft-nullable-notation-followups.md`)과, 이미 이 changeset 안에서 3차례(코드 리뷰
`19_43_18`→`20_16_17`→`20_39_25`, consistency-check `20_05_42`) 검토·수정을 거친 review 산출물
46개로 구성된다. 앞선 두 라운드의 `documentation.md` 는 모두 위험도 **NONE** 으로 수렴했고,
그 조치 이력(`RESOLUTION.md`)이 CHANGELOG·JSDoc·plan 문서에 실제로 반영되었는지 이번에도
소스를 직접 열어(`Read`/`grep`/`git diff`, 저장소 뮤테이션 없음) 재검증했다.

## 재검증 결과 (기존 WARNING 전부 재확인)

- `CHANGELOG.md` 신규 항목 — `list`/`create`/`update` 세 응답 모두 언급, `**영향**:` codegen
  캐비엇 포함, 라우트 `GET /api/alerts`(정확, `/rules` 아님) — `19_43_18` W2/W3, `20_05_42` INFO#2
  전부 반영 확인.
- `alert-rule-response.dto.ts` — JSDoc 이 "지금 무엇을 지켜야 하는가"만 남기고 정정 경위는
  CHANGELOG 로 위임됨(`dc83c0312`, `20_05_42` W1 반영). `nest-cli.json` 의 `@nestjs/swagger`
  플러그인이 JSDoc 을 공개 `description` 으로 내보낸다는 경고 주석도 존재.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 분류표 — `46+6+4+3=59` 로
  합계가 본문 수치와 일치(`19_43_18` W4 반영 확인).
- `swagger-dto-contract-guard.ts`/`.spec.ts` — 신규 함수(`findNumericAsNumber`,
  `scanNumericExposure`, `readColumnType`, `readOption<T>`) 전부 "왜 이 축인가"·"왜 전수 대조가
  아닌가"·"알려진 한계(`<Entity>Dto` 이름 관례)"를 docstring 에 명시하고, 라운드 ID 인용
  (`20_16_17 W1`, `20_39_25 W1/W3`)도 대응하는 SUMMARY.md 의 실제 W-번호와 일치함을 대조 확인.

## 발견사항

- **[WARNING]** plan 문서 삽입으로 기존 "2단계" 항목의 하위 서술이 무관한 "Float 라벨링" 항목 아래로 재부모화(re-parent)됐다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:270`-`333`
    (신규 삽입 `- [ ] spec/conventions/swagger.md ...`: `282`-`286`, `- [ ] spec/1-data-model.md:873
    ... Float 라벨링`: `287`-`320`; 기존 내용 재부모화 구간: `322`-`333`)
  - 상세: 원본 문서에서 "`§5.4 drift 배치 — 2단계`" 불릿 하나가 `(a)/(b)` 옵션 서술 →
    `**ExecutionDto 는 형태가 조금 다르다**` → `**ExecutionDto 에는 스키마-레벨 테스트가 아예
    없다**` → `**"엔티티라 키가 항상 있다" 는 논거는...**` 순으로 전부 같은 6-space 들여쓰기의
    **하나의 연속된 continuation** 이었다(`git diff` 로 확인: 이 부분은 diff 밖의 순수 컨텍스트).
    이번 diff 가 `(a)/(b)` 서술 직후, 그 continuation 이 끝나기 **전에** 두 개의 새 최상위
    불릿(`- [ ] spec/conventions/swagger.md ...`, `- [ ] spec/1-data-model.md:873 ... Float
    라벨링`)을 끼워 넣고, 그중 두 번째("Float 라벨링") 불릿 아래에 "왜 (a) 가 안 되는가"라는
    신규 대형 블록(23개 필드 전수 대조 표 2개 포함, `291`-`320`)을 추가했다. 그 결과 마크다운
    파서(및 사람이 들여쓰기로 구조를 읽을 때) 관점에서 다음이 벌어진다.
    1. "(b) ... **아래 참조**"(`271`)가 가리키는 "아래" 내용("(a) 가 왜 안 되는가" 블록)이 같은
       불릿이 아니라 **두 개의 무관한 불릿을 건너뛴 뒤, 심지어 그 불릿과도 다른 "Float 라벨링"
       불릿의 하위 내용**으로 옮겨 붙었다.
    2. 기존 콘텐츠였던 `**ExecutionDto 는 형태가 조금 다르다**`(`322`) 이하 세 문단은 diff 로
       손대지 않았음에도, 새로 삽입된 두 불릿 때문에 이제 "Float 라벨링" 불릿의 continuation
       처럼 보인다 — `ExecutionDto` 노출 경로 이야기가 `threshold` 의 `Float` 라벨링과는
       아무 관계가 없다.
    체크리스트를 들여쓰기로 훑는 향후 작업자(§5.4 2단계 착수자)가 "Float 라벨링" 항목을 읽다가
    `ExecutionDto` 노출 경로·스키마 테스트 부재 같은 실질적으로 "2단계" 항목에 속하는 정보를
    만나 혼동하거나, 반대로 "2단계" 항목만 보고 그 항목에 딸려 있던 것으로 오인된 상세 근거를
    놓칠 수 있다.
  - 제안: 새로 삽입하는 두 불릿(`spec/conventions/swagger.md` 성문화, `spec/1-data-model.md:873`
    Float 라벨링)을 "2단계" 불릿의 **continuation 전체가 끝난 뒤**(`엔티티라 키가 항상 있다...`
    문단 다음)로 옮기거나, "(a) 가 왜 안 되는가" 블록을 "2단계" 불릿의 `(a)` 서술 바로 아래
    (`"아래 참조"` 가 실제로 가리키는 자리)로 옮긴다. 최소한 "(a) 가 왜 안 되는가" 블록 제목에
    "(§5.4 2단계 참고)" 같은 명시적 역참조를 달아, 어느 불릿에 속한 근거인지 헷갈리지 않게 한다.

## 요약

핵심 코드/문서 변경(`AlertRuleDto.threshold` wire 타입 정정, CHANGELOG, 신규 repo-guard 축,
e2e 회귀 테스트)은 세 차례의 선행 리뷰 라운드가 지적한 WARNING(영향범위 축소 서술·codegen 영향
누락·산술 불일치·정규식→AST·경로 정규화·런타임 계약 테스트 부재)이 전부 소스 레벨에서 반영됨을
재확인했고, 새로운 결함은 없었다. 다만 이번 라운드에서 처음으로, `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 새 후속 항목 두 개를 끼워 넣는 과정에서 기존
"§5.4 2단계" 항목의 continuation 이 관계없는 "Float 라벨링" 항목 아래로 구조적으로 재부모화된
것을 발견했다 — 내용 자체(사실관계·수치)는 정확하지만, 어느 체크리스트 항목에 속한 근거인지가
마크다운 들여쓰기상 잘못 표시되어 향후 이 plan 을 근거로 §5.4 2단계에 착수할 사람을 혼동시킬
수 있다. 코드 파일(DTO·가드·e2e) 자체의 문서화 품질은 이번 라운드에서도 결함을 찾지 못했다.

## 위험도

LOW
