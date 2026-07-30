# 문서화(Documentation) 코드 리뷰 — workflow duplicate 결함 수정 + `/ai-review` fix 반영

대상: `WorkflowsService.duplicate()` 캔버스 전체 복제 재구현(선행 라운드) 및 그에 대한 `/ai-review`
(`review/code/2026/07/30/17_54_27/`) Warning 7건 + 요청 INFO 3건 fix 반영분. 코드 4개 파일
(`workflows.controller.ts`/`workflows.service.ts`/`workflows.service.spec.ts`/`workflow-crud.e2e-spec.ts`),
사용자 문서 2개(`ui-tour.mdx`/`.en.mdx`), `CHANGELOG.md`, `plan/in-progress/workflow-duplicate-nodes-edges.md`,
그리고 선행 리뷰·consistency-check 산출물(`review/code/2026/07/30/17_54_27/**`,
`review/consistency/2026/07/30/{16_45_59,17_03_26}/**`) 및 `spec/2-navigation/1-workflow-list.md`·
`spec/data-flow/11-workflow.md` 를 모두 직접 `Read`/`git show`/실행으로 대조했다.

## 발견사항

- **[WARNING]** 리뷰 산출물(`RESOLUTION.md`)의 단위 테스트 개수 주장이 사실과 다름 — "137/137" 은
  대상 파일 단독 수치가 아니라 5개 파일을 합친 수치
  - 위치: `review/code/2026/07/30/17_54_27/RESOLUTION.md:74-76` ("unit : 통과 — ... `workflows.service.spec.ts` 단독 137/137."),
    같은 파일 `:54-56` ("반영 후 76/76(→137/137, WARNING #5 fixture 포함 후) 그대로 통과")
  - 상세: 직접 실행해 확인했다.
    ```
    $ npx jest workflows.service.spec.ts --runInBand
    Tests: 77 passed, 77 total

    $ npx jest workflows --runInBand   # 경로에 "workflows" 를 포함하는 5개 파일 전부 매칭
    Test Suites: 5 passed, 5 total   (workflows.service.spec.ts, workflows.controller.spec.ts,
                                       workflow-dto-validation.spec.ts, workflow-channel-authorizer.spec.ts,
                                       workflow-ownership.util.spec.ts)
    Tests: 137 passed, 137 total
    ```
    즉 `workflows.service.spec.ts` 단독 실제 테스트 수는 77건이고, "137" 은 `npx jest workflows`(substring
    매칭)로 5개 파일을 한꺼번에 돌린 합산치다. `git show 0cb0ac86d:.../workflows.service.spec.ts | grep -c
    "it("` = 76, `git show e782bb829:...` = 77 — WARNING #2 커밋 시점 76개 → WARNING #5(source-missing
    fixture 1건 추가) 이후 77개로, 실제 진행은 "76→77" 이지 "76→137" 이 아니다. RESOLUTION.md 본문은 같은
    문장 안에서 "76/76" 은 정확히 쓰고 바로 이어 "137/137" 로 건너뛰어, 서로 다른 스코프(단일 파일 vs
    5파일 합산)의 숫자를 마치 같은 대상의 연속된 진행처럼 서술한다. 같은 오기재가 커밋 메시지에도
    전파됐다 — `e6c6322f4`("style(backend): SUMMARY#2 후속 — prettier 포맷 오류 수정")의 본문이 "동작
    변경 없음 (137/137 유지)." 라고 적어, 이 세션 안에서 최소 3곳(RESOLUTION.md 2곳 + 커밋 메시지 1곳)에
    같은 부정확한 수치가 반복 기록됐다. 실질 회귀·기능 결함은 아니다(실제로 77/77·137/137 둘 다 그
    자체로는 전부 통과) — 다만 "이 파일 단독으로 137건을 검증했다"는 서술은 실측과 어긋나는 근거 부풀림이고,
    이런 review 산출물은 CLAUDE.md 상 영구 보관되는 감사 기록(`review/code/**`)이라 향후 이 changeset 의
    테스트 커버리지를 판단하는 근거로 재인용될 수 있다.
  - 제안: `RESOLUTION.md` 의 두 지점을 "`workflows.service.spec.ts` 단독 77/77(WARNING #5 fixture 포함,
    76→77)" 로 정정. `npx jest workflows`(5파일 합산 137) 를 인용하고 싶다면 "workflows 접두 파일군 5개
    합산 137/137" 처럼 스코프를 명시할 것. 커밋 메시지(`e6c6322f4`)는 이미 푸시된 이력이라 되돌려 고치지
    않아도 되나, 향후 유사 수치 인용 시 참고하지 않도록 유의.

## 검증했으나 문제 없음 (직접 대조 확인)

- **CHANGELOG.md 신규 항목** (`CHANGELOG.md:3-18`): 선행 라운드가 지적한 WARNING(누락)이 `8783c63d8` 로
  해소됐다. "캔버스 전체 복제로 재구현"·"REPEATABLE READ 로 read skew 차단" 두 항목이 실제 구현
  (`workflows.service.ts:228-333`, `dataSource.transaction('REPEATABLE READ', ...)`)과 line-level 로
  정확히 일치하고, 기존 항목들과 같은 포맷(`## Unreleased — <제목>` → 번호 목록 → `SoT:`/`추적:` 각주)을
  따른다.
- **Swagger `@ApiOperation.description`** (`workflows.controller.ts:212-216`): "노드·엣지를 포함한 캔버스
  전체" 문구가 실제 구현(UUID 재발급·재매핑, 버전/트리거/데이터셋/실행이력 비승계)과 정확히 일치.
- **`duplicate()` JSDoc + 인라인 주석 3중 교차참조** (`workflows.service.ts:216-227`, `:236-244`, `:270-280`,
  `:284-288`, `:307-308`): 이번 fix(`6d3595319`)가 추가한 "Node/Edge 필드 집합 3중 중복 지점 N/3" 주석이
  `duplicate()`(1/3) ↔ `importWorkflow()`(2/3, `:429`/`:483`) ↔ `syncNodes`/`syncEdges`(3/3, `:971`/`:1013`)
  세 지점 모두에서 서로를 정확히 가리키도록 `git show 6d3595319` 로 직접 대조 — 상호참조 불일치 없음.
  `remap()` null 방어 사유 주석(INFO#7)·"본 파일 하단" → "`workflows.service.spec.ts` 의 W3c 가드"로 구체화
  (INFO#4)·W3c describe 제목 확장(INFO#5) 모두 실제 커밋 diff 와 일치.
- **`ui-tour.mdx`/`ui-tour.en.mdx`** (`:97`/`:86`): 선행 라운드 WARNING(`user_guide_sync` #7)이
  `e66bbb9c1` 로 해소됨. 두 언어 버전이 "캔버스 전체 복사 / 버전 기록·트리거(웹훅·스케줄) 설정은 새로
  시작" 을 정확히 대응 번역으로 담고 있어 ko/en 불일치 없음. 캔버스 내 "Ctrl+D 노드 복제"(에디터 로컬 복제)
  언급과는 문맥·엔드포인트가 명확히 분리돼 있어 혼동 소지 없음.
- **`workflow-crud.e2e-spec.ts` 의 `buildFiveNodeGraphPayload()` 헬퍼** (`:26-106`, WARNING#4 fix):
  추출된 헬퍼에 "왜 container 축과 toolOwner 축을 다른 노드로 나눴는지·왜 노드 id 가 UUID 여야 하는지"를
  설명하는 JSDoc 이 있고, 이를 소비하는 `it('C. ...')` 케이스(`:226-333`)의 인라인 주석도 각 단언 그룹의
  근거를 정확히 설명한다.
- **`plan/in-progress/workflow-duplicate-nodes-edges.md`**: 체크리스트·Rationale 이관 서술이 실제
  spec 변경(`spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`)과 실제 커밋 순서
  (`f71839fe6`→`0502e43c7`→`13b818ec5`→`539bbf7fd`, 이어서 이번 라운드 fix 커밋들)에 정확히 대응.
- **선행 라운드 문서화 findings 재확인**: `review/code/2026/07/30/17_54_27/documentation.md`(선행
  documentation 리뷰, WARNING 1건=CHANGELOG 누락·INFO 3건)의 WARNING 은 이번 라운드에서 해소, INFO 중
  요청받은 2건(주석 위치·discoverability)도 해소. 나머지 INFO 2건(JSDoc `trigger` 가 spec 의
  "`trigger`(webhook/schedule)" 명확화를 미러링하지 않음, Swagger 설명 237자)은 `RESOLUTION.md` 의
  "보류·후속 항목"에 의도적 미반영으로 명시돼 있고 실제 코드도 그 상태 그대로 — 문서와 실제가 일치하므로
  새로운 결함 아님(요청 범위 밖 선택적 항목).

## 요약

이번 diff 의 실제 애플리케이션 코드·사용자 문서(CHANGELOG, Swagger, JSDoc, ko/en ui-tour, 3중 교차참조
주석, plan/spec)는 전부 실측 대조 결과 정확하고 상호 일치하며, 선행 `/ai-review` 라운드가 남긴 문서화
WARNING·요청 INFO 는 전부 올바르게 해소됐다. 유일한 결함은 코드가 아니라 이번 fix 세션이 남긴 감사
기록(`review/code/2026/07/30/17_54_27/RESOLUTION.md`) 안의 테스트 개수 주장이다 — "`workflows.service.spec.ts`
단독 137/137" 은 실제로 `npx jest workflows.service.spec.ts` 를 실행하면 77/77이며, 137은 파일명에
"workflows" 를 포함하는 5개 무관 파일을 합산한 수치였다(직접 실행으로 재현·확인). 같은 부정확한 수치가
RESOLUTION.md 내 2곳 + 커밋 메시지(`e6c6322f4`) 1곳까지 총 3곳에 전파됐다. 기능적 회귀나 실제 테스트
누락은 아니지만(두 수치 모두 그 자체로는 사실상 전부 통과), 영구 보관되는 리뷰 감사 기록의 근거
정확성 문제이므로 WARNING 으로 기록한다.

## 위험도

LOW
