# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-doc-precision-batch-c.md`

## 검토 범위 및 방법

target 은 `spec/**` 5개 파일에 대한 정밀도 수정 5건(C-1~C-5)을 담은 planner draft다. 각 항목의
"변경안" 이 실제로 삽입될 자리(대상 spec 파일의 현재 본문)와 그 자리가 인용하는
`spec/conventions/**` 규약(특히 `spec-impl-evidence.md`, `swagger.md`, `secret-store.md`,
`review-citations.md`)을 대조했다. 참고: `spec-impl-evidence.md`·`swagger.md` 는 번들 프롬프트에서
컨텍스트 예산으로 절단되어 있어 저장소에서 직접 전문을 읽었다.

## 발견사항

- **[INFO]** C-4 의 `code:` glob 표기가 축약형이다 — 최종 반영 시 전체 경로로 펼쳐야 함
  - target 위치: C-4 "변경안" 표 (`…/fixtures/dto/responses/optional-nullable*.ts` 등)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의 — "레포 루트 기준
    상대경로"
  - 상세: draft 표의 항목이 `…/` 생략 표기를 쓴다(가독성을 위한 축약으로 보인다). 실제
    frontmatter 에 적용할 때는 `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable*.ts`
    처럼 레포 루트 기준 전체 경로여야 한다 — 실제로 해당 파일들이 그 경로에 존재함을 확인했다
    (`find codebase/backend/src/repo-guards/__tests__/fixtures/...`).
  - 제안: 이 자체는 plan 문서의 표기 관례(다른 항목들도 같은 축약을 쓴다 — 예: secret-store.md
    인용에서도 `···` 류 생략이 흔하다)라 draft 단계에서는 문제 아님. `--impl-done` 재검증
    체크리스트(이미 draft 에 있음: "등재 후 게이트에 다시 물어…확인")가 이 갭을 잡아줄 것이므로
    새 조치는 불필요 — 다만 실제 편집 시 전체 경로 사용을 재확인할 것.

- **[INFO]** C-4 신규 `code:` 항목에 준수-예시/대조군 구분을 표시하는 인라인 YAML 주석 선례 미언급
  - target 위치: C-4 "변경안" 표 전체
  - 위반 규약: 없음(강제 규정 아님) — `spec/conventions/review-citations.md` frontmatter 의
    실제 관행과 `spec-impl-evidence.md` §2.1 Rationale 이 권장하는 패턴
  - 상세: `review-citations.md` 는 이미 `code:` 리스트 안에 `# 준수 예시` / `# 시행 코드` 인라인
    YAML 주석으로 항목 성격을 구분해 두었고(2026-09-06 파서 수정 이후 안전하다고 명시), 이
    패턴이 저장소의 기존 관행이다. C-4 가 추가하는 항목들은 전부 "대조군(negative fixture)"
    성격인데, 이를 구분하는 주석 없이 기존 "가드 본체" 항목과 섞어 나열하면 다음 검토자가
    항목 성격(구현 vs 시행 vs 대조군)을 다시 추론해야 한다.
  - 제안: 강제 사항은 아니므로 필수 수정 요구는 아니지만, 실제 편집 시
    `# 대조군(negative fixture) — <가드 이름> 이 강제하는 위반 형태의 실례` 같은 인라인 주석을
    붙이면 review-citations.md 선례와 일관되고 가독성이 좋아진다.

- **[INFO]** C-4 가 `spec/2-navigation/**` 프론트매터에 `repo-guards/__tests__` 를 처음 들이는
  사례임
  - target 위치: C-4 표의 `2-navigation/2-trigger-list.md` 행
  - 위반 규약: 없음 — 오히려 규약이 요구하는 형태
  - 상세: 저장소 전수 확인 결과, 현재 `spec/2-navigation/**` 어떤 파일도 frontmatter `code:` 에
    `repo-guards/__tests__/*.ts` 를 등재하지 않고 있다(`spec/5-system/2-api-convention.md` 만
    선례 보유). C-4 의 근거(`3-error-handling.md §1.10` 이 스스로 "공용 카탈로그 가시성 등재" 라
    적고 SoT 를 `2-trigger-list.md` 로 명시 위임)는 실측 확인됐다(`3-error-handling.md:234` 원문
    대조). 첫 사례이긴 하나 `spec-impl-evidence.md` §2.1 의 "`code:` = 본 spec 이 약속한 surface 의
    구현 경로" 정의와 어긋나지 않는다 — 오히려 지금처럼 미등재 상태가 §2.1 이 경고하는 "넓은
    글롭으로 가드만 통과" 문제의 거울상(가드가 아예 링크되지 않아 래칫이 못 무는 상태)이다.
  - 제안: 그대로 진행. 별도 조치 불요.

## 검증한 사실관계 (규약 위반 아님으로 확인된 항목)

다음은 이 검토 관점에서 "규약 위반이 아님" 을 확인하기 위해 실측한 항목들이다 (다른 리뷰어의
정확도 검토와 중복될 수 있으나, 규약 준수 판정의 전제이므로 기록한다):

- C-1 대상(`1-data-model.md ## Rationale` 세 옵션 표)은 실제로 존재하며, draft 의 "채택 행
  하위 각주" 방식은 이미 같은 문서·`secret-store.md` 에서 쓰이는 "표 뒤 블록쿼트 부연" 패턴과
  형식이 같다 — 별도 규약 위반 없음. "별 행으로 넣지 않는 이유"(사후 이력 편집 방지)는
  `feedback_rationale_rejected_alternatives_need_history` 계열 원칙(날조된 기각 대안 금지)과
  방향이 같다 — 4번째 옵션을 "당시 고려됐던 대안" 인 것처럼 표에 끼워 넣지 않고 각주로 분리한
  것은 오히려 이 원칙을 지키는 선택이다.
- C-2 의 인용 앵커(`secret-store.md#1-uri-scheme`, `chat-channel.md#r-k-...`)는 대상 heading 이
  실재해 `spec-links` 가드를 통과할 형태다. `§1.1`(응답 노출 금지)을 재서술하지 않고 링크만
  거는 방식은 SoT 이중화를 피하는 이 저장소의 관행과 일치한다.
- C-3 의 `swagger.md` 앵커 불일치 지적은 실측대로다 — §1-3(`swagger.md:81-88`)엔
  `nullable`/키-생략 예시가 없고, 그 근거는 §1-4(`swagger.md:110-116`)에 있다. "§1-4 로
  전면 교체하지 않고 병기" 하는 이유(§1-3 은 `@ApiPropertyOptional` 표준 예시, §1-4 는
  `@ApiProperty({nullable:true})` 근거를 각각 담당)도 `swagger.md` §1-4 실제 서술과 부합한다.
- C-4 의 소유권 판단(`endpoint-path-conflict-wrap*` 은 `2-trigger-list.md` 단독 등재, 양쪽
  등재 아님)은 `3-error-handling.md:234` 의 명시적 SoT 위임 문구와 일치하고, `swagger-dto-contract*`/
  `user-entity-exposure*` 류가 `2-api-convention.md`+`swagger.md` 양쪽에 이미 등재된 기존
  패턴과도 구분된다(그 경우는 두 문서가 각각 다른 검증 축을 강제하므로 양쪽 등재가 맞다는
  전제가 실제 `2-api-convention.md` §검증-층 표에서 확인된다).
- C-4 의 glob 폭 경고("`-guard` 를 붙이면 1/2 만 덮는다")는 실제 파일명
  (`endpoint-path-conflict-wrap.spec.ts` / `endpoint-path-conflict-wrap-guard.ts`)과 대조해
  정확하다.
- C-4 가 `production-build-devdep-guard*` 를 등재 보류한 근거("이 저장소 어떤 spec 도
  `tsconfig.build.json`/`dist`/`devDependency` 를 언급하지 않는다")는 `spec-impl-evidence.md`
  §2.1 이 다루는 것은 "시행 코드 없는 문서형 convention" 뿐이고 그 반대(시행 코드는 있는데 소유
  spec 없음)는 다루지 않는다는 draft 의 지적이 맞다 — 억지로 소유자를 만들지 않고 트래커에
  택일 항목으로 미룬 것은 무리한 관할 확장을 피하는 보수적 선택으로, 규약 위반이 아니다.
- C-5 의 세 위치(`3-error-handling.md:265,284,475`)와 정본 UUID
  (`2-api-convention.md:175`, `12-webhook.md:302`, `GlobalExceptionFilter` 의 `uuidv4()`),
  그리고 EIA 문서의 `"3f2a…"` 를 건드리지 않는 근거(생략 표기이지 다른 형식이 아님)는 모두
  실측과 일치한다.

## 요약

target draft 는 정식 규약(특히 `spec-impl-evidence.md` 의 `code:` 필드 정의·소유권 모델,
`swagger.md` 의 §1-3/§1-4 역할 분리, `secret-store.md` 의 노출-금지 SoT 위임 방식)을 정확히
이해하고 그 틀 안에서 수정안을 설계했다. 특히 C-4 는 `spec-impl-evidence.md` 가 명시적으로
금지하는 "넓은 트리 글롭으로 가드만 통과시키는" 패턴을 스스로 발견해 좁은 파일 단위 glob 으로
교정하는 내용이라, 규약 준수 관점에서는 오히려 기존 위반을 닫는 조치다. CRITICAL/WARNING 급
위반은 발견되지 않았다. 위에 적은 INFO 3건은 모두 강제 규정이 아니거나(주석 관행), draft 자체의
표기 축약(경로 생략)에 대한 것으로 실제 편집 단계에서 자연히 해소될 사항이다.

## 위험도

NONE
